import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/lib/auth/session';
import { query, queryOne } from '@/lib/db/client';
import type { Stream } from '@clippr/types';

const createStreamSchema = z.object({
  youtubeStreamId: z.string().min(1),
  youtubeVideoId: z.string().min(1),
  title: z.string().optional(),
});

export async function GET() {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as typeof session.user & { id: string }).id;
  const streams = await query<Stream>(
    `SELECT id, user_id, youtube_stream_id, youtube_video_id, title, status,
            hls_manifest_url, started_at, ended_at, created_at, updated_at
     FROM streams
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  return NextResponse.json(streams);
}

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as typeof session.user & { id: string }).id;
  const body = await req.json();
  const parsed = createStreamSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { youtubeStreamId, youtubeVideoId, title } = parsed.data;

  const stream = await queryOne<Stream>(
    `INSERT INTO streams (user_id, youtube_stream_id, youtube_video_id, title)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, youtubeStreamId, youtubeVideoId, title ?? null]
  );

  return NextResponse.json(stream, { status: 201 });
}
