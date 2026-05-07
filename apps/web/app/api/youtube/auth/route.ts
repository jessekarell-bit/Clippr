import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '../../../lib/auth';
import { buildYouTubeAuthUrl, hasYouTubeOAuthConfig } from '../../../lib/youtube';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const isAuthed = request.cookies.get(AUTH_COOKIE_NAME)?.value === 'authenticated';
  if (!isAuthed) {
    return NextResponse.redirect(new URL('/login?next=/streams', request.url));
  }

  if (!hasYouTubeOAuthConfig()) {
    return NextResponse.redirect(new URL('/streams?youtube=missing_config', request.url));
  }

  const nextPath = request.nextUrl.searchParams.get('next') ?? '/streams';
  const authUrl = buildYouTubeAuthUrl(nextPath);
  return NextResponse.redirect(authUrl);
}
