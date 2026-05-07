import Link from 'next/link';
import { cookies } from 'next/headers';
import { prisma } from '@clippr/database';
import { approveAndScheduleClip, rejectClip } from '../../../actions/clip-actions';
import ShortPreviewPlayer, { type HighlightPhase } from '../../../components/short-preview-player';
import { getSelectedStream } from '../../../lib/youtube';
import { buildHighlightPhases, buildHookTitle } from '../../../lib/highlight-plan';

interface ClipDetailPageProps {
  params: Promise<{ clipId: string }>;
  searchParams: Promise<{ duration?: string }>;
}

type Clip = {
  id: string;
  userId: string;
  title: string | null;
  s3Url: string;
  aiScore: number;
  status: string;
};

function statusLabel(status: string): string {
  return status.replaceAll('_', ' ').toLowerCase();
}

export default async function ClipDetailPage({ params, searchParams }: ClipDetailPageProps) {
  const { clipId } = await params;
  const query = await searchParams;
  const parsedDuration = Number(query.duration ?? '30');
  const duration = parsedDuration === 10 || parsedDuration === 20 || parsedDuration === 30 ? parsedDuration : 30;
  const cookieStore = await cookies();
  const selectedStream = getSelectedStream(cookieStore);
  const sourceLabel = selectedStream?.title ?? 'Demo livestream';
  const phases = buildHighlightPhases({
    clipId,
    duration,
    streamId: selectedStream?.streamId,
    streamTitle: sourceLabel,
  }) as HighlightPhase[];
  const clipWindow = {
    start: phases[0]?.start ?? 0,
    end: phases.at(-1)?.end ?? duration,
  };

  let dbUnavailable = false;
  let clip: Clip | null = null;

  try {
    clip = (await prisma.clip.findUnique({ where: { id: clipId } })) as Clip | null;
  } catch {
    dbUnavailable = true;
    clip = {
      id: clipId,
      userId: 'demo-user',
      title: buildHookTitle(clipId, duration, sourceLabel, phases),
      s3Url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      aiScore: 88.3,
      status: 'PENDING_REVIEW',
    };
  }

  if (!clip) {
    return (
      <main className="site">
        <p className="demo-note">Clip not found.</p>
        <Link href="/clips" className="button ghost">
          Back to dashboard
        </Link>
      </main>
    );
  }

  const insights = [
    { label: 'Geluidspiek', value: '92 / 100', detail: 'Op dit moment was het geluid duidelijk hoger dan normaal.' },
    { label: 'Chat-activiteit', value: '78 / 100', detail: 'Veel meer reacties in chat dan gemiddeld.' },
    { label: 'Tekstsignaal', value: '1.3x', detail: 'Opvallende woorden in spraak herkend.' },
  ];

  const publishLog = [
    { platform: 'YouTube Shorts', status: 'queued', detail: 'Wacht op jouw goedkeuring.' },
    { platform: 'TikTok', status: 'queued', detail: 'Wacht op jouw goedkeuring.' },
    { platform: 'Instagram Reels', status: 'queued', detail: 'Wacht op jouw goedkeuring.' },
  ];

  const qaChecks = [
    { label: 'Ondertitels lopen gelijk', value: 'In orde' },
    { label: 'Beeld past in 9:16', value: 'In orde' },
    { label: 'Lengte is goed', value: 'In orde' },
  ];

  const navigation = [
    { label: 'Vorige clip', href: `/clips/demo-2?duration=${duration}` },
    { label: 'Volgende clip', href: `/clips/demo-7?duration=${duration}` },
  ];

  return (
    <main className="site clip-detail">
      <div className="breadcrumb">
        <Link href="/clips">Clips</Link>
        <span>/</span>
        <span className="muted">Clip detail</span>
      </div>

      <header className="detail-header">
        <div>
          <p className="badge">Clip review</p>
          <h1>{clip.title ?? 'Untitled clip'}</h1>
          <div className="clip-row">
            <span className="score-pill">Score {clip.aiScore.toFixed(1)}</span>
            <span className="status-pill">{statusLabel(clip.status)}</span>
          </div>
        </div>
        <div className="clips-actions">
          <Link href={`/clips?duration=${duration}`} className="button ghost">
            Back
          </Link>
        </div>
      </header>

      {dbUnavailable ? (
        <p className="demo-note">
          Demo-modus: deze preview gebruikt je YouTube-link en plaatst niets online.
        </p>
      ) : null}

      {selectedStream ? (
        <section className="card youtube-connect-card">
          <div>
            <h3>Echte demo output</h3>
            <p className="muted">
              Download een echte {duration}s MP4 op basis van deze YouTube-video.
            </p>
          </div>
          <div className="topbar-actions">
            <a href={`/api/demo/export?clipId=${clipId}&duration=${duration}`} className="button primary">
              Download {duration}s output
            </a>
          </div>
        </section>
      ) : null}

      <section className="clips-status-tabs">
        {[10, 20, 30].map((value) => (
          <Link
            key={value}
            href={`/clips/${clipId}?duration=${value}`}
            className={`status-tab${duration === value ? ' is-active' : ''}`}
          >
            {value}s
          </Link>
        ))}
      </section>

      <nav className="detail-quick-nav">
        {navigation.map((item) => (
          <Link key={item.label} href={item.href} className="button ghost">
            {item.label}
          </Link>
        ))}
      </nav>

      <section className="detail-grid">
        <div className="player-pane card">
          {selectedStream ? (
            <ShortPreviewPlayer
              videoId={selectedStream.streamId}
              phases={phases}
              className="vertical-player"
              showControls
              loopPlayback
              autoPlay={false}
            />
          ) : (
            <video src={clip.s3Url} controls className="vertical-player" />
          )}
          <div className="player-meta">
            <div>
              <p className="muted">Duration</p>
              <strong>{clipWindow.end - clipWindow.start} seconden</strong>
            </div>
            <div>
              <p className="muted">Source stream</p>
              <strong>{selectedStream?.title ?? 'Livestream - demo'}</strong>
            </div>
            <div>
              <p className="muted">Generated</p>
              <strong>Segment {clipWindow.start}s - {clipWindow.end}s</strong>
            </div>
          </div>
          <p className="muted">Highlight fases: {phases.map((phase) => `${phase.start}-${phase.end}s`).join(' + ')}</p>
        </div>

        <aside className="actions-pane card">
          <h3>Publicatie-instellingen</h3>
          {dbUnavailable ? (
            <p className="muted">Demo-stand: je kunt alles testen, maar er wordt niets gepubliceerd.</p>
          ) : null}
          {!dbUnavailable ? (
          <form action={approveAndScheduleClip} className="action-form">
            <input type="hidden" name="clipId" value={clip.id} />
            <input type="hidden" name="userId" value={clip.userId} />

            <label>
              <span className="muted">Titel</span>
              <input type="text" name="title" defaultValue={clip.title ?? 'Nieuwe clip'} />
            </label>

            <label>
              <span className="muted">Beschrijving</span>
              <textarea name="caption" rows={3} placeholder="Optionele tekst voor je post" />
            </label>

            <fieldset className="platform-grid">
              <legend className="muted">Kanalen</legend>
              <label className="platform-option">
                <input type="checkbox" defaultChecked /> YouTube Shorts
              </label>
              <label className="platform-option">
                <input type="checkbox" defaultChecked /> TikTok
              </label>
              <label className="platform-option">
                <input type="checkbox" defaultChecked /> Instagram Reels
              </label>
            </fieldset>

            <label>
              <span className="muted">Planmoment</span>
              <input type="datetime-local" name="scheduledAt" />
            </label>

            <button type="submit" className="button primary block">
              Goedkeuren en klaarzetten
            </button>
          </form>
          ) : (
            <div className="action-form">
              <button type="button" className="button primary block is-disabled">
                Demo gegenereerd (geen publicatie)
              </button>
            </div>
          )}

          {!dbUnavailable ? (
            <form action={rejectClip} className="reject-form">
              <input type="hidden" name="clipId" value={clip.id} />
              <button type="submit" className="button ghost block">
                Clip afkeuren
              </button>
            </form>
          ) : null}
        </aside>
      </section>

      <section className="insights">
        <div className="section-head">
          <h3>AI insights</h3>
          <p className="muted">Waarom deze clip als sterk moment is gekozen.</p>
        </div>
        <div className="grid3">
          {insights.map((item) => (
            <article className="card" key={item.label}>
              <p className="muted">{item.label}</p>
              <strong className="insight-value">{item.value}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h3>Quality checks</h3>
          <p className="muted">Snelle controles zodat je clip direct geplaatst kan worden.</p>
        </div>
        <div className="grid3">
          {qaChecks.map((check) => (
            <article className="card" key={check.label}>
              <p className="muted">{check.label}</p>
              <strong>{check.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="publish-log">
        <div className="section-head">
          <h3>Publish log</h3>
          <p className="muted">Status per kanaal nadat je op goedkeuren klikt.</p>
        </div>
        <ul className="log-list">
          {publishLog.map((entry) => (
            <li key={entry.platform} className="card log-entry">
              <div>
                <strong>{entry.platform}</strong>
                <p className="muted">{entry.detail}</p>
              </div>
              <span className="status-pill">{entry.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
