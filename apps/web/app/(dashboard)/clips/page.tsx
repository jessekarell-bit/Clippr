import Link from 'next/link';
import { cookies } from 'next/headers';
import { prisma } from '@clippr/database';
import ShortPreviewPlayer, { type HighlightPhase } from '../../components/short-preview-player';
import { getSelectedStream, getYouTubeSession } from '../../lib/youtube';
import { buildHighlightPhases, buildHookTitle } from '../../lib/highlight-plan';

type ClipRow = {
  id: string;
  title: string | null;
  aiScore: number;
  status: string;
  s3Url: string;
  sourceLabel?: string;
  thumbnailUrl?: string;
  youtubeVideoId?: string;
  phases?: HighlightPhase[];
  shortWindow?: string;
};

interface ClipsPageProps {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; page?: string; duration?: string }>;
}

const STATUS_TABS = [
  { value: 'all', label: 'Alles' },
  { value: 'PENDING_REVIEW', label: 'Nakijken' },
  { value: 'APPROVED', label: 'Goedgekeurd' },
  { value: 'PUBLISHED', label: 'Geplaatst' },
  { value: 'REJECTED', label: 'Afgekeurd' },
] as const;

const PAGE_SIZE = 6;
const ALLOWED_DURATIONS = [10, 20, 30] as const;

function statusLabel(status: string): string {
  return status.replaceAll('_', ' ').toLowerCase();
}

function toQueryString(params: { q: string; status: string; sort: string; page: number; duration: number }): string {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.status !== 'all') query.set('status', params.status);
  if (params.sort !== 'score_desc') query.set('sort', params.sort);
  if (params.duration !== 30) query.set('duration', String(params.duration));
  if (params.page > 1) query.set('page', String(params.page));
  const value = query.toString();
  return value.length > 0 ? `?${value}` : '';
}

function applyFilters(clips: ClipRow[], q: string, status: string, sort: string): ClipRow[] {
  let filtered = clips;

  if (q.trim().length > 0) {
    const query = q.toLowerCase();
    filtered = filtered.filter((clip) => (clip.title ?? '').toLowerCase().includes(query));
  }

  if (status !== 'all') {
    filtered = filtered.filter((clip) => clip.status === status);
  }

  if (sort === 'score_asc') {
    filtered = [...filtered].sort((a, b) => a.aiScore - b.aiScore);
  } else if (sort === 'title_asc') {
    filtered = [...filtered].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
  } else {
    filtered = [...filtered].sort((a, b) => b.aiScore - a.aiScore);
  }

  return filtered;
}

export default async function ClipsPage({ searchParams }: ClipsPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const youtubeSession = getYouTubeSession(cookieStore);
  const selectedStream = getSelectedStream(cookieStore);
  const q = params.q ?? '';
  const status = params.status ?? 'all';
  const sort = params.sort ?? 'score_desc';
  const parsedDuration = Number(params.duration ?? '30');
  const duration = ALLOWED_DURATIONS.includes(parsedDuration as (typeof ALLOWED_DURATIONS)[number]) ? parsedDuration : 30;
  const currentPage = Math.max(1, Number(params.page ?? '1'));

  let dbUnavailable = false;
  let clips: ClipRow[] = [];

  try {
    clips = (await prisma.clip.findMany({
      orderBy: { aiScore: 'desc' },
      take: 50,
      select: { id: true, title: true, aiScore: true, status: true, s3Url: true },
    })) as ClipRow[];
  } catch {
    dbUnavailable = true;
    const videoId = selectedStream?.streamId;
    const sourceLabel = selectedStream?.title ?? 'Demo livestream';
    const windowLabel = (clipId: string) => {
      const phases = buildHighlightPhases({
        clipId,
        duration,
        streamId: selectedStream?.streamId,
        streamTitle: sourceLabel,
      });
      const start = phases[0]?.start ?? 0;
      const end = phases.at(-1)?.end ?? start + duration;
      const window = { start, end };
      return `${window.start}s-${window.end}s`;
    };
    clips = [
      {
        id: 'demo-1',
        title: buildHookTitle(
          'demo-1',
          duration,
          sourceLabel,
          buildHighlightPhases({ clipId: 'demo-1', duration, streamId: selectedStream?.streamId, streamTitle: sourceLabel }),
        ),
        aiScore: 92.4,
        status: 'PENDING_REVIEW',
        s3Url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        sourceLabel,
        thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined,
        youtubeVideoId: videoId,
        phases: buildHighlightPhases({
          clipId: 'demo-1',
          duration,
          streamId: selectedStream?.streamId,
          streamTitle: sourceLabel,
        }) as HighlightPhase[],
        shortWindow: windowLabel('demo-1'),
      },
      {
        id: 'demo-2',
        title: buildHookTitle(
          'demo-2',
          duration,
          sourceLabel,
          buildHighlightPhases({ clipId: 'demo-2', duration, streamId: selectedStream?.streamId, streamTitle: sourceLabel }),
        ),
        aiScore: 87.1,
        status: 'APPROVED',
        s3Url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        sourceLabel,
        thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined,
        youtubeVideoId: videoId,
        phases: buildHighlightPhases({
          clipId: 'demo-2',
          duration,
          streamId: selectedStream?.streamId,
          streamTitle: sourceLabel,
        }) as HighlightPhase[],
        shortWindow: windowLabel('demo-2'),
      },
      {
        id: 'demo-3',
        title: buildHookTitle(
          'demo-3',
          duration,
          sourceLabel,
          buildHighlightPhases({ clipId: 'demo-3', duration, streamId: selectedStream?.streamId, streamTitle: sourceLabel }),
        ),
        aiScore: 82.8,
        status: 'PUBLISHED',
        s3Url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        sourceLabel,
        thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined,
        youtubeVideoId: videoId,
        phases: buildHighlightPhases({
          clipId: 'demo-3',
          duration,
          streamId: selectedStream?.streamId,
          streamTitle: sourceLabel,
        }) as HighlightPhase[],
        shortWindow: windowLabel('demo-3'),
      },
      {
        id: 'demo-4',
        title: buildHookTitle(
          'demo-4',
          duration,
          sourceLabel,
          buildHighlightPhases({ clipId: 'demo-4', duration, streamId: selectedStream?.streamId, streamTitle: sourceLabel }),
        ),
        aiScore: 76.5,
        status: 'REJECTED',
        s3Url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        sourceLabel,
        thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined,
        youtubeVideoId: videoId,
        phases: buildHighlightPhases({
          clipId: 'demo-4',
          duration,
          streamId: selectedStream?.streamId,
          streamTitle: sourceLabel,
        }) as HighlightPhase[],
        shortWindow: windowLabel('demo-4'),
      },
      {
        id: 'demo-5',
        title: buildHookTitle(
          'demo-5',
          duration,
          sourceLabel,
          buildHighlightPhases({ clipId: 'demo-5', duration, streamId: selectedStream?.streamId, streamTitle: sourceLabel }),
        ),
        aiScore: 79.2,
        status: 'PENDING_REVIEW',
        s3Url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        sourceLabel,
        thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined,
        youtubeVideoId: videoId,
        phases: buildHighlightPhases({
          clipId: 'demo-5',
          duration,
          streamId: selectedStream?.streamId,
          streamTitle: sourceLabel,
        }) as HighlightPhase[],
        shortWindow: windowLabel('demo-5'),
      },
      {
        id: 'demo-6',
        title: buildHookTitle(
          'demo-6',
          duration,
          sourceLabel,
          buildHighlightPhases({ clipId: 'demo-6', duration, streamId: selectedStream?.streamId, streamTitle: sourceLabel }),
        ),
        aiScore: 84.6,
        status: 'APPROVED',
        s3Url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        sourceLabel,
        thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined,
        youtubeVideoId: videoId,
        phases: buildHighlightPhases({
          clipId: 'demo-6',
          duration,
          streamId: selectedStream?.streamId,
          streamTitle: sourceLabel,
        }) as HighlightPhase[],
        shortWindow: windowLabel('demo-6'),
      },
      {
        id: 'demo-7',
        title: buildHookTitle(
          'demo-7',
          duration,
          sourceLabel,
          buildHighlightPhases({ clipId: 'demo-7', duration, streamId: selectedStream?.streamId, streamTitle: sourceLabel }),
        ),
        aiScore: 90.3,
        status: 'PENDING_REVIEW',
        s3Url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        sourceLabel,
        thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined,
        youtubeVideoId: videoId,
        phases: buildHighlightPhases({
          clipId: 'demo-7',
          duration,
          streamId: selectedStream?.streamId,
          streamTitle: sourceLabel,
        }) as HighlightPhase[],
        shortWindow: windowLabel('demo-7'),
      },
    ];
  }

  const visibleClips = applyFilters(clips, q, status, sort);
  const counts = {
    all: clips.length,
    PENDING_REVIEW: clips.filter((clip) => clip.status === 'PENDING_REVIEW').length,
    APPROVED: clips.filter((clip) => clip.status === 'APPROVED').length,
    PUBLISHED: clips.filter((clip) => clip.status === 'PUBLISHED').length,
    REJECTED: clips.filter((clip) => clip.status === 'REJECTED').length,
  };
  const totalPages = Math.max(1, Math.ceil(visibleClips.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageClips = visibleClips.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <main className="site clip-dashboard">
      <header className="clips-header">
        <div>
          <p className="badge">Creator dashboard</p>
          <h1>Generated clips</h1>
          <p className="subtitle">Bekijk je clips, kies de beste en zet ze snel online.</p>
        </div>
        <div className="clips-actions">
          <Link href="/clips" className="button ghost">
            Wis filters
          </Link>
        </div>
      </header>

      {dbUnavailable ? (
        <p className="demo-note">
          Demo-modus: clips zijn voorbeelden op basis van je YouTube-link en worden niet gepubliceerd.
        </p>
      ) : null}

      <section className="card youtube-connect-card">
        <div>
          <h3>YouTube bron</h3>
          <p className="muted">
            {youtubeSession?.channelTitle
              ? `Clips worden gemaakt op basis van ${youtubeSession.channelTitle}.`
              : 'Koppel YouTube in Streams om clips uit je eigen livestreams te maken.'}
          </p>
        </div>
        <div className="topbar-actions">
          <Link href="/streams" className="button ghost">
            Open Streams
          </Link>
        </div>
      </section>

      <section className="clips-status-tabs">
        {STATUS_TABS.map((tab) => {
          const href = `/clips${toQueryString({ q, status: tab.value, sort, page: 1, duration })}`;
          const isActive = status === tab.value;
          return (
            <Link key={tab.value} href={href} className={`status-tab${isActive ? ' is-active' : ''}`}>
              {tab.label} <span className="status-tab-count">{counts[tab.value]}</span>
            </Link>
          );
        })}
      </section>

      <section className="clips-stats">
        <article className="card">
          <p>Totaal clips</p>
          <strong>{clips.length}</strong>
        </article>
        <article className="card">
          <p>Nog na te kijken</p>
          <strong>{clips.filter((clip) => clip.status === 'PENDING_REVIEW').length}</strong>
        </article>
        <article className="card">
          <p>Gemiddelde score</p>
          <strong>{clips.length ? (clips.reduce((acc, clip) => acc + clip.aiScore, 0) / clips.length).toFixed(1) : '0.0'}</strong>
        </article>
      </section>

      <form className="clips-filterbar card" method="get">
        <input type="text" name="q" placeholder="Zoek op titel..." defaultValue={q} />
        <input type="hidden" name="status" value={status} />
        <select name="duration" defaultValue={String(duration)}>
          <option value="10">Duur: 10 seconden</option>
          <option value="20">Duur: 20 seconden</option>
          <option value="30">Duur: 30 seconden</option>
        </select>
        <select name="sort" defaultValue={sort}>
          <option value="score_desc">Sorteer: hoogste score</option>
          <option value="score_asc">Sorteer: laagste score</option>
          <option value="title_asc">Sorteer: titel A-Z</option>
        </select>
        <button type="submit" className="button primary">
          Toepassen
        </button>
      </form>
      <p className="muted results-meta">
        Je ziet {pageClips.length} van {visibleClips.length} clips
        {q ? ` for "${q}"` : ''}.
      </p>

      <ul className="clips-grid">
        {pageClips.map((clip) => (
          <li key={clip.id} className="clip-card">
            <div className="thumb-preview">
              {clip.youtubeVideoId && clip.phases ? (
                <ShortPreviewPlayer
                  className="thumb-iframe"
                  videoId={clip.youtubeVideoId}
                  phases={clip.phases}
                  loopPlayback
                  autoPlay={false}
                />
              ) : (
                <video className="thumb-video" src={clip.s3Url} muted playsInline preload="metadata" />
              )}
              {clip.thumbnailUrl ? (
                <img className="thumb-image" src={clip.thumbnailUrl} alt="YouTube thumbnail" />
              ) : null}
              <span className="thumb-label">9:16 Preview</span>
            </div>
            <div className="clip-meta">
              <strong>{clip.title ?? 'Untitled clip'}</strong>
              {clip.sourceLabel ? <p className="muted clip-source">Bron: {clip.sourceLabel}</p> : null}
              {clip.phases ? (
                <p className="muted clip-source">Fases: {clip.phases.map((phase) => `${phase.start}-${phase.end}s`).join(' + ')}</p>
              ) : null}
              <div className="clip-row">
                <span className="score-pill">Score {clip.aiScore.toFixed(1)}</span>
                <span className="status-pill">{statusLabel(clip.status)}</span>
                {clip.shortWindow ? <span className="status-pill">Short {clip.shortWindow}</span> : null}
              </div>
              <Link href={`/clips/${clip.id}?duration=${duration}`} className="button ghost">
                Openen
              </Link>
            </div>
          </li>
        ))}
      </ul>

      {visibleClips.length === 0 ? <p className="demo-note">Geen clips gevonden. Probeer andere filters.</p> : null}

      {visibleClips.length > 0 ? (
        <nav className="pagination">
          <Link
            href={`/clips${toQueryString({ q, status, sort, page: Math.max(1, page - 1), duration })}`}
            className={`button ghost${page === 1 ? ' is-disabled' : ''}`}
            aria-disabled={page === 1}
          >
            Vorige
          </Link>
          <span className="muted">
            Pagina {page} / {totalPages}
          </span>
          <Link
            href={`/clips${toQueryString({ q, status, sort, page: Math.min(totalPages, page + 1), duration })}`}
            className={`button ghost${page === totalPages ? ' is-disabled' : ''}`}
            aria-disabled={page === totalPages}
          >
            Volgende
          </Link>
        </nav>
      ) : null}
    </main>
  );
}
