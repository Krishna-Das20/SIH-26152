/**
 * Narrative Breakpoint Detection Engine
 *
 * Identifies the exact moments when a narrative undergoes a significant
 * inflection or mutation across time, platforms, or sentiment.
 *
 * For each detected breakpoint:
 *   - Exact timestamp & triggering post IDs
 *   - Previous vs new narrative state titles
 *   - Magnitude & shift level (STABLE, GRADUAL, SIGNIFICANT, MAJOR BREAK)
 *   - Sentiment delta & emotion transition
 *   - Added & removed keywords and entities
 *   - Evidence-grounded "Why" summary
 *
 * Strict anti-fabrication: only points with mathematically verified shifts
 * are emitted as breakpoints.
 */

import { SocialPost } from '@/types/intelligence';
import { cosineSimilarity } from '@/lib/ml/embeddings';
import { extractTopKeywords, generateNarrativeTitle } from './titleGenerator';
import { extractEntities } from './temporalTracker';
import { dominantEmotion, sentimentDistribution } from './mutations';
import type { NarrativeBreakpoint, NarrativeShiftLevel, TemporalBucketState } from './types';

export function detectBreakpoints(
  chronologicalPosts: SocialPost[],
  temporalStates: TemporalBucketState[],
  embeddingMap: Map<string, number[]>
): NarrativeBreakpoint[] {
  if (chronologicalPosts.length < 4 || temporalStates.length < 2) {
    return [];
  }

  const breakpoints: NarrativeBreakpoint[] = [];

  for (let i = 1; i < temporalStates.length; i++) {
    const prevState = temporalStates[i - 1];
    const currState = temporalStates[i];

    const shift = currState.semanticShiftFromPrev || 0;
    const sentFrom = prevState.dominantSentiment;
    const sentTo = currState.dominantSentiment;
    const sentChanged = sentFrom !== sentTo;
    const emoFrom = prevState.dominantEmotion || 'neutral';
    const emoTo = currState.dominantEmotion || 'neutral';
    const emoChanged = emoFrom !== emoTo;

    // Breakpoint condition: semantic shift >= 25% OR (semantic shift >= 15% AND sentiment/emotion flip)
    const isBreakpoint = shift >= 25 || (shift >= 15 && (sentChanged || emoChanged));

    if (!isBreakpoint) continue;

    // Determine shift level
    const shiftLevel: NarrativeShiftLevel =
      shift >= 45
        ? 'major_break'
        : shift >= 30
        ? 'significant_mutation'
        : 'gradual_shift';

    // Find posts associated with currState bucket
    const bucketPosts = chronologicalPosts.filter(
      (p) => new Date(p.timestamp).getTime() >= new Date(currState.timestamp).getTime()
    );
    const prevPosts = chronologicalPosts.filter(
      (p) => new Date(p.timestamp).getTime() < new Date(currState.timestamp).getTime()
    );

    // Isolate triggering posts (top 2 posts in current bucket with largest displacement from prev centroid)
    const triggeringPosts: string[] = [];
    if (prevState.centroid) {
      const scoredPosts = bucketPosts.map((p) => {
        const emb = embeddingMap.get(p.id);
        const sim = emb ? cosineSimilarity(prevState.centroid!, emb) : 1;
        return { id: p.id, displacement: 1 - sim };
      });
      scoredPosts.sort((a, b) => b.displacement - a.displacement);
      triggeringPosts.push(...scoredPosts.slice(0, 3).map((sp) => sp.id));
    } else {
      triggeringPosts.push(...bucketPosts.slice(0, 2).map((p) => p.id));
    }

    // Previous vs new titles
    const prevTitle = prevPosts.length > 0 ? generateNarrativeTitle(prevPosts) : prevState.topKeywords.join(' ');
    const newTitle = bucketPosts.length > 0 ? generateNarrativeTitle(bucketPosts) : currState.topKeywords.join(' ');

    // Keyword & entity diffs
    const prevKwSet = new Set(prevState.topKeywords);
    const currKwSet = new Set(currState.topKeywords);
    const addedKeywords = currState.topKeywords.filter((k) => !prevKwSet.has(k));
    const removedKeywords = prevState.topKeywords.filter((k) => !currKwSet.has(k));

    const prevEntSet = new Set(prevState.topEntities);
    const currEntSet = new Set(currState.topEntities);
    const addedEntities = currState.topEntities.filter((e) => !prevEntSet.has(e));
    const removedEntities = prevState.topEntities.filter((e) => !currEntSet.has(e));

    // Sentiment score delta
    const prevScore = prevState.sentimentDistribution.positive - prevState.sentimentDistribution.negative;
    const currScore = currState.sentimentDistribution.positive - currState.sentimentDistribution.negative;
    const scoreDelta = Number((currScore - prevScore).toFixed(2));

    // Why summary statements
    const whySummary: string[] = [];
    whySummary.push(
      `Semantic framing shifted by ${shift.toFixed(1)}% between temporal intervals.`
    );
    if (sentChanged) {
      whySummary.push(
        `Dominant sentiment transitioned from ${sentFrom} to ${sentTo} (net score delta: ${scoreDelta > 0 ? '+' : ''}${scoreDelta}).`
      );
    }
    if (emoChanged) {
      whySummary.push(
        `Emotional tone pivoted from ${emoFrom} to ${emoTo}.`
      );
    }
    if (addedKeywords.length > 0) {
      whySummary.push(
        `New focal keywords emerged: ${addedKeywords.slice(0, 3).join(', ')}.`
      );
    }
    if (currState.platforms.length > 0) {
      whySummary.push(
        `Activity observed on platform: ${currState.platforms.join(', ')}.`
      );
    }

    breakpoints.push({
      id: `BP-${breakpoints.length + 1}`,
      timestamp: currState.timestamp,
      previousStateTitle: prevTitle,
      newStateTitle: newTitle,
      magnitude: Math.min(100, Math.round(shift)),
      shiftLevel,
      triggeringPostIds: triggeringPosts,
      platform: currState.platforms[0] || 'x',
      communityId: currState.topCommunityId,
      sentimentDelta: {
        from: sentFrom,
        to: sentTo,
        scoreDelta,
      },
      emotionDelta: {
        from: emoFrom,
        to: emoTo,
      },
      addedKeywords,
      removedKeywords,
      addedEntities,
      removedEntities,
      whySummary,
    });
  }

  return breakpoints;
}
