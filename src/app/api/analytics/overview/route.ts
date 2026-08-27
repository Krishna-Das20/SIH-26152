import { NextResponse } from 'next/server';
import { resolveTenant, applyFilters } from '@/lib/tenant';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // Tenant-scoped: a signed-in user sees only their own data.
  const ctx = await resolveTenant();
  const allPosts = ctx.posts;
  const filteredPosts = applyFilters(allPosts, searchParams);

  const totalPosts = filteredPosts.length;
  const uniqueAuthors = new Set(filteredPosts.map(p => p.author.id)).size;

  let totalSentiment = 0;
  let sarcasticCount = 0;
  let anxietyCount = 0;
  let excitementCount = 0;
  let supportiveCount = 0;
  let opposingCount = 0;

  // IMPORTANT: Platform breakdown is computed across ALL posts in the tenant corpus!
  // This ensures that when the user switches tabs, the counts for other platforms
  // and the unified total remain intact and never collapse to zero.
  const platformBreakdown: Record<string, number> = {
    x: 0, telegram: 0, reddit: 0, youtube: 0, instagram: 0, facebook: 0
  };

  for (const post of allPosts) {
    if (platformBreakdown[post.platform] !== undefined) {
      platformBreakdown[post.platform]++;
    }
  }

  for (const post of filteredPosts) {
    totalSentiment += post.sentiment.score;
    if (post.sentiment.sarcasmScore > 0.4) sarcasticCount++;
    if (post.sentiment.nuancedEmotion === 'anxiety' || post.sentiment.nuancedEmotion === 'fear') anxietyCount++;
    if (post.sentiment.nuancedEmotion === 'excitement' || post.sentiment.nuancedEmotion === 'joy') excitementCount++;
    if (post.sentiment.stance === 'supportive') supportiveCount++;
    if (post.sentiment.stance === 'opposing') opposingCount++;
  }

  const avgSentiment = totalPosts > 0 ? Number((totalSentiment / totalPosts).toFixed(2)) : 0;
  const sarcasmIndex = totalPosts > 0 ? Math.round((sarcasticCount / totalPosts) * 100) : 0;

  // Threat / Volatility Level Assessment
  let threatLevel: 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL' = 'LOW';
  const tensionScore = (anxietyCount + opposingCount + (sarcasticCount * 0.5)) / Math.max(totalPosts, 1);
  if (tensionScore > 0.45) threatLevel = 'CRITICAL';
  else if (tensionScore > 0.3) threatLevel = 'HIGH';
  else if (tensionScore > 0.15) threatLevel = 'ELEVATED';

  return NextResponse.json({
    totalPosts,
    unifiedTotalPosts: allPosts.length,
    activeNodes: uniqueAuthors,
    averageSentiment: avgSentiment,
    sarcasmIndex,
    threatLevel,
    supportivePercentage: totalPosts > 0 ? Math.round((supportiveCount / totalPosts) * 100) : 0,
    opposingPercentage: totalPosts > 0 ? Math.round((opposingCount / totalPosts) * 100) : 0,
    platformBreakdown,
    latestTimestamp: filteredPosts.length > 0
      ? filteredPosts[filteredPosts.length - 1].timestamp
      : (allPosts.length > 0 ? allPosts[allPosts.length - 1].timestamp : new Date().toISOString())
  });
}

