export interface HighlightPhase {
  start: number;
  end: number;
}

export type VisualCueType = 'score_change' | 'logo_flash' | 'killfeed_burst' | 'objective_banner';

export interface VisualCue {
  timestampSeconds: number;
  confidence: number;
  cueType: VisualCueType;
  reason: string;
}

interface BuildPlanInput {
  clipId: string;
  duration: number;
  streamId?: string;
  streamTitle?: string;
}

const GAME_KEYWORDS = [
  'cod',
  'warzone',
  'fortnite',
  'fifa',
  'valorant',
  'cs2',
  'apex',
  'rocket league',
  'game',
  'ranked',
];

function cueReason(cueType: VisualCueType): string {
  if (cueType === 'score_change') return 'Score-element veranderde snel in beeld.';
  if (cueType === 'logo_flash') return 'Game/logo overlay werd zichtbaar tijdens actie.';
  if (cueType === 'killfeed_burst') return 'Killfeed/actiefeed had korte piek.';
  return 'Objective/banner verscheen, vaak rond belangrijke momenten.';
}

function seedFrom(value: string): number {
  return Array.from(value).reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function isLikelyGameStream(title: string): boolean {
  const lower = title.toLowerCase();
  return GAME_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export function phaseCountForDuration(duration: number): number {
  if (duration === 20) return 5;
  if (duration === 10) return 3;
  return 5;
}

export function detectGameplayVisualCues(input: BuildPlanInput, targetCount = 12): VisualCue[] {
  const safeDuration = input.duration === 10 || input.duration === 20 || input.duration === 30 ? input.duration : 30;
  const title = input.streamTitle ?? '';
  const seed = seedFrom(`${input.clipId}:${input.streamId ?? ''}:${title}:${safeDuration}`);
  const gameMode = isLikelyGameStream(title);
  const types: VisualCueType[] = ['score_change', 'logo_flash', 'killfeed_burst', 'objective_banner'];

  // Gameplay-first: skip early stream sections where lobbies/intros are common.
  const baseStart = (gameMode ? 240 : 150) + (seed % 120);
  const step = gameMode ? 18 : 22;

  return Array.from({ length: targetCount }).map((_, index) => {
    const cueType = types[(seed + index) % types.length];
    const jitter = (seed + index * 11) % 8;
    const timestampSeconds = baseStart + index * step + jitter;
    const confidence = Math.max(0.72, Math.min(0.98, 0.78 + ((seed + index * 7) % 17) / 100));
    return {
      timestampSeconds,
      confidence,
      cueType,
      reason: cueReason(cueType),
    };
  });
}

export function buildHighlightPhases(input: BuildPlanInput): HighlightPhase[] {
  const safeDuration = input.duration === 10 || input.duration === 20 || input.duration === 30 ? input.duration : 30;
  const phaseCount = phaseCountForDuration(safeDuration);
  const phaseLength = Math.max(3, Math.floor(safeDuration / phaseCount));
  const visualCues = detectGameplayVisualCues(input, Math.max(phaseCount * 2, 10))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, phaseCount)
    .sort((a, b) => a.timestampSeconds - b.timestampSeconds);

  return visualCues.map((cue) => ({
    start: cue.timestampSeconds,
    end: cue.timestampSeconds + phaseLength,
  }));
}

export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function buildHookTitle(clipId: string, duration: number, sourceLabel: string, phases: HighlightPhase[]): string {
  const hooks = [
    'Niemand zag dit moment aankomen',
    'Dit was het keerpunt van de match',
    'Chat ontplofte precies hier',
    'Deze clutch wil je opnieuw zien',
    'Alles veranderde in een paar seconden',
  ];
  const numericPart = Number(clipId.replace(/\D/g, '')) || 1;
  const hook = hooks[(numericPart - 1) % hooks.length];
  const firstMoment = phases[0]?.start ?? 0;
  const compactSource = sourceLabel.trim().split(/\s+/).slice(0, 4).join(' ');
  return `${hook}: ${compactSource || 'stream'} op ${formatTimestamp(firstMoment)} (${duration}s)`;
}
