import { NextResponse } from 'next/server';
import { resolveTenant, applyFilters } from '@/lib/tenant';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // Tenant-scoped: a signed-in user sees only their own data.
  const ctx = await resolveTenant();

  // TWO views of the same tenant's data, deliberately.
  //
  // `corpus*` describes everything this tenant has, ignoring ?platform=.
  // The dashboard's platform ribbon is NAVIGATION: each card says how much
  // data sits behind that tab, so those numbers must not move when a tab is
  // selected. Deriving them from the FILTERED set made selecting YouTube
  // report 0 posts for Telegram and Instagram — the ribbon claimed the data
  // had disappeared, when it had only been filtered out of the current view.
  const corpusBreakdown: Record<string, number> = {
    x: 0, telegram: 0, reddit: 0, youtube: 0, instagram: 0, facebook: 0,
  };
  for (const post of ctx.posts) {
    if (corpusBreakdown[post.platform] !== undefined) corpusBreakdown[post.platform]++;
  }
  const corpusTotal = ctx.posts.length;

  // Everything below is the SCOPED view — what the selected tab is showing.
  const posts = applyFilters(ctx.posts, searchParams);

  const totalPosts = posts.length;
  const uniqueAuthors = new Set(posts.map(p => p.author.id)).size;

  let totalSentiment = 0;
  let sarcasticCount = 0;
  let anxietyCount = 0;
  let excitementCount = 0;
  let supportiveCount = 0;
  let opposingCount = 0;

  const platformBreakdown: Record<string, number> = {
    x: 0, telegram: 0, reddit: 0, youtube: 0, instagram: 0, facebook: 0
  };

  for (const post of posts) {
    totalSentiment += post.sentiment.score;
    if (post.sentiment.sarcasmScore > 0.4) sarcasticCount++;
    if (post.sentiment.nuancedEmotion === 'anxiety' || post.sentiment.nuancedEmotion === 'fear') anxietyCount++;
    if (post.sentiment.nuancedEmotion === 'excitement' || post.sentiment.nuancedEmotion === 'joy') excitementCount++;
    if (post.sentiment.stance === 'supportive') supportiveCount++;
    if (post.sentiment.stance === 'opposing') opposingCount++;

    if (platformBreakdown[post.platform] !== undefined) {
      platformBreakdown[post.platform]++;
    }
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
    activeNodes: uniqueAuthors,
    averageSentiment: avgSentiment,
    sarcasmIndex,
    threatLevel,
    supportivePercentage: totalPosts > 0 ? Math.round((supportiveCount / totalPosts) * 100) : 0,
    opposingPercentage: totalPosts > 0 ? Math.round((opposingCount / totalPosts) * 100) : 0,
    // Scoped to the active tab. Kept for callers that want the filtered view.
    platformBreakdown,
    // Corpus-wide, never affected by ?platform=. Use these for navigation.
    corpusBreakdown,
    corpusTotal,
    latestTimestamp: posts.length > 0 ? posts[posts.length - 1].timestamp : new Date().toISOString()
  });
}
