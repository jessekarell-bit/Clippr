import fs from 'node:fs';
import path from 'node:path';

export interface SegmentWatcherOptions {
  streamDirectory: string;
  debounceMs?: number;
  onSegmentReady: (segmentPath: string) => Promise<void> | void;
}

export function createSegmentWatcher(options: SegmentWatcherOptions): fs.FSWatcher {
  const seen = new Set<string>();
  const debounce = options.debounceMs ?? 800;

  return fs.watch(options.streamDirectory, (eventType, fileName) => {
    if (eventType !== 'rename' || !fileName?.endsWith('.ts') || seen.has(fileName)) {
      return;
    }

    seen.add(fileName);
    setTimeout(async () => {
      const fullPath = path.join(options.streamDirectory, fileName);
      if (fs.existsSync(fullPath)) {
        await options.onSegmentReady(fullPath);
      }
    }, debounce);
  });
}
