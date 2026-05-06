import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/lib/auth/session';
import { query, queryOne } from '@/lib/db/client';
import type { Stream } from '@clippr/types';

const updateStreamSchema = z.object({
  title: z.string().optional(),
  status: z.enum(['pending', 'ingesting', 'completed', 'failed']).optional(),
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
  const stream = await queryOne<Stream>(
    'SELECT * FROM streams WHERE id = $1 AND user_id = $2',
    [params.id, userId]
  );

  if (!stream) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(stream);
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
  const parsed = updateStreamSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await queryOne<Stream>(
    'SELECT id FROM streams WHERE id = $1 AND user_id = $2',
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
  const stream = await queryOne<Stream>(
    `UPDATE streams SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );

  return NextResponse.json(stream);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as typeof session.user & { id: string }).id;
  const deleted = await query(
    'DELETE FROM streams WHERE id = $1 AND user_id = $2 RETURNING id',
    [params.id, userId]
  );

  if (deleted.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
