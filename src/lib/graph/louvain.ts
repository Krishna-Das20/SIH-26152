/**
 * Louvain modularity-maximisation community detection.
 *
 * Implements the two-phase algorithm from Blondel et al. (2008),
 * "Fast unfolding of communities in large networks":
 *
 *   Phase 1 - repeatedly move each node into the neighbouring community that
 *             yields the largest positive modularity gain, until no move helps.
 *   Phase 2 - collapse each community into a single super-node (aggregating
 *             edge weights, keeping intra-community weight as a self-loop)
 *             and repeat on the smaller graph.
 *
 * The graph is treated as undirected and weighted; parallel edges between the
 * same pair are summed. Returns a community index per node id.
 */

export interface LouvainEdge {
  source: string;
  target: string;
  weight: number;
}

/** Adjacency: node -> (neighbour -> summed weight). Self-loops allowed. */
type Adjacency = Map<string, Map<string, number>>;

function buildAdjacency(nodeIds: string[], edges: LouvainEdge[]): Adjacency {
  const adj: Adjacency = new Map();
  for (const id of nodeIds) adj.set(id, new Map());

  for (const e of edges) {
    if (!adj.has(e.source) || !adj.has(e.target)) continue;
    const w = e.weight > 0 ? e.weight : 1;

    const su = adj.get(e.source)!;
    su.set(e.target, (su.get(e.target) || 0) + w);

    if (e.source !== e.target) {
      const tv = adj.get(e.target)!;
      tv.set(e.source, (tv.get(e.source) || 0) + w);
    }
  }
  return adj;
}

/** Weighted degree; self-loops count twice, per the standard definition. */
function weightedDegree(adj: Adjacency, node: string): number {
  const nbrs = adj.get(node);
  if (!nbrs) return 0;
  let k = 0;
  for (const [nbr, w] of nbrs) k += nbr === node ? 2 * w : w;
  return k;
}

function totalWeight(adj: Adjacency): number {
  let sum = 0;
  for (const [node, nbrs] of adj) {
    for (const [nbr, w] of nbrs) sum += nbr === node ? 2 * w : w;
  }
  return sum / 2; // each undirected edge is counted from both endpoints
}

/** Phase 1: local modularity optimisation over the given graph. */
function optimiseLocally(adj: Adjacency, maxPasses = 20): Map<string, number> {
  const nodes = Array.from(adj.keys());
  const m = totalWeight(adj);

  // Each node starts in its own community.
  const community = new Map<string, number>();
  nodes.forEach((n, i) => community.set(n, i));

  if (m === 0) return community;

  const degree = new Map<string, number>();
  const communityTotalDegree = new Map<number, number>();
  for (const n of nodes) {
    const k = weightedDegree(adj, n);
    degree.set(n, k);
    communityTotalDegree.set(community.get(n)!, k);
  }

  for (let pass = 0; pass < maxPasses; pass++) {
    let moved = false;

    for (const node of nodes) {
      const nodeDegree = degree.get(node)!;
      const currentCommunity = community.get(node)!;

      // Summed weight from `node` into each neighbouring community.
      const weightToCommunity = new Map<number, number>();
      for (const [nbr, w] of adj.get(node)!) {
        if (nbr === node) continue;
        const c = community.get(nbr)!;
        weightToCommunity.set(c, (weightToCommunity.get(c) || 0) + w);
      }

      // Temporarily remove the node from its own community.
      communityTotalDegree.set(
        currentCommunity,
        (communityTotalDegree.get(currentCommunity) || 0) - nodeDegree
      );

      // The modularity gain of moving into community c is proportional to
      //     k_in(c) - (sigma_tot(c) * k_node) / (2m)
      // The 1/m factor is common to all candidates, so comparing the bracketed
      // term alone selects the same winner.
      const baseline =
        (weightToCommunity.get(currentCommunity) || 0) -
        ((communityTotalDegree.get(currentCommunity) || 0) * nodeDegree) / (2 * m);

      let bestCommunity = currentCommunity;
      let bestScore = baseline;

      for (const [candidate, kIn] of weightToCommunity) {
        const score =
          kIn - ((communityTotalDegree.get(candidate) || 0) * nodeDegree) / (2 * m);
        if (score > bestScore + 1e-12) {
          bestScore = score;
          bestCommunity = candidate;
        }
      }

      // Re-insert into the winning community.
      community.set(node, bestCommunity);
      communityTotalDegree.set(
        bestCommunity,
        (communityTotalDegree.get(bestCommunity) || 0) + nodeDegree
      );

      if (bestCommunity !== currentCommunity) moved = true;
    }

    if (!moved) break;
  }

  return community;
}

/** Phase 2: collapse each community into a single super-node. */
function aggregate(adj: Adjacency, community: Map<string, number>): Adjacency {
  const next: Adjacency = new Map();
  const key = (c: number) => `c${c}`;

  for (const c of new Set(community.values())) next.set(key(c), new Map());

  for (const [node, nbrs] of adj) {
    const cu = key(community.get(node)!);
    for (const [nbr, w] of nbrs) {
      const cv = key(community.get(nbr)!);
      const bucket = next.get(cu)!;
      // Halved because every undirected pair is visited from both endpoints.
      bucket.set(cv, (bucket.get(cv) || 0) + w / 2);
    }
  }
  return next;
}

/**
 * Runs Louvain and returns `nodeId -> communityIndex`. Indices are renumbered
 * densely from 0 in descending order of size, so community 0 is the largest.
 */
export function detectCommunities(
  nodeIds: string[],
  edges: LouvainEdge[],
  maxLevels = 10
): Map<string, number> {
  if (nodeIds.length === 0) return new Map();

  let adj = buildAdjacency(nodeIds, edges);
  const levels: Map<string, number>[] = [];

  for (let level = 0; level < maxLevels; level++) {
    const assignment = optimiseLocally(adj);
    levels.push(assignment);

    const distinct = new Set(assignment.values()).size;
    // No compression means modularity has converged.
    if (distinct === adj.size) break;

    adj = aggregate(adj, assignment);
    if (adj.size <= 1) break;
  }

  // Fold the per-level assignments back down onto the original node ids.
  const folded = new Map<string, number>();
  for (const node of nodeIds) {
    let key = node;
    let community = 0;
    for (const assignment of levels) {
      const next = assignment.get(key);
      if (next === undefined) break;
      community = next;
      key = `c${community}`;
    }
    folded.set(node, community);
  }

  // Renumber densely, largest community first.
  const sizes = new Map<number, number>();
  for (const c of folded.values()) sizes.set(c, (sizes.get(c) || 0) + 1);
  const remap = new Map<number, number>();
  Array.from(sizes.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([c], i) => remap.set(c, i));

  const renumbered = new Map<string, number>();
  for (const [node, c] of folded) renumbered.set(node, remap.get(c) ?? 0);
  return renumbered;
}

/**
 * Newman-Girvan modularity Q of a partition. Roughly [-0.5, 1]; values above
 * ~0.3 indicate meaningful community structure. Returned by the graph API so
 * the clustering can be judged rather than taken on trust.
 */
export function modularity(
  nodeIds: string[],
  edges: LouvainEdge[],
  community: Map<string, number>
): number {
  const adj = buildAdjacency(nodeIds, edges);
  const m = totalWeight(adj);
  if (m === 0) return 0;

  // Q = sum_c [ (in_c / 2m) - (tot_c / 2m)^2 ], computed per community so the
  // cost stays linear in edges rather than quadratic in nodes.
  const intraWeight = new Map<number, number>();
  const totalDegree = new Map<number, number>();

  for (const u of nodeIds) {
    const cu = community.get(u) ?? -1;
    totalDegree.set(cu, (totalDegree.get(cu) || 0) + weightedDegree(adj, u));

    for (const [v, w] of adj.get(u) || []) {
      if ((community.get(v) ?? -2) !== cu) continue;
      // Self-loops contribute their full weight; ordinary intra edges are seen
      // twice across the outer loop, so both cases resolve correctly below.
      intraWeight.set(cu, (intraWeight.get(cu) || 0) + w);
    }
  }

  let q = 0;
  for (const c of new Set(community.values())) {
    const inC = intraWeight.get(c) || 0;
    const totC = totalDegree.get(c) || 0;
    q += inC / (2 * m) - Math.pow(totC / (2 * m), 2);
  }

  return Number(q.toFixed(4));
}
