import { NextResponse } from 'next/server';
import { fetchInstagramRichData } from '@/lib/ingestion/instagram';
import { getAllPosts, addPosts } from '@/lib/store';
import { enrichPosts } from '@/lib/ml/client';
import { guardIngest } from '@/lib/guard';

// Keep track of monitored sync targets in-memory
declare global {
  // eslint-disable-next-line no-var
  var _instagramSyncTargets: Set<string> | undefined;
  // eslint-disable-next-line no-var
  var _lastInstagramSync: string | undefined;
}

function getSyncTargets(): Set<string> {
  if (!global._instagramSyncTargets) {
    global._instagramSyncTargets = new Set<string>([
      'https://www.instagram.com/reel/DcHEonOvCLB/'
    ]);
  }
  return global._instagramSyncTargets;
}

export async function GET() {
  const all = await getAllPosts();
  const igPosts = all.filter((p) => p.platform === 'instagram');
  const igComments = igPosts.filter((p) => p.inReplyToPostId || p.id.startsWith('ig_c_'));
  const targets = Array.from(getSyncTargets());

  return NextResponse.json({
    active: true,
    monitoredTargets: targets,
    totalInstagramPosts: igPosts.length,
    totalInstagramComments: igComments.length,
    lastSyncTimestamp: global._lastInstagramSync || null,
  });
}

export async function POST(req: Request) {
  const guard = await guardIngest();
  if (!guard.allowed) return guard.response!;

  try {
    const body = await req.json().catch(() => ({}));
    let target = (body.targetUrl || body.target || '').trim();

    const targets = getSyncTargets();
    if (target) {
      targets.add(target);
    } else {
      // Pick first monitored target
      target = Array.from(targets)[0] || 'https://www.instagram.com/reel/DcHEonOvCLB/';
    }

    // Extract rich posts and comments from the target
    const extracted = await fetchInstagramRichData(target);
    if (!extracted || extracted.length === 0) {
      return NextResponse.json({
        success: false,
        target,
        message: 'Could not fetch comments from the target URL. Verify the Instagram URL is public.',
        newCommentsCount: 0,
      });
    }

    // Compare with existing posts in store
    const existing = await getAllPosts();
    const existingIds = new Set(existing.map((p) => p.id));

    const brandNew = extracted.filter((p) => !existingIds.has(p.id));

    if (brandNew.length > 0) {
      // Enrich with ML sentiment analysis
      const scored = await enrichPosts(brandNew);
      await addPosts(scored);
    }

    global._lastInstagramSync = new Date().toISOString();

    const allAfter = await getAllPosts();
    const totalIg = allAfter.filter((p) => p.platform === 'instagram').length;
    const totalIgComments = allAfter.filter(
      (p) => p.platform === 'instagram' && (p.inReplyToPostId || p.id.startsWith('ig_c_'))
    ).length;

    return NextResponse.json({
      success: true,
      target,
      totalExtracted: extracted.length,
      newCommentsCount: brandNew.length,
      brandNewComments: brandNew.map((p) => ({
        id: p.id,
        author: p.author.username,
        text: p.content,
        sentiment: p.sentiment.label,
        timestamp: p.timestamp,
      })),
      totalInstagramPosts: totalIg,
      totalInstagramComments: totalIgComments,
      syncedAt: global._lastInstagramSync,
      message:
        brandNew.length > 0
          ? `Real-time sync captured and ML-scored ${brandNew.length} new Instagram comments!`
          : `Sync complete. All ${extracted.length} Instagram comments are up-to-date in corpus.`,
    });
  } catch (error: any) {
    console.error('Instagram Comment Sync Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
