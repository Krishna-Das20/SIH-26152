/**
 * Narrative Platform Propagation & Influence Attribution Engine
 *
 * Reconstructs the multi-platform journey of a narrative:
 *   - Origin platform (where the first post in the cluster appeared)
 *   - Propagation hops with precise elapsed delays (in hours)
 *   - Associates high-centrality accounts with each propagation step
 *   - Extracts top amplifiers ranked by influence & betweenness
 */

import { SocialPost, PlatformType } from '@/types/intelligence';
import type { PlatformPropagation, PropagationHop, NarrativeAmplifier } from './types';

export function buildPlatformPropagation(
  chronologicalPosts: SocialPost[]
): PlatformPropagation {
  if (chronologicalPosts.length === 0) {
    return {
      originPlatform: 'x',
      originTimestamp: new Date().toISOString(),
      totalSpreadTimeHours: 0,
      hops: [],
    };
  }

  const originPost = chronologicalPosts[0];
  const originPlatform = originPost.platform;
  const originTimestamp = originPost.timestamp;
  const originTimeMs = new Date(originTimestamp).getTime();

  // Track first seen timestamp and post counts per platform
  const platformData = new Map<
    PlatformType,
    { firstSeen: string; postCount: number; authors: Map<string, { name: string; score: number }> }
  >();

  for (const post of chronologicalPosts) {
    const p = post.platform;
    const existing = platformData.get(p);
    const authScore = (post.author.betweennessScore || 0) * 50 + (post.author.isKOL ? 50 : 0);
    const authName = post.author.displayName || post.author.username;

    if (!existing) {
      const authors = new Map<string, { name: string; score: number }>();
      authors.set(authName, { name: authName, score: authScore });
      platformData.set(p, {
        firstSeen: post.timestamp,
        postCount: 1,
        authors,
      });
    } else {
      existing.postCount++;
      const curAuth = existing.authors.get(authName);
      if (!curAuth || authScore > curAuth.score) {
        existing.authors.set(authName, { name: authName, score: authScore });
      }
    }
  }

  // Convert to sorted hops
  const hops: PropagationHop[] = [...platformData.entries()]
    .map(([platform, data]) => {
      const hopTimeMs = new Date(data.firstSeen).getTime();
      const delayHours = Number(Math.max((hopTimeMs - originTimeMs) / (3600 * 1000), 0).toFixed(1));
      const keyAmplifiers = [...data.authors.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .map((a) => a.name);

      return {
        platform,
        timestamp: data.firstSeen,
        delayHours,
        postCount: data.postCount,
        keyAmplifiers,
      };
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const lastHopTime = hops.length > 0 ? hops[hops.length - 1].delayHours : 0;

  return {
    originPlatform,
    originTimestamp,
    totalSpreadTimeHours: lastHopTime,
    hops,
  };
}

export function extractNarrativeAmplifiers(
  chronologicalPosts: SocialPost[]
): NarrativeAmplifier[] {
  const authorMap = new Map<string, NarrativeAmplifier>();

  const halfIndex = Math.floor(chronologicalPosts.length / 2);

  for (let i = 0; i < chronologicalPosts.length; i++) {
    const post = chronologicalPosts[i];
    const author = post.author;
    const isLate = i >= halfIndex;

    const baseInfluence =
      (author.followerCount ? Math.min(Math.log10(author.followerCount) * 15, 60) : 0) +
      (author.isKOL ? 30 : 0) +
      (author.betweennessScore ? author.betweennessScore * 40 : 0);

    const influenceScore = Math.min(100, Math.round(baseInfluence || 20));

    const existing = authorMap.get(author.id);
    if (!existing) {
      authorMap.set(author.id, {
        id: author.id,
        username: author.username,
        displayName: author.displayName || author.username,
        platform: post.platform,
        influenceScore,
        betweennessRank: author.betweennessScore ? 1 : undefined,
        communityId: author.communityId,
        firstSeenInNarrative: post.timestamp,
        associatedWithShift: isLate,
      });
    } else {
      if (influenceScore > existing.influenceScore) {
        existing.influenceScore = influenceScore;
      }
      if (isLate) existing.associatedWithShift = true;
    }
  }

  return [...authorMap.values()]
    .sort((a, b) => b.influenceScore - a.influenceScore)
    .slice(0, 6);
}
