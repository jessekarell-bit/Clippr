import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import ffmpegPath from 'ffmpeg-static';
import { extractYouTubeVideoId, parseSelectedStream, YOUTUBE_SELECTED_STREAM_COOKIE_NAME } from '../../../lib/youtube';
import { buildHighlightPhases } from '../../../lib/highlight-plan';

const execFileAsync = promisify(execFile);

interface Phase {
  start: number;
  end: number;
}

export const runtime = 'nodejs';

function buildYouTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  let tempDir = '';
  try {
    const selected = parseSelectedStream(request.cookies.get(YOUTUBE_SELECTED_STREAM_COOKIE_NAME)?.value);
    const clipId = request.nextUrl.searchParams.get('clipId') ?? 'demo-1';
    const parsedDuration = Number(request.nextUrl.searchParams.get('duration') ?? '30');
    const duration = parsedDuration === 10 || parsedDuration === 20 || parsedDuration === 30 ? parsedDuration : 30;
    const providedUrl = request.nextUrl.searchParams.get('videoUrl');
    const providedId = providedUrl ? extractYouTubeVideoId(providedUrl) : null;
    const videoId = providedId ?? selected?.streamId;

    if (!videoId) {
      return NextResponse.json(
        { error: 'Geen YouTube video geselecteerd. Kies eerst een video in Streams.' },
        { status: 400 },
      );
    }

    if (!ffmpegPath) {
      return NextResponse.json({ error: 'FFmpeg binary niet gevonden in deze omgeving.' }, { status: 500 });
    }

    tempDir = await mkdtemp(path.join(os.tmpdir(), 'clippr-demo-'));
    const sourcePath = path.join(tempDir, 'source.mp4');
    const outputPath = path.join(tempDir, `clippr-${clipId}-${duration}s.mp4`);
    const phases = buildHighlightPhases({
      clipId,
      duration,
      streamId: videoId,
      streamTitle: selected?.title ?? '',
    }) as Phase[];

    const youtubeDlExec = (await import('youtube-dl-exec')).default as unknown as (
      url: string,
      flags: Record<string, unknown>,
    ) => Promise<unknown>;

    await youtubeDlExec(buildYouTubeUrl(videoId), {
      format: 'mp4[height<=1080]/mp4/best',
      output: sourcePath,
      noWarnings: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
    });

    const partPaths: string[] = [];
    for (let index = 0; index < phases.length; index += 1) {
      const phase = phases[index];
      const partPath = path.join(tempDir, `part-${index}.mp4`);
      await execFileAsync(ffmpegPath, [
        '-y',
        '-ss',
        String(phase.start),
        '-to',
        String(phase.end),
        '-i',
        sourcePath,
        '-vf',
        'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '24',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
        partPath,
      ]);
      partPaths.push(partPath);
    }

    if (partPaths.length === 1) {
      await execFileAsync(ffmpegPath, ['-y', '-i', partPaths[0], '-c', 'copy', outputPath]);
    } else {
      const transitionDuration = 0.6;
      const filterParts: string[] = [];
      const totalParts = partPaths.length;
      const segmentDurations = phases.map((phase) => Math.max(0.1, phase.end - phase.start));

      for (let index = 0; index < totalParts; index += 1) {
        filterParts.push(`[${index}:v]format=yuv420p[v${index}]`);
      }

      let previousVideoLabel = 'v0';
      let compositeDuration = segmentDurations[0];
      for (let index = 1; index < totalParts; index += 1) {
        const outputLabel = `vx${index}`;
        const offset = compositeDuration - transitionDuration;
        filterParts.push(
          `[${previousVideoLabel}][v${index}]xfade=transition=fadeblack:duration=${transitionDuration}:offset=${offset.toFixed(2)}[${outputLabel}]`,
        );
        previousVideoLabel = outputLabel;
        compositeDuration = compositeDuration + segmentDurations[index] - transitionDuration;
      }

      let previousAudioLabel = '0:a';
      for (let index = 1; index < totalParts; index += 1) {
        const outputLabel = `ax${index}`;
        filterParts.push(`[${previousAudioLabel}][${index}:a]acrossfade=d=${transitionDuration}:c1=tri:c2=tri[${outputLabel}]`);
        previousAudioLabel = outputLabel;
      }

      const mergeArgs: string[] = ['-y'];
      partPaths.forEach((partPath) => {
        mergeArgs.push('-i', partPath);
      });

      mergeArgs.push(
        '-filter_complex',
        filterParts.join(';'),
        '-map',
        `[${previousVideoLabel}]`,
        '-map',
        `[${previousAudioLabel}]`,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
        outputPath,
      );

      await execFileAsync(ffmpegPath, mergeArgs);
    }

    const outputBuffer = await readFile(outputPath);
    return new NextResponse(outputBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="clippr-${clipId}-${duration}s.mp4"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Kon demo output niet genereren.', detail: error instanceof Error ? error.message : 'Onbekende fout' },
      { status: 500 },
    );
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
