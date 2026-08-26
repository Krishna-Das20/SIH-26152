/**
 * Narrative Mutation Calculations
 *
 * Computes four shift metrics that together compose the mutation score:
 *
 *   semantic_shift  = (1 − cos_sim(early_embed, late_embed)) × 100    [0,100]
 *   sentiment_shift = total_variation_distance(early_dist, late_dist) × 100
 *   emotion_shift   = same→0, different→100  (categorical comparison)
 *   keyword_shift   = (1 − jaccard(early_top5, late_top5)) × 100      [0,100]
 *
 *   mutation_score  = 0.40·semantic + 0.25·sentiment + 0.20·emotion + 0.15·keyword
 *
 * CRITICAL: if any component is null, mutation_score is null.
 * We never fabricate a composite score from partial data.
 *
 * Three of the four components are distribution comparisons and saturate to
 * exactly 0 or exactly 100 when a stage holds a single post -- see
 * MIN_STAGE_POSTS below, which is why a narrative needs at least
 * 2 x MIN_STAGE_POSTS posts before it receives a composite score at all.
 */

import { SocialPost, EmotionType } from '@/types/intelligence';
import { cosineSimilarity } from '@/lib/ml/embeddings';
import { extractTopKeywords } from './titleGenerator';
import { MutationBreakdown, KeywordStage } from './types';

// ── Mutation weights ──────────────────────────────────────────────────────

const WEIGHT_SEMANTIC = 0.40;
const WEIGHT_SENTIMENT = 0.25;
const WEIGHT_EMOTION = 0.20;
const WEIGHT_KEYWORD = 0.15;

/**
 * Minimum posts per stage before the saturating components mean anything.
 *
 * `sentimentShift`, `emotionShift` and `keywordShift` are all computed from
 * DISTRIBUTIONS over a stage. With a single post per stage there is no
 * distribution to compare: the sentiment histogram is one-hot, so TVD collapses
 * to exactly 0 or exactly 100; the emotion "mode" is just that one post's
 * emotion, so the categorical comparison is a coin flip; and two short comments
 * essentially never share a top-5 keyword, so Jaccard distance pins at 100.
 *
 * Measured on the 352-post frozen corpus: all 18 two-post narratives had
 * sentimentShift of exactly 0 or exactly 100. Those three components carry 60
 * of the 100 available points, so unrelated comment PAIRS scored 60-72 and
 * ranked above the one genuinely large narrative (69 posts), which scored 17.
 * The ranking was measuring cluster smallness, not narrative mutation.
 *
 * Below this floor each component returns null, which by the strict rule in
 * computeMutationScore() makes the composite null rather than fabricated.
 * `semanticShift` is exempt: a centroid of one vector is still that vector, so
 * cosine distance between stages remains a real continuous measurement.
 */
const MIN_STAGE_POSTS = 2;

// ── Semantic Shift ────────────────────────────────────────────────────────

/**
 * Compute semantic shift between early and late narrative stages.
 *
 * Uses the centroid (mean) of early-stage embeddings vs late-stage embeddings
 * as the representative vectors.
 *
 * Formula: (1 − cosine_similarity(early_centroid, late_centroid)) × 100
 * Clamped to [0, 100].
 *
 * Returns null if fewer than 2 posts have embeddings.
 */
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

/**
 * Compute the centroid (element-wise mean) of a set of vectors.
 */
function centroid(vectors: number[][]): number[] | null {
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

// ── Sentiment Shift ───────────────────────────────────────────────────────

/**
 * Compute sentiment shift between early and late stages.
 *
 * Uses Total Variation Distance between the sentiment label distributions.
 *
 * TVD = 0.5 × Σ|P(label) − Q(label)|
 *
 * Scaled to [0, 100].  Returns null if no sentiment data.
 */
export function computeSentimentShift(
  earlyPosts: SocialPost[],
  latePosts: SocialPost[]
): number | null {
  if (earlyPosts.length < MIN_STAGE_POSTS || latePosts.length < MIN_STAGE_POSTS) return null;

  const earlyDist = sentimentDistribution(earlyPosts);
  const lateDist = sentimentDistribution(latePosts);

  // Total Variation Distance
  let tvd = 0;
  for (const label of ['positive', 'negative', 'neutral'] as const) {
    tvd += Math.abs(earlyDist[label] - lateDist[label]);
  }
  tvd /= 2; // TVD is half the L1 norm

  return clamp(tvd * 100, 0, 100);
}

function sentimentDistribution(
  posts: SocialPost[]
): Record<'positive' | 'negative' | 'neutral', number> {
  const counts = { positive: 0, negative: 0, neutral: 0 };
  for (const p of posts) {
    const label = p.sentiment.label;
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

// ── Emotion Shift ─────────────────────────────────────────────────────────

/**
 * Compute emotion shift between early and late stages.
 *
 * The existing emotion model provides categorical output (dominant_emotion).
 * Comparison: same dominant emotion → 0, different → 100.
 *
 * Returns null if no emotion data exists.
 */
export function computeEmotionShift(
  earlyPosts: SocialPost[],
  latePosts: SocialPost[]
): number | null {
  if (earlyPosts.length < MIN_STAGE_POSTS || latePosts.length < MIN_STAGE_POSTS) return null;

  const earlyDominant = dominantEmotion(earlyPosts);
  const lateDominant = dominantEmotion(latePosts);

  if (!earlyDominant || !lateDominant) return null;

  return earlyDominant === lateDominant ? 0 : 100;
}

function dominantEmotion(posts: SocialPost[]): EmotionType | null {
  const counts = new Map<EmotionType, number>();
  for (const p of posts) {
    const emotion = p.sentiment.nuancedEmotion;
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

// ── Keyword Shift ─────────────────────────────────────────────────────────

/**
 * Compute keyword shift between early and late stages.
 *
 * Uses Jaccard distance between the top-5 keywords of each stage.
 *
 * keyword_shift = (1 − |intersection| / |union|) × 100
 *
 * Returns null if keywords cannot be extracted from either stage.
 */
export function computeKeywordShift(
  earlyPosts: SocialPost[],
  latePosts: SocialPost[]
): number | null {
  if (earlyPosts.length < MIN_STAGE_POSTS || latePosts.length < MIN_STAGE_POSTS) return null;

  const earlyKw = new Set(extractTopKeywords(earlyPosts, 5));
  const lateKw = new Set(extractTopKeywords(latePosts, 5));

  if (earlyKw.size === 0 || lateKw.size === 0) return null;

  const intersection = new Set([...earlyKw].filter((k) => lateKw.has(k)));
  const union = new Set([...earlyKw, ...lateKw]);

  if (union.size === 0) return null;

  const jaccard = intersection.size / union.size;
  return clamp((1 - jaccard) * 100, 0, 100);
}

// ── Keyword Evolution ─────────────────────────────────────────────────────

/**
 * Build keyword evolution stages for a narrative.
 */
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
      periodStart: s.posts[0].timestamp,
      periodEnd: s.posts[s.posts.length - 1].timestamp,
    }));
}

// ── Composite Mutation Score ──────────────────────────────────────────────

/**
 * Compute the composite mutation score.
 *
 * mutation_score = 0.40 × semantic + 0.25 × sentiment + 0.20 × emotion + 0.15 × keyword
 *
 * Returns null if ANY component is null (strict anti-fabrication rule).
 */
export function computeMutationScore(breakdown: MutationBreakdown): number | null {
  const { semanticShift, sentimentShift, emotionShift, keywordShift } = breakdown;

  if (
    semanticShift === null ||
    sentimentShift === null ||
    emotionShift === null ||
    keywordShift === null
  ) {
    return null;
  }

  const score =
    WEIGHT_SEMANTIC * semanticShift +
    WEIGHT_SENTIMENT * sentimentShift +
    WEIGHT_EMOTION * emotionShift +
    WEIGHT_KEYWORD * keywordShift;

  return clamp(Number(score.toFixed(1)), 0, 100);
}

// ── Helpers ───────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export {
  MIN_STAGE_POSTS,
  WEIGHT_SEMANTIC,
  WEIGHT_SENTIMENT,
  WEIGHT_EMOTION,
  WEIGHT_KEYWORD,
  dominantEmotion,
  sentimentDistribution,
};
