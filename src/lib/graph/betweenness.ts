/**
 * Brandes betweenness centrality.
 *
 * Implements Brandes (2001), "A faster algorithm for betweenness centrality":
 * a BFS from every source builds the shortest-path DAG, then dependencies are
 * accumulated back down it. Runs in O(V*E) rather than the O(V^3) of the naive
 * all-pairs formulation.
 *
 * Betweenness measures how often a node lies on shortest paths between other
 * nodes. In this context it is the brokerage score: a node with high
 * betweenness but modest reach is a bridge between otherwise separate
 * communities, which is exactly the profile of an information broker.
 */

export interface BetweennessEdge {
  source: string;
  target: string;
}

/**
 * Computes betweenness for every node.
 *
 * @param directed  When false (default) edges are traversed both ways, which
 *                  is the right model for "who bridges which conversations".
 * @param normalise When true (default) scores are divided by the number of
 *                  possible pairs, putting them on a comparable [0,1] scale
 *                  regardless of graph size.
 */
export function betweennessCentrality(
  nodeIds: string[],
  edges: BetweennessEdge[],
  { directed = false, normalise = true }: { directed?: boolean; normalise?: boolean } = {}
): Map<string, number> {
  const centrality = new Map<string, number>();
  for (const id of nodeIds) centrality.set(id, 0);

  const n = nodeIds.length;
  if (n < 3) return centrality; // no node can lie *between* fewer than 3

  // Deduplicated adjacency list. Parallel edges do not create extra paths.
  const neighbours = new Map<string, Set<string>>();
  for (const id of nodeIds) neighbours.set(id, new Set());
  for (const e of edges) {
    if (!neighbours.has(e.source) || !neighbours.has(e.target)) continue;
    if (e.source === e.target) continue;
    neighbours.get(e.source)!.add(e.target);
    if (!directed) neighbours.get(e.target)!.add(e.source);
  }

  for (const source of nodeIds) {
    // --- Single-source shortest paths (BFS, unit edge weights) ---
    const stack: string[] = [];
    const predecessors = new Map<string, string[]>();
    const pathCount = new Map<string, number>(); // sigma
    const distance = new Map<string, number>();

    for (const id of nodeIds) {
      predecessors.set(id, []);
      pathCount.set(id, 0);
      distance.set(id, -1);
    }
    pathCount.set(source, 1);
    distance.set(source, 0);

    const queue: string[] = [source];
    let head = 0;

    while (head < queue.length) {
      const v = queue[head++];
      stack.push(v);
      const dv = distance.get(v)!;

      for (const w of neighbours.get(v)!) {
        // First time w is reached: it sits one level deeper.
        if (distance.get(w)! < 0) {
          distance.set(w, dv + 1);
          queue.push(w);
        }
        // Another shortest path to w found via v.
        if (distance.get(w) === dv + 1) {
          pathCount.set(w, pathCount.get(w)! + pathCount.get(v)!);
          predecessors.get(w)!.push(v);
        }
      }
    }

    // --- Dependency accumulation, walking the DAG back to the source ---
    const dependency = new Map<string, number>();
    for (const id of nodeIds) dependency.set(id, 0);

    while (stack.length > 0) {
      const w = stack.pop()!;
      const sigmaW = pathCount.get(w)!;
      for (const v of predecessors.get(w)!) {
        const share = (pathCount.get(v)! / sigmaW) * (1 + dependency.get(w)!);
        dependency.set(v, dependency.get(v)! + share);
      }
      if (w !== source) {
        centrality.set(w, centrality.get(w)! + dependency.get(w)!);
      }
    }
  }

  // Undirected graphs count every pair twice (once from each endpoint).
  if (!directed) {
    for (const [id, score] of centrality) centrality.set(id, score / 2);
  }

  if (normalise) {
    // Number of ordered/unordered pairs excluding the node itself.
    const pairs = directed ? (n - 1) * (n - 2) : ((n - 1) * (n - 2)) / 2;
    if (pairs > 0) {
      for (const [id, score] of centrality) {
        centrality.set(id, Number((score / pairs).toFixed(6)));
      }
    }
  }

  return centrality;
}
