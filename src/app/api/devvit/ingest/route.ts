import { NextResponse } from 'next/server';
import {
  devvitEventToPost,
  fetchLiveSubredditStream,
  getDevvitTelemetry,
  DevvitPostInput,
} from '@/lib/ingestion/devvit';
import { addPosts, getAllPosts } from '@/lib/store';
import { enrichPosts } from '@/lib/ml/client';
import { guardIngest } from '@/lib/guard';

export async function GET() {
  const tele = getDevvitTelemetry();
  const all = await getAllPosts();
  const redditPosts = all.filter((p) => p.platform === 'reddit');

  return NextResponse.json({
    status: 'connected',
    provider: 'Reddit Devvit Platform',
    telemetry: {
      totalReceivedFromDevvit: tele.totalReceived,
      lastEventTimestamp: tele.lastEventTime,
      monitoredSubreddits: tele.monitoredSubreddits,
      totalRedditPostsInCorpus: redditPosts.length,
    },
    webhookEndpoint: '/api/devvit/ingest',
    docs: '/docs/devvit-setup.md',
  });
}

export async function POST(req: Request) {
  const guard = await guardIngest();
  if (!guard.allowed) return guard.response!;

  try {
    const body = await req.json().catch(() => ({}));

    // 1. If payload is an on-demand trigger to fetch live data from a subreddit
    if (body.subreddit || body.target) {
      const targetSub = (body.subreddit || body.target || 'technology').replace(/^r\//, '');
      const limit = Math.min(Number(body.limit) || 25, 50);

      const livePosts = await fetchLiveSubredditStream(targetSub, limit);
      if (livePosts.length === 0) {
        return NextResponse.json({
          success: false,
          message: `No live posts could be retrieved for r/${targetSub}.`,
          ingestedCount: 0,
        });
      }

      const enriched = await enrichPosts(livePosts);
      await addPosts(enriched);

      const all = await getAllPosts();
      const redditCount = all.filter((p) => p.platform === 'reddit').length;

      return NextResponse.json({
        success: true,
        source: 'devvit-live-stream',
        subreddit: targetSub,
        ingestedCount: enriched.length,
        totalRedditPostsInStore: redditCount,
        posts: enriched.slice(0, 10).map((p) => ({
          id: p.id,
          title: p.content.slice(0, 80),
          author: p.author.displayName,
          sentiment: p.sentiment.label,
          timestamp: p.timestamp,
        })),
        message: `Captured & ML-scored ${enriched.length} real live posts from r/${targetSub} via Devvit stream!`,
      });
    }

    // 2. If payload comes directly from Devvit App (event trigger or batch)
    let incomingItems: DevvitPostInput[] = [];

    if (body.type === 'batch' && Array.isArray(body.data)) {
      incomingItems = body.data;
    } else if (body.data && typeof body.data === 'object') {
      incomingItems = [body.data];
    } else if (body.id) {
      incomingItems = [body];
    }

    if (incomingItems.length === 0) {
      return NextResponse.json(
        { error: 'No post or comment data received in Devvit payload.' },
        { status: 400 }
      );
    }

    const posts = incomingItems.map(devvitEventToPost);
    const enriched = await enrichPosts(posts);
    await addPosts(enriched);

    const all = await getAllPosts();
    const redditCount = all.filter((p) => p.platform === 'reddit').length;

    return NextResponse.json({
      success: true,
      source: 'devvit-app-event',
      ingestedCount: enriched.length,
      totalRedditPostsInStore: redditCount,
      message: `Processed ${enriched.length} live events from Reddit Devvit.`,
    });
  } catch (err: any) {
    console.error('Devvit Ingest Route Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
