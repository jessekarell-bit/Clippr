import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '../../../lib/auth';
import {
  YOUTUBE_SELECTED_STREAM_COOKIE_NAME,
  extractYouTubeVideoId,
  serializeSelectedStream,
} from '../../../lib/youtube';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const isAuthed = request.cookies.get(AUTH_COOKIE_NAME)?.value === 'authenticated';
  if (!isAuthed) {
    return NextResponse.redirect(new URL('/login?next=/streams', request.url));
  }

  const streamId = request.nextUrl.searchParams.get('streamId');
  const title = request.nextUrl.searchParams.get('title');
  const videoUrl = request.nextUrl.searchParams.get('videoUrl');
  const channelTitle = request.nextUrl.searchParams.get('channelTitle') ?? undefined;
  const nextPath = request.nextUrl.searchParams.get('next') ?? '/streams';

  let resolvedStreamId = streamId ?? '';
  let resolvedTitle = title ?? '';
  let resolvedChannelTitle = channelTitle;

  if ((!resolvedStreamId || !resolvedTitle) && videoUrl) {
    const videoId = extractYouTubeVideoId(videoUrl);
    if (!videoId) {
      return NextResponse.redirect(new URL('/streams?youtube=invalid_url', request.url));
    }

    resolvedStreamId = videoId;

    try {
      const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
      const metadataResponse = await fetch(endpoint, { cache: 'no-store' });
      if (metadataResponse.ok) {
        const payload = (await metadataResponse.json()) as { title?: string; author_name?: string };
        resolvedTitle = payload.title ?? `YouTube video ${videoId}`;
        resolvedChannelTitle = payload.author_name ?? resolvedChannelTitle;
      }
    } catch {
      // Fallback values are used below.
    }

    if (!resolvedTitle) {
      resolvedTitle = `YouTube video ${videoId}`;
    }
  }

  if (!resolvedStreamId || !resolvedTitle) {
    return NextResponse.redirect(new URL('/streams?youtube=select_failed', request.url));
  }

  const response = NextResponse.redirect(new URL(`${nextPath}?youtube=stream_selected`, request.url));
  response.cookies.set(
    YOUTUBE_SELECTED_STREAM_COOKIE_NAME,
    serializeSelectedStream({ streamId: resolvedStreamId, title: resolvedTitle, channelTitle: resolvedChannelTitle }),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    },
  );
  return response;
}
