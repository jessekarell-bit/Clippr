export interface ScoringWeights {
  audioWeight: number;
  chatWeight: number;
  transcriptWeight: number;
}

export class EngagementScorer {
  private readonly weights: ScoringWeights;

  constructor(channelHistoryWeights: ScoringWeights) {
    const total = channelHistoryWeights.audioWeight + channelHistoryWeights.chatWeight + channelHistoryWeights.transcriptWeight;
    this.weights = {
      audioWeight: channelHistoryWeights.audioWeight / total,
      chatWeight: channelHistoryWeights.chatWeight / total,
      transcriptWeight: channelHistoryWeights.transcriptWeight / total,
    };
  }

  calculateScore(audioScore: number, chatScore: number, transcriptMultiplier = 1): number {
    const transcriptBase = 100 * this.weights.transcriptWeight * (transcriptMultiplier - 1);
    const baseScore = audioScore * this.weights.audioWeight + chatScore * this.weights.chatWeight + transcriptBase;
    return Math.max(0, Math.min(100, baseScore));
  }

  isHighlight(score: number, threshold = 75): boolean {
    return score >= threshold;
  }
}
