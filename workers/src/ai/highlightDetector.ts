import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { downloadToBuffer } from '../lib/s3.js';
import { getChatActivityInRange } from '../lib/redis.js';
import type { HighlightWindow, WordTimestamp } from '@clippr/types';

// Keywords that signal excitement or viral potential
const EXCITEMENT_KEYWORDS = [
  'oh my god', 'omg', 'no way', "let's go", 'lets go', 'wait what',
  'unbelievable', 'insane', 'crazy', 'amazing', 'incredible', 'holy',
  'wow', 'clutch', 'banger', 'sick', 'dude', 'what the',
];

// Scores a 0–100 how "exciting" the transcript text is
export function scoreTranscript(words: WordTimestamp[]): {
  score: number;
  triggerKeywords: string[];
} {
  if (words.length === 0) return { score: 0, triggerKeywords: [] };

  const fullText = words.map((w) => w.word).join(' ').toLowerCase();
  const triggerKeywords: string[] = [];
  let hits = 0;

  for (const kw of EXCITEMENT_KEYWORDS) {
    if (fullText.includes(kw)) {
      hits++;
      triggerKeywords.push(kw);
    }
  }

  // Bonus: rapid speech (many words in short time = excitement)
  const totalDuration = words[words.length - 1].end - words[0].start;
  const wordsPerSecond = totalDuration > 0 ? words.length / totalDuration : 0;
  const speechBonus = Math.min(wordsPerSecond / 3, 1) * 20;

  const keywordScore = Math.min(hits * 15, 60);
  return {
    score: Math.min(keywordScore + speechBonus, 100),
    triggerKeywords,
  };
}

// Uses ffprobe to compute mean RMS audio amplitude (proxy for excitement)
export async function getAudioPeakScore(s3Key: string): Promise<number> {
  const buffer = await downloadToBuffer(s3Key);
  const tmpPath = join(tmpdir(), `${randomUUID()}.ts`);
  writeFileSync(tmpPath, buffer);

  try {
    const rms = await measureRMS(tmpPath);
    // Map RMS dBFS to 0–100: -60dB = 0, -10dB = 100
    const clamped = Math.max(-60, Math.min(-10, rms));
    return Math.round(((clamped + 60) / 50) * 100);
  } finally {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
  }
}

function measureRMS(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'quiet',
      '-select_streams', 'a:0',
      '-show_entries', 'frame_tags=lavfi.astats.Overall.RMS_level',
      '-f', 'lavfi',
      '-i', `amovie=${filePath},astats=metadata=1:reset=1`,
    ]);

    let stdout = '';
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.on('close', () => {
      const match = stdout.match(/RMS_level=(-?\d+\.?\d*)/);
      if (match) {
        resolve(parseFloat(match[1]));
      } else {
        // Fallback: return neutral score if ffprobe analysis fails
        resolve(-35);
      }
    });
    proc.on('error', reject);
  });
}

export async function scoreHighlightWindow(opts: {
  streamId: string;
  startOffsetSecs: number;
  endOffsetSecs: number;
  s3Key: string;
  words: WordTimestamp[];
  streamStartTime: Date;
}): Promise<HighlightWindow> {
  const { streamId, startOffsetSecs, endOffsetSecs, s3Key, words, streamStartTime } = opts;

  const windowStartUnix = Math.floor(streamStartTime.getTime() / 1000) + startOffsetSecs;
  const windowEndUnix = Math.floor(streamStartTime.getTime() / 1000) + endOffsetSecs;

  const [audioPeakScore, chatCount, transcriptResult] = await Promise.all([
    getAudioPeakScore(s3Key),
    getChatActivityInRange(streamId, windowStartUnix, windowEndUnix),
    Promise.resolve(scoreTranscript(words)),
  ]);

  // Normalize chat activity: map 0–50 messages/min to 0–100
  const windowMinutes = (endOffsetSecs - startOffsetSecs) / 60;
  const messagesPerMinute = windowMinutes > 0 ? chatCount / windowMinutes : 0;
  const chatActivityScore = Math.min((messagesPerMinute / 50) * 100, 100);

  // Weighted average: audio 30%, chat 40%, transcript 30%
  const overallScore =
    audioPeakScore * 0.3 +
    chatActivityScore * 0.4 +
    transcriptResult.score * 0.3;

  return {
    startOffsetSecs,
    endOffsetSecs,
    audioPeakScore,
    chatActivityScore,
    transcriptScore: transcriptResult.score,
    overallScore: Math.round(overallScore * 10) / 10,
    triggerKeywords: transcriptResult.triggerKeywords,
  };
}
