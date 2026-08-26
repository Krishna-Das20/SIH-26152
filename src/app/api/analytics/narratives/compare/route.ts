import { NextResponse } from 'next/server';
import { tenantPosts } from '@/lib/tenant';
import { analyzeNarratives } from '@/lib/narratives';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics/narratives/compare?id1=...&id2=...
 * Compare two narratives or compare early vs late stage of one narrative.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id1 = searchParams.get('id1') || searchParams.get('id');
    const id2 = searchParams.get('id2');

    if (!id1) {
      return NextResponse.json(
        { error: 'Missing narrative ID', detail: 'Provide at least ?id1= or ?id=' },
        { status: 400 }
      );
    }

    const { posts, mode } = await tenantPosts(req);
    const result = await analyzeNarratives(posts);

    const narrative1 = result.narratives.find((n) => n.id === id1);
    if (!narrative1) {
      return NextResponse.json(
        { error: 'Narrative not found', detail: `No narrative with id "${id1}" exists.` },
        { status: 404 }
      );
    }

    if (id2) {
      const narrative2 = result.narratives.find((n) => n.id === id2);
      if (!narrative2) {
        return NextResponse.json(
          { error: 'Narrative 2 not found', detail: `No narrative with id "${id2}" exists.` },
          { status: 404 }
        );
      }

      // Inter-narrative comparison
      const kw1 = new Set(narrative1.keywordEvolution.flatMap((s) => s.keywords));
      const kw2 = new Set(narrative2.keywordEvolution.flatMap((s) => s.keywords));
      const sharedKeywords = [...kw1].filter((k) => kw2.has(k));
      const distinct1 = [...kw1].filter((k) => !kw2.has(k));
      const distinct2 = [...kw2].filter((k) => !kw1.has(k));

      return NextResponse.json({
        mode,
        type: 'inter_narrative',
        narrative1: {
          id: narrative1.id,
          title: narrative1.title,
          postCount: narrative1.postCount,
          dominantSentiment: narrative1.dominantSentiment,
          dominantEmotion: narrative1.dominantEmotion,
          platforms: narrative1.platforms,
          mutationScore: narrative1.mutationScore,
          distinctKeywords: distinct1.slice(0, 6),
        },
        narrative2: {
          id: narrative2.id,
          title: narrative2.title,
          postCount: narrative2.postCount,
          dominantSentiment: narrative2.dominantSentiment,
          dominantEmotion: narrative2.dominantEmotion,
          platforms: narrative2.platforms,
          mutationScore: narrative2.mutationScore,
          distinctKeywords: distinct2.slice(0, 6),
        },
        sharedKeywords,
      });
    }

    // Intra-narrative temporal comparison (early vs late stage)
    const earlyStage = narrative1.keywordEvolution[0];
    const lateStage = narrative1.keywordEvolution[narrative1.keywordEvolution.length - 1];

    return NextResponse.json({
      mode,
      type: 'intra_narrative_temporal',
      narrativeId: narrative1.id,
      title: narrative1.title,
      mutationScore: narrative1.mutationScore,
      semanticShift: narrative1.semanticShift,
      sentimentShift: narrative1.sentimentShift,
      emotionShift: narrative1.emotionShift,
      keywordShift: narrative1.keywordShift,
      earlyStage: {
        period: `${earlyStage?.periodStart} to ${earlyStage?.periodEnd}`,
        keywords: earlyStage?.keywords || [],
        entities: earlyStage?.entities || [],
      },
      lateStage: {
        period: `${lateStage?.periodStart} to ${lateStage?.periodEnd}`,
        keywords: lateStage?.keywords || [],
        entities: lateStage?.entities || [],
      },
      breakpoints: narrative1.breakpoints,
    });
  } catch (error) {
    console.error('Narrative compare failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to compare narratives',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
