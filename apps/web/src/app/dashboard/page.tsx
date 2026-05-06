import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { query } from '@/lib/db/client';

export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session?.user) redirect('/login');

  const userId = (session.user as typeof session.user & { id: string }).id;

  const streams = await query<{
    id: string;
    title: string | null;
    status: string;
    started_at: string | null;
    youtube_video_id: string | null;
  }>(
    `SELECT id, title, status, started_at, youtube_video_id
     FROM streams
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [userId]
  );

  const clipStats = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) as count
     FROM clips
     WHERE user_id = $1
     GROUP BY status`,
    [userId]
  );

  const readyClips = clipStats.find((s) => s.status === 'ready')?.count ?? '0';

  return (
    <main style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>
        Dashboard
      </h1>
      <p style={{ color: '#888', marginBottom: '32px' }}>
        {readyClips} clip{readyClips !== '1' ? 's' : ''} ready for review
      </p>

      <section>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>
          Recent Streams
        </h2>
        {streams.length === 0 ? (
          <p style={{ color: '#666' }}>
            No streams yet. Start a stream on YouTube and add it here to begin generating clips.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {streams.map((stream) => (
              <a
                key={stream.id}
                href={`/dashboard/streams/${stream.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  background: '#1a1a1a',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  color: 'inherit',
                  border: '1px solid #2a2a2a',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {stream.title ?? stream.youtube_video_id ?? 'Untitled stream'}
                  </div>
                  {stream.started_at && (
                    <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '4px' }}>
                      {new Date(stream.started_at).toLocaleString()}
                    </div>
                  )}
                </div>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '999px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  background: stream.status === 'ingesting' ? '#1a3a1a' :
                              stream.status === 'completed' ? '#1a2a3a' :
                              stream.status === 'failed' ? '#3a1a1a' : '#2a2a2a',
                  color: stream.status === 'ingesting' ? '#4caf50' :
                         stream.status === 'completed' ? '#64b5f6' :
                         stream.status === 'failed' ? '#ef5350' : '#888',
                }}>
                  {stream.status}
                </span>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
