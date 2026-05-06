import { redirect, notFound } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { queryOne } from '@/lib/db/client';
import { getSignedDownloadUrl } from '@/lib/s3/client';

export default async function ClipDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession();
  if (!session?.user) redirect('/login');

  const userId = (session.user as typeof session.user & { id: string }).id;

  const clip = await queryOne<{
    id: string;
    title: string | null;
    status: string;
    duration_secs: string;
    start_offset_secs: string;
    end_offset_secs: string;
    converted_s3_key: string | null;
    thumbnail_s3_key: string | null;
    subtitles_srt: string | null;
    overall_score: string | null;
    audio_peak_score: string | null;
    chat_activity_score: string | null;
    transcript_score: string | null;
    score_metadata: Record<string, unknown> | null;
    created_at: string;
  }>(
    `SELECT c.id, c.title, c.status, c.duration_secs, c.start_offset_secs, c.end_offset_secs,
            c.converted_s3_key, c.thumbnail_s3_key, c.subtitles_srt, c.created_at,
            cs.overall_score, cs.audio_peak_score, cs.chat_activity_score,
            cs.transcript_score, cs.score_metadata
     FROM clips c
     LEFT JOIN clip_scores cs ON cs.clip_id = c.id
     WHERE c.id = $1 AND c.user_id = $2`,
    [params.id, userId]
  );

  if (!clip) notFound();

  const videoUrl = clip.converted_s3_key
    ? await getSignedDownloadUrl(clip.converted_s3_key)
    : null;

  const keywords = (clip.score_metadata?.triggerKeywords as string[] | undefined) ?? [];

  return (
    <main style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
      <a href="/dashboard/clips" style={{ color: '#888', fontSize: '0.9rem', textDecoration: 'none' }}>
        ← Back to clips
      </a>

      <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px' }}>
        {/* Video preview */}
        <div>
          {videoUrl ? (
            <video
              src={videoUrl}
              controls
              style={{
                width: '100%',
                borderRadius: '10px',
                background: '#0f0f0f',
                aspectRatio: '9/16',
                objectFit: 'contain',
              }}
            />
          ) : (
            <div style={{
              aspectRatio: '9/16',
              background: '#1a1a1a',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#444',
            }}>
              {clip.status === 'processing' ? 'Processing...' : 'No preview'}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '8px' }}>
            {clip.title ?? `Clip ${clip.id.slice(0, 8)}`}
          </h1>

          <div style={{ marginBottom: '24px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600,
              background: clip.status === 'ready' ? '#1a3a1a' : '#2a2a2a',
              color: clip.status === 'ready' ? '#4caf50' : '#888',
            }}>
              {clip.status}
            </span>
            <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', background: '#2a2a2a', color: '#888' }}>
              {parseFloat(clip.duration_secs).toFixed(1)}s
            </span>
          </div>

          {/* Scores */}
          {clip.overall_score && (
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Score Breakdown</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { label: 'Overall', value: clip.overall_score, weight: 1 },
                  { label: 'Chat Activity (40%)', value: clip.chat_activity_score, weight: 0.4 },
                  { label: 'Audio Peak (30%)', value: clip.audio_peak_score, weight: 0.3 },
                  { label: 'Transcript (30%)', value: clip.transcript_score, weight: 0.3 },
                ].map(({ label, value }) => value && (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.85rem', color: '#888' }}>{label}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {parseFloat(value).toFixed(1)}
                      </span>
                    </div>
                    <div style={{ height: '6px', background: '#2a2a2a', borderRadius: '3px' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(parseFloat(value), 100)}%`,
                        background: parseFloat(value) >= 80 ? '#4caf50' :
                                    parseFloat(value) >= 65 ? '#ff9800' : '#ef5350',
                        borderRadius: '3px',
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {keywords.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '8px' }}>Detected Keywords</h2>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {keywords.map((kw) => (
                  <span key={kw} style={{
                    padding: '3px 8px', borderRadius: '4px',
                    fontSize: '0.8rem', background: '#1a2a3a', color: '#90caf9',
                  }}>
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {clip.status === 'ready' && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <form action={`/api/clips/${clip.id}`} method="PATCH">
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px', background: '#1a3a1a', color: '#4caf50',
                    border: '1px solid #2a4a2a', borderRadius: '8px', cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Approve
                </button>
              </form>
              <button
                style={{
                  padding: '10px 20px', background: '#3a1a1a', color: '#ef5350',
                  border: '1px solid #4a2a2a', borderRadius: '8px', cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Reject
              </button>
              <button
                style={{
                  padding: '10px 20px', background: '#1a2a3a', color: '#90caf9',
                  border: '1px solid #2a3a4a', borderRadius: '8px', cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Publish
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
