import type { RequestCookies } from 'next/dist/compiled/@edge-runtime/cookies';

export const YOUTUBE_COOKIE_NAME = 'clippr_youtube_session';
export const YOUTUBE_SELECTED_STREAM_COOKIE_NAME = 'clippr_selected_stream';

export interface YouTubeSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  channelId?: string;
  channelTitle?: string;
}

export interface YouTubeChannelInfo {
  id: string;
  title: string;
}

export interface YouTubeLiveStreamInfo {
  id: string;
  title: string;
  status: 'ACTIVE' | 'PROCESSING' | 'FAILED';
}

export interface SelectedYouTubeStream {
  streamId: string;
  title: string;
  channelTitle?: string;
}

export function hasYouTubeOAuthConfig(): boolean {
  return Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET);
}

export function youtubeRedirectUri(): string {
  return process.env.YOUTUBE_REDIRECT_URI ?? 'http://localhost:3000/api/youtube/callback';
}

function encodeState(nextPath: string): string {
  return Buffer.from(nextPath, 'utf8').toString('base64url');
}

export function decodeState(state: string | null): string {
  if (!state) return '/streams';
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    return decoded.startsWith('/') ? decoded : '/streams';
  } catch {
    return '/streams';
  }
}

export function buildYouTubeAuthUrl(nextPath: string): string {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  if (!clientId) {
    throw new Error('Missing YOUTUBE_CLIENT_ID');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: youtubeRedirectUri(),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube.upload',
    ].join(' '),
    state: encodeState(nextPath),
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function serializeYouTubeSession(session: YouTubeSession): string {
  return Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
}

export function parseYouTubeSession(serialized: string | undefined): YouTubeSession | null {
  if (!serialized) return null;
  try {
    return JSON.parse(Buffer.from(serialized, 'base64url').toString('utf8')) as YouTubeSession;
  } catch {
    return null;
  }
}

export function getYouTubeSession(cookiesStore: Pick<RequestCookies, 'get'>): YouTubeSession | null {
  return parseYouTubeSession(cookiesStore.get(YOUTUBE_COOKIE_NAME)?.value);
}

export function serializeSelectedStream(stream: SelectedYouTubeStream): string {
  return Buffer.from(JSON.stringify(stream), 'utf8').toString('base64url');
}

export function parseSelectedStream(serialized: string | undefined): SelectedYouTubeStream | null {
  if (!serialized) return null;
  try {
    return JSON.parse(Buffer.from(serialized, 'base64url').toString('utf8')) as SelectedYouTubeStream;
  } catch {
    return null;
  }
}

export function getSelectedStream(cookiesStore: Pick<RequestCookies, 'get'>): SelectedYouTubeStream | null {
  return parseSelectedStream(cookiesStore.get(YOUTUBE_SELECTED_STREAM_COOKIE_NAME)?.value);
}

export function extractYouTubeVideoId(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.hostname.includes('youtube.com')) {
      const value = url.searchParams.get('v');
      return value && value.length > 0 ? value : null;
    }
    if (url.hostname === 'youtu.be') {
      const value = url.pathname.replace('/', '');
      return value.length > 0 ? value : null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchYouTubeChannel(session: YouTubeSession): Promise<YouTubeChannelInfo | null> {
  const endpoint = 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true';
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as {
    items?: Array<{ id: string; snippet?: { title?: string } }>;
  };
  const channel = payload.items?.[0];
  if (!channel) return null;
  return {
    id: channel.id,
    title: channel.snippet?.title ?? 'YouTube channel',
  };
}

export async function fetchYouTubeActiveStreams(session: YouTubeSession): Promise<YouTubeLiveStreamInfo[]> {
  const endpoint =
    'https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status&broadcastStatus=active&broadcastType=all&mine=true';
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  });

  if (!response.ok) return [];
  const payload = (await response.json()) as {
    items?: Array<{ id: string; snippet?: { title?: string } }>;
  };
  return (payload.items ?? []).map((item) => ({
    id: item.id,
    title: item.snippet?.title ?? 'Livestream',
    status: 'ACTIVE',
  }));
}
