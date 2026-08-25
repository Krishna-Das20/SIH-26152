import { NextResponse } from 'next/server';
import { fetchLiveRedditPosts } from '@/lib/ingestion/reddit';
import { fetchLiveYouTubeComments } from '@/lib/ingestion/youtube';
import { addPosts, getAllPosts, resetDataset } from '@/lib/store';
import { analyzeSentimentAndEmotion } from '@/lib/nlp/emotionEngine';
import { inferDemographics } from '@/lib/nlp/demographicProfiler';
import { SocialPost } from '@/types/intelligence';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, subreddit = 'india', videoId, platform, customText } = body;

    if (action === 'reset') {
      const resetData = resetDataset();
      return NextResponse.json({ success: true, count: resetData.length, message: 'Dataset reset to baseline.' });
    }

    if (action === 'custom' && customText) {
      const sentiment = analyzeSentimentAndEmotion(customText);
      const demo = inferDemographics('', customText);
      const newCustomPost: SocialPost = {
        id: `post_custom_${Date.now()}`,
        platform: platform || 'x',
        author: {
          id: `usr_custom_${Date.now()}`,
          username: 'live_analyst',
          displayName: 'Live Stream Ingestion',
          platform: platform || 'x',
          followerCount: 15400,
          verified: true,
          estimatedAgeBracket: demo.estimatedAgeBracket,
          inferredLocation: demo.inferredLocation,
          detectedLanguage: demo.detectedLanguage,
          interests: demo.interests
        },
        content: customText,
        timestamp: new Date().toISOString(),
        likes: 1,
        shares: 0,
        replies: 0,
        hashtags: ['#LiveIngest'],
        sentiment
      };

      await addPosts([newCustomPost]);
      return NextResponse.json({ success: true, post: newCustomPost });
    }

    // Live Ingest triggers
    const results: SocialPost[] = [];

    // 1. Reddit Public Ingestion
    const redditPosts = await fetchLiveRedditPosts(subreddit, 10);
    results.push(...redditPosts);

    // 2. YouTube Ingestion (if videoId provided or key present)
    if (videoId) {
      const ytPosts = await fetchLiveYouTubeComments(videoId, 5);
      results.push(...ytPosts);
    }

    await addPosts(results);

    return NextResponse.json({
      success: true,
      ingestedCount: results.length,
      platforms: ['reddit', ...(videoId ? ['youtube'] : [])],
      totalInStore: (await getAllPosts()).length
    });
  } catch (error: any) {
    console.error('Ingestion API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
