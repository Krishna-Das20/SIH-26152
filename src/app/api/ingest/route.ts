import { NextResponse } from 'next/server';
import { fetchLiveRedditPosts } from '@/lib/ingestion/reddit';
import { fetchLiveYouTubeComments } from '@/lib/ingestion/youtube';
import { fetchTelegramPosts } from '@/lib/ingestion/telegram';
import { addPosts, getAllPosts, resetDataset } from '@/lib/store';
import { analyzeSentimentAndEmotion } from '@/lib/nlp/emotionEngine';
import { inferDemographics } from '@/lib/nlp/demographicProfiler';
import { SocialPost } from '@/types/intelligence';
import { analyzeOne, enrichPosts } from '@/lib/ml/client';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, subreddit = 'india', videoId, telegramChannel, platform, customText } = body;

    if (action === 'reset') {
      const resetData = await resetDataset();
      return NextResponse.json({ success: true, count: resetData.length, message: 'Dataset reset to baseline.' });
    }

    if (action === 'custom' && customText) {
      // Routed through the ML client so manually injected test posts are scored
      // by the same engine as ingested ones.
      const sentiment = await analyzeOne(`post_custom_${Date.now()}`, customText);
      const demo = inferDemographics('', customText);
      const newCustomPost: SocialPost = {
        id: `post_custom_${Date.now()}`,
        platform: platform || 'x',
        author: {
          id: `usr_custom_${Date.now()}`,
          username: 'live_analyst',
          displayName: 'Live Stream Ingestion',
          platform: platform || 'x',
          followerCount: null, // manual injection has no real account behind it
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

    // 3. Telegram public channel (Essential platform per the problem statement)
    let telegramSource: string | undefined;
    if (telegramChannel) {
      const tg = await fetchTelegramPosts(telegramChannel, 20);
      results.push(...tg.posts);
      telegramSource = tg.source;
    }

    // Score everything through the transformer service where available.
    const analyzed = await enrichPosts(results);
    await addPosts(analyzed);

    return NextResponse.json({
      success: true,
      ingestedCount: analyzed.length,
      // Report the platforms that actually yielded posts, not the ones we
      // attempted. Reddit currently 403s, and listing it regardless made a
      // failed ingest look like a successful multi-platform one.
      platforms: Array.from(new Set(analyzed.map((p) => p.platform))),
      attempted: [
        'reddit',
        ...(videoId ? ['youtube'] : []),
        ...(telegramChannel ? ['telegram'] : []),
      ],
      telegramSource,
      totalInStore: (await getAllPosts()).length
    });
  } catch (error: any) {
    console.error('Ingestion API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
