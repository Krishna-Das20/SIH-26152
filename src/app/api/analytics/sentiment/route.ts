import { NextResponse } from 'next/server';
import { getAllPosts } from '@/lib/store';
import { EmotionType, TimelineDataPoint } from '@/types/intelligence';

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

  // 1. Emotion Breakdown Count
  const emotionCounts: Record<EmotionType, number> = {
    joy: 0,
    excitement: 0,
    anxiety: 0,
    anger: 0,
    fear: 0,
    sadness: 0,
    supportive: 0,
    against: 0,
    neutral: 0
  };

  let totalSarcasm = 0;
  let supportiveCount = 0;
  let opposingCount = 0;
  let neutralStanceCount = 0;

  // 2. Build Chronological Timeline Points (hourly buckets)
  const timelineMap = new Map<string, TimelineDataPoint>();

  for (const post of posts) {
    const emotion = post.sentiment.nuancedEmotion;
    if (emotionCounts[emotion] !== undefined) {
      emotionCounts[emotion]++;
    }

    totalSarcasm += post.sentiment.sarcasmScore;

    if (post.sentiment.stance === 'supportive') supportiveCount++;
    else if (post.sentiment.stance === 'opposing') opposingCount++;
    else neutralStanceCount++;

    // Group into 2-hour or 1-hour intervals
    const postDate = new Date(post.timestamp);
    const hourKey = `${String(postDate.getUTCHours()).padStart(2, '0')}:00 UTC`;

    if (!timelineMap.has(hourKey)) {
      timelineMap.set(hourKey, {
        timestamp: hourKey,
        postVolume: 0,
        sentimentScore: 0,
        sarcasmCount: 0,
        anxietyCount: 0,
        excitementCount: 0,
        angerCount: 0,
        supportiveCount: 0,
        opposingCount: 0
      });
    }

    const point = timelineMap.get(hourKey)!;
    point.postVolume += 1;
    point.sentimentScore += post.sentiment.score;
    if (post.sentiment.sarcasmScore > 0.4) point.sarcasmCount += 1;
    if (emotion === 'anxiety' || emotion === 'fear') point.anxietyCount += 1;
    if (emotion === 'excitement' || emotion === 'joy') point.excitementCount += 1;
    if (emotion === 'anger' || emotion === 'against') point.angerCount += 1;
    if (post.sentiment.stance === 'supportive') point.supportiveCount += 1;
    if (post.sentiment.stance === 'opposing') point.opposingCount += 1;
  }

  // Normalize point sentiment averages
  const timelineSeries = Array.from(timelineMap.values()).map(pt => ({
    ...pt,
    sentimentScore: pt.postVolume > 0 ? Number((pt.sentimentScore / pt.postVolume).toFixed(2)) : 0
  }));

  const total = Math.max(posts.length, 1);
  const emotionRadar = Object.entries(emotionCounts).map(([emotion, count]) => ({
    emotion: emotion.charAt(0).toUpperCase() + emotion.slice(1),
    value: Math.round((count / total) * 100),
    rawCount: count
  }));

  return NextResponse.json({
    totalPosts: posts.length,
    emotionRadar,
    sarcasmRate: Math.round((totalSarcasm / total) * 100),
    stanceDistribution: [
      { name: 'Supportive', value: supportiveCount, color: '#10b981' },
      { name: 'Opposing / Critical', value: opposingCount, color: '#f43f5e' },
      { name: 'Neutral / Inquisitive', value: neutralStanceCount, color: '#00f0ff' }
    ],
    temporalTimeline: timelineSeries
  });
}
