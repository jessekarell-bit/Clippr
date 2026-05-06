import OpenAI from 'openai';
import { createReadStream, writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { downloadToBuffer } from '../lib/s3.js';
import type { WordTimestamp } from '@clippr/types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface TranscriptionResult {
  text: string;
  words: WordTimestamp[];
  durationSecs: number;
}

export async function transcribeSegment(
  s3Key: string,
  segmentStartedAt: Date
): Promise<TranscriptionResult> {
  const buffer = await downloadToBuffer(s3Key);

  // Write to a temp file — OpenAI SDK requires a file stream
  const tmpPath = join(tmpdir(), `${randomUUID()}.ts`);
  writeFileSync(tmpPath, buffer);

  try {
    const response = await openai.audio.transcriptions.create({
      file: createReadStream(tmpPath) as Parameters<typeof openai.audio.transcriptions.create>[0]['file'],
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    });

    const words: WordTimestamp[] =
      (response as { words?: Array<{ word: string; start: number; end: number }> }).words?.map(
        (w) => ({
          word: w.word,
          start: w.start,
          end: w.end,
          confidence: 1.0,
        })
      ) ?? [];

    return {
      text: response.text,
      words,
      durationSecs: (response as { duration?: number }).duration ?? 0,
    };
  } finally {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
  }
}
