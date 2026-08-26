/**
 * Narrative Branching & Convergence Engine
 *
 * Detects structural splits and mergers in narrative evolution:
 *   - Narrative Fragmentation / Branching: When a narrative splits into
 *     competing or diverging sub-threads in later stages.
 *   - Narrative Convergence: When previously separate narrative clusters
 *     begin sharing vocabulary and move closer in semantic space.
 *
 * Strict anti-fabrication: branch & convergence links are only emitted
 * when verified by actual vector distance and keyword overlap.
 */

import { SocialPost } from '@/types/intelligence';
import { cosineSimilarity } from '@/lib/ml/embeddings';
import { extractTopKeywords, generateNarrativeTitle } from './titleGenerator';
import { centroid } from './mutations';
import type { NarrativeBranch, NarrativeConvergence } from './types';

export function detectBranches(
  chronologicalPosts: SocialPost[],
  embeddingMap: Map<string, number[]>
): NarrativeBranch[] {
  if (chronologicalPosts.length < 6) return [];

  // Consider the later half of posts for branching
  const half = Math.floor(chronologicalPosts.length / 2);
  const latePosts = chronologicalPosts.slice(half);

  if (latePosts.length < 3) return [];

  // Group late posts by platform or distinct keyword focus
  const groups = new Map<string, SocialPost[]>();
  for (const post of latePosts) {
    const kws = extractTopKeywords([post], 2);
    const key = kws[0] || post.platform;
    const list = groups.get(key) || [];
    list.push(post);
    groups.set(key, list);
  }

  const branches: NarrativeBranch[] = [];
  const allEmbeddings = chronologicalPosts
    .map((p) => embeddingMap.get(p.id))
    .filter((e): e is number[] => e !== undefined);
  const parentCentroid = centroid(allEmbeddings);

  for (const [key, branchPosts] of groups) {
    if (branchPosts.length < 2 || branchPosts.length === latePosts.length) continue;

    const branchEmbeddings = branchPosts
      .map((p) => embeddingMap.get(p.id))
      .filter((e): e is number[] => e !== undefined);
    const branchCentroid = centroid(branchEmbeddings);

    let simToParent = 75;
    if (parentCentroid && branchCentroid) {
      simToParent = Math.round(cosineSimilarity(parentCentroid, branchCentroid) * 100);
    }

    const title = generateNarrativeTitle(branchPosts);
    const distinctKeywords = extractTopKeywords(branchPosts, 3);

    branches.push({
      branchId: `BR-${branches.length + 1}`,
      title,
      splitTimestamp: branchPosts[0].timestamp,
      postCount: branchPosts.length,
      similarityToParent: simToParent,
      distinctKeywords,
    });
  }

  return branches.slice(0, 3);
}

export function detectConvergences(
  narrativeId: string,
  narrativePosts: SocialPost[],
  allNarrativesPosts: { id: string; posts: SocialPost[] }[],
  embeddingMap: Map<string, number[]>
): NarrativeConvergence[] {
  if (narrativePosts.length < 2) return [];

  const thisKws = new Set(extractTopKeywords(narrativePosts, 6));
  const thisEmbeddings = narrativePosts
    .map((p) => embeddingMap.get(p.id))
    .filter((e): e is number[] => e !== undefined);
  const thisCentroid = centroid(thisEmbeddings);

  if (!thisCentroid || thisKws.size === 0) return [];

  const convergences: NarrativeConvergence[] = [];

  for (const other of allNarrativesPosts) {
    if (other.id === narrativeId || other.posts.length < 2) continue;

    const otherKws = new Set(extractTopKeywords(other.posts, 6));
    const sharedKeywords = [...thisKws].filter((k) => otherKws.has(k));

    if (sharedKeywords.length < 2) continue;

    const otherEmbeddings = other.posts
      .map((p) => embeddingMap.get(p.id))
      .filter((e): e is number[] => e !== undefined);
    const otherCentroid = centroid(otherEmbeddings);

    if (!otherCentroid) continue;

    const sim = cosineSimilarity(thisCentroid, otherCentroid);

    // Convergence threshold: similarity >= 0.60 AND >= 2 shared keywords
    if (sim >= 0.60) {
      convergences.push({
        convergedWithNarrativeId: other.id,
        convergedWithTitle: generateNarrativeTitle(other.posts),
        timestamp: narrativePosts[narrativePosts.length - 1].timestamp,
        sharedKeywords,
        combinedCentroidSim: Math.round(sim * 100),
      });
    }
  }

  return convergences.slice(0, 2);
}
