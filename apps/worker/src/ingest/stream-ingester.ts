import ffmpeg from 'fluent-ffmpeg';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';

export interface StreamIngestOptions {
  manifestUrl: string;
  outputDirectory: string;
  segmentDurationSeconds: number;
  streamId: string;
  reconnectDelayMs?: number;
}

export interface SegmentCompletedPayload {
  streamId: string;
  segmentPath: string;
  fileName: string;
}

export class StreamIngester extends EventEmitter {
  private command: ffmpeg.FfmpegCommand | null = null;
  private readonly streamDir: string;
  private readonly processedSegments = new Set<string>();

  constructor(private readonly options: StreamIngestOptions) {
    super();
    this.streamDir = path.join(options.outputDirectory, options.streamId);
  }

  async start(): Promise<void> {
    fs.mkdirSync(this.streamDir, { recursive: true });

    await new Promise<void>((resolve, reject) => {
      const command = (ffmpeg(this.options.manifestUrl) as any)
        .inputOptions(['-re', '-loglevel warning'])
        .outputOptions([
          '-map 0',
          '-c copy',
          '-f segment',
          `-segment_time ${this.options.segmentDurationSeconds}`,
          '-reset_timestamps 1',
          '-segment_format mpegts',
        ])
        .output(path.join(this.streamDir, 'segment_%05d.ts'))
        .on('start', () => resolve())
        .on('error', (err: Error, _stdout: string, stderr: string) => {
          if (err.message.includes('SIGKILL')) {
            return;
          }
          this.emit('error', new Error(`Ingest failed: ${stderr || err.message}`));
          reject(err);
        })
        .on('end', () => this.emit('end'));

      this.command = command;
      command.run();
    });

    this.monitorNewSegments();
  }

  stop(): void {
    this.command?.kill('SIGKILL');
    this.command = null;
  }

  private monitorNewSegments(): void {
    fs.watch(this.streamDir, (eventType, filename) => {
      if (!filename || !filename.endsWith('.ts') || eventType !== 'rename') {
        return;
      }

      if (this.processedSegments.has(filename)) {
        return;
      }

      this.processedSegments.add(filename);
      setTimeout(() => {
        const segmentPath = path.join(this.streamDir, filename);
        if (!fs.existsSync(segmentPath)) {
          return;
        }

        const payload: SegmentCompletedPayload = {
          streamId: this.options.streamId,
          fileName: filename,
          segmentPath,
        };

        this.emit('segment_completed', payload);
      }, 1000);
    });
  }
}
