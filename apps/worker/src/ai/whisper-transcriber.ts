import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import OpenAI from 'openai';

const execFileAsync = promisify(execFile);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export class WhisperTranscriber {
  private async extractAudio(videoPath: string, outputPath: string): Promise<void> {
    await execFileAsync('ffmpeg', ['-i', videoPath, '-vn', '-acodec', 'libmp3lame', '-q:a', '2', outputPath, '-y']);
  }

  async processSegment(videoPath: string): Promise<TranscriptSegment[]> {
    const audioPath = videoPath.replace(path.extname(videoPath), '.mp3');
    await this.extractAudio(videoPath, audioPath);

    try {
      const response = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      });

      const segments = (response as any).segments ?? [];
      return segments.map((seg: any, index: number) => ({
        id: seg.id ?? index,
        start: seg.start,
        end: seg.end,
        text: seg.text,
      }));
    } finally {
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
    }
  }
}
