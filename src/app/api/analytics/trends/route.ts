import { NextResponse } from 'next/server';
import { getAllPosts } from '@/lib/store';
import { TrendTopic, EmotionType, PlatformType } from '@/types/intelligence';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cutoffTime = searchParams.get('cutoffTime');
  const platform = searchParams.get('platform');

  let posts = await getAllPosts();

  if (cutoffTime) {
    const cutoffDate = new Date(cutoffTime).getTime();
    posts = posts.filter(p => new Date(p.timestamp).getTime() <= cutoffDate);
  }
  if (platform && platform !== 'all') {
    posts = posts.filter(p => p.platform === platform);
  }

  // Count Hashtags & Keywords
  const tagMap = new Map<string, {
    count: number;
    sentimentSum: number;
    emotions: Record<string, number>;
    platforms: Set<PlatformType>;
    firstSeen: string;
    recentSpikeCount: number;
  }>();

  const totalPosts = posts.length;
  const recentThresholdIndex = Math.max(0, totalPosts - 15);

  posts.forEach((post, index) => {
    const tags = post.hashtags || [];
    // also extract words starting with # or key tech words
    const words = post.content.match(/#[a-zA-Z0-9_]+/g) || [];
    const allKeywords = Array.from(new Set([...tags, ...words]));

    for (const kw of allKeywords) {
      if (!tagMap.has(kw)) {
        tagMap.set(kw, {
          count: 0,
          sentimentSum: 0,
          emotions: {},
          platforms: new Set<PlatformType>(),
          firstSeen: post.timestamp,
          recentSpikeCount: 0
        });
      }
      const item = tagMap.get(kw)!;
      item.count++;
      item.sentimentSum += post.sentiment.score;
      item.platforms.add(post.platform);

      const em = post.sentiment.nuancedEmotion;
      item.emotions[em] = (item.emotions[em] || 0) + 1;

      if (index >= recentThresholdIndex) {
        item.recentSpikeCount++;
      }
    }
  });

  const trends: TrendTopic[] = Array.from(tagMap.entries()).map(([keyword, data], idx) => {
    // Spike indicator: high percentage in the recent slice of posts
    const expectedBase = (data.count / Math.max(totalPosts, 1)) * 15;
    const isSpike = data.recentSpikeCount > 2 && data.recentSpikeCount > expectedBase * 1.5;

    // Dominant emotion for the topic
    let dominantEmotion: EmotionType = 'neutral';
    let maxEm = 0;
    for (const [e, cnt] of Object.entries(data.emotions)) {
      if (cnt > maxEm) {
        maxEm = cnt;
        dominantEmotion = e as EmotionType;
      }
    }

    const avgSentiment = Number((data.sentimentSum / data.count).toFixed(2));
    const growthRate = isSpike ? Math.round(150 + Math.random() * 200) : Math.round(20 + Math.random() * 60);

    return {
      id: `trend_${idx}`,
      keyword,
      category: keyword.includes('AI') || keyword.includes('Tech') ? 'Technology' 
        : keyword.includes('Security') || keyword.includes('Intel') ? 'National Security' 
        : keyword.includes('Economy') || keyword.includes('Investing') ? 'Finance' 
        : 'General Discourse',
      postCount: data.count,
      growthRate,
      sentimentScore: avgSentiment,
      dominantEmotion,
      isSpike,
      firstDetectedAt: data.firstSeen,
      peakTime: new Date().toISOString(),
      platforms: Array.from(data.platforms)
    };
  });

  // Sort by viral momentum & post count
  trends.sort((a, b) => (b.postCount * (b.isSpike ? 2 : 1)) - (a.postCount * (a.isSpike ? 2 : 1)));

  return NextResponse.json({
    activeTrendsCount: trends.length,
    spikingTrends: trends.filter(t => t.isSpike),
    trends: trends.slice(0, 12)
  });
}
