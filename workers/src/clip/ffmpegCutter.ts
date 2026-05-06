import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { downloadToBuffer, uploadBuffer, s3, BUCKET } from '../lib/s3.js';
import { query } from '../lib/db.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';

export async function cutRawClip(opts: {
  streamId: string;
  clipId: string;
  startOffsetSecs: number;
  endOffsetSecs: number;
}): Promise<string> {
  const { streamId, clipId, startOffsetSecs, endOffsetSecs } = opts;
  const duration = endOffsetSecs - startOffsetSecs;

  // Fetch segments covering the requested time range
  const segments = await query<{
    segment_index: number;
    s3_key: string;
    duration_secs: string;
    started_at: string;
  }>(
    `SELECT segment_index, s3_key, duration_secs, started_at
     FROM stream_segments
     WHERE stream_id = $1
     ORDER BY segment_index`,
    [streamId]
  );

  if (segments.length === 0) {
    throw new Error(`No segments found for stream ${streamId}`);
  }

  // Find which segments overlap with [startOffsetSecs, endOffsetSecs]
  const streamStart = new Date(segments[0].started_at).getTime() / 1000;
  const relevantSegments = segments.filter((seg) => {
    const segStart = new Date(seg.started_at).getTime() / 1000 - streamStart;
    const segEnd = segStart + parseFloat(seg.duration_secs);
    return segEnd > startOffsetSecs && segStart < endOffsetSecs;
  });

  if (relevantSegments.length === 0) {
    throw new Error(`No segments overlap with time range [${startOffsetSecs}, ${endOffsetSecs}]`);
  }

  const tmpDir = join(tmpdir(), randomUUID());
  mkdirSync(tmpDir);

  try {
    // Download relevant segments
    const segPaths: string[] = [];
    for (const seg of relevantSegments) {
      const buf = await downloadToBuffer(seg.s3_key);
      const segPath = join(tmpDir, `${seg.segment_index}.ts`);
      writeFileSync(segPath, buf);
      segPaths.push(segPath);
    }

    // Write concat file
    const concatFile = join(tmpDir, 'concat.txt');
    writeFileSync(
      concatFile,
      segPaths.map((p) => `file '${p}'`).join('\n')
    );

    // Compute trim offset relative to first segment start
    const firstSegStart =
      new Date(relevantSegments[0].started_at).getTime() / 1000 - streamStart;
    const trimStart = startOffsetSecs - firstSegStart;

    const outputPath = join(tmpDir, 'raw.mp4');

    await ffmpegRun([
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFile,
      '-ss', String(Math.max(0, trimStart)),
      '-t', String(duration),
      '-c', 'copy',
      outputPath,
    ]);

    // Upload to S3
    const { readFileSync } = await import('fs');
    const outputBuffer = readFileSync(outputPath);
    const s3Key = `clips/${clipId}/raw.mp4`;
    await uploadBuffer(s3Key, outputBuffer, 'video/mp4');

    return s3Key;
  } finally {
    // Cleanup temp dir
    try {
      const { rmSync } = await import('fs');
      rmSync(tmpDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  }
}

export function ffmpegRun(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args);
    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg failed (code ${code}): ${stderr.slice(-500)}`));
      } else {
        resolve();
      }
    });
    proc.on('error', reject);
  });
}
