import { cookies } from 'next/headers';
import { getSelectedStream, getYouTubeSession } from '../../lib/youtube';
import { detectStreamKeyElements, formatTimestamp } from '../../lib/key-elements';

const jobs = [
  { id: 'flow-1001', stage: 'transcription', status: 'completed', latency: '2.1s' },
  { id: 'flow-1001', stage: 'audio-peak', status: 'completed', latency: '1.3s' },
  { id: 'flow-1001', stage: 'chat-velocity', status: 'completed', latency: '0.5s' },
  { id: 'flow-1001', stage: 'engagement-score', status: 'completed', latency: '0.3s' },
  { id: 'flow-1001', stage: 'clip-render', status: 'processing', latency: '4.8s' },
];

function statusClass(status: string): string {
  const value = status.toLowerCase();
  if (value === 'completed') return 'status-pill status-green';
  if (value === 'processing') return 'status-pill status-blue';
  if (value === 'failed') return 'status-pill status-red';
  return 'status-pill';
}

export default async function PipelinePage() {
  const cookieStore = await cookies();
  const youtubeSession = getYouTubeSession(cookieStore);
  const selectedStream = getSelectedStream(cookieStore);
  const keyElements = selectedStream ? detectStreamKeyElements(selectedStream, 8) : [];
  const hasJobs = jobs.length > 0;

  return (
    <main className="site dashboard-page">
      <header className="page-header">
        <div>
          <p className="badge">Stap 2-4</p>
          <h1>Clips maken met AI</h1>
          <p className="subtitle">Hier zie je hoe je livestream stap voor stap wordt omgezet naar clipvoorstellen.</p>
        </div>
      </header>

      <section className="grid3">
        <article className="card"><p>Wachtende taken</p><strong>42</strong></article>
        <article className="card"><p>Gemiddelde verwerking</p><strong>8.9s</strong></article>
        <article className="card"><p>Gevonden key elements</p><strong>{keyElements.length}</strong></article>
      </section>

      <section className="card youtube-connect-card">
        <div>
          <h3>Bron voor AI-analyse</h3>
          <p className="muted">
            {selectedStream?.title
              ? `Pipeline verwerkt nu: ${selectedStream.title}.`
              : youtubeSession?.channelTitle
              ? `Pipeline gebruikt momenteel streams van ${youtubeSession.channelTitle}.`
              : 'Koppel eerst YouTube om echte streamdata in deze pipeline te zien.'}
          </p>
        </div>
      </section>

      <section className="section split">
        <div className="section-head split-full">
          <h3>Pipeline health</h3>
          <p className="muted">Overzicht van alle stappen: van spraakherkenning tot het maken van de clip.</p>
        </div>
        <article className="card">
          <h3>Stappen</h3>
          <ol className="steps compact">
            <li>Spraak omzetten naar tekst</li>
            <li>Luide momenten herkennen</li>
            <li>Drukke chatmomenten herkennen</li>
            <li>Score geven aan elk moment</li>
            <li>Clip snijden en omzetten naar 9:16</li>
          </ol>
        </article>
        <article className="card">
          <h3>Nu bezig</h3>
          <ul className="flow-list">
            {jobs.map((job, index) => (
              <li key={`${job.stage}-${index}`}>
                <span>{job.stage}</span>
                <span className="muted">{job.latency}</span>
                <span className={statusClass(job.status)}>{job.status}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="section">
        <div className="section-head">
          <h3>Gedetecteerde key elements</h3>
          <p className="muted">De AI markeert hier automatisch de belangrijkste momenten uit je stream.</p>
        </div>
        {!selectedStream ? (
          <article className="card empty-state">
            <h3>Nog geen bron gekozen</h3>
            <p className="muted">Kies eerst een stream in Streams om key elements te ontdekken.</p>
          </article>
        ) : (
          <div className="card table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Moment</th>
                  <th>Tijd</th>
                  <th>Type</th>
                  <th>Score</th>
                  <th>Waarom</th>
                </tr>
              </thead>
              <tbody>
                {keyElements.map((item) => (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td>{formatTimestamp(item.timestampSeconds)}</td>
                    <td>{item.type.replace('_', ' ')}</td>
                    <td><span className="score-pill">{item.score}</span></td>
                    <td>{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h3>Flow execution table</h3>
          <p className="muted">Lijst van alle taken met status en snelheid.</p>
        </div>
        {!hasJobs ? (
          <article className="card empty-state">
            <h3>Nog geen taken</h3>
            <p className="muted">Start eerst een livestream om clips te laten maken.</p>
            <button type="button" className="button ghost">Naar streams</button>
          </article>
        ) : null}
        <div className="card table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Taak-ID</th>
                <th>Stap</th>
                <th>Status</th>
                <th>Snelheid</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, index) => (
                <tr key={`${job.id}-${job.stage}-${index}`}>
                  <td>{job.id}</td>
                  <td>{job.stage}</td>
                  <td><span className={statusClass(job.status)}>{job.status}</span></td>
                  <td>{job.latency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
