/**
 * Correctness checks for the graph algorithms, against graphs whose answers are
 * known analytically. Run with:  npx tsx src/lib/graph/__tests__/verify.ts
 *
 * These exist because "the code runs" is not evidence that Louvain or Brandes
 * are correct -- the previous implementation ran fine and computed neither.
 */

import { detectCommunities, modularity, LouvainEdge } from '../louvain';
import { betweennessCentrality } from '../betweenness';

let failures = 0;

function check(name: string, actual: unknown, expected: unknown, tolerance = 0) {
  let ok: boolean;
  if (typeof actual === 'number' && typeof expected === 'number') {
    ok = Math.abs(actual - expected) <= tolerance;
  } else {
    ok = JSON.stringify(actual) === JSON.stringify(expected);
  }
  if (!ok) failures++;
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function edges(pairs: [string, string][]): LouvainEdge[] {
  return pairs.map(([source, target]) => ({ source, target, weight: 1 }));
}

// ── 1. Two triangles joined by a single bridge ────────────────────────────
// Classic community-detection test. Louvain must find exactly 2 communities,
// {a,b,c} and {d,e,f}, and modularity should be clearly positive (~0.36).
console.log('\n[1] Two triangles + bridge');
{
  const nodes = ['a', 'b', 'c', 'd', 'e', 'f'];
  const e = edges([
    ['a', 'b'], ['b', 'c'], ['a', 'c'],
    ['d', 'e'], ['e', 'f'], ['d', 'f'],
    ['c', 'd'], // the single bridge
  ]);

  const comm = detectCommunities(nodes, e);
  const distinct = new Set(comm.values()).size;
  check('finds exactly 2 communities', distinct, 2);
  check('a,b,c together', comm.get('a') === comm.get('b') && comm.get('b') === comm.get('c'), true);
  check('d,e,f together', comm.get('d') === comm.get('e') && comm.get('e') === comm.get('f'), true);
  check('the two groups differ', comm.get('a') !== comm.get('d'), true);

  const q = modularity(nodes, e, comm);
  console.log(`        modularity Q = ${q}`);
  check('Q is near the analytic 0.357', q, 0.357, 0.02);
}

// ── 2. Barbell: two 4-cliques joined by one edge ──────────────────────────
console.log('\n[2] Two 4-cliques + bridge');
{
  const left = ['a', 'b', 'c', 'd'];
  const right = ['w', 'x', 'y', 'z'];
  const nodes = [...left, ...right];
  const pairs: [string, string][] = [];
  for (const group of [left, right]) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) pairs.push([group[i], group[j]]);
    }
  }
  pairs.push(['d', 'w']);
  const e = edges(pairs);

  const comm = detectCommunities(nodes, e);
  check('finds exactly 2 communities', new Set(comm.values()).size, 2);
  check('left clique is one community', new Set(left.map((n) => comm.get(n))).size, 1);
  check('right clique is one community', new Set(right.map((n) => comm.get(n))).size, 1);

  const q = modularity(nodes, e, comm);
  console.log(`        modularity Q = ${q}`);
  check('Q > 0.4 for a strong partition', q > 0.4, true);
}

// ── 3. A star has no community structure: Q must be ~0 ────────────────────
// This is the shape the demo dataset actually produces, so confirm that the
// near-zero Q reported by the API is correct rather than a bug.
console.log('\n[3] Star graph (hub + 6 leaves)');
{
  const nodes = ['hub', 'l1', 'l2', 'l3', 'l4', 'l5', 'l6'];
  const e = edges(nodes.slice(1).map((l) => ['hub', l] as [string, string]));
  const comm = detectCommunities(nodes, e);
  const q = modularity(nodes, e, comm);
  console.log(`        communities = ${new Set(comm.values()).size}, Q = ${q}`);
  check('Q is ~0 (a star genuinely has no communities)', Math.abs(q) < 0.15, true);
}

// ── 4. Brandes betweenness on a path graph a-b-c-d-e ──────────────────────
// Analytic values for an undirected 5-path, normalised by (n-1)(n-2)/2 = 6:
//   a,e = 0 ; b,d = 3/6 = 0.5 ; c = 4/6 = 0.667
console.log('\n[4] Betweenness on a 5-node path');
{
  const nodes = ['a', 'b', 'c', 'd', 'e'];
  const e = [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
    { source: 'c', target: 'd' },
    { source: 'd', target: 'e' },
  ];
  const bc = betweennessCentrality(nodes, e);
  check('endpoint a = 0', bc.get('a')!, 0, 1e-6);
  check('endpoint e = 0', bc.get('e')!, 0, 1e-6);
  check('b = 0.5', bc.get('b')!, 0.5, 1e-6);
  check('d = 0.5', bc.get('d')!, 0.5, 1e-6);
  check('centre c = 0.667', bc.get('c')!, 2 / 3, 1e-3);
}

// ── 5. Brandes on a star: hub takes all betweenness ───────────────────────
console.log('\n[5] Betweenness on a star');
{
  const nodes = ['hub', 'l1', 'l2', 'l3', 'l4'];
  const e = nodes.slice(1).map((l) => ({ source: 'hub', target: l }));
  const bc = betweennessCentrality(nodes, e);
  check('hub = 1.0 (on every shortest path)', bc.get('hub')!, 1.0, 1e-6);
  check('leaf = 0', bc.get('l1')!, 0, 1e-6);
}

// ── 6. Degenerate inputs must not throw ───────────────────────────────────
console.log('\n[6] Degenerate inputs');
{
  check('empty graph', detectCommunities([], []).size, 0);
  check('single node, no edges', detectCommunities(['solo'], []).size, 1);
  check('betweenness with no edges', betweennessCentrality(['a', 'b', 'c'], []).get('a')!, 0);
  check('self-loop only', detectCommunities(['a'], [{ source: 'a', target: 'a', weight: 1 }]).size, 1);
  check('edge referencing unknown node', detectCommunities(['a'], [{ source: 'a', target: 'ghost', weight: 1 }]).size, 1);
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
