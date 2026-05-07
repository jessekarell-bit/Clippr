import { cookies } from 'next/headers';
import {
  fetchYouTubeActiveStreams,
  getSelectedStream,
  getYouTubeSession,
  hasYouTubeOAuthConfig,
} from '../../lib/youtube';

const demoStreams = [
  { id: 'yt-live-7812', title: 'Friday Night Ranked Live', channel: 'Clippr Demo Channel', status: 'ACTIVE', manifest: 'hls.m3u8', segments: 128, lag: '1.2s' },
  { id: 'yt-live-7768', title: 'Road to Top 100', channel: 'Creator Alpha', status: 'PROCESSING', manifest: 'hls.m3u8', segments: 94, lag: '1.9s' },
  { id: 'yt-live-7754', title: 'Chill Q&A Stream', channel: 'Creator Beta', status: 'FAILED', manifest: 'hls.m3u8', segments: 21, lag: 'n/a' },
];

interface StreamsPageProps {
  searchParams: Promise<{ youtube?: string }>;
}

function statusClass(status: string): string {
  const value = status.toLowerCase();
  if (value === 'active') return 'status-pill status-green';
  if (value === 'processing') return 'status-pill status-blue';
  if (value === 'failed') return 'status-pill status-red';
  return 'status-pill';
}

export default async function StreamsPage({ searchParams }: StreamsPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const youtubeSession = getYouTubeSession(cookieStore);
  const hasConfig = hasYouTubeOAuthConfig();
  const isConnected = Boolean(youtubeSession);
  const selectedStream = getSelectedStream(cookieStore);

  let streams = demoStreams;
  if (youtubeSession) {
    const liveStreams = await fetchYouTubeActiveStreams(youtubeSession);
    if (liveStreams.length > 0) {
      streams = liveStreams.map((stream, index) => ({
        id: stream.id,
        title: stream.title,
        channel: youtubeSession.channelTitle ?? 'YouTube channel',
        status: stream.status,
        manifest: 'youtube-live',
        segments: 120 + index * 7,
        lag: `${(1.1 + index * 0.3).toFixed(1)}s`,
      }));
    } else {
      streams = [];
    }
  }

  const active = streams.filter((s) => s.status === 'ACTIVE').length;
  const hasStreams = streams.length > 0;

  return (
    <main className="site dashboard-page">
      <header className="page-header">
        <div>
          <p className="badge">Stap 1</p>
          <h1>Livestreams inlezen</h1>
          <p className="subtitle">Hier zie je of je livestream goed binnenkomt en of alles stabiel draait.</p>
        </div>
      </header>

      <section className="card youtube-connect-card">
        <div>
          <h3>YouTube koppeling</h3>
          <p className="muted">
            {isConnected
              ? `Verbonden met ${youtubeSession?.channelTitle ?? 'je kanaal'}.`
              : 'Koppel je YouTube-account om echte live streams in te laden.'}
          </p>
          {!hasConfig ? (
            <p className="error-text">YouTube API is nog niet ingesteld. Voeg client-id en secret toe in je env.</p>
          ) : null}
          {params.youtube === 'connected' ? <p className="success-text">YouTube account succesvol gekoppeld.</p> : null}
          {params.youtube === 'disconnected' ? <p className="muted">YouTube account is losgekoppeld.</p> : null}
          {params.youtube === 'token_error' ? <p className="error-text">Kon geen YouTube token ophalen.</p> : null}
          {params.youtube === 'stream_selected' ? (
            <p className="success-text">Livestream gekozen. Deze wordt nu gebruikt in Clips en Pipeline.</p>
          ) : null}
          {params.youtube === 'invalid_url' ? <p className="error-text">Deze YouTube-link is niet geldig.</p> : null}
        </div>
        <div className="topbar-actions">
          {!isConnected ? (
            <a href="/api/youtube/auth?next=/streams" className="button primary">
              Koppel YouTube
            </a>
          ) : (
            <form method="post" action="/api/youtube/disconnect">
              <button type="submit" className="button ghost">
                Ontkoppel YouTube
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="card youtube-connect-card">
        <div>
          <h3>Test met YouTube-link</h3>
          <p className="muted">Plak een YouTube-link om direct met die stream/video te testen in je flow.</p>
        </div>
        <form method="get" action="/api/youtube/select-stream" className="clips-filterbar">
          <input
            type="url"
            name="videoUrl"
            placeholder="https://www.youtube.com/watch?v=..."
            defaultValue="https://www.youtube.com/watch?v=nb-LTjJAC5U"
            required
          />
          <input type="hidden" name="next" value="/streams" />
          <button type="submit" className="button primary">
            Gebruik deze link
          </button>
        </form>
      </section>

      <section className="grid3">
        <article className="card"><p>Actieve streams</p><strong>{active}</strong></article>
        <article className="card"><p>Totaal videostukken</p><strong>{streams.reduce((acc, s) => acc + s.segments, 0)}</strong></article>
        <article className="card"><p>Stabiliteit</p><strong>98.6%</strong></article>
      </section>

      <section className="section split">
        <div className="section-head split-full">
          <h3>Ingest operations</h3>
          <p className="muted">Handige acties en uitleg om je livestream stabiel binnen te houden.</p>
        </div>
        <article className="card">
          <h3>Acties</h3>
          <div className="action-stack">
            <button type="button" className="button ghost">Start streamcontrole</button>
            <button type="button" className="button ghost">Opnieuw verbinden</button>
            <button type="button" className="button ghost">Afgeronde stream opslaan</button>
          </div>
        </article>
        <article className="card">
          <h3>Wat je moet weten</h3>
          <ul className="steps compact">
            <li>Bij status ACTIVE loopt alles goed.</li>
            <li>Bij FAILED probeer je best opnieuw te verbinden.</li>
            <li>Vertraging boven 3 seconden vraagt extra aandacht.</li>
          </ul>
        </article>
      </section>

      <section className="section">
        <div className="section-head">
          <h3>Live streams overview</h3>
          <p className="muted">Overzicht van je streams met status, hoeveelheid videostukken en vertraging.</p>
        </div>
        {!hasStreams ? (
          <article className="card empty-state">
            <h3>Geen actieve streams</h3>
            <p className="muted">Start een livestream op YouTube. Zodra die live staat, zie je hem hier.</p>
            <a href="/api/youtube/auth?next=/streams" className="button primary">
              YouTube koppelen
            </a>
          </article>
        ) : null}
        <div className="card table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Stream-ID</th>
                <th>Titel</th>
                <th>Kanaal</th>
                <th>Status</th>
                <th>Manifest</th>
                <th>Videostukken</th>
                <th>Vertraging</th>
                <th>Actie</th>
              </tr>
            </thead>
            <tbody>
              {streams.map((stream) => (
                <tr key={stream.id}>
                  <td>{stream.id}</td>
                  <td>{stream.title}</td>
                  <td>{stream.channel}</td>
                  <td><span className={statusClass(stream.status)}>{stream.status.toLowerCase()}</span></td>
                  <td>{stream.manifest}</td>
                  <td>{stream.segments}</td>
                  <td>{stream.lag}</td>
                  <td>
                    <a
                      href={`/api/youtube/select-stream?streamId=${encodeURIComponent(stream.id)}&title=${encodeURIComponent(stream.title)}&channelTitle=${encodeURIComponent(stream.channel)}&next=/streams`}
                      className={`button ghost${selectedStream?.streamId === stream.id ? ' is-disabled' : ''}`}
                    >
                      {selectedStream?.streamId === stream.id ? 'Gekozen' : 'Gebruik deze stream'}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
