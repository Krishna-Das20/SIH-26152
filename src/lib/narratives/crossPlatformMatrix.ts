/**
 * Narrative Cross-Platform Divergence Matrix Engine
 *
 * Compares how the same underlying narrative cluster is framed across
 * different social media platforms:
 *   - YouTube vs Telegram vs Reddit vs X vs Instagram vs Facebook
 *   - Dominant sentiment & nuanced emotion per channel
 *   - Distinct vocabulary / keywords per platform
 *   - Divergence score (semantic & sentiment distance from narrative centroid)
 *   - Sample representative framing snippet
 */

import { SocialPost, PlatformType } from '@/types/intelligence';
import { cosineSimilarity } from '@/lib/ml/embeddings';
import { extractTopKeywords } from './titleGenerator';
import { dominantEmotion, centroid, sentimentDistribution } from './mutations';
import type { CrossPlatformComparison } from './types';

export function buildCrossPlatformMatrix(
  posts: SocialPost[],
  overallCentroid: number[] | null,
  embeddingMap: Map<string, number[]>
): CrossPlatformComparison[] {
  if (posts.length === 0) return [];

  const platformGroups = new Map<PlatformType, SocialPost[]>();

  for (const post of posts) {
    const list = platformGroups.get(post.platform) || [];
    list.push(post);
    platformGroups.set(post.platform, list);
  }

  const matrix: CrossPlatformComparison[] = [];

  for (const [platform, platPosts] of platformGroups) {
    const sentDist = sentimentDistribution(platPosts);
    const dominantSentiment =
      sentDist.positive >= sentDist.negative && sentDist.positive >= sentDist.neutral
        ? 'positive'
        : sentDist.negative >= sentDist.positive && sentDist.negative >= sentDist.neutral
        ? 'negative'
        : 'neutral';

    const domEmotion = dominantEmotion(platPosts);
    const topKeywords = extractTopKeywords(platPosts, 4);

    // Compute divergence from overall centroid
    let divergenceScore = 0;
    if (overallCentroid) {
      const platEmbeddings = platPosts
        .map((p) => embeddingMap.get(p.id))
        .filter((e): e is number[] => e !== undefined);
      const platCentroid = centroid(platEmbeddings);
      if (platCentroid) {
        const sim = cosineSimilarity(overallCentroid, platCentroid);
        divergenceScore = Math.max(0, Math.min(100, Math.round((1 - sim) * 100)));
      }
    }

    // Pick shortest representative snippet
    const sample = platPosts
      .map((p) => p.content.trim())
      .filter((c) => c.length > 15)
      .sort((a, b) => a.length - b.length)[0] || platPosts[0].content;

    const sampleFramingSnippet =
      sample.length > 90 ? sample.slice(0, 87) + '…' : sample;

    matrix.push({
      platform,
      dominantSentiment,
      dominantEmotion: domEmotion,
      topKeywords,
      postCount: platPosts.length,
      divergenceScore,
      sampleFramingSnippet,
    });
  }

  // Sort by post count descending
  matrix.sort((a, b) => b.postCount - a.postCount);

  return matrix;
}
