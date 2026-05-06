import Bull from 'bull';
import { QUEUE_NAMES } from '@clippr/config';
import type { PublishJobPayload } from '@clippr/types';
import { query, queryOne } from '../lib/db.js';
import { publishToYouTube } from './youtubePublisher.js';
import { publishToTikTok } from './tiktokPublisher.js';
import { publishToInstagram } from './instagramPublisher.js';

const publishQueue = new Bull<PublishJobPayload>(QUEUE_NAMES.PUBLISH, {
  redis: process.env.REDIS_URL ?? 'redis://localhost:6379',
});

publishQueue.process(2, async (job) => {
  const { publicationId, clipId, platform, platformAccountId } = job.data;

  console.log(`[publishWorker] Publishing clip ${clipId} to ${platform}`);

  // Fetch clip and platform account
  const clip = await queryOne<{
    converted_s3_key: string;
    title: string | null;
  }>(
    'SELECT converted_s3_key, title FROM clips WHERE id = $1',
    [clipId]
  );

  const account = await queryOne<{
    access_token: string;
    platform_user_id: string;
  }>(
    'SELECT access_token, platform_user_id FROM platform_accounts WHERE id = $1',
    [platformAccountId]
  );

  if (!clip?.converted_s3_key || !account) {
    await query(
      `UPDATE publications SET status = 'failed', error_message = $1, updated_at = now() WHERE id = $2`,
      ['Clip or platform account not found', publicationId]
    );
    return;
  }

  await query(
    `UPDATE publications SET status = 'uploading', updated_at = now() WHERE id = $1`,
    [publicationId]
  );

  const title = clip.title ?? 'Clip';

  try {
    let postId: string;
    let postUrl: string;

    if (platform === 'youtube') {
      ({ videoId: postId, videoUrl: postUrl } = await publishToYouTube({
        clipId,
        convertedS3Key: clip.converted_s3_key,
        title,
        description: `Auto-generated clip by Clippr`,
        accessToken: account.access_token,
      }));
    } else if (platform === 'tiktok') {
      ({ postId, postUrl } = await publishToTikTok({
        convertedS3Key: clip.converted_s3_key,
        title,
        accessToken: account.access_token,
      }));
    } else if (platform === 'instagram') {
      // Instagram requires a public video URL; construct from S3 (must be public or pre-signed)
      const publicVideoUrl =
        `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${clip.converted_s3_key}`;

      ({ postId, postUrl } = await publishToInstagram({
        convertedS3Key: clip.converted_s3_key,
        title,
        accessToken: account.access_token,
        instagramUserId: account.platform_user_id,
        publicVideoUrl,
      }));
    } else {
      throw new Error(`Unknown platform: ${platform}`);
    }

    await query(
      `UPDATE publications SET
         status = 'published',
         platform_post_id = $1,
         platform_post_url = $2,
         published_at = now(),
         updated_at = now()
       WHERE id = $3`,
      [postId, postUrl, publicationId]
    );

    // Update clip status to published if all publications are done
    await query(
      `UPDATE clips SET status = 'published', updated_at = now() WHERE id = $1`,
      [clipId]
    );

    console.log(`[publishWorker] Clip ${clipId} published to ${platform}: ${postUrl}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await query(
      `UPDATE publications SET status = 'failed', error_message = $1, updated_at = now() WHERE id = $2`,
      [errorMessage, publicationId]
    );
    throw err;
  }
});

publishQueue.on('failed', (job, err) => {
  console.error(`[publishWorker] Job ${job.id} failed:`, err.message);
});

console.log('[publishWorker] Worker started, waiting for jobs...');

export { publishQueue };
