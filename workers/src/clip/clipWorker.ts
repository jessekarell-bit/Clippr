import Bull from 'bull';
import { QUEUE_NAMES } from '@clippr/config';
import type { ClipJobPayload } from '@clippr/types';
import { query, queryOne } from '../lib/db.js';
import { cutRawClip } from './ffmpegCutter.js';
import { convertToVertical, generateThumbnail, generateSRT } from './formatConverter.js';

const clipQueue = new Bull<ClipJobPayload>(QUEUE_NAMES.CLIP, {
  redis: process.env.REDIS_URL ?? 'redis://localhost:6379',
});

clipQueue.process(2, async (job) => {
  const { clipId, streamId, startOffsetSecs, endOffsetSecs } = job.data;

  console.log(`[clipWorker] Processing clip ${clipId} (${startOffsetSecs}s–${endOffsetSecs}s)`);

  await query(
    `UPDATE clips SET status = 'processing', updated_at = now() WHERE id = $1`,
    [clipId]
  );

  try {
    // Step 1: Cut raw clip from HLS segments
    const rawS3Key = await cutRawClip({
      streamId,
      clipId,
      startOffsetSecs,
      endOffsetSecs,
    });

    // Step 2: Convert to 9:16 vertical format
    const convertedS3Key = await convertToVertical({ rawS3Key, clipId });

    // Step 3: Generate thumbnail
    const thumbnailS3Key = await generateThumbnail(convertedS3Key, clipId);

    // Step 4: Fetch transcription words for subtitle generation
    const transcription = await queryOne<{ words_json: string; started_at: string }>(
      `SELECT words_json, started_at
       FROM transcriptions
       WHERE stream_id = $1
         AND started_at <= $2::timestamptz
         AND ended_at >= $3::timestamptz
       ORDER BY started_at
       LIMIT 1`,
      [
        streamId,
        new Date(Date.now() + endOffsetSecs * 1000).toISOString(),
        new Date(Date.now() + startOffsetSecs * 1000).toISOString(),
      ]
    );

    let subtitlesSrt = '';
    if (transcription?.words_json) {
      const words = JSON.parse(transcription.words_json);
      subtitlesSrt = generateSRT(words, startOffsetSecs);
    }

    // Step 5: Update clip record
    await query(
      `UPDATE clips SET
         status = 'ready',
         raw_s3_key = $1,
         converted_s3_key = $2,
         thumbnail_s3_key = $3,
         subtitles_srt = $4,
         updated_at = now()
       WHERE id = $5`,
      [rawS3Key, convertedS3Key, thumbnailS3Key, subtitlesSrt || null, clipId]
    );

    console.log(`[clipWorker] Clip ${clipId} ready`);
  } catch (err) {
    await query(
      `UPDATE clips SET status = 'pending', updated_at = now() WHERE id = $1`,
      [clipId]
    );
    throw err;
  }
});

clipQueue.on('failed', (job, err) => {
  console.error(`[clipWorker] Job ${job.id} failed:`, err.message);
});

console.log('[clipWorker] Worker started, waiting for jobs...');

export { clipQueue };
