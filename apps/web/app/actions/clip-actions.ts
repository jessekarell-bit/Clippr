'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { prisma } from '@clippr/database';
import type { Platform, PublishClipJobData } from '@clippr/core';
import { isAuthenticated } from '../lib/auth';

const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);
const isRedisConfigured = Boolean(process.env.REDIS_URL);

const redisConnection = isRedisConfigured
  ? new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })
  : null;

const publishQueue =
  redisConnection !== null
    ? new Queue<PublishClipJobData>('social-publication-queue', {
        connection: redisConnection,
      })
    : null;

export async function approveAndScheduleClip(formData: FormData): Promise<void> {
  const cookieStore = await cookies();
  if (!isAuthenticated(cookieStore)) {
    redirect('/login?next=/clips');
  }

  const clipId = String(formData.get('clipId'));
  const userId = String(formData.get('userId'));
  const title = String(formData.get('title') ?? 'Auto clip');

  if (!isDatabaseConfigured) {
    console.info('[demo] approveAndScheduleClip skipped (no DATABASE_URL).', { clipId, userId, title });
    revalidatePath(`/clips/${clipId}`);
    return;
  }

  const clip = await prisma.clip.findFirst({ where: { id: clipId, userId } });
  if (!clip) throw new Error('Clip not found or unauthorized');

  await prisma.clip.update({ where: { id: clip.id }, data: { status: 'APPROVED', title } });

  const targetPlatforms: Platform[] = ['YOUTUBE', 'TIKTOK', 'INSTAGRAM'];

  if (publishQueue) {
    await publishQueue.add('publish-clip', {
      clipId: clip.id,
      userId,
      s3Url: clip.s3Url,
      title,
      targetPlatforms,
    });
  } else {
    console.warn('[clipActions] Redis not configured, skipping publish queue dispatch.');
  }

  revalidatePath(`/clips/${clip.id}`);
  revalidatePath('/clips');
}

export async function rejectClip(formData: FormData): Promise<void> {
  const cookieStore = await cookies();
  if (!isAuthenticated(cookieStore)) {
    redirect('/login?next=/clips');
  }

  const clipId = String(formData.get('clipId'));

  if (!isDatabaseConfigured) {
    console.info('[demo] rejectClip skipped (no DATABASE_URL).', { clipId });
    revalidatePath(`/clips/${clipId}`);
    return;
  }

  await prisma.clip.update({ where: { id: clipId }, data: { status: 'REJECTED' } });
  revalidatePath(`/clips/${clipId}`);
  revalidatePath('/clips');
}
