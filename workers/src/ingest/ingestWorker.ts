import Bull from 'bull';
import { QUEUE_NAMES } from '@clippr/config';
import type { IngestJobPayload, AIJobPayload } from '@clippr/types';
import { query, queryOne } from '../lib/db.js';
import { uploadBuffer, segmentS3Key } from '../lib/s3.js';
import { resolveHLSViaYtDlp, pollLiveChat, getLiveBroadcastStatus } from './youtubeStream.js';
import { runIngestLoop } from './hlsFetcher.js';
import type { HLSSegment } from '@clippr/types';

const ingestQueue = new Bull<IngestJobPayload>(QUEUE_NAMES.INGEST, {
  redis: process.env.REDIS_URL ?? 'redis://localhost:6379',
});

const aiQueue = new Bull<AIJobPayload>(QUEUE_NAMES.AI, {
  redis: process.env.REDIS_URL ?? 'redis://localhost:6379',
});

ingestQueue.process(1, async (job) => {
  const { streamId, youtubeStreamId, youtubeVideoId, userId, liveChatId } = job.data;

  console.log(`[ingestWorker] Processing stream ${streamId} (video: ${youtubeVideoId})`);

  // Look up the YouTube access token for this user
  const account = await queryOne<{
    access_token: string;
    refresh_token: string | null;
  }>(
    `SELECT access_token, refresh_token
     FROM platform_accounts
     WHERE user_id = $1 AND platform = 'youtube'`,
    [userId]
  );

  if (!account) {
    throw new Error(`No YouTube account found for user ${userId}`);
  }

  // Resolve HLS manifest URL via yt-dlp
  const videoUrl = `https://www.youtube.com/watch?v=${youtubeVideoId}`;
  let manifestUrl: string;

  try {
    manifestUrl = await resolveHLSViaYtDlp(videoUrl);
    console.log(`[ingestWorker] Resolved manifest: ${manifestUrl}`);
  } catch (err) {
    await query(
      `UPDATE streams SET status = 'failed', updated_at = now() WHERE id = $1`,
      [streamId]
    );
    throw err;
  }

  // Update stream with manifest URL and start time
  await query(
    `UPDATE streams SET
       hls_manifest_url = $1,
       status = 'ingesting',
       started_at = now(),
       updated_at = now()
     WHERE id = $2`,
    [manifestUrl, streamId]
  );

  const streamStartTime = new Date();
  let segmentsProcessed = 0;
  let stopped = false;

  const shouldStop = () => stopped;

  // Segment handler: upload to S3, insert DB row, enqueue AI job
  const onSegment = async (segment: HLSSegment, buffer: Buffer) => {
    const s3Key = segmentS3Key(streamId, segment.index);
    await uploadBuffer(s3Key, buffer, 'video/mp2t');

    await query(
      `INSERT INTO stream_segments (stream_id, segment_index, s3_key, duration_secs, started_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (stream_id, segment_index) DO NOTHING`,
      [streamId, segment.index, s3Key, segment.durationSecs, segment.startedAt]
    );

    await aiQueue.add({
      streamId,
      segmentIndex: segment.index,
      s3Key,
      segmentStartedAt: segment.startedAt.toISOString(),
      segmentDurationSecs: segment.durationSecs,
    });

    segmentsProcessed++;
    await job.progress(segmentsProcessed);
    console.log(`[ingestWorker] Segment ${segment.index} uploaded (stream ${streamId})`);
  };

  // Run chat polling and ingest loop in parallel
  const chatPollPromise = liveChatId
    ? pollLiveChat({
        streamId,
        liveChatId,
        accessToken: account.access_token,
        shouldStop,
      }).catch((err) => {
        console.error('[ingestWorker] Chat poll error:', err);
      })
    : Promise.resolve();

  try {
    await runIngestLoop({
      streamId,
      manifestUrl,
      streamStartTime,
      onSegment,
      shouldStop,
    });

    stopped = true;
    await chatPollPromise;

    await query(
      `UPDATE streams SET status = 'completed', ended_at = now(), updated_at = now() WHERE id = $1`,
      [streamId]
    );

    console.log(`[ingestWorker] Stream ${streamId} completed (${segmentsProcessed} segments)`);
  } catch (err) {
    stopped = true;
    await chatPollPromise;

    await query(
      `UPDATE streams SET status = 'failed', ended_at = now(), updated_at = now() WHERE id = $1`,
      [streamId]
    );

    throw err;
  }
});

ingestQueue.on('failed', (job, err) => {
  console.error(`[ingestWorker] Job ${job.id} failed:`, err.message);
});

ingestQueue.on('completed', (job) => {
  console.log(`[ingestWorker] Job ${job.id} completed`);
});

console.log('[ingestWorker] Worker started, waiting for jobs...');

export { ingestQueue };
