import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { query } from '@/lib/db/client';

export async function GET(req: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as typeof session.user & { id: string }).id;
  const { searchParams } = new URL(req.url);
  const streamId = searchParams.get('streamId');
  const status = searchParams.get('status');
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100);
  const offset = Number(searchParams.get('offset') ?? 0);

  const conditions: string[] = ['c.user_id = $1'];
  const params: unknown[] = [userId];
  let idx = 2;

  if (streamId) {
    conditions.push(`c.stream_id = $${idx++}`);
    params.push(streamId);
  }
  if (status) {
    conditions.push(`c.status = $${idx++}`);
    params.push(status);
  }

  params.push(limit, offset);

  const clips = await query(
    `SELECT c.*, cs.overall_score, cs.audio_peak_score, cs.chat_activity_score,
            cs.transcript_score, cs.engagement_history_score
     FROM clips c
     LEFT JOIN clip_scores cs ON cs.clip_id = c.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY cs.overall_score DESC NULLS LAST, c.created_at DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    params
  );

  return NextResponse.json(clips);
}
