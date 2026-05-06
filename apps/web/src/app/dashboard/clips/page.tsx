import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { query } from '@/lib/db/client';

export default async function ClipsPage({
  searchParams,
}: {
  searchParams: { status?: string; streamId?: string };
}) {
  const session = await getServerSession();
  if (!session?.user) redirect('/login');

  const userId = (session.user as typeof session.user & { id: string }).id;

  const conditions = ['c.user_id = $1'];
  const params: unknown[] = [userId];
  let idx = 2;

  if (searchParams.status) {
    conditions.push(`c.status = $${idx++}`);
    params.push(searchParams.status);
  }
  if (searchParams.streamId) {
    conditions.push(`c.stream_id = $${idx++}`);
    params.push(searchParams.streamId);
  }

  const clips = await query<{
    id: string;
    title: string | null;
    status: string;
    duration_secs: string;
    thumbnail_s3_key: string | null;
    overall_score: string | null;
    created_at: string;
  }>(
    `SELECT c.id, c.title, c.status, c.duration_secs, c.thumbnail_s3_key,
            cs.overall_score, c.created_at
     FROM clips c
     LEFT JOIN clip_scores cs ON cs.clip_id = c.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY cs.overall_score DESC NULLS LAST, c.created_at DESC
     LIMIT 50`,
    params
  );

  return (
    <main style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Clips</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['ready', 'pending', 'rejected', 'published'] as const).map((s) => (
            <a
              key={s}
              href={`/dashboard/clips?status=${s}`}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                textDecoration: 'none',
                background: searchParams.status === s ? '#2a2a4a' : '#1a1a1a',
                color: searchParams.status === s ? '#90caf9' : '#888',
                border: '1px solid #2a2a2a',
              }}
            >
              {s}
            </a>
          ))}
        </div>
      </div>

      {clips.length === 0 ? (
        <p style={{ color: '#666' }}>No clips yet. Clips are generated automatically as streams are processed.</p>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px',
        }}>
          {clips.map((clip) => (
            <a
              key={clip.id}
              href={`/dashboard/clips/${clip.id}`}
              style={{
                display: 'block',
                background: '#1a1a1a',
                borderRadius: '10px',
                overflow: 'hidden',
                textDecoration: 'none',
                color: 'inherit',
                border: '1px solid #2a2a2a',
              }}
            >
              <div style={{
                aspectRatio: '9/16',
                maxHeight: '200px',
                background: '#0f0f0f',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#444',
                fontSize: '0.8rem',
              }}>
                {clip.thumbnail_s3_key ? (
                  <span>Preview</span>
                ) : (
                  <span>No preview</span>
                )}
              </div>
              <div style={{ padding: '12px' }}>
                <div style={{ fontWeight: 600, marginBottom: '4px', fontSize: '0.95rem' }}>
                  {clip.title ?? `Clip ${clip.id.slice(0, 8)}`}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#888' }}>
                    {parseFloat(clip.duration_secs).toFixed(0)}s
                  </span>
                  {clip.overall_score && (
                    <span style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: parseFloat(clip.overall_score) >= 80 ? '#4caf50' :
                             parseFloat(clip.overall_score) >= 65 ? '#ff9800' : '#888',
                    }}>
                      {parseFloat(clip.overall_score).toFixed(0)} pts
                    </span>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
