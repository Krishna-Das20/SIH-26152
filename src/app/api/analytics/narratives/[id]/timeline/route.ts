import { NextResponse } from 'next/server';
import { tenantPosts } from '@/lib/tenant';
import { analyzeNarratives } from '@/lib/narratives';

/**
 * GET /api/analytics/narratives/:id/timeline — chronological timeline for one narrative
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
      narrativeId: narrative.id,
      narrativeTitle: narrative.title,
      timeline: narrative.timeline,
      platformFlow: narrative.platformFlow,
      keywordEvolution: narrative.keywordEvolution,
      firstSeen: narrative.firstSeen,
      lastSeen: narrative.lastSeen,
    });
  } catch (error) {
    console.error('Narrative timeline failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve narrative timeline',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
