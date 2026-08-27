import { NextResponse } from 'next/server';
import { tenantPosts } from '@/lib/tenant';
import { analyzeNarratives, resetNarrativeCache, TimeWindowFilter } from '@/lib/narratives';

/**
 * Narrative Mutation Tracker API
 *
 * GET  /api/analytics/narratives?window=all&platform=all — analyse the tenant corpus and return narratives
 * POST /api/analytics/narratives — force re-analysis (clears embedding cache)
 *
 * Uses `tenantPosts(req)` — the required tenant abstraction.
 */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const windowParam = (searchParams.get('window') || 'all') as TimeWindowFilter;
    const platformParam = searchParams.get('platform') || 'all';

    const { posts, mode } = await tenantPosts(req);

    if (posts.length < 2) {
      return NextResponse.json({
        mode,
        narratives: [],
        availablePlatforms: [],
        totalPostsAnalyzed: posts.length,
        coverage: { sentiment: 0, emotion: 0, embeddings: 0 },
        method: {
          clustering: 'union-find connected components',
          similarityThreshold: 0.70,
          embeddingModel: 'all-MiniLM-L6-v2',
          mutationFormula: '0.25·semantic + 0.15·sentiment + 0.15·emotion + 0.10·keyword + 0.10·entity + 0.10·platform + 0.08·community + 0.07·amplification',
        },
        note: 'Not enough posts to detect narratives. Ingest more data.',
      });
    }

    const result = await analyzeNarratives(posts, {
      window: windowParam,
      platform: platformParam,
    });

    return NextResponse.json({
      mode,
      ...result,
    });
  } catch (error) {
    console.error('Narrative analysis failed:', error);
    return NextResponse.json(
      {
        error: 'Narrative analysis failed',
        detail: error instanceof Error ? error.message : 'Unknown error',
        note: 'The ML service may be unavailable. Embeddings are required for narrative clustering.',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    resetNarrativeCache();

    const { searchParams } = new URL(req.url);
    const windowParam = (searchParams.get('window') || 'all') as TimeWindowFilter;
    const platformParam = searchParams.get('platform') || 'all';

    const { posts, mode } = await tenantPosts(req);
    const result = await analyzeNarratives(posts, {
      window: windowParam,
      platform: platformParam,
    });

    return NextResponse.json({
      mode,
      reanalyzed: true,
      ...result,
    });
  } catch (error) {
    console.error('Narrative re-analysis failed:', error);
    return NextResponse.json(
      {
        error: 'Narrative re-analysis failed',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
