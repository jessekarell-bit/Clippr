import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/lib/auth/session';
import { queryOne } from '@/lib/db/client';
import type { Clip } from '@clippr/types';

const updateClipSchema = z.object({
  title: z.string().optional(),
  status: z.enum(['pending', 'processing', 'ready', 'rejected', 'published']).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as typeof session.user & { id: string }).id;
  const clip = await queryOne(
    `SELECT c.*, cs.overall_score, cs.audio_peak_score, cs.chat_activity_score,
            cs.transcript_score, cs.engagement_history_score, cs.score_metadata
     FROM clips c
     LEFT JOIN clip_scores cs ON cs.clip_id = c.id
     WHERE c.id = $1 AND c.user_id = $2`,
    [params.id, userId]
  );

  if (!clip) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(clip);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as typeof session.user & { id: string }).id;
  const body = await req.json();
  const parsed = updateClipSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await queryOne<Clip>(
    'SELECT id FROM clips WHERE id = $1 AND user_id = $2',
    [params.id, userId]
  );

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const updates: string[] = ['updated_at = now()'];
  const values: unknown[] = [];
  let i = 1;

  if (parsed.data.title !== undefined) {
    updates.push(`title = $${i++}`);
    values.push(parsed.data.title);
  }
  if (parsed.data.status !== undefined) {
    updates.push(`status = $${i++}`);
    values.push(parsed.data.status);
  }

  values.push(params.id);
  const clip = await queryOne(
    `UPDATE clips SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );

  return NextResponse.json(clip);
}
