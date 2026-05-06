import { query } from '../lib/db.js';

interface ChannelEngagementStats {
  avgOverallScore: number;
  topKeywords: string[];
  bestTimeOfDay: number | null;
}

// Fetches historical performance for a user's clips to compute channel-specific weights.
// Returns a multiplier (0.5–1.5) to adjust the raw highlight score.
export async function getEngagementMultiplier(
  userId: string,
  triggerKeywords: string[],
  hour: number
): Promise<number> {
  const stats = await getChannelStats(userId);
  if (!stats) return 1.0;

  let multiplier = 1.0;

  // Boost if keywords match historically successful clips
  const keywordOverlap = triggerKeywords.filter((kw) =>
    stats.topKeywords.includes(kw)
  ).length;
  if (keywordOverlap > 0) {
    multiplier += Math.min(keywordOverlap * 0.1, 0.3);
  }

  // Boost if this hour is historically good for this channel
  if (stats.bestTimeOfDay !== null && Math.abs(stats.bestTimeOfDay - hour) <= 1) {
    multiplier += 0.1;
  }

  return Math.min(Math.max(multiplier, 0.5), 1.5);
}

async function getChannelStats(userId: string): Promise<ChannelEngagementStats | null> {
  const rows = await query<{
    avg_score: string;
    score_metadata: Record<string, unknown> | null;
  }>(
    `SELECT AVG(cs.overall_score) as avg_score, cs.score_metadata
     FROM clips c
     JOIN clip_scores cs ON cs.clip_id = c.id
     JOIN publications p ON p.clip_id = c.id
     WHERE c.user_id = $1 AND p.status = 'published'
     GROUP BY cs.score_metadata
     ORDER BY avg_score DESC
     LIMIT 20`,
    [userId]
  );

  if (rows.length === 0) return null;

  const avgOverallScore = rows.reduce((sum, r) => sum + parseFloat(r.avg_score), 0) / rows.length;

  // Extract top keywords from score_metadata of best-performing clips
  const keywordCounts: Record<string, number> = {};
  for (const row of rows) {
    const keywords = (row.score_metadata?.triggerKeywords as string[] | undefined) ?? [];
    for (const kw of keywords) {
      keywordCounts[kw] = (keywordCounts[kw] ?? 0) + 1;
    }
  }

  const topKeywords = Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([kw]) => kw);

  return { avgOverallScore, topKeywords, bestTimeOfDay: null };
}
