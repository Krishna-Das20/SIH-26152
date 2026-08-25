import { NextResponse } from 'next/server';
import { addPosts, getAllPosts, resetDataset } from '@/lib/store';
import { analyzeSentimentAndEmotion } from '@/lib/nlp/emotionEngine';
import { inferDemographics } from '@/lib/nlp/demographicProfiler';
import { SocialPost, PlatformType } from '@/types/intelligence';
import { analyzeOne } from '@/lib/ml/client';
import {
  ingestFrom,
  ingestFromAllConfigured,
  activePlatforms,
  CONNECTORS,
} from '@/lib/ingestion/registry';
import { guardIngest } from '@/lib/guard';

/**
 * Multi-platform ingestion trigger (Component A).
 *
 * Body options:
 *   { action: 'reset' }                       restore the demo baseline
 *   { action: 'custom', customText, platform } inject a manual test post
 *   { targets: [{ platform, target }] }        ingest specific platforms
 *   { }                                        ingest every configured platform
 *
 * Per-platform shorthands are also accepted for convenience:
 *   { subreddit, videoId, telegramChannel, xQuery, instagramTag, facebookPageId }
 */
export async function POST(req: Request) {
  // Writes spend real third-party quota; reads stay open.
  const guard = await guardIngest();
  if (!guard.allowed) return guard.response!;

  try {
    const body = await req.json().catch(() => ({} as any));
    const { action, platform, customText } = body;

    if (action === 'reset') {
      const resetData = await resetDataset();
      return NextResponse.json({
        success: true,
        count: resetData.length,
        message: 'Dataset reset to baseline.',
      });
    }

    if (action === 'custom' && customText) {
      const sentiment = await analyzeOne(`post_custom_${Date.now()}`, customText);
      const demo = inferDemographics('', customText);
      const newCustomPost: SocialPost = {
        id: `post_custom_${Date.now()}`,
        platform: (platform as PlatformType) || 'x',
        author: {
          id: `usr_custom_${Date.now()}`,
          username: 'live_analyst',
          displayName: 'Manual Injection',
          platform: (platform as PlatformType) || 'x',
          followerCount: null, // no real account behind a manual injection
          verified: false,
          estimatedAgeBracket: demo.estimatedAgeBracket,
          inferredLocation: demo.inferredLocation,
          detectedLanguage: demo.detectedLanguage,
          interests: demo.interests,
        },
        content: customText,
        timestamp: new Date().toISOString(),
        likes: 0,
        shares: 0,
        replies: 0,
        hashtags: ['#ManualInjection'],
        sentiment,
      };

      await addPosts([newCustomPost]);
      return NextResponse.json({ success: true, post: newCustomPost });
    }

    // ── Build the target list ────────────────────────────────────────────
    const explicit: { platform: PlatformType; target?: string }[] = Array.isArray(body.targets)
      ? body.targets
      : [];

    // Map the per-platform shorthands onto the same structure.
    const shorthands: [PlatformType, unknown][] = [
      ['reddit', body.subreddit],
      ['youtube', body.videoId ?? body.youtubeQuery],
      ['telegram', body.telegramChannel],
      ['x', body.xQuery ?? body.xHandle],
      ['instagram', body.instagramTag],
      ['facebook', body.facebookPageId],
    ];
    for (const [p, value] of shorthands) {
      if (typeof value === 'string' && value.trim()) {
        explicit.push({ platform: p, target: value.trim() });
      }
    }

    const limit = Math.min(Number(body.limit) || 25, 100);

    const outcome =
      explicit.length > 0
        ? await ingestFrom(explicit, limit)
        : await ingestFromAllConfigured({}, limit);

    await addPosts(outcome.posts);

    return NextResponse.json({
      success: true,
      ingestedCount: outcome.posts.length,
      // Only platforms that actually produced posts.
      platforms: outcome.succeeded,
      // Everything attempted, with the reason each empty one was empty, so a
      // failed ingest is never mistaken for a quiet one.
      results: outcome.results.map((r) => ({
        platform: r.platform,
        status: r.status,
        count: r.posts.length,
        source: r.source,
        note: r.note,
      })),
      configuredPlatforms: activePlatforms(),
      totalPlatformsImplemented: CONNECTORS.length,
      totalInStore: (await getAllPosts()).length,
    });
  } catch (error: any) {
    console.error('Ingestion API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
