import Link from 'next/link';

const layerCards = [
  {
    title: '1. Livestream binnenhalen',
    text: 'Koppel YouTube en kies een stream. Clippr leest live videostukken in.',
    route: '/streams',
    routeLabel: 'Open Streams',
  },
  {
    title: '2. AI zoekt topmomenten',
    text: 'Clippr kijkt naar spraak, geluid en chat om sterke momenten te scoren.',
    route: '/pipeline',
    routeLabel: 'Open Pipeline',
  },
  {
    title: '3. Clips worden gemaakt',
    text: 'Moments met hoge score worden automatisch gesneden en in 9:16 gezet.',
    route: '/clips',
    routeLabel: 'Open Clips',
  },
  {
    title: '4. Je reviewt en plant',
    text: 'Pas titel of beschrijving aan en plan wanneer de clip online moet.',
    route: '/clips',
    routeLabel: 'Naar Review',
  },
  {
    title: '5. Publiceren op platforms',
    text: 'Zet clips klaar voor YouTube Shorts, TikTok en Instagram Reels.',
    route: '/publishing',
    routeLabel: 'Open Publishing',
  },
];

const demoScenario = [
  'Creator start een livestream op YouTube.',
  'Clippr detecteert binnen enkele minuten de eerste topmomenten.',
  'In het dashboard verschijnen kant-en-klare verticale clips.',
  'Creator keurt 3 clips goed en plant ze voor vandaag.',
  'Publicatie-status wordt live bijgehouden per platform.',
];

export default function DemoPage() {
  return (
    <main className="site">
      <header className="hero compact-hero">
        <p className="badge">Clippr demo</p>
        <h1>Complete architectuur in 1 verhaal</h1>
        <p className="subtitle">
          Deze pagina laat stap voor stap zien hoe de app werkt, zodat je het makkelijk kunt laten zien aan klanten,
          partners of teamleden.
        </p>
        <div className="actions">
          <Link href="/clips" className="button primary">
            Start demo in dashboard
          </Link>
          <Link href="/" className="button ghost">
            Terug naar home
          </Link>
        </div>
      </header>

      <section className="section">
        <div className="section-head">
          <h2>Architectuurlagen</h2>
          <p className="muted">Van brondata naar publicatie, met duidelijke dashboards per laag.</p>
        </div>
        <div className="architecture-grid">
          {layerCards.map((layer) => (
            <article key={layer.title} className="card architecture-card">
              <h3>{layer.title}</h3>
              <p>{layer.text}</p>
              <Link href={layer.route} className="button ghost">
                {layer.routeLabel}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="section split">
        <article className="card">
          <h3>Demo scenario (praatplaat)</h3>
          <ol className="steps">
            {demoScenario.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </article>
        <article className="card accent">
          <h3>Wat je live kunt tonen</h3>
          <ul className="steps compact">
            <li>Koppelen van YouTube stream of video-link</li>
            <li>Actieve pipeline-status en verwerkingstijden</li>
            <li>Clip review met score en publicatieknoppen</li>
            <li>Statusoverzicht per platform in publishing</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
