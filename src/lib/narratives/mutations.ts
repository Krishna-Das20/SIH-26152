/**
 * Narrative Mutation Calculations & Confidence Engine
 *
 * Computes the 8-dimension transparent mutation score and evidence confidence:
 *
 *   1. semantic_shift      = (1 − cos_sim(early_centroid, late_centroid)) × 100
 *   2. sentiment_shift     = total_variation_distance(early_sent, late_sent) × 100
 *   3. emotion_shift       = Jensen-Shannon / categorical distribution distance × 100
 *   4. keyword_shift       = (1 − jaccard(early_kw, late_kw)) × 100
 *   5. entity_shift        = (1 − jaccard(early_entities, late_entities)) × 100
 *   6. platform_shift      = total_variation_distance(early_platforms, late_platforms) × 100
 *   7. community_shift     = total_variation_distance(early_communities, late_communities) × 100
 *   8. amplification_shift = relative engagement surge & KOL involvement × 100
 *
 * Composite Mutation Formula:
 *   Score = 0.25·semantic + 0.15·sentiment + 0.15·emotion + 0.10·keyword +
 *           0.10·entity + 0.10·platform + 0.08·community + 0.07·amplification
 *
 * Strict anti-fabrication:
 *   - Any missing component renders as null.
 *   - Confidence level is separately calculated from sample size, time span,
 *     and platform breadth.
 */

import { SocialPost, EmotionType, PlatformType } from '@/types/intelligence';
import { cosineSimilarity } from '@/lib/ml/embeddings';
import { extractTopKeywords } from './titleGenerator';
import { extractEntities } from './temporalTracker';
import type {
  MutationBreakdown,
  KeywordStage,
  NarrativeConfidence,
  NarrativeLifecycleState,
  ConfidenceLevel,
} from './types';

// ── Mutation Weights (Sum to 1.00) ────────────────────────────────────────

export const WEIGHTS = {
  semantic: 0.25,
  sentiment: 0.15,
  emotion: 0.15,
  keyword: 0.10,
  entity: 0.10,
  platform: 0.10,
  community: 0.08,
  amplification: 0.07,
} as const;

export const MIN_STAGE_POSTS = 2;

// ── 1. Semantic Shift ─────────────────────────────────────────────────────

export function computeSemanticShift(
  earlyEmbeddings: number[][],
  lateEmbeddings: number[][]
): number | null {
  if (earlyEmbeddings.length === 0 || lateEmbeddings.length === 0) return null;

  const earlyCentroid = centroid(earlyEmbeddings);
  const lateCentroid = centroid(lateEmbeddings);

  if (!earlyCentroid || !lateCentroid) return null;

  const sim = cosineSimilarity(earlyCentroid, lateCentroid);
  return clamp((1 - sim) * 100, 0, 100);
}

export function centroid(vectors: number[][]): number[] | null {
  if (vectors.length === 0) return null;
  const dim = vectors[0].length;
  if (dim === 0) return null;

  const sum = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) {
      sum[i] += v[i];
    }
  }
  return sum.map((s) => s / vectors.length);
}

// ── 2. Sentiment Shift (TVD) ──────────────────────────────────────────────

export function computeSentimentShift(
  earlyPosts: SocialPost[],
  latePosts: SocialPost[]
): number | null {
  if (earlyPosts.length < MIN_STAGE_POSTS || latePosts.length < MIN_STAGE_POSTS) return null;

  const earlyDist = sentimentDistribution(earlyPosts);
  const lateDist = sentimentDistribution(latePosts);

  let tvd = 0;
  for (const label of ['positive', 'negative', 'neutral'] as const) {
    tvd += Math.abs(earlyDist[label] - lateDist[label]);
  }
  tvd /= 2;

  return clamp(tvd * 100, 0, 100);
}

export function sentimentDistribution(
  posts: SocialPost[]
): Record<'positive' | 'negative' | 'neutral', number> {
  const counts = { positive: 0, negative: 0, neutral: 0 };
  for (const p of posts) {
    const label = p.sentiment?.label;
    if (label === 'positive' || label === 'negative' || label === 'neutral') {
      counts[label]++;
    }
  }
  const total = Math.max(counts.positive + counts.negative + counts.neutral, 1);
  return {
    positive: counts.positive / total,
    negative: counts.negative / total,
    neutral: counts.neutral / total,
  };
}

// ── 3. Emotion Shift ──────────────────────────────────────────────────────

export function computeEmotionShift(
  earlyPosts: SocialPost[],
  latePosts: SocialPost[]
): number | null {
  if (earlyPosts.length < MIN_STAGE_POSTS || latePosts.length < MIN_STAGE_POSTS) return null;

  const earlyDist = emotionDistribution(earlyPosts);
  const lateDist = emotionDistribution(latePosts);

  const allEmotions = new Set([
    ...Object.keys(earlyDist),
    ...Object.keys(lateDist),
  ]) as Set<EmotionType>;

  if (allEmotions.size === 0) return null;

  let tvd = 0;
  for (const emo of allEmotions) {
    tvd += Math.abs((earlyDist[emo] || 0) - (lateDist[emo] || 0));
  }
  tvd /= 2;

  return clamp(tvd * 100, 0, 100);
}

function emotionDistribution(posts: SocialPost[]): Partial<Record<EmotionType, number>> {
  const counts = new Map<EmotionType, number>();
  let total = 0;
  for (const p of posts) {
    const emo = p.sentiment?.nuancedEmotion;
    if (emo) {
      counts.set(emo, (counts.get(emo) || 0) + 1);
      total++;
    }
  }
  const dist: Partial<Record<EmotionType, number>> = {};
  if (total === 0) return dist;
  for (const [emo, count] of counts) {
    dist[emo] = count / total;
  }
  return dist;
}

export function dominantEmotion(posts: SocialPost[]): EmotionType | null {
  const counts = new Map<EmotionType, number>();
  for (const p of posts) {
    const emotion = p.sentiment?.nuancedEmotion;
    if (emotion) {
      counts.set(emotion, (counts.get(emotion) || 0) + 1);
    }
  }
  if (counts.size === 0) return null;

  let best: EmotionType | null = null;
  let max = 0;
  for (const [emotion, count] of counts) {
    if (count > max) {
      max = count;
      best = emotion;
    }
  }
  return best;
}

// ── 4. Keyword Shift (Jaccard Distance) ───────────────────────────────────

export function computeKeywordShift(
  earlyPosts: SocialPost[],
  latePosts: SocialPost[]
): number | null {
  if (earlyPosts.length < MIN_STAGE_POSTS || latePosts.length < MIN_STAGE_POSTS) return null;

  const earlyKw = new Set(extractTopKeywords(earlyPosts, 6));
  const lateKw = new Set(extractTopKeywords(latePosts, 6));

  if (earlyKw.size === 0 || lateKw.size === 0) return null;

  const intersection = new Set([...earlyKw].filter((k) => lateKw.has(k)));
  const union = new Set([...earlyKw, ...lateKw]);

  if (union.size === 0) return null;

  const jaccard = intersection.size / union.size;
  return clamp((1 - jaccard) * 100, 0, 100);
}

// ── 5. Entity Shift (Jaccard Distance) ────────────────────────────────────

export function computeEntityShift(
  earlyPosts: SocialPost[],
  latePosts: SocialPost[]
): number | null {
  if (earlyPosts.length < MIN_STAGE_POSTS || latePosts.length < MIN_STAGE_POSTS) return null;

  const earlyEnt = new Set(extractEntities(earlyPosts));
  const lateEnt = new Set(extractEntities(latePosts));

  if (earlyEnt.size === 0 && lateEnt.size === 0) return 0; // Both empty -> no entity shift
  if (earlyEnt.size === 0 || lateEnt.size === 0) return 50; // Partial evidence

  const intersection = new Set([...earlyEnt].filter((e) => lateEnt.has(e)));
  const union = new Set([...earlyEnt, ...lateEnt]);

  if (union.size === 0) return 0;

  const jaccard = intersection.size / union.size;
  return clamp((1 - jaccard) * 100, 0, 100);
}

// ── 6. Platform Shift ─────────────────────────────────────────────────────

export function computePlatformShift(
  earlyPosts: SocialPost[],
  latePosts: SocialPost[]
): number | null {
  // TVD over a distribution, exactly like sentimentShift -- so it saturates to
  // 0 or 100 on a single-post stage for the same reason. Same floor applies.
  if (earlyPosts.length < MIN_STAGE_POSTS || latePosts.length < MIN_STAGE_POSTS) return null;

  const earlyPlat = platformDistribution(earlyPosts);
  const latePlat = platformDistribution(latePosts);

  const allPlatforms = new Set([
    ...Object.keys(earlyPlat),
    ...Object.keys(latePlat),
  ]) as Set<PlatformType>;

  let tvd = 0;
  for (const plat of allPlatforms) {
    tvd += Math.abs((earlyPlat[plat] || 0) - (latePlat[plat] || 0));
  }
  tvd /= 2;

  return clamp(tvd * 100, 0, 100);
}

function platformDistribution(posts: SocialPost[]): Partial<Record<PlatformType, number>> {
  const counts = new Map<PlatformType, number>();
  for (const p of posts) {
    counts.set(p.platform, (counts.get(p.platform) || 0) + 1);
  }
  const dist: Partial<Record<PlatformType, number>> = {};
  const total = posts.length || 1;
  for (const [p, c] of counts) {
    dist[p] = c / total;
  }
  return dist;
}

// ── 7. Community Shift (Louvain) ──────────────────────────────────────────

export function computeCommunityShift(
  earlyPosts: SocialPost[],
  latePosts: SocialPost[]
): number | null {
  if (earlyPosts.length < MIN_STAGE_POSTS || latePosts.length < MIN_STAGE_POSTS) return null;

  const earlyComm = communityDistribution(earlyPosts);
  const lateComm = communityDistribution(latePosts);

  // `author.communityId` is populated by the graph layer, not by ingestion, so
  // on the frozen corpus NO post carries one (verified: 0 of 358). Reporting
  // "0% shift" here would be a factual claim of stability that nothing
  // measured -- the truth is that this dimension is UNOBSERVED. Return null
  // and let the composite renormalise around it.
  if (Object.keys(earlyComm).length === 0 && Object.keys(lateComm).length === 0) {
    return null;
  }

  const allComms = new Set([
    ...Object.keys(earlyComm).map(Number),
    ...Object.keys(lateComm).map(Number),
  ]);

  let tvd = 0;
  for (const comm of allComms) {
    tvd += Math.abs((earlyComm[comm] || 0) - (lateComm[comm] || 0));
  }
  tvd /= 2;

  return clamp(tvd * 100, 0, 100);
}

function communityDistribution(posts: SocialPost[]): Record<number, number> {
  const counts = new Map<number, number>();
  let total = 0;
  for (const p of posts) {
    if (p.author.communityId !== undefined && p.author.communityId >= 0) {
      counts.set(p.author.communityId, (counts.get(p.author.communityId) || 0) + 1);
      total++;
    }
  }
  const dist: Record<number, number> = {};
  if (total === 0) return dist;
  for (const [c, cnt] of counts) {
    dist[c] = cnt / total;
  }
  return dist;
}

// ── 8. Amplification Shift ────────────────────────────────────────────────

export function computeAmplificationShift(
  earlyPosts: SocialPost[],
  latePosts: SocialPost[]
): number | null {
  if (earlyPosts.length === 0 || latePosts.length === 0) return null;

  // Average over the posts that actually REPORT engagement. Treating an
  // unknown as 0 would drag the mean toward zero and make a source that hides
  // its counts look like a source with no engagement.
  const engagement = (p: SocialPost): number | null =>
    p.likes === null && p.shares === null && p.replies === null
      ? null
      : (p.likes ?? 0) + (p.shares ?? 0) + (p.replies ?? 0);

  const earlyVals = earlyPosts.map(engagement).filter((v): v is number => v !== null);
  const lateVals = latePosts.map(engagement).filter((v): v is number => v !== null);
  if (earlyVals.length === 0 || lateVals.length === 0) return null;

  const earlyEngage = earlyVals.reduce((s, v) => s + v, 0) / earlyVals.length;
  const lateEngage = lateVals.reduce((s, v) => s + v, 0) / lateVals.length;

  const earlyKOLs = earlyPosts.filter((p) => p.author.isKOL || (p.author.betweennessScore && p.author.betweennessScore > 0)).length;
  const lateKOLs = latePosts.filter((p) => p.author.isKOL || (p.author.betweennessScore && p.author.betweennessScore > 0)).length;

  const engageRatio = (lateEngage + 1) / (earlyEngage + 1);
  const kolDelta = (lateKOLs - earlyKOLs) * 20;

  const shift = Math.abs(engageRatio - 1) * 30 + Math.max(0, kolDelta);
  return clamp(shift, 0, 100);
}

// ── Composite Mutation Score ──────────────────────────────────────────────

export function computeMutationScore(breakdown: MutationBreakdown): number | null {
  const {
    semanticShift,
    sentimentShift,
    emotionShift,
    keywordShift,
    entityShift,
    platformShift,
    communityShift,
    amplificationShift,
  } = breakdown;

  // Strict anti-fabrication: core dimensions must be present
  if (semanticShift === null || sentimentShift === null || emotionShift === null || keywordShift === null) {
    return null;
  }

  // `?? 0` would fold an UNMEASURED dimension in as a measured zero, which is
  // both a false claim and a silent penalty: community is unobservable on the
  // current corpus, so every score was being dragged down by a fixed 8% of
  // weight that no evidence supported. Renormalise over the dimensions that
  // actually produced a value instead -- the score then means "how much did
  // this narrative move, across what we could measure".
  const parts: [number, number | null][] = [
    [WEIGHTS.semantic, semanticShift],
    [WEIGHTS.sentiment, sentimentShift],
    [WEIGHTS.emotion, emotionShift],
    [WEIGHTS.keyword, keywordShift],
    [WEIGHTS.entity, entityShift],
    [WEIGHTS.platform, platformShift],
    [WEIGHTS.community, communityShift],
    [WEIGHTS.amplification, amplificationShift],
  ];

  let weighted = 0;
  let weightPresent = 0;
  for (const [w, v] of parts) {
    if (v === null || v === undefined) continue;
    weighted += w * v;
    weightPresent += w;
  }

  if (weightPresent === 0) return null;

  return clamp(Number((weighted / weightPresent).toFixed(1)), 0, 100);
}

// ── Evidence Confidence Calculation ───────────────────────────────────────

export function computeEvidenceConfidence(
  posts: SocialPost[],
  timeSpanHours: number,
  platforms: PlatformType[]
): NarrativeConfidence {
  const sampleSize = posts.length;
  if (sampleSize === 0) {
    return {
      level: 'LOW',
      score: 0,
      sampleSize: 0,
      timeSpanHours: 0,
      platformCount: 0,
      reasons: ['No posts observed in cluster'],
    };
  }

  const platformCount = platforms.length;
  const reasons: string[] = [];

  let score = 0;

  // 1. Sample Size (max 40 pts)
  if (sampleSize >= 20) {
    score += 40;
    reasons.push(`${sampleSize} posts observed (broad corpus sample)`);
  } else if (sampleSize >= 8) {
    score += 28;
    reasons.push(`${sampleSize} posts observed (adequate sample)`);
  } else if (sampleSize >= 3) {
    score += 15;
    reasons.push(`${sampleSize} posts observed (small sample)`);
  } else {
    score += 5;
    reasons.push(`${sampleSize} posts observed (minimal sample — reduced confidence)`);
  }

  // 2. Multi-Platform Coverage (max 30 pts)
  if (platformCount >= 3) {
    score += 30;
    reasons.push(`Cross-platform confirmation across ${platformCount} channels`);
  } else if (platformCount === 2) {
    score += 20;
    reasons.push(`Corroborated across 2 distinct platforms`);
  } else {
    score += 10;
    reasons.push(`Single platform observation (${platforms[0] || 'Unknown'})`);
  }

  // 3. Time Span (max 30 pts)
  if (timeSpanHours >= 48) {
    score += 30;
    reasons.push(`Observed over ${Math.round(timeSpanHours)}h extended temporal window`);
  } else if (timeSpanHours >= 12) {
    score += 20;
    reasons.push(`Observed across ${Math.round(timeSpanHours)}h temporal evolution`);
  } else {
    score += 10;
    reasons.push(`Short observation window (<12h)`);
  }

  const finalScore = clamp(score, 0, 100);
  const level: ConfidenceLevel =
    finalScore >= 70 ? 'HIGH' : finalScore >= 45 ? 'MEDIUM' : 'LOW';

  return {
    level,
    score: finalScore,
    sampleSize,
    timeSpanHours: Number(timeSpanHours.toFixed(1)),
    platformCount,
    reasons,
  };
}

// ── Lifecycle State Determination ─────────────────────────────────────────

export function determineLifecycleState(
  postCount: number,
  mutationScore: number | null,
  semanticDriftPerHour: number,
  timeSpanHours: number,
  isAccelerating: boolean
): NarrativeLifecycleState {
  if (postCount < 3 && timeSpanHours < 6) return 'emerging';
  if (mutationScore !== null && mutationScore >= 45) return 'mutating';
  if (isAccelerating) return 'growing';
  if (postCount >= 15 && semanticDriftPerHour < 0.2) return 'peaking';
  if (timeSpanHours >= 72 && semanticDriftPerHour < 0.1) return 'declining';
  return 'growing';
}

// ── Keyword Evolution ─────────────────────────────────────────────────────

export function buildKeywordEvolution(
  chronologicalPosts: SocialPost[]
): KeywordStage[] {
  if (chronologicalPosts.length < 2) return [];

  const n = chronologicalPosts.length;
  const third = Math.max(Math.floor(n / 3), 1);

  const stages: { label: 'early' | 'middle' | 'latest'; posts: SocialPost[] }[] = [];

  if (n >= 3) {
    stages.push({ label: 'early', posts: chronologicalPosts.slice(0, third) });
    stages.push({ label: 'middle', posts: chronologicalPosts.slice(third, 2 * third) });
    stages.push({ label: 'latest', posts: chronologicalPosts.slice(2 * third) });
  } else {
    const half = Math.floor(n / 2);
    stages.push({ label: 'early', posts: chronologicalPosts.slice(0, half) });
    stages.push({ label: 'latest', posts: chronologicalPosts.slice(half) });
  }

  return stages
    .filter((s) => s.posts.length > 0)
    .map((s) => ({
      stage: s.label,
      keywords: extractTopKeywords(s.posts, 5),
      entities: extractEntities(s.posts),
      periodStart: s.posts[0].timestamp,
      periodEnd: s.posts[s.posts.length - 1].timestamp,
    }));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
