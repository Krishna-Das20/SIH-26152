import { NextResponse } from 'next/server';
import { tenantPosts } from '@/lib/tenant';
import { analyzeNarratives } from '@/lib/narratives';

/**
 * GET /api/analytics/narratives/:id — single narrative detail
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { posts, mode } = await tenantPosts(req);
    const result = await analyzeNarratives(posts);

    const narrative = result.narratives.find((n) => n.id === params.id);

    if (!narrative) {
      return NextResponse.json(
        {
          error: 'Narrative not found',
          detail: `No narrative with id "${params.id}" exists in the current corpus.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      mode,
      narrative,
      availablePlatforms: result.availablePlatforms,
      totalPostsAnalyzed: result.totalPostsAnalyzed,
    });
  } catch (error) {
    console.error('Narrative detail failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve narrative',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
