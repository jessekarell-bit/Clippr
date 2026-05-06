import type { HLSSegment } from '@clippr/types';

// Minimal HLS manifest parser for live streams.
// Only handles the subset needed: #EXTINF durations and segment URIs.
function parseM3U8(
  manifestText: string,
  manifestBaseUrl: string,
  streamStartTime: Date,
  startIndex: number
): HLSSegment[] {
  const lines = manifestText.split('\n').map((l) => l.trim()).filter(Boolean);
  const segments: HLSSegment[] = [];
  let pendingDuration: number | null = null;
  let elapsedSecs = 0;
  let index = startIndex;

  for (const line of lines) {
    if (line.startsWith('#EXTINF:')) {
      const durationStr = line.replace('#EXTINF:', '').split(',')[0];
      pendingDuration = parseFloat(durationStr);
    } else if (!line.startsWith('#') && line.length > 0) {
      const duration = pendingDuration ?? 6;
      const uri = line.startsWith('http') ? line : resolveUrl(manifestBaseUrl, line);
      const startedAt = new Date(streamStartTime.getTime() + elapsedSecs * 1000);

      segments.push({ index, uri, durationSecs: duration, startedAt });
      elapsedSecs += duration;
      index++;
      pendingDuration = null;
    }
  }

  return segments;
}

function resolveUrl(base: string, relative: string): string {
  const baseUrl = new URL(base);
  return new URL(relative, baseUrl).toString();
}

function isEndOfStream(manifestText: string): boolean {
  return manifestText.includes('#EXT-X-ENDLIST');
}

export async function fetchManifest(manifestUrl: string): Promise<string> {
  const res = await fetch(manifestUrl, {
    headers: { 'User-Agent': 'Clippr/1.0' },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch HLS manifest: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

export async function downloadSegment(uri: string): Promise<Buffer> {
  const res = await fetch(uri, {
    headers: { 'User-Agent': 'Clippr/1.0' },
  });
  if (!res.ok) {
    throw new Error(`Failed to download segment: ${res.status} ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Fetches the manifest and returns any new segments not yet in seenUris.
// Updates seenUris in-place.
export async function fetchNewSegments(
  manifestUrl: string,
  seenUris: Set<string>,
  streamStartTime: Date,
  nextIndex: number
): Promise<{ segments: HLSSegment[]; isEnd: boolean }> {
  const manifestText = await fetchManifest(manifestUrl);
  const allSegments = parseM3U8(manifestText, manifestUrl, streamStartTime, nextIndex);

  const newSegments = allSegments.filter((s) => !seenUris.has(s.uri));
  for (const s of newSegments) {
    seenUris.add(s.uri);
  }

  return {
    segments: newSegments,
    isEnd: isEndOfStream(manifestText),
  };
}

export async function runIngestLoop(opts: {
  streamId: string;
  manifestUrl: string;
  streamStartTime: Date;
  onSegment: (segment: HLSSegment, buffer: Buffer) => Promise<void>;
  shouldStop: () => boolean;
  pollIntervalMs?: number;
}): Promise<void> {
  const {
    streamId,
    manifestUrl,
    streamStartTime,
    onSegment,
    shouldStop,
    pollIntervalMs = 4000,
  } = opts;

  const seenUris = new Set<string>();
  let nextIndex = 0;
  let consecutiveErrors = 0;

  console.log(`[ingestLoop] Starting for stream ${streamId}`);

  while (!shouldStop()) {
    try {
      const { segments, isEnd } = await fetchNewSegments(
        manifestUrl,
        seenUris,
        streamStartTime,
        nextIndex
      );

      for (const segment of segments) {
        const buffer = await downloadSegment(segment.uri);
        await onSegment(segment, buffer);
        nextIndex = segment.index + 1;
      }

      consecutiveErrors = 0;

      if (isEnd) {
        console.log(`[ingestLoop] Stream ${streamId} ended (EXT-X-ENDLIST)`);
        break;
      }
    } catch (err) {
      consecutiveErrors++;
      console.error(`[ingestLoop] Error (attempt ${consecutiveErrors}):`, err);

      // Back off on repeated errors, give up after 10 consecutive failures
      if (consecutiveErrors >= 10) {
        throw new Error(`Ingest loop failed after ${consecutiveErrors} consecutive errors`);
      }

      await sleep(Math.min(pollIntervalMs * consecutiveErrors, 30_000));
      continue;
    }

    await sleep(pollIntervalMs);
  }

  console.log(`[ingestLoop] Finished for stream ${streamId}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
