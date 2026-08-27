/**
 * Narrative Clustering — Union-Find Connected Components
 *
 * Groups posts into narratives based on semantic similarity of their
 * embeddings.  Uses a simple union-find (disjoint set) algorithm on a
 * pairwise cosine-similarity matrix with a configurable threshold.
 *
 * Why union-find over DBSCAN:
 *   - Fully deterministic (no random seed, no min_samples ambiguity)
 *   - Simple to implement and audit
 *   - O(n²) similarity matrix is trivial for ~200 posts
 *   - Transparent: the threshold is the ONLY parameter
 *
 * The narrative ID is a stable hash derived from the sorted set of post
 * IDs, so the same cluster always gets the same ID.
 */

import { cosineSimilarity } from '@/lib/ml/embeddings';

// ── Configuration ─────────────────────────────────────────────────────────

const NARRATIVE_SIMILARITY_THRESHOLD = Number(
  process.env.NARRATIVE_SIMILARITY_THRESHOLD || '0.70'
);

/** Minimum posts to form a narrative.  A "narrative" of 1 is just a post. */
const MIN_NARRATIVE_SIZE = 2;

// ── Union-Find ────────────────────────────────────────────────────────────

class UnionFind {
  private parent: number[];
  private rank: number[];

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array(n).fill(0);
  }

  find(x: number): number {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]); // path compression
    }
    return this.parent[x];
  }

  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    // union by rank
    if (this.rank[ra] < this.rank[rb]) {
      this.parent[ra] = rb;
    } else if (this.rank[ra] > this.rank[rb]) {
      this.parent[rb] = ra;
    } else {
      this.parent[rb] = ra;
      this.rank[ra]++;
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────

export interface ClusterInput {
  id: string;
  embedding: number[];
}

export interface NarrativeCluster {
  /** Sorted post IDs in this cluster. */
  postIds: string[];
  /** Stable narrative ID derived from sorted post IDs. */
  narrativeId: string;
}

/**
 * Cluster posts into narratives based on embedding similarity.
 *
 * @param items  Posts with their embeddings
 * @param threshold  Cosine similarity threshold (default from env)
 * @returns Array of clusters, each with ≥ MIN_NARRATIVE_SIZE posts
 */
export function clusterNarratives(
  items: ClusterInput[],
  threshold: number = NARRATIVE_SIMILARITY_THRESHOLD
): NarrativeCluster[] {
  const n = items.length;
  if (n < MIN_NARRATIVE_SIZE) return [];

  const runClustering = (t: number) => {
    const uf = new UnionFind(n);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const sim = cosineSimilarity(items[i].embedding, items[j].embedding);
        if (sim >= t) {
          uf.union(i, j);
        }
      }
    }

    const groups = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
      const root = uf.find(i);
      const list = groups.get(root);
      if (list) list.push(i);
      else groups.set(root, [i]);
    }

    const clusters: NarrativeCluster[] = [];
    for (const indices of groups.values()) {
      if (indices.length < MIN_NARRATIVE_SIZE) continue;
      const postIds = indices.map((i) => items[i].id).sort();
      clusters.push({
        postIds,
        narrativeId: generateNarrativeId(postIds),
      });
    }
    clusters.sort((a, b) => b.postIds.length - a.postIds.length);
    return clusters;
  };

  // Try default threshold first
  let clusters = runClustering(threshold);

  // If no clusters formed at a strict threshold, adaptively relax down to 0.35
  if (clusters.length === 0 && threshold > 0.40) {
    clusters = runClustering(0.40);
  }
  if (clusters.length === 0 && threshold > 0.30) {
    clusters = runClustering(0.30);
  }

  return clusters;
}

/**
 * Generate a deterministic narrative ID from sorted post IDs.
 *
 * Uses a simple string hash (djb2) to produce a short, stable identifier.
 * This is NOT cryptographic — it's for deduplication and stable references.
 */
function generateNarrativeId(sortedPostIds: string[]): string {
  const input = sortedPostIds.join('|');
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return `N${hash.toString(36).toUpperCase().padStart(6, '0')}`;
}

export { NARRATIVE_SIMILARITY_THRESHOLD, MIN_NARRATIVE_SIZE };
