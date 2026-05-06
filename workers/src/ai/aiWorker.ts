import Bull from 'bull';
import { QUEUE_NAMES } from '@clippr/config';
import type { AIJobPayload, ClipJobPayload } from '@clippr/types';
import { query, queryOne } from '../lib/db.js';
import { transcribeSegment } from './whisperClient.js';
import { scoreHighlightWindow } from './highlightDetector.js';
import { getEngagementMultiplier } from './engagementScorer.js';

const HIGHLIGHT_THRESHOLD = parseFloat(
  process.env.HIGHLIGHT_SCORE_THRESHOLD ?? '65'
);

// Sliding window of recent segments per stream for multi-segment highlight detection
const recentSegments = new Map<
  string,
  Array<{ index: number; startOffset: number; endOffset: number; s3Key: string; words: import('@clippr/types').WordTimestamp[] }>
>();

const MAX_WINDOW_SECS = 60;

const aiQueue = new Bull<AIJobPayload>(QUEUE_NAMES.AI, {
  redis: process.env.REDIS_URL ?? 'redis://localhost:6379',
});

const clipQueue = new Bull<ClipJobPayload>(QUEUE_NAMES.CLIP, {
  redis: process.env.REDIS_URL ?? 'redis://localhost:6379',
});

aiQueue.process(3, async (job) => {
  const { streamId, segmentIndex, s3Key, segmentStartedAt, segmentDurationSecs } = job.data;

  const startedAt = new Date(segmentStartedAt);

  // Transcribe via Whisper
  let transcription: Awaited<ReturnType<typeof transcribeSegment>>;
  try {
    transcription = await transcribeSegment(s3Key, startedAt);
  } catch (err) {
    console.error(`[aiWorker] Transcription failed for segment ${segmentIndex}:`, err);
    return;
  }

  // Fetch stream info to get user_id and start time
  const stream = await queryOne<{
    id: string;
    user_id: string;
    started_at: string;
  }>('SELECT id, user_id, started_at FROM streams WHERE id = $1', [streamId]);

  if (!stream) return;

  const streamStartTime = new Date(stream.started_at);
  const startOffset = (startedAt.getTime() - streamStartTime.getTime()) / 1000;
  const endOffset = startOffset + segmentDurationSecs;

  // Persist transcription
  await query(
    `INSERT INTO transcriptions
       (stream_id, segment_index, text, words_json, started_at, ended_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      streamId,
      segmentIndex,
      transcription.text,
      JSON.stringify(transcription.words),
      startedAt,
      new Date(startedAt.getTime() + segmentDurationSecs * 1000),
    ]
  );

  // Maintain sliding window of recent segments
  const key = streamId;
  const window = recentSegments.get(key) ?? [];
  window.push({
    index: segmentIndex,
    startOffset,
    endOffset,
    s3Key,
    words: transcription.words,
  });

  // Keep only segments within MAX_WINDOW_SECS
  const cutoff = endOffset - MAX_WINDOW_SECS;
  const trimmed = window.filter((s) => s.endOffset > cutoff);
  recentSegments.set(key, trimmed);

  // Score the current segment as a potential highlight window
  const windowWords = trimmed.flatMap((s) => s.words);
  const windowStart = trimmed[0]?.startOffset ?? startOffset;

  const highlight = await scoreHighlightWindow({
    streamId,
    startOffsetSecs: windowStart,
    endOffsetSecs: endOffset,
    s3Key,
    words: windowWords,
    streamStartTime,
  });

  const engagementMultiplier = await getEngagementMultiplier(
    stream.user_id,
    highlight.triggerKeywords,
    startedAt.getHours()
  );

  const finalScore = Math.min(highlight.overallScore * engagementMultiplier, 100);

  console.log(
    `[aiWorker] Segment ${segmentIndex} scored ${finalScore.toFixed(1)} ` +
    `(threshold: ${HIGHLIGHT_THRESHOLD})`
  );

  if (finalScore >= HIGHLIGHT_THRESHOLD) {
    // Insert clip record
    const clip = await queryOne<{ id: string }>(
      `INSERT INTO clips (stream_id, user_id, start_offset_secs, end_offset_secs, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id`,
      [streamId, stream.user_id, highlight.startOffsetSecs, highlight.endOffsetSecs]
    );

    if (!clip) return;

    // Insert score
    await query(
      `INSERT INTO clip_scores
         (clip_id, overall_score, audio_peak_score, chat_activity_score,
          transcript_score, score_metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        clip.id,
        finalScore,
        highlight.audioPeakScore,
        highlight.chatActivityScore,
        highlight.transcriptScore,
        JSON.stringify({ triggerKeywords: highlight.triggerKeywords, engagementMultiplier }),
      ]
    );

    // Enqueue clip generation
    await clipQueue.add({
      clipId: clip.id,
      streamId,
      startOffsetSecs: highlight.startOffsetSecs,
      endOffsetSecs: highlight.endOffsetSecs,
    });

    console.log(
      `[aiWorker] Created clip ${clip.id} with score ${finalScore.toFixed(1)}`
    );
  }
});

aiQueue.on('failed', (job, err) => {
  console.error(`[aiWorker] Job ${job.id} failed:`, err.message);
});

console.log('[aiWorker] Worker started, waiting for jobs...');

export { aiQueue };
