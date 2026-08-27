import { NextResponse } from 'next/server';
import { PlatformType } from '@/types/intelligence';
import { addPosts, getAllPosts } from '@/lib/store';
import { enrichPosts } from '@/lib/ml/client';
import { getConnector, inferPlatform, describeCapabilities } from '@/lib/ingestion/registry';
import { guardIngest } from '@/lib/guard';

/**
 * Target analyzer: point it at any account, channel, subreddit, hashtag, video
 * or search phrase on any of the six supported platforms.
 *
 * The platform is inferred from the target when not given, so an analyst can
 * paste a URL directly. Nothing is ever substituted: if the requested platform
 * cannot serve the target, the response says which platform failed and why,
 * rather than quietly returning data from a different one. (An earlier version
 * silently answered Telegram requests with Reddit search results.)
 */
export async function POST(req: Request) {
  // Writes spend real third-party quota; reads stay open.
  const guard = await guardIngest();
  if (!guard.allowed) return guard.response!;

  try {
    const body = await req.json().catch(() => ({} as any));
    const rawTarget: string = (body.targetUrlOrHandle ?? body.target ?? '').toString().trim();
    const requested: PlatformType | undefined = body.platform;
    const limit = Math.min(Number(body.limit) || 25, 100);

    if (!rawTarget) {
      return NextResponse.json(
        { error: 'Provide a target: a URL, @handle, r/subreddit, #hashtag, channel, or search phrase.' },
        { status: 400 }
      );
    }

    // `body.platform` is caller-supplied. getConnector() rejects anything that
    // is not a real connector below, so this cannot reach arbitrary code — but
    // choosing the connector also chooses which fetcher sees `rawTarget`, so
    // keep the value constrained to the registry rather than trusting the body.
    const platform: PlatformType = requested || inferPlatform(rawTarget) || 'telegram';
    const connector = getConnector(platform);

    if (!connector) {
      return NextResponse.json({ error: `Unsupported platform "${platform}".` }, { status: 400 });
    }

    const result = await connector.fetch(rawTarget, limit);

    if (result.posts.length === 0) {
      const capability = describeCapabilities().find((c) => c.platform === platform);
      return NextResponse.json({
        success: false,
        platform,
        status: result.status,
        message: result.note || `No posts found on ${connector.displayName} for "${rawTarget}".`,
        // Tell the operator exactly what would unblock this platform.
        requiredEnv: capability?.configured ? [] : capability?.requiredEnv ?? [],
        setupDoc: connector.setupDoc,
        // And which platforms would work right now instead.
        availableNow: describeCapabilities()
          .filter((c) => c.configured)
          .map((c) => ({ platform: c.platform, displayName: c.displayName, hint: c.targetHint })),
      });
    }

    const analyzed = await enrichPosts(result.posts);
    await addPosts(analyzed);

    return NextResponse.json({
      success: true,
      platform,
      status: result.status,
      source: result.source,
      scrapedCount: analyzed.length,
      target: rawTarget,
      posts: analyzed.slice(0, 10),
      // Which engine actually produced these scores.
      engine: analyzed.some((p) => p.sentiment.engine === 'ml') ? 'ml' : 'lexicon',
      totalPostsStored: (await getAllPosts()).length,
    });
  } catch (error: any) {
    console.error('Target analyzer error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
