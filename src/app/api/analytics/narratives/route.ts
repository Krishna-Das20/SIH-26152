import { NextResponse } from 'next/server';
import { tenantPosts } from '@/lib/tenant';
import { analyzeNarratives, resetNarrativeCache } from '@/lib/narratives';

/**
 * Narrative Mutation Tracker API
 *
 * GET  /api/analytics/narratives         — analyse the tenant corpus and return narratives
 * POST /api/analytics/narratives/analyze — force re-analysis (clears embedding cache)
 *
 * Uses `tenantPosts(req)` — the required tenant abstraction.
 * Accepts `?cutoffTime=` and `?platform=` query params via `applyFilters()`.
 */

export async function GET(req: Request) {
  try {
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
          mutationFormula: '0.40×semantic + 0.25×sentiment + 0.20×emotion + 0.15×keyword',
        },
        note: 'Not enough posts to detect narratives. Ingest more data.',
      });
    }

    const result = await analyzeNarratives(posts);

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
    // Force re-analysis: clear the embedding cache
    resetNarrativeCache();

    const { posts, mode } = await tenantPosts(req);
    const result = await analyzeNarratives(posts);

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
