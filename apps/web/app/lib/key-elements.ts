import type { SelectedYouTubeStream } from './youtube';
import { buildHighlightPhases, detectGameplayVisualCues } from './highlight-plan';

export type KeyElementType = 'audio_peak' | 'chat_surge' | 'quote' | 'gameplay_event';

export interface StreamKeyElement {
  id: string;
  type: KeyElementType;
  timestampSeconds: number;
  score: number;
  title: string;
  reason: string;
}

function typeLabel(type: KeyElementType): string {
  if (type === 'audio_peak') return 'Geluidspiek';
  if (type === 'chat_surge') return 'Chatpiek';
  if (type === 'quote') return 'Sterke quote';
  return 'Gameplay moment';
}

function reasonForType(type: KeyElementType): string {
  if (type === 'audio_peak') return 'Volume en intonatie stegen plots boven het gemiddelde.';
  if (type === 'chat_surge') return 'Veel reacties in korte tijd, duidelijk meer dan normaal.';
  if (type === 'quote') return 'Herkenbare uitspraak met hoge kans op engagement.';
  return 'Visueel hoog tempo met duidelijke actie in beeld.';
}

export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function detectStreamKeyElements(stream: SelectedYouTubeStream, limit = 8): StreamKeyElement[] {
  const clipIds = ['demo-1', 'demo-2', 'demo-3', 'demo-4'];
  const phaseMoments = clipIds.flatMap((clipId) =>
    buildHighlightPhases({
      clipId,
      duration: 20,
      streamId: stream.streamId,
      streamTitle: stream.title,
    }).map((phase) => phase.start),
  );

  const types: KeyElementType[] = ['gameplay_event', 'audio_peak', 'chat_surge', 'quote'];
  const visualCues = detectGameplayVisualCues(
    {
      clipId: 'pipeline-overview',
      duration: 30,
      streamId: stream.streamId,
      streamTitle: stream.title,
    },
    limit,
  );
  return phaseMoments.slice(0, limit).map((timestampSeconds, index) => {
    const type = types[index % types.length];
    const score = Math.max(78, 95 - index * 2);
    const cueReason = visualCues[index]?.reason ?? 'Visueel spelmoment met verhoogde activiteit.';
    return {
      id: `${stream.streamId}-key-${index + 1}`,
      type,
      timestampSeconds,
      score,
      title: `${typeLabel(type)} #${index + 1}`,
      reason: `${reasonForType(type)} ${cueReason}`,
    };
  });
}
