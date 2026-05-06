import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/lib/auth/session';
import { queryOne } from '@/lib/db/client';
import { publishQueue } from '@/lib/queue/client';
import type { Clip } from '@clippr/types';

const publishSchema = z.object({
  platform: z.enum(['youtube', 'tiktok', 'instagram']),
  platformAccountId: z.string().uuid(),
  scheduledFor: z.string().datetime().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as typeof session.user & { id: string }).id;
  const body = await req.json();
  const parsed = publishSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const clip = await queryOne<Clip>(
    `SELECT id, status, converted_s3_key FROM clips WHERE id = $1 AND user_id = $2`,
    [params.id, userId]
  );

  if (!clip) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!clip.convertedS3Key) {
    return NextResponse.json(
      { error: 'Clip not yet converted' },
      { status: 409 }
    );
  }

  const publication = await queryOne<{ id: string }>(
    `INSERT INTO publications (clip_id, platform_account_id, platform, scheduled_for)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [
      params.id,
      parsed.data.platformAccountId,
      parsed.data.platform,
      parsed.data.scheduledFor ?? null,
    ]
  );

  if (!publication) {
    return NextResponse.json({ error: 'Failed to create publication' }, { status: 500 });
  }

  const delay = parsed.data.scheduledFor
    ? Math.max(0, new Date(parsed.data.scheduledFor).getTime() - Date.now())
    : 0;

  await publishQueue.add(
    {
      publicationId: publication.id,
      clipId: params.id,
      platform: parsed.data.platform,
      platformAccountId: parsed.data.platformAccountId,
    },
    { delay }
  );

  return NextResponse.json(publication, { status: 202 });
}
