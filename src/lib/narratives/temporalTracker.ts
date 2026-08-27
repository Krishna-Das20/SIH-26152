/**
 * Narrative Temporal Tracker
 *
 * Slices narrative posts into discrete temporal buckets to track the state
 * of the narrative at every point in time:
 *   - Semantic centroid C(t)
 *   - Sentiment distribution
 *   - Dominant emotion
 *   - Top keywords & entities
 *   - Active platforms & Louvain communities
 *   - Influential accounts
 *   - Semantic velocity (centroid drift rate over time)
 *
 * Strict anti-fabrication: bucket values are exact aggregations of the
 * posts within each temporal window.
 */

import { SocialPost, PlatformType, EmotionType } from '@/types/intelligence';
import { cosineSimilarity } from '@/lib/ml/embeddings';
import { extractTopKeywords } from './titleGenerator';
import { dominantEmotion, sentimentDistribution, centroid } from './mutations';
import type { TemporalBucketState } from './types';

/**
 * Adaptive temporal bucketing resolution based on total time span.
 */
export function determineBucketDurationMs(timeSpanMs: number): number {
  const HOUR = 3600 * 1000;
  const DAY = 24 * HOUR;

  if (timeSpanMs <= 12 * HOUR) return HOUR; // 1-hour buckets for <= 12h
  if (timeSpanMs <= 3 * DAY) return 4 * HOUR; // 4-hour buckets for <= 3 days
  if (timeSpanMs <= 14 * DAY) return DAY; // 1-day buckets for <= 2 weeks
  if (timeSpanMs <= 60 * DAY) return 3 * DAY; // 3-day buckets for <= 2 months
  return 7 * DAY; // 1-week buckets for longer spans
}

/**
 * Build temporal state sequence for a narrative.
 */
export function buildTemporalStates(
  chronologicalPosts: SocialPost[],
  embeddingMap: Map<string, number[]>
): TemporalBucketState[] {
  if (chronologicalPosts.length === 0) return [];

  const firstTime = new Date(chronologicalPosts[0].timestamp).getTime();
  const lastTime = new Date(chronologicalPosts[chronologicalPosts.length - 1].timestamp).getTime();
  const timeSpanMs = Math.max(lastTime - firstTime, 1000);

  const bucketDurationMs = determineBucketDurationMs(timeSpanMs);
  const bucketCount = Math.max(Math.ceil(timeSpanMs / bucketDurationMs), 1);

  // Distribute posts into buckets
  const buckets: SocialPost[][] = Array.from({ length: bucketCount }, () => []);

  for (const post of chronologicalPosts) {
    const postTime = new Date(post.timestamp).getTime();
    const index = Math.min(
      Math.floor((postTime - firstTime) / bucketDurationMs),
      bucketCount - 1
    );
    buckets[index].push(post);
  }

  const states: TemporalBucketState[] = [];
  let prevCentroid: number[] | null = null;

  for (let b = 0; b < bucketCount; b++) {
    const postsInBucket = buckets[b];
    if (postsInBucket.length === 0) continue;

    const bucketTime = new Date(firstTime + b * bucketDurationMs).toISOString();

    // 1. Centroid
    const bucketEmbeddings = postsInBucket
      .map((p) => embeddingMap.get(p.id))
      .filter((e): e is number[] => e !== undefined);
    const currCentroid = centroid(bucketEmbeddings);

    // 2. Semantic shift from previous bucket
    let shiftFromPrev: number | null = null;
    if (prevCentroid && currCentroid) {
      const sim = cosineSimilarity(prevCentroid, currCentroid);
      shiftFromPrev = Math.max(0, Math.min(100, Number(((1 - sim) * 100).toFixed(1))));
    }
    if (currCentroid) prevCentroid = currCentroid;

    // 3. Sentiment & Emotion
    const sentDist = sentimentDistribution(postsInBucket);
    const dominantSent =
      sentDist.positive >= sentDist.negative && sentDist.positive >= sentDist.neutral
        ? 'positive'
        : sentDist.negative >= sentDist.positive && sentDist.negative >= sentDist.neutral
        ? 'negative'
        : 'neutral';
    const domEmo = dominantEmotion(postsInBucket);

    // 4. Keywords & Entities
    const topKeywords = extractTopKeywords(postsInBucket, 5);
    const entities = extractEntities(postsInBucket);

    // 5. Platforms & Communities
    const platforms = [...new Set(postsInBucket.map((p) => p.platform))] as PlatformType[];
    const communityCounts = new Map<number, number>();
    const amplifierSet = new Set<string>();

    for (const p of postsInBucket) {
      if (p.author.communityId !== undefined && p.author.communityId >= 0) {
        communityCounts.set(
          p.author.communityId,
          (communityCounts.get(p.author.communityId) || 0) + 1
        );
      }
      if (p.author.isKOL || (p.author.betweennessScore && p.author.betweennessScore > 0)) {
        amplifierSet.add(p.author.displayName || p.author.username);
      }
    }

    const topComm = [...communityCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    states.push({
      timestamp: bucketTime,
      postCount: postsInBucket.length,
      centroid: currCentroid || undefined,
      sentimentDistribution: sentDist,
      dominantSentiment: dominantSent,
      dominantEmotion: domEmo,
      topKeywords,
      topEntities: entities,
      platforms,
      topCommunityId: topComm,
      topAmplifiers: Array.from(amplifierSet).slice(0, 3),
      semanticShiftFromPrev: shiftFromPrev,
    });
  }

  return states;
}

/**
 * Extract named entities / hashtags / mentions from a set of posts.
 */
export function extractEntities(posts: SocialPost[]): string[] {
  const entityFreq = new Map<string, number>();

  for (const post of posts) {
    // 1. Explicit hashtags
    for (const tag of post.hashtags || []) {
      const formatted = tag.startsWith('#') ? tag : `#${tag}`;
      entityFreq.set(formatted, (entityFreq.get(formatted) || 0) + 2);
    }

    // 2. Mentioned usernames
    for (const mention of post.mentionedUsernames || []) {
      const formatted = mention.startsWith('@') ? mention : `@${mention}`;
      entityFreq.set(formatted, (entityFreq.get(formatted) || 0) + 2);
    }

    // 3. Capitalized proper nouns / acronyms (e.g. "OpenAI", "UPSC", "Telegram", "India", "WearOS")
    const properNounMatches = post.content.match(/\b[A-Z][a-zA-Z0-9_-]{2,}\b/g) || [];
    for (const noun of properNounMatches) {
      if (['The', 'This', 'That', 'With', 'From', 'Have', 'When', 'What', 'Your'].includes(noun)) continue;
      entityFreq.set(noun, (entityFreq.get(noun) || 0) + 1);
    }
  }

  return Array.from(entityFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([entity]) => entity);
}

/**
 * Compute narrative velocity metrics (semantic drift per hour and post rate).
 */
export function computeNarrativeVelocity(
  chronologicalPosts: SocialPost[],
  temporalStates: TemporalBucketState[]
): {
  semanticDriftPerHour: number;
  postVelocityPerHour: number;
  isAccelerating: boolean;
} {
  if (chronologicalPosts.length < 2) {
    return { semanticDriftPerHour: 0, postVelocityPerHour: 0, isAccelerating: false };
  }

  const firstTime = new Date(chronologicalPosts[0].timestamp).getTime();
  const lastTime = new Date(chronologicalPosts[chronologicalPosts.length - 1].timestamp).getTime();
  const totalHours = Math.max((lastTime - firstTime) / (3600 * 1000), 0.5);

  const postVelocity = Number((chronologicalPosts.length / totalHours).toFixed(2));

  // Compute sum of semantic shifts between adjacent buckets
  let totalDrift = 0;
  let driftCount = 0;
  for (const st of temporalStates) {
    if (st.semanticShiftFromPrev !== undefined && st.semanticShiftFromPrev !== null) {
      totalDrift += st.semanticShiftFromPrev;
      driftCount++;
    }
  }

  const semanticDriftPerHour = Number((totalDrift / Math.max(totalHours, 1)).toFixed(2));

  // Acceleration: compare late half velocity to early half velocity
  const half = Math.floor(temporalStates.length / 2);
  const earlyPosts = temporalStates.slice(0, half).reduce((s, b) => s + b.postCount, 0);
  const latePosts = temporalStates.slice(half).reduce((s, b) => s + b.postCount, 0);
  const isAccelerating = latePosts > earlyPosts && semanticDriftPerHour > 0.5;

  return {
    semanticDriftPerHour,
    postVelocityPerHour: postVelocity,
    isAccelerating,
  };
}
