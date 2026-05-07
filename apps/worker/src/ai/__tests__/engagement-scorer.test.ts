import { describe, expect, it } from 'vitest';
import { EngagementScorer } from '../engagement-scorer.js';

describe('EngagementScorer', () => {
  it('returns high score for high inputs', () => {
    const scorer = new EngagementScorer({ audioWeight: 0.5, chatWeight: 0.3, transcriptWeight: 0.2 });
    const score = scorer.calculateScore(95, 80, 1.2);
    expect(score).toBeGreaterThan(75);
  });
});
