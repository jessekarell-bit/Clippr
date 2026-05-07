import { Job } from 'bullmq';
import type { PublishClipJobData } from '@clippr/core';
import { prisma } from '@clippr/database';
import { publishYouTubeShort } from './adapters/youtube-publisher.js';
import { publishTikTokVideo } from './adapters/tiktok-publisher.js';
import { publishInstagramReel } from './adapters/instagram-publisher.js';

export async function publishProcessor(job: Job<PublishClipJobData>): Promise<void> {
  const clip = await prisma.clip.findUnique({ where: { id: job.data.clipId } });
  if (!clip) throw new Error('Clip not found');

  const accounts = await prisma.socialAccount.findMany({ where: { userId: job.data.userId } });

  try {
    for (const platform of job.data.targetPlatforms) {
      const account = accounts.find((acc: (typeof accounts)[number]) => acc.platform === platform);
      if (!account) continue;

      if (platform === 'YOUTUBE') {
        await publishYouTubeShort({ accessToken: account.accessToken, videoUrl: clip.s3Url, title: job.data.title, description: job.data.description });
      }

      if (platform === 'TIKTOK') {
        await publishTikTokVideo({ accessToken: account.accessToken, videoUrl: clip.s3Url, title: job.data.title, description: job.data.description });
      }

      if (platform === 'INSTAGRAM') {
        await publishInstagramReel({ accessToken: account.accessToken, videoUrl: clip.s3Url, title: job.data.title, description: job.data.description }, process.env.IG_USER_ID ?? '');
      }
    }

    await prisma.clip.update({ where: { id: clip.id }, data: { status: 'PUBLISHED' } });
  } catch {
    await prisma.clip.update({ where: { id: clip.id }, data: { status: 'PUBLISH_FAILED' } });
    throw new Error('Publishing failed');
  }
}
