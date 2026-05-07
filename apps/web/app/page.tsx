import Link from 'next/link';

const features = [
  {
    title: 'Automatisch beste momenten',
    description:
      'Clippr kijkt mee met je stream en pikt automatisch de leukste momenten eruit.',
  },
  {
    title: 'Direct klaar voor Shorts',
    description:
      'Elke clip wordt automatisch in het juiste formaat gezet voor Shorts, TikTok en Reels.',
  },
  {
    title: 'Makkelijk publiceren',
    description:
      'Kijk clips snel na, kies je platformen en plan je posts in met een paar klikken.',
  },
];

const steps = [
  'Koppel je YouTube live stream.',
  'Wij zoeken automatisch naar sterke momenten.',
  'Je ziet je clips direct in je dashboard.',
  'Keur goed en publiceer met één klik.',
];

const architectureLayers = [
  {
    step: 'Stap 1',
    title: 'Stream ingest',
    description: 'We lezen je livestream in en houden alles stabiel bij in kleine videostukken.',
  },
  {
    step: 'Stap 2',
    title: 'AI analyse',
    description: 'Audio, chat en spraak worden gecombineerd om topmomenten te herkennen.',
  },
  {
    step: 'Stap 3',
    title: 'Clip engine',
    description: 'De beste momenten worden automatisch gesneden en omgezet naar 9:16.',
  },
  {
    step: 'Stap 4',
    title: 'Review dashboard',
    description: 'Je bekijkt clips, past tekst aan en beslist wat je wilt posten.',
  },
  {
    step: 'Stap 5',
    title: 'Publicatie',
    description: 'Clippr zet je clips klaar voor YouTube Shorts, TikTok en Instagram Reels.',
  },
];

export default function RootPage() {
  return (
    <main className="site">
      <header className="hero">
        <img src="/clippr-logo.svg" alt="Clippr logo" className="brand-logo" />
        <h1>Van livestream naar Shorts, automatisch.</h1>
        <p className="subtitle">
          Haal meer uit je livestreams zonder extra edit-werk. Clippr maakt clips voor je en helpt je ze snel te
          publiceren op YouTube Shorts, TikTok en Instagram Reels.
        </p>
        <div className="actions">
          <Link href="/clips" className="button primary">
            Open dashboard
          </Link>
          <Link href="/demo" className="button ghost">
            Bekijk demo-flow
          </Link>
          <a href="#pricing" className="button ghost">
            Bekijk pricing
          </a>
        </div>
      </header>

      <section className="section grid3">
        {features.map((feature) => (
          <article className="card" key={feature.title}>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </article>
        ))}
      </section>

      <section className="section split">
        <div>
          <h2>Hoe het werkt</h2>
          <ol className="steps">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
        <div className="card accent">
          <h3>Waarom makers dit fijn vinden</h3>
          <p>
            Je livestream zit vol goede momenten. Met Clippr hoef je niet meer handmatig te zoeken en te knippen.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Architectuur als demo</h2>
          <p className="muted">Een duidelijke, toonbare flow van livestream tot publicatie.</p>
        </div>
        <div className="architecture-grid">
          {architectureLayers.map((layer) => (
            <article key={layer.title} className="card architecture-card">
              <p className="badge">{layer.step}</p>
              <h3>{layer.title}</h3>
              <p>{layer.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="pricing" className="section pricing">
        <h2>Pricing</h2>
        <div className="grid3">
          <article className="card">
            <h3>Starter</h3>
            <p className="price">EUR 29 / maand</p>
            <p>Tot 20 stream-uren per maand, 2 gekoppelde social accounts.</p>
          </article>
          <article className="card featured">
            <h3>Pro</h3>
            <p className="price">EUR 79 / maand</p>
            <p>Tot 100 stream-uren, betere suggesties, plannen van posts en snellere verwerking.</p>
          </article>
          <article className="card">
            <h3>Scale</h3>
            <p className="price">Custom</p>
            <p>Voor teams en agencies met meerdere kanalen en extra ondersteuning.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
