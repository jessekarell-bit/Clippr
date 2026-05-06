import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/lib/auth/session';
import { queryOne } from '@/lib/db/client';
import { ingestQueue } from '@/lib/queue/client';
import type { Stream } from '@clippr/types';

const ingestSchema = z.object({
  youtubeVideoId: z.string().min(1),
  liveChatId: z.string().optional(),
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

  const stream = await queryOne<Stream>(
    'SELECT * FROM streams WHERE id = $1 AND user_id = $2',
    [params.id, userId]
  );

  if (!stream) {
    return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
  }

  if (stream.status === 'ingesting') {
    return NextResponse.json(
      { error: 'Stream is already being ingested' },
      { status: 409 }
    );
  }

  const body = await req.json();
  const parsed = ingestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Update youtube_video_id if provided
  if (parsed.data.youtubeVideoId && !stream.youtubeVideoId) {
    await queryOne(
      `UPDATE streams SET youtube_video_id = $1, updated_at = now() WHERE id = $2`,
      [parsed.data.youtubeVideoId, params.id]
    );
  }

  const job = await ingestQueue.add({
    streamId: params.id,
    youtubeStreamId: stream.youtubeStreamId,
    youtubeVideoId: parsed.data.youtubeVideoId ?? stream.youtubeVideoId ?? '',
    userId,
    liveChatId: parsed.data.liveChatId,
  });

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
