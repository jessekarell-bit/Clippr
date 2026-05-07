import fs from 'node:fs';

export interface SubtitleCue {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

function toSrtTimestamp(seconds: number): string {
  const ms = Math.floor((seconds % 1) * 1000);
  const total = Math.floor(seconds);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function buildSrtFile(cues: SubtitleCue[], outputPath: string): string {
  const payload = cues
    .map((cue, index) => `${index + 1}\n${toSrtTimestamp(cue.startSeconds)} --> ${toSrtTimestamp(cue.endSeconds)}\n${cue.text}\n`)
    .join('\n');

  fs.writeFileSync(outputPath, payload, 'utf8');
  return outputPath;
}
