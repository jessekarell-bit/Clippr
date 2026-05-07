import fs from 'node:fs/promises';
import path from 'node:path';
import ffmpeg from 'fluent-ffmpeg';

export interface RenderClipOptions {
  inputVideoPath: string;
  outputVideoPath: string;
  startTimeSeconds: number;
  durationSeconds: number;
  subtitleSrtPath?: string;
}

export async function renderVerticalClip(options: RenderClipOptions): Promise<string> {
  await fs.mkdir(path.dirname(options.outputVideoPath), { recursive: true });

  return new Promise((resolve, reject) => {
    const filters = options.subtitleSrtPath
      ? `[0:v]scale=-1:1920,crop=1080:1920:(in_w-1080)/2:0,subtitles='${options.subtitleSrtPath.replace(/\\/g, '/')}':force_style='Fontsize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1'[out]`
      : '[0:v]scale=-1:1920,crop=1080:1920:(in_w-1080)/2:0[out]';

    ffmpeg(options.inputVideoPath)
      .setStartTime(options.startTimeSeconds)
      .setDuration(options.durationSeconds)
      .complexFilter(filters, 'out')
      .outputOptions(['-c:v libx264', '-preset fast', '-crf 23', '-c:a aac', '-pix_fmt yuv420p'])
      .output(options.outputVideoPath)
      .on('end', () => resolve(options.outputVideoPath))
      .on('error', reject)
      .run();
  });
}
