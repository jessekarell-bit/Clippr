import path from 'node:path';
import fs from 'node:fs';
import { Job } from 'bullmq';
import { WhisperTranscriber } from '../ai/whisper-transcriber.js';
import { AudioPeakDetector } from '../ai/audio-peak-detector.js';
import { EngagementScorer } from '../ai/engagement-scorer.js';
import { renderVerticalClip } from '../clip/render-vertical-clip.js';
import { buildSrtFile } from '../clip/subtitle-builder.js';
import { uploadMedia } from '../storage/media-storage.js';
import { prisma } from '@clippr/database';

const transcriber = new WhisperTranscriber();
const audio = new AudioPeakDetector();
const scorer = new EngagementScorer({ audioWeight: 0.5, chatWeight: 0.3, transcriptWeight: 0.2 });

function transcriptMultiplier(lines: string[]): number {
  const hypeKeywords = ['lets go', 'no way', 'oh my god', 'insane', 'clutch'];
  const text = lines.join(' ').toLowerCase();
  return hypeKeywords.some((k) => text.includes(k)) ? 1.3 : 1;
}

export async function clipGenerationProcessor(job: Job): Promise<void> {
  const segmentPath = String(job.data.segmentPath ?? '');
  const streamId = String(job.data.streamId ?? '');

  if (job.name === 'transcribe-segment') {
    await transcriber.processSegment(segmentPath);
    return;
  }

  if (job.name === 'analyze-audio') {
    await audio.analyzeVolume(segmentPath);
    return;
  }

  if (job.name === 'analyze-chat') {
    return;
  }

  if (job.name !== 'evaluate-and-clip') {
    return;
  }

  const transcript = await transcriber.processSegment(segmentPath);
  const volume = await audio.analyzeVolume(segmentPath);
  const chatScore = 35;
  const score = scorer.calculateScore((volume.energyScore + volume.dynamismScore) / 2, chatScore, transcriptMultiplier(transcript.map((t) => t.text)));

  if (!scorer.isHighlight(score)) {
    return;
  }

  const startTimeSeconds = transcript[0]?.start ?? 0;
  const endTimeSeconds = transcript[transcript.length - 1]?.end ?? 30;
  const durationSeconds = Math.max(5, Math.min(60, endTimeSeconds - startTimeSeconds));

  const outputDir = process.env.CLIP_OUTPUT_DIR ?? path.join(process.cwd(), '.clips');
  fs.mkdirSync(outputDir, { recursive: true });

  const subtitlePath = path.join(outputDir, `${streamId}-${job.id}.srt`);
  buildSrtFile(
    transcript.map((t) => ({ startSeconds: t.start, endSeconds: t.end, text: t.text })),
    subtitlePath,
  );

  const outputPath = path.join(outputDir, `${streamId}-${job.id}.mp4`);
  await renderVerticalClip({
    inputVideoPath: segmentPath,
    outputVideoPath: outputPath,
    startTimeSeconds,
    durationSeconds,
    subtitleSrtPath: subtitlePath,
  });

  const objectKey = `clips/${streamId}/${job.id}.mp4`;
  const s3Url = await uploadMedia(outputPath, objectKey);

  const stream = await prisma.stream.findFirst({ where: { youtubeStreamId: streamId } });
  if (!stream) {
    return;
  }

  await prisma.clip.create({
    data: {
      userId: stream.userId,
      streamId: stream.id,
      title: `Auto highlight ${job.id}`,
      s3Url,
      aiScore: score,
      durationSeconds: Math.round(durationSeconds),
    },
  });
}
