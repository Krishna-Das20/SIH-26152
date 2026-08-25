/**
 * Narrative Analyzer — Orchestrator
 *
 * Ties together embedding generation, clustering, mutation calculation,
 * title generation, and timeline construction to produce complete
 * Narrative objects from a set of SocialPosts.
 *
 * This is the single entry point that API routes call.
 */

import { SocialPost, PlatformType, EmotionType } from '@/types/intelligence';
import { generateEmbeddings, clearEmbeddingCache } from '@/lib/ml/embeddings';
import { clusterNarratives, NARRATIVE_SIMILARITY_THRESHOLD } from './clustering';
import { generateNarrativeTitle } from './titleGenerator';
import {
  computeSemanticShift,
  computeSentimentShift,
  computeEmotionShift,
  computeKeywordShift,
  computeMutationScore,
  buildKeywordEvolution,
  dominantEmotion,
} from './mutations';
import type {
  Narrative,
  NarrativeTimelineEntry,
  PlatformFlowEntry,
  NarrativeAnalysisResponse,
  MutationBreakdown,
} from './types';

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Analyse a set of posts and return all detected narratives with
 * mutation metrics.
 *
 * This is the main entry point.  It:
 *   1. Generates embeddings (via the ML service)
 *   2. Clusters semantically similar posts
 *   3. Builds timeline, platform flow, keyword evolution
 *   4. Computes mutation scores
 *   5. Returns a complete NarrativeAnalysisResponse
 */
export async function analyzeNarratives(
  posts: SocialPost[]
): Promise<NarrativeAnalysisResponse> {
  const availablePlatforms = [
    ...new Set(posts.map((p) => p.platform)),
  ] as PlatformType[];

  if (posts.length < 2) {
    return emptyResponse(posts.length, availablePlatforms);
  }

  // 1. Generate embeddings
  const embeddingItems = posts
    .filter((p) => p.content && p.content.trim().length > 0)
    .map((p) => ({ id: p.id, text: p.content }));

  const embeddingMap = await generateEmbeddings(embeddingItems);

  const embeddingCoverage = embeddingMap.size / Math.max(posts.length, 1);

  // 2. Prepare clustering input (only posts with embeddings)
  const clusterInput = posts
    .filter((p) => embeddingMap.has(p.id))
    .map((p) => ({
      id: p.id,
      embedding: embeddingMap.get(p.id)!,
    }));

  if (clusterInput.length < 2) {
    return emptyResponse(posts.length, availablePlatforms, embeddingCoverage);
  }

  // 3. Cluster into narratives
  const clusters = clusterNarratives(clusterInput);

  // 4. Build full narrative objects
  const postById = new Map(posts.map((p) => [p.id, p]));
  const narratives: Narrative[] = [];

  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    const clusterPosts = cluster.postIds
      .map((id) => postById.get(id))
      .filter((p): p is SocialPost => p !== undefined);

    if (clusterPosts.length < 2) continue;

    const narrative = buildNarrative(
      cluster.narrativeId,
      clusterPosts,
      embeddingMap
    );
    narratives.push(narrative);
  }

  // Sort by mutation score descending (nulls last)
  narratives.sort((a, b) => {
    if (a.mutationScore === null && b.mutationScore === null) return 0;
    if (a.mutationScore === null) return 1;
    if (b.mutationScore === null) return -1;
    return b.mutationScore - a.mutationScore;
  });

  // Compute sentiment coverage
  const sentimentCoverage =
    posts.filter((p) => p.sentiment && p.sentiment.label).length /
    Math.max(posts.length, 1);

  // Compute emotion coverage
  const emotionCoverage =
    posts.filter((p) => p.sentiment && p.sentiment.nuancedEmotion).length /
    Math.max(posts.length, 1);

  return {
    narratives,
    availablePlatforms,
    totalPostsAnalyzed: posts.length,
    coverage: {
      sentiment: Number(sentimentCoverage.toFixed(2)),
      emotion: Number(emotionCoverage.toFixed(2)),
      embeddings: Number(embeddingCoverage.toFixed(2)),
    },
    method: {
      clustering: 'union-find connected components',
      similarityThreshold: NARRATIVE_SIMILARITY_THRESHOLD,
      embeddingModel: 'all-MiniLM-L6-v2',
      mutationFormula:
        '0.40×semantic + 0.25×sentiment + 0.20×emotion + 0.15×keyword',
    },
  };
}

/** Force re-analysis by clearing the embedding cache. */
export function resetNarrativeCache(): void {
  clearEmbeddingCache();
}

// ── Internal ──────────────────────────────────────────────────────────────

function buildNarrative(
  narrativeId: string,
  posts: SocialPost[],
  embeddingMap: Map<string, number[]>
): Narrative {
  // Sort chronologically
  const chronological = [...posts].sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Timeline
  const timeline: NarrativeTimelineEntry[] = chronological.map((p) => ({
    timestamp: p.timestamp,
    platform: p.platform,
    postId: p.id,
    sentiment: p.sentiment.label,
    emotion: p.sentiment.nuancedEmotion,
    contentSnippet: p.content.slice(0, 120),
  }));

  // Platform flow
  const platformFlow = buildPlatformFlow(chronological);

  // Platforms
  const platforms = [...new Set(chronological.map((p) => p.platform))] as PlatformType[];

  // Time bounds
  const firstSeen = chronological[0].timestamp;
  const lastSeen = chronological[chronological.length - 1].timestamp;

  // Engagement
  const engagement = chronological.reduce(
    (sum, p) => sum + p.likes + p.shares + p.replies,
    0
  );

  // Split into early/late halves for mutation calculation
  const half = Math.floor(chronological.length / 2);
  const earlyPosts = chronological.slice(0, Math.max(half, 1));
  const latePosts = chronological.slice(Math.max(half, 1));

  // Semantic shift
  const earlyEmbeddings = earlyPosts
    .map((p) => embeddingMap.get(p.id))
    .filter((e): e is number[] => e !== undefined);
  const lateEmbeddings = latePosts
    .map((p) => embeddingMap.get(p.id))
    .filter((e): e is number[] => e !== undefined);

  const semanticShift = computeSemanticShift(earlyEmbeddings, lateEmbeddings);
  const sentimentShift = computeSentimentShift(earlyPosts, latePosts);
  const emotionShift = computeEmotionShift(earlyPosts, latePosts);
  const keywordShift = computeKeywordShift(earlyPosts, latePosts);

  const breakdown: MutationBreakdown = {
    semanticShift,
    sentimentShift,
    emotionShift,
    keywordShift,
    mutationScore: null,
  };
  breakdown.mutationScore = computeMutationScore(breakdown);

  // Keyword evolution
  const keywordEvolution = buildKeywordEvolution(chronological);

  // Dominant sentiment/emotion
  const sentimentCounts = new Map<string, number>();
  const emotionCounts = new Map<EmotionType, number>();
  for (const p of chronological) {
    sentimentCounts.set(
      p.sentiment.label,
      (sentimentCounts.get(p.sentiment.label) || 0) + 1
    );
    if (p.sentiment.nuancedEmotion) {
      emotionCounts.set(
        p.sentiment.nuancedEmotion,
        (emotionCounts.get(p.sentiment.nuancedEmotion) || 0) + 1
      );
    }
  }

  const dominantSentimentEntry = [...sentimentCounts.entries()].sort(
    (a, b) => b[1] - a[1]
  )[0];
  const dominantSentiment = dominantSentimentEntry
    ? (dominantSentimentEntry[0] as 'positive' | 'negative' | 'neutral')
    : null;

  const domEmotion = dominantEmotion(chronological);

  // Title
  const title = generateNarrativeTitle(chronological);

  return {
    id: narrativeId,
    title,
    postIds: chronological.map((p) => p.id),
    platforms,
    firstSeen,
    lastSeen,
    postCount: chronological.length,
    engagement,
    mutationScore: breakdown.mutationScore,
    semanticShift: semanticShift !== null ? Number(semanticShift.toFixed(1)) : null,
    sentimentShift: sentimentShift !== null ? Number(sentimentShift.toFixed(1)) : null,
    emotionShift,
    keywordShift: keywordShift !== null ? Number(keywordShift.toFixed(1)) : null,
    dominantSentiment,
    dominantEmotion: domEmotion,
    timeline,
    platformFlow,
    keywordEvolution,
  };
}

function buildPlatformFlow(
  chronologicalPosts: SocialPost[]
): PlatformFlowEntry[] {
  const platformMap = new Map<
    PlatformType,
    { firstSeen: string; count: number }
  >();

  for (const p of chronologicalPosts) {
    const existing = platformMap.get(p.platform);
    if (existing) {
      existing.count++;
    } else {
      platformMap.set(p.platform, { firstSeen: p.timestamp, count: 1 });
    }
  }

  return [...platformMap.entries()]
    .map(([platform, data]) => ({
      platform,
      firstSeen: data.firstSeen,
      postCount: data.count,
    }))
    .sort(
      (a, b) =>
        new Date(a.firstSeen).getTime() - new Date(b.firstSeen).getTime()
    );
}

function emptyResponse(
  totalPosts: number,
  platforms: PlatformType[],
  embeddingCoverage: number = 0
): NarrativeAnalysisResponse {
  return {
    narratives: [],
    availablePlatforms: platforms,
    totalPostsAnalyzed: totalPosts,
    coverage: {
      sentiment: 0,
      emotion: 0,
      embeddings: embeddingCoverage,
    },
    method: {
      clustering: 'union-find connected components',
      similarityThreshold: NARRATIVE_SIMILARITY_THRESHOLD,
      embeddingModel: 'all-MiniLM-L6-v2',
      mutationFormula:
        '0.40×semantic + 0.25×sentiment + 0.20×emotion + 0.15×keyword',
    },
  };
}
