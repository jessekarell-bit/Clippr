import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class AudioPeakDetector {
  async analyzeVolume(filePath: string): Promise<{ energyScore: number; dynamismScore: number }> {
    try {
      const { stderr } = await execFileAsync('ffmpeg', [
        '-i',
        filePath,
        '-af',
        'volumedetect',
        '-vn',
        '-sn',
        '-dn',
        '-f',
        'null',
        process.platform === 'win32' ? 'NUL' : '/dev/null',
      ]);

      const meanMatch = stderr.match(/mean_volume:\s(-?\d+\.?\d*)\s/);
      const maxMatch = stderr.match(/max_volume:\s(-?\d+\.?\d*)\s/);
      if (!meanMatch || !maxMatch) {
        return { energyScore: 0, dynamismScore: 0 };
      }

      const meanDb = Number.parseFloat(meanMatch[1]);
      const maxDb = Number.parseFloat(maxMatch[1]);
      const energyScore = Math.max(0, Math.min(100, ((meanDb + 50) / 35) * 100));
      const dynamicRange = maxDb - meanDb;
      const dynamismScore = Math.max(0, Math.min(100, (dynamicRange / 20) * 100));

      return { energyScore, dynamismScore };
    } catch {
      return { energyScore: 0, dynamismScore: 0 };
    }
  }
}
