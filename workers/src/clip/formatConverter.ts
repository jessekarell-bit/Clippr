import { writeFileSync, readFileSync, unlinkSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { downloadToBuffer, uploadBuffer } from '../lib/s3.js';
import { ffmpegRun } from './ffmpegCutter.js';
import type { WordTimestamp } from '@clippr/types';

export type CropStrategy = 'blur_background' | 'smart_crop';

// Converts a raw 16:9 clip to 9:16 vertical format (1080x1920).
// blur_background: scales the original to fill the 9:16 frame with a blurred version,
//   then overlays the original letterboxed in the center.
// smart_crop: center-weighted crop assuming subject is in center frame.
export async function convertToVertical(opts: {
  rawS3Key: string;
  clipId: string;
  strategy?: CropStrategy;
}): Promise<string> {
  const { rawS3Key, clipId, strategy = 'blur_background' } = opts;

  const rawBuffer = await downloadToBuffer(rawS3Key);
  const tmpDir = join(tmpdir(), randomUUID());
  mkdirSync(tmpDir);
  const inputPath = join(tmpDir, 'raw.mp4');
  const outputPath = join(tmpDir, 'converted.mp4');

  writeFileSync(inputPath, rawBuffer);

  try {
    if (strategy === 'blur_background') {
      await ffmpegRun([
        '-y',
        '-i', inputPath,
        '-filter_complex',
        // bg: scale to fill 1080x1920, then blur; fg: scale to fit width
        '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:20[bg];' +
        '[0:v]scale=1080:-2[fg];' +
        '[bg][fg]overlay=(W-w)/2:(H-h)/2[out]',
        '-map', '[out]',
        '-map', '0:a?',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-ar', '44100',
        outputPath,
      ]);
    } else {
      // smart_crop: crop a 9:16 region from center of the 16:9 frame
      await ffmpegRun([
        '-y',
        '-i', inputPath,
        '-vf',
        // From 1920x1080 source: crop 607x1080 from center, then scale to 1080x1920
        'crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-ar', '44100',
        outputPath,
      ]);
    }

    const outputBuffer = readFileSync(outputPath);
    const s3Key = `clips/${clipId}/converted.mp4`;
    await uploadBuffer(s3Key, outputBuffer, 'video/mp4');
    return s3Key;
  } finally {
    try {
      const { rmSync } = await import('fs');
      rmSync(tmpDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  }
}

// Generates a thumbnail from the first frame of the converted clip
export async function generateThumbnail(
  convertedS3Key: string,
  clipId: string
): Promise<string> {
  const buffer = await downloadToBuffer(convertedS3Key);
  const tmpDir = join(tmpdir(), randomUUID());
  mkdirSync(tmpDir);
  const inputPath = join(tmpDir, 'converted.mp4');
  const thumbPath = join(tmpDir, 'thumbnail.jpg');

  writeFileSync(inputPath, buffer);

  try {
    await ffmpegRun([
      '-y',
      '-i', inputPath,
      '-ss', '00:00:01',
      '-vframes', '1',
      '-q:v', '2',
      thumbPath,
    ]);

    const thumbBuffer = readFileSync(thumbPath);
    const s3Key = `clips/${clipId}/thumbnail.jpg`;
    await uploadBuffer(s3Key, thumbBuffer, 'image/jpeg');
    return s3Key;
  } finally {
    try {
      const { rmSync } = await import('fs');
      rmSync(tmpDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  }
}

// Generates an SRT subtitle file from Whisper word timestamps
export function generateSRT(
  words: WordTimestamp[],
  startOffsetSecs: number
): string {
  if (words.length === 0) return '';

  // Group words into subtitle blocks of ~5 words or max 3 seconds
  const blocks: Array<{ words: WordTimestamp[]; start: number; end: number }> = [];
  let currentBlock: WordTimestamp[] = [];
  let blockStart = words[0].start;

  for (const word of words) {
    currentBlock.push(word);
    const blockDuration = word.end - blockStart;

    if (currentBlock.length >= 5 || blockDuration >= 3) {
      blocks.push({
        words: currentBlock,
        start: blockStart - startOffsetSecs,
        end: word.end - startOffsetSecs,
      });
      currentBlock = [];
      blockStart = word.end;
    }
  }

  if (currentBlock.length > 0) {
    blocks.push({
      words: currentBlock,
      start: blockStart - startOffsetSecs,
      end: currentBlock[currentBlock.length - 1].end - startOffsetSecs,
    });
  }

  return blocks
    .map((block, i) => {
      const start = formatSRTTime(Math.max(0, block.start));
      const end = formatSRTTime(Math.max(0, block.end));
      const text = block.words.map((w) => w.word).join(' ').trim();
      return `${i + 1}\n${start} --> ${end}\n${text}`;
    })
    .join('\n\n');
}

function formatSRTTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.round((secs % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}
