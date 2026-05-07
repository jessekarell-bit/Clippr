import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '../../../lib/auth';
import { YOUTUBE_COOKIE_NAME } from '../../../lib/youtube';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const isAuthed = request.cookies.get(AUTH_COOKIE_NAME)?.value === 'authenticated';
  if (!isAuthed) {
    return NextResponse.redirect(new URL('/login?next=/streams', request.url));
  }

  const response = NextResponse.redirect(new URL('/streams?youtube=disconnected', request.url));
  response.cookies.delete(YOUTUBE_COOKIE_NAME);
  return response;
}
