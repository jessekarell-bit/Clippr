import { cookies } from 'next/headers';
import { getSelectedStream, getYouTubeSession } from '../../lib/youtube';

const publications = [
  { clip: 'Insane clutch in overtime', youtube: 'queued', tiktok: 'queued', instagram: 'queued' },
  { clip: 'Best reaction of the stream', youtube: 'published', tiktok: 'published', instagram: 'failed' },
  { clip: 'Chat exploded after surprise win', youtube: 'published', tiktok: 'processing', instagram: 'queued' },
];

function statusClass(status: string): string {
  const value = status.toLowerCase();
  if (value === 'published') return 'status-pill status-green';
  if (value === 'processing' || value === 'queued') return 'status-pill status-blue';
  if (value === 'failed') return 'status-pill status-red';
  return 'status-pill';
}

export default async function PublishingPage() {
  const cookieStore = await cookies();
  const youtubeSession = getYouTubeSession(cookieStore);
  const selectedStream = getSelectedStream(cookieStore);
  const hasPublications = publications.length > 0;
  return (
    <main className="site dashboard-page">
      <header className="page-header">
        <div>
          <p className="badge">Stap 5</p>
          <h1>Plaatsen op social media</h1>
          <p className="subtitle">Beheer hier het plaatsen van clips op YouTube Shorts, TikTok en Instagram Reels.</p>
        </div>
      </header>

      <section className="grid3">
        <article className="card"><p>Klaar om te plaatsen</p><strong>17</strong></article>
        <article className="card"><p>Vandaag geplaatst</p><strong>38</strong></article>
        <article className="card"><p>Mislukt</p><strong>3</strong></article>
      </section>

      <section className="card youtube-connect-card">
        <div>
          <h3>Publicatiebron</h3>
          <p className="muted">
            {selectedStream?.title
              ? `Geplande posts gebruiken clips uit: ${selectedStream.title}.`
              : youtubeSession?.channelTitle
              ? `Geplande posts zijn gekoppeld aan ${youtubeSession.channelTitle}.`
              : 'Koppel YouTube in Streams om je eigen kanaal direct te kunnen beheren.'}
          </p>
          {selectedStream ? (
            <p className="success-text">Demo-veilig: deze flow toont alleen voorbeelden en plaatst niets op YouTube.</p>
          ) : null}
        </div>
      </section>

      <section className="section split">
        <div className="section-head split-full">
          <h3>Publishing controls</h3>
          <p className="muted">Snelle acties en belangrijke regels per platform.</p>
        </div>
        <article className="card">
          <h3>Acties</h3>
          <div className="action-stack">
            <button type="button" className="button ghost">Mislukte posts opnieuw proberen</button>
            <button type="button" className="button ghost">Plaatsen pauzeren</button>
            <button type="button" className="button ghost">Rapport downloaden</button>
          </div>
        </article>
        <article className="card">
          <h3>Belangrijk per platform</h3>
          <ul className="steps compact">
            <li>YouTube Shorts: juiste lengte en formaat zijn nodig.</li>
            <li>TikTok: sommige accounts hebben extra limieten.</li>
            <li>Instagram Reels: plaatsen gebeurt in 2 stappen.</li>
          </ul>
        </article>
      </section>

      <section className="section">
        <div className="section-head">
          <h3>Distribution matrix</h3>
          <p className="muted">Per clip zie je op welk kanaal hij al geplaatst is.</p>
        </div>
        {!hasPublications ? (
          <article className="card empty-state">
            <h3>Nog niets gepland</h3>
            <p className="muted">Keur eerst clips goed om ze klaar te zetten voor publicatie.</p>
            <button type="button" className="button ghost">Naar clip review</button>
          </article>
        ) : null}
        <div className="card table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Clip</th>
                <th>YouTube</th>
                <th>TikTok</th>
                <th>Instagram</th>
              </tr>
            </thead>
            <tbody>
              {publications.map((item) => (
                <tr key={item.clip}>
                  <td>{item.clip}</td>
                  <td><span className={statusClass(item.youtube)}>{item.youtube}</span></td>
                  <td><span className={statusClass(item.tiktok)}>{item.tiktok}</span></td>
                  <td><span className={statusClass(item.instagram)}>{item.instagram}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
