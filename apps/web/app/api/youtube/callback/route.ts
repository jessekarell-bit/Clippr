import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '../../../lib/auth';
import {
  YOUTUBE_COOKIE_NAME,
  decodeState,
  fetchYouTubeChannel,
  hasYouTubeOAuthConfig,
  serializeYouTubeSession,
  youtubeRedirectUri,
} from '../../../lib/youtube';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const isAuthed = request.cookies.get(AUTH_COOKIE_NAME)?.value === 'authenticated';
  if (!isAuthed) {
    return NextResponse.redirect(new URL('/login?next=/streams', request.url));
  }

  if (!hasYouTubeOAuthConfig()) {
    return NextResponse.redirect(new URL('/streams?youtube=missing_config', request.url));
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  if (!code) {
    return NextResponse.redirect(new URL('/streams?youtube=missing_code', request.url));
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      redirect_uri: youtubeRedirectUri(),
      grant_type: 'authorization_code',
    }),
    cache: 'no-store',
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(new URL('/streams?youtube=token_error', request.url));
  }

  const tokenPayload = (await tokenResponse.json()) as TokenResponse;
  const expiresAt = tokenPayload.expires_in ? Date.now() + tokenPayload.expires_in * 1000 : undefined;

  const session = {
    accessToken: tokenPayload.access_token,
    refreshToken: tokenPayload.refresh_token,
    expiresAt,
  };

  const channel = await fetchYouTubeChannel(session);
  const enrichedSession = {
    ...session,
    channelId: channel?.id,
    channelTitle: channel?.title,
  };

  const nextPath = decodeState(state);
  const response = NextResponse.redirect(new URL(`${nextPath}?youtube=connected`, request.url));
  response.cookies.set(YOUTUBE_COOKIE_NAME, serializeYouTubeSession(enrichedSession), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
