/**
 * SKYNET Narrative Clustering Engine — Adaptive Density-Peak Semantic Clustering
 *
 * Discovers coherent narrative clusters using:
 *   1. Local Semantic Density Estimation (rho): measures thematic concentration.
 *   2. Density-Peak Centroid Identification: finds authentic narrative nucleus points.
 *   3. Semantic Gravitational Assignment: maps posts to their true narrative attractor.
 *   4. Multi-Scale Fallback (Union-Find): ensures robust coverage across sparse data.
 */

import { cosineSimilarity } from '@/lib/ml/embeddings';

const NARRATIVE_SIMILARITY_THRESHOLD = Number(
  process.env.NARRATIVE_SIMILARITY_THRESHOLD || '0.55'
);

const MIN_NARRATIVE_SIZE = 2;
const MAX_NARRATIVE_CLUSTERS = 24;

export interface ClusterInput {
  id: string;
  embedding: number[];
}

export interface NarrativeCluster {
  postIds: string[];
  narrativeId: string;
  coherenceScore?: number;
}

/**
 * Cluster posts into narratives based on density-peak semantic attraction.
 */
export function clusterNarratives(
  items: ClusterInput[],
  threshold: number = NARRATIVE_SIMILARITY_THRESHOLD
): NarrativeCluster[] {
  const n = items.length;
  if (n < MIN_NARRATIVE_SIZE) return [];

  // 1. Build Pairwise Similarity Matrix
  const simMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    simMatrix[i][i] = 1.0;
    for (let j = i + 1; j < n; j++) {
      const s = cosineSimilarity(items[i].embedding, items[j].embedding);
      simMatrix[i][j] = s;
      simMatrix[j][i] = s;
    }
  }

  // 2. Compute Local Density (rho) for each post
  // Gaussian kernel density over semantic neighborhood
  const density: number[] = new Array(n).fill(0);
  const cutoff = Math.max(0.40, threshold * 0.85);

  for (let i = 0; i < n; i++) {
    let d = 0;
    for (let j = 0; j < n; j++) {
      if (i !== j && simMatrix[i][j] >= cutoff) {
        d += Math.exp(-Math.pow((1.0 - simMatrix[i][j]) / 0.25, 2));
      }
    }
    density[i] = d;
  }

  // 3. Find Density Peaks (Centroids)
  // A post is a cluster center if it has high local density and isn't too close to an existing center
  const indexedDensity = density
    .map((d, idx) => ({ idx, density: d }))
    .sort((a, b) => b.density - a.density);

  const clusterCentroids: number[] = [];
  const minCentroidSeparation = 0.65; // Distinct themes must not be overly identical

  for (const { idx } of indexedDensity) {
    if (density[idx] < 1.0) break; // Insufficient density to form a narrative seed

    let isDistinct = true;
    for (const c of clusterCentroids) {
      if (simMatrix[idx][c] > minCentroidSeparation) {
        isDistinct = false;
        break;
      }
    }

    if (isDistinct) {
      clusterCentroids.push(idx);
      if (clusterCentroids.length >= MAX_NARRATIVE_CLUSTERS) break;
    }
  }

  // 4. Assign Posts to Nearest Centroid
  const clusterBuckets = new Map<number, { indices: number[]; similarities: number[] }>();
  for (const c of clusterCentroids) {
    clusterBuckets.set(c, { indices: [c], similarities: [1.0] });
  }

  const assigned = new Set<number>(clusterCentroids);

  for (let i = 0; i < n; i++) {
    if (assigned.has(i)) continue;

    let bestCentroid = -1;
    let bestSim = -1;

    for (const c of clusterCentroids) {
      const sim = simMatrix[i][c];
      if (sim > bestSim && sim >= threshold) {
        bestSim = sim;
        bestCentroid = c;
      }
    }

    if (bestCentroid !== -1) {
      clusterBuckets.get(bestCentroid)!.indices.push(i);
      clusterBuckets.get(bestCentroid)!.similarities.push(bestSim);
      assigned.add(i);
    }
  }

  // 5. Convert Buckets to Narrative Clusters
  const clusters: NarrativeCluster[] = [];

  for (const [, bucket] of clusterBuckets.entries()) {
    if (bucket.indices.length >= MIN_NARRATIVE_SIZE) {
      const postIds = bucket.indices.map((idx) => items[idx].id).sort();
      const avgSim = bucket.similarities.reduce((a, b) => a + b, 0) / bucket.similarities.length;

      clusters.push({
        postIds,
        narrativeId: generateNarrativeId(postIds),
        coherenceScore: Number(avgSim.toFixed(3)),
      });
    }
  }

  // 6. Fallback Union-Find if Density Peaks yield too few clusters (< 4)
  if (clusters.length < 4 && threshold > 0.40) {
    return runUnionFindClustering(items, threshold * 0.85);
  }

  // Sort by cluster size descending
  clusters.sort((a, b) => b.postIds.length - a.postIds.length);
  return clusters;
}

/**
 * Union-Find Fallback Clustering for Sparse or Broad Neighborhoods
 */
function runUnionFindClustering(items: ClusterInput[], threshold: number): NarrativeCluster[] {
  const n = items.length;
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(x: number): number {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }

  function union(a: number, b: number) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(items[i].embedding, items[j].embedding);
      if (sim >= threshold) {
        union(i, j);
      }
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }

  const clusters: NarrativeCluster[] = [];
  for (const indices of groups.values()) {
    if (indices.length >= MIN_NARRATIVE_SIZE) {
      const postIds = indices.map((i) => items[i].id).sort();
      clusters.push({
        postIds,
        narrativeId: generateNarrativeId(postIds),
      });
    }
  }

  clusters.sort((a, b) => b.postIds.length - a.postIds.length);
  return clusters.slice(0, MAX_NARRATIVE_CLUSTERS);
}

/**
 * Generate a deterministic narrative ID from sorted post IDs.
 */
function generateNarrativeId(sortedPostIds: string[]): string {
  const input = sortedPostIds.join('|');
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return `SKY-${hash.toString(36).toUpperCase().padStart(6, '0')}`;
}

export { NARRATIVE_SIMILARITY_THRESHOLD, MIN_NARRATIVE_SIZE };
