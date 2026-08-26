/**
 * Narrative Analyzer — Master Orchestrator
 *
 * Coordinates the full intelligence pipeline:
 *   1. Filter by time window & platform
 *   2. Semantic embedding generation (ML service)
 *   3. Union-find narrative clustering
 *   4. Temporal state tracking & centroid evolution
 *   5. Narrative velocity calculations
 *   6. 8-dimension mutation scoring & confidence analysis
 *   7. Breakpoint detection (exact inflection moments)
 *   8. "Why Did It Mutate?" explanation & evidence chain
 *   9. Platform propagation & KOL influence attribution
 *  10. Cross-platform framing matrix
 *  11. Branching & convergence detection
 *
 * Strict anti-fabrication: uncalculable metrics remain null.
 */

import { SocialPost, PlatformType, EmotionType } from '@/types/intelligence';
import { generateEmbeddings, clearEmbeddingCache } from '@/lib/ml/embeddings';
import { clusterNarratives, NARRATIVE_SIMILARITY_THRESHOLD } from './clustering';
import { generateNarrativeTitle, extractTopKeywords } from './titleGenerator';
import {
  computeSemanticShift,
  computeSentimentShift,
  computeEmotionShift,
  computeKeywordShift,
  computeEntityShift,
  computePlatformShift,
  computeCommunityShift,
  computeAmplificationShift,
  computeMutationScore,
  computeEvidenceConfidence,
  determineLifecycleState,
  buildKeywordEvolution,
  dominantEmotion,
  centroid,
} from './mutations';
import { buildTemporalStates, computeNarrativeVelocity, extractEntities } from './temporalTracker';
import { detectBreakpoints } from './breakpoints';
import { generateWhyMutated, buildEvidenceChain } from './evidenceExplainer';
import { buildPlatformPropagation, extractNarrativeAmplifiers } from './propagationTracker';
import { buildCrossPlatformMatrix } from './crossPlatformMatrix';
import { detectBranches, detectConvergences } from './fragmentation';
import type {
  Narrative,
  NarrativeTimelineEntry,
  NarrativeAnalysisResponse,
  MutationBreakdown,
  TimeWindowFilter,
} from './types';

export interface AnalyzeOptions {
  window?: TimeWindowFilter;
  platform?: string;
}

export async function analyzeNarratives(
  allPosts: SocialPost[],
  options?: AnalyzeOptions
): Promise<NarrativeAnalysisResponse> {
  const availablePlatforms = [
    ...new Set(allPosts.map((p) => p.platform)),
  ] as PlatformType[];

  // Apply filters
  let posts = [...allPosts];

  if (options?.platform && options.platform !== 'all') {
    posts = posts.filter((p) => p.platform === options.platform);
  }

  if (options?.window && options.window !== 'all') {
    const latestTime = Math.max(...posts.map((p) => new Date(p.timestamp).getTime()));
    const windowHours =
      options.window === '24h' ? 24 : options.window === '7d' ? 7 * 24 : 30 * 24;
    const cutoff = latestTime - windowHours * 3600 * 1000;
    posts = posts.filter((p) => new Date(p.timestamp).getTime() >= cutoff);
  }

  if (posts.length < 2) {
    return emptyResponse(posts.length, availablePlatforms, 0, options);
  }

  // 1. Generate embeddings
  const embeddingItems = posts
    .filter((p) => p.content && p.content.trim().length > 0)
    .map((p) => ({ id: p.id, text: p.content }));

  const embeddingMap = await generateEmbeddings(embeddingItems);
  const embeddingCoverage = embeddingMap.size / Math.max(posts.length, 1);

  // 2. Prepare clustering input
  const clusterInput = posts
    .filter((p) => embeddingMap.has(p.id))
    .map((p) => ({
      id: p.id,
      embedding: embeddingMap.get(p.id)!,
    }));

  if (clusterInput.length < 2) {
    return emptyResponse(posts.length, availablePlatforms, embeddingCoverage, options);
  }

  // 3. Cluster into narratives
  const clusters = clusterNarratives(clusterInput);

  // 4. Build clusters map for convergence checks
  const postById = new Map(posts.map((p) => [p.id, p]));
  const clusterPostsList: { id: string; posts: SocialPost[] }[] = [];

  for (const c of clusters) {
    const cPosts = c.postIds
      .map((id) => postById.get(id))
      .filter((p): p is SocialPost => p !== undefined);
    if (cPosts.length >= 2) {
      clusterPostsList.push({ id: c.narrativeId, posts: cPosts });
    }
  }

  // 5. Build full narrative objects
  const narratives: Narrative[] = [];

  for (const { id: narrativeId, posts: clusterPosts } of clusterPostsList) {
    const narrative = buildFullNarrative(
      narrativeId,
      clusterPosts,
      embeddingMap,
      clusterPostsList
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

  const sentimentCoverage =
    posts.filter((p) => p.sentiment && p.sentiment.label).length /
    Math.max(posts.length, 1);

  const emotionCoverage =
    posts.filter((p) => p.sentiment && p.sentiment.nuancedEmotion).length /
    Math.max(posts.length, 1);

  return {
    narratives,
    availablePlatforms,
    totalPostsAnalyzed: posts.length,
    filterApplied: {
      window: options?.window || 'all',
      platform: options?.platform || 'all',
    },
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
        '0.25·semantic + 0.15·sentiment + 0.15·emotion + 0.10·keyword + 0.10·entity + 0.10·platform + 0.08·community + 0.07·amplification',
      confidenceFormula:
        'min(100, 40·(sampleSize/20) + 30·(platforms/3) + 30·(timeSpan/48h))',
    },
  };
}

export function resetNarrativeCache(): void {
  clearEmbeddingCache();
}

function buildFullNarrative(
  narrativeId: string,
  posts: SocialPost[],
  embeddingMap: Map<string, number[]>,
  allClusterPosts: { id: string; posts: SocialPost[] }[]
): Narrative {
  // Sort chronologically
  const chronological = [...posts].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const firstSeen = chronological[0].timestamp;
  const lastSeen = chronological[chronological.length - 1].timestamp;
  const timeSpanHours = Math.max(
    (new Date(lastSeen).getTime() - new Date(firstSeen).getTime()) / (3600 * 1000),
    0.5
  );

  const platforms = [...new Set(chronological.map((p) => p.platform))] as PlatformType[];
  const engagement = chronological.reduce(
    (sum, p) => sum + p.likes + p.shares + p.replies,
    0
  );

  // 1. Temporal state tracking & centroids
  const temporalStates = buildTemporalStates(chronological, embeddingMap);
  const narrativeVelocity = computeNarrativeVelocity(chronological, temporalStates);

  // 2. Early vs Late splitting for mutation
  const half = Math.floor(chronological.length / 2);
  const earlyPosts = chronological.slice(0, Math.max(half, 1));
  const latePosts = chronological.slice(Math.max(half, 1));

  const earlyEmbeddings = earlyPosts
    .map((p) => embeddingMap.get(p.id))
    .filter((e): e is number[] => e !== undefined);
  const lateEmbeddings = latePosts
    .map((p) => embeddingMap.get(p.id))
    .filter((e): e is number[] => e !== undefined);

  const allEmbeddings = chronological
    .map((p) => embeddingMap.get(p.id))
    .filter((e): e is number[] => e !== undefined);
  const overallCentroid = centroid(allEmbeddings);

  const semanticShift = computeSemanticShift(earlyEmbeddings, lateEmbeddings);
  const sentimentShift = computeSentimentShift(earlyPosts, latePosts);
  const emotionShift = computeEmotionShift(earlyPosts, latePosts);
  const keywordShift = computeKeywordShift(earlyPosts, latePosts);
  const entityShift = computeEntityShift(earlyPosts, latePosts);
  const platformShift = computePlatformShift(earlyPosts, latePosts);
  const communityShift = computeCommunityShift(earlyPosts, latePosts);
  const amplificationShift = computeAmplificationShift(earlyPosts, latePosts);

  const breakdown: MutationBreakdown = {
    semanticShift,
    sentimentShift,
    emotionShift,
    keywordShift,
    entityShift,
    platformShift,
    communityShift,
    amplificationShift,
    mutationScore: null,
  };
  breakdown.mutationScore = computeMutationScore(breakdown);

  // 3. Breakpoints
  const breakpoints = detectBreakpoints(chronological, temporalStates, embeddingMap);
  const triggerSet = new Set(breakpoints.flatMap((b) => b.triggeringPostIds));

  // 4. Timeline
  const timeline: NarrativeTimelineEntry[] = chronological.map((p) => ({
    timestamp: p.timestamp,
    platform: p.platform,
    postId: p.id,
    authorUsername: p.author.username,
    authorDisplayName: p.author.displayName,
    sentiment: p.sentiment?.label || 'neutral',
    emotion: p.sentiment?.nuancedEmotion || 'neutral',
    contentSnippet: p.content.slice(0, 120),
    isBreakpointTrigger: triggerSet.has(p.id),
  }));

  // 5. Propagation & Amplifiers
  const propagation = buildPlatformPropagation(chronological);
  const topAmplifiers = extractNarrativeAmplifiers(chronological);

  // 6. Cross-Platform Matrix
  const crossPlatformMatrix = buildCrossPlatformMatrix(
    chronological,
    overallCentroid,
    embeddingMap
  );

  // 7. Keyword & Entity Evolution
  const keywordEvolution = buildKeywordEvolution(chronological);
  const earlyKeywords = extractTopKeywords(earlyPosts, 5);
  const lateKeywords = extractTopKeywords(latePosts, 5);

  // 8. Why Mutated & Evidence Chain
  const whyMutated = generateWhyMutated(
    breakdown,
    breakpoints,
    propagation,
    topAmplifiers,
    earlyKeywords,
    lateKeywords,
    chronological.length
  );

  const evidenceChain = buildEvidenceChain(
    breakdown,
    breakpoints,
    propagation,
    topAmplifiers,
    earlyKeywords,
    lateKeywords
  );

  // 9. Confidence
  const confidence = computeEvidenceConfidence(
    chronological,
    timeSpanHours,
    platforms
  );

  // 10. Lifecycle State
  const state = determineLifecycleState(
    chronological.length,
    breakdown.mutationScore,
    narrativeVelocity.semanticDriftPerHour,
    timeSpanHours,
    narrativeVelocity.isAccelerating
  );

  // 11. Branching & Convergence
  const branches = detectBranches(chronological, embeddingMap);
  const convergences = detectConvergences(
    narrativeId,
    chronological,
    allClusterPosts,
    embeddingMap
  );

  // 12. Title & Summary
  const title = generateNarrativeTitle(chronological);
  const summary = `Narrative spans ${chronological.length} post(s) across ${platforms.join(', ')} over ${timeSpanHours.toFixed(1)}h. ${whyMutated[0] || ''}`;

  // 13. Dominant Sentiment & Emotion
  const domSentiment =
    chronological.filter((p) => p.sentiment?.label === 'positive').length >=
    chronological.filter((p) => p.sentiment?.label === 'negative').length
      ? 'positive'
      : 'negative';
  const domEmotion = dominantEmotion(chronological);

  // 14. Top Communities
  const communityFreq = new Map<number, number>();
  for (const p of chronological) {
    if (p.author.communityId !== undefined && p.author.communityId >= 0) {
      communityFreq.set(p.author.communityId, (communityFreq.get(p.author.communityId) || 0) + 1);
    }
  }
  const topCommunities = [...communityFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c]) => c);

  return {
    id: narrativeId,
    title,
    summary,
    state,
    postIds: chronological.map((p) => p.id),
    platforms,
    firstSeen,
    lastSeen,
    timeSpanHours: Number(timeSpanHours.toFixed(1)),
    postCount: chronological.length,
    engagement,
    narrativeVelocity,
    mutationScore: breakdown.mutationScore,
    semanticShift: semanticShift !== null ? Number(semanticShift.toFixed(1)) : null,
    sentimentShift: sentimentShift !== null ? Number(sentimentShift.toFixed(1)) : null,
    emotionShift: emotionShift !== null ? Number(emotionShift.toFixed(1)) : null,
    keywordShift: keywordShift !== null ? Number(keywordShift.toFixed(1)) : null,
    entityShift: entityShift !== null ? Number(entityShift.toFixed(1)) : null,
    platformShift: platformShift !== null ? Number(platformShift.toFixed(1)) : null,
    communityShift: communityShift !== null ? Number(communityShift.toFixed(1)) : null,
    amplificationShift: amplificationShift !== null ? Number(amplificationShift.toFixed(1)) : null,
    confidence,
    whyMutated,
    evidenceChain,
    breakpoints,
    propagation,
    crossPlatformMatrix,
    topAmplifiers,
    topCommunities,
    branches,
    convergences,
    dominantSentiment: domSentiment,
    dominantEmotion: domEmotion,
    timeline,
    platformFlow: propagation.hops.map((h) => ({
      platform: h.platform,
      firstSeen: h.timestamp,
      postCount: h.postCount,
    })),
    keywordEvolution,
    temporalStates,
  };
}

function emptyResponse(
  totalPosts: number,
  platforms: PlatformType[],
  embeddingCoverage: number = 0,
  options?: AnalyzeOptions
): NarrativeAnalysisResponse {
  return {
    narratives: [],
    availablePlatforms: platforms,
    totalPostsAnalyzed: totalPosts,
    filterApplied: {
      window: options?.window || 'all',
      platform: options?.platform || 'all',
    },
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
        '0.25·semantic + 0.15·sentiment + 0.15·emotion + 0.10·keyword + 0.10·entity + 0.10·platform + 0.08·community + 0.07·amplification',
      confidenceFormula:
        'min(100, 40·(sampleSize/20) + 30·(platforms/3) + 30·(timeSpan/48h))',
    },
  };
}
