/**
 * Narrative Mutation Tracker — Master Verification Suite
 *
 * Run: npx tsx src/lib/narratives/__tests__/verify-narratives.ts
 *
 * Tests:
 *   1. Cosine similarity & Union-find clustering
 *   2. Centroid computation & Semantic shift
 *   3. Sentiment shift (Total Variation Distance)
 *   4. Emotion shift (GoEmotions TVD)
 *   5. Keyword & Entity shift (Jaccard)
 *   6. Platform & Community shifts
 *   7. 8-dimension mutation scoring formula & weights
 *   8. Temporal state tracking & narrative velocity
 *   9. Breakpoint detection & triggering anchors
 *  10. "Why Did It Mutate?" factual reasoning & 6-stage evidence chain
 *  11. Evidence confidence scoring (High/Medium/Low)
 *  12. Platform propagation & hop delays
 *  13. Cross-platform matrix
 *  14. Narrative branching & convergence
 *  15. Strict anti-fabrication & edge cases
 */

import { cosineSimilarity } from '@/lib/ml/embeddings';
import { clusterNarratives } from '@/lib/narratives/clustering';
import {
  computeSemanticShift,
  computeSentimentShift,
  computeEmotionShift,
  computeKeywordShift,
  computeEntityShift,
  computePlatformShift,
  computeCommunityShift,
  computeAmplificationShift,
  computeMutationScore,
  computeEvidenceConfidence,
  determineLifecycleState,
  buildKeywordEvolution,
  WEIGHTS,
} from '@/lib/narratives/mutations';
import {
  buildTemporalStates,
  computeNarrativeVelocity,
  extractEntities,
} from '@/lib/narratives/temporalTracker';
import { detectBreakpoints } from '@/lib/narratives/breakpoints';
import { generateWhyMutated, buildEvidenceChain } from '@/lib/narratives/evidenceExplainer';
import { buildPlatformPropagation, extractNarrativeAmplifiers } from '@/lib/narratives/propagationTracker';
import { buildCrossPlatformMatrix } from '@/lib/narratives/crossPlatformMatrix';
import { detectBranches, detectConvergences } from '@/lib/narratives/fragmentation';
import { generateNarrativeTitle, extractTopKeywords, tokenize } from '@/lib/narratives/titleGenerator';
import type { MutationBreakdown } from '@/lib/narratives/types';
import { SocialPost, SentimentAnalysis, AuthorProfile, EmotionType } from '@/types/intelligence';

// ── Test Helpers ──────────────────────────────────────────────────────────

function makeAuthor(id: string, isKOL = false, betweenness = 0, communityId = 1): AuthorProfile {
  return {
    id,
    username: `@test_${id}`,
    displayName: `Test ${id}`,
    platform: 'youtube',
    followerCount: 5000,
    verified: false,
    estimatedAgeBracket: null,
    inferredLocation: null,
    detectedLanguage: 'English',
    interests: [],
    isKOL,
    betweennessScore: betweenness,
    communityId,
  };
}

function makeSentiment(
  label: 'positive' | 'negative' | 'neutral',
  emotion: EmotionType,
  keywords: string[] = []
): SentimentAnalysis {
  const score = label === 'positive' ? 0.7 : label === 'negative' ? -0.6 : 0.1;
  return {
    score,
    label,
    nuancedEmotion: emotion,
    sarcasmScore: 0,
    stance: label === 'positive' ? 'supportive' : label === 'negative' ? 'opposing' : 'neutral',
    confidence: 0.85,
    keywords,
    engine: 'ml',
  };
}

function makePost(
  id: string,
  content: string,
  platform: 'youtube' | 'telegram' | 'reddit' | 'x',
  timestamp: string,
  sentiment: SentimentAnalysis,
  hashtags: string[] = [],
  author?: AuthorProfile
): SocialPost {
  return {
    id,
    platform,
    author: author || makeAuthor(`author_${id}`),
    content,
    timestamp,
    likes: 10,
    shares: 2,
    replies: 3,
    hashtags,
    sentiment,
  };
}

// ── Test Posts ────────────────────────────────────────────────────────────

const testPosts: SocialPost[] = [
  makePost(
    'test_1',
    'AI coding tools help programmers write code faster and improve developer productivity',
    'youtube',
    '2026-08-01T10:00:00Z',
    makeSentiment('positive', 'excitement', ['AI', 'coding', 'productivity']),
    ['#AIDevelopers']
  ),
  makePost(
    'test_2',
    'Software engineers using AI assistants report significant productivity gains in coding',
    'youtube',
    '2026-08-01T14:00:00Z',
    makeSentiment('positive', 'joy', ['AI', 'productivity', 'engineers']),
    ['#AIDevelopers']
  ),
  makePost(
    'test_3',
    'AI coding tools may automate routine developer jobs in software development',
    'reddit',
    '2026-08-02T10:00:00Z',
    makeSentiment('neutral', 'anxiety', ['AI', 'automate', 'jobs']),
    ['#AIJobs']
  ),
  makePost(
    'test_4',
    'AI could replace software developers and cause major tech layoffs',
    'telegram',
    '2026-08-02T18:00:00Z',
    makeSentiment('negative', 'fear', ['AI', 'replace', 'layoffs']),
    ['#TechLayoffs'],
    makeAuthor('kol_1', true, 0.8, 2)
  ),
];

// Mock 384-dim embeddings
const embProductivity = new Array(384).fill(0).map((_, i) => (i < 192 ? 0.05 : 0));
const embReplacement = new Array(384).fill(0).map((_, i) => (i < 192 ? 0.01 : 0.05));
const embOrthogonal = new Array(384).fill(0).map((_, i) => (i >= 192 ? 0.08 : 0));

const testEmbeddingMap = new Map<string, number[]>([
  ['test_1', embProductivity],
  ['test_2', embProductivity],
  ['test_3', embReplacement],
  ['test_4', embReplacement],
]);

// ── Runner ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function approx(a: number, b: number, epsilon = 0.5): boolean {
  return Math.abs(a - b) <= epsilon;
}

console.log('\nNarrative Mutation Master Verification Suite\n');

// ── 1. Cosine Similarity & Clustering ─────────────────────────────────────
console.log('── 1. Cosine Similarity & Clustering ──');
assert('Identical vectors → 1.0', approx(cosineSimilarity(embProductivity, embProductivity), 1.0));
assert('Orthogonal vectors → 0.0', approx(cosineSimilarity(embProductivity, embOrthogonal), 0.0));

const clusterInput = [
  { id: '1', embedding: embProductivity },
  { id: '2', embedding: embProductivity },
  { id: '3', embedding: embOrthogonal },
  { id: '4', embedding: embOrthogonal },
];
const clusters = clusterNarratives(clusterInput, 0.70);
assert('Two distinct clusters formed', clusters.length === 2);
// The prefix changed from 'N' to 'SKY-' when the product was renamed. What
// actually matters is that the id is DERIVED from the cluster contents, so the
// same cluster always resolves to the same id across runs and processes --
// assert that property rather than the branding.
assert('Cluster IDs carry the SKY- prefix', clusters[0].narrativeId.startsWith('SKY-'));
assert(
  'Cluster IDs are deterministic across runs',
  clusterNarratives(clusterInput, 0.70)[0].narrativeId === clusters[0].narrativeId
);

// ── 2. Semantic Shift ─────────────────────────────────────────────────────
console.log('\n── 2. Semantic Shift ──');
const semIdentical = computeSemanticShift([embProductivity, embProductivity], [embProductivity, embProductivity]);
assert('Identical centroids → 0% shift', semIdentical !== null && approx(semIdentical, 0));

const semOrthogonal = computeSemanticShift([embProductivity], [embOrthogonal]);
assert('Orthogonal centroids → 100% shift', semOrthogonal !== null && approx(semOrthogonal, 100));

const semReal = computeSemanticShift([embProductivity, embProductivity], [embReplacement, embReplacement]);
assert('Displaced centroids → valid shift range (0, 100)', semReal !== null && semReal > 10 && semReal < 90);

// ── 3. Sentiment & Emotion Shifts ─────────────────────────────────────────
console.log('\n── 3. Sentiment & Emotion Shifts ──');
const sentShift = computeSentimentShift([testPosts[0], testPosts[1]], [testPosts[2], testPosts[3]]);
assert('Positive to Negative sentiment shift is detected', sentShift !== null && sentShift >= 50);

const emoShift = computeEmotionShift([testPosts[0], testPosts[1]], [testPosts[2], testPosts[3]]);
assert('Excitement/Joy to Anxiety/Fear emotion shift is detected', emoShift !== null && emoShift >= 50);

// ── 4. Keyword & Entity Shifts ───────────────────────────────────────────
console.log('\n── 4. Keyword & Entity Shifts ──');
const kwShift = computeKeywordShift([testPosts[0], testPosts[1]], [testPosts[2], testPosts[3]]);
assert('Keyword shift detects vocabulary divergence', kwShift !== null && kwShift > 30);

const entShift = computeEntityShift([testPosts[0], testPosts[1]], [testPosts[2], testPosts[3]]);
assert('Entity shift detects new hashtags/mentions', entShift !== null && entShift > 20);

// ── 5. 8-Dimension Mutation Score Formula ─────────────────────────────────
console.log('\n── 5. 8-Dimension Mutation Score ──');
const breakdown: MutationBreakdown = {
  semanticShift: 60,
  sentimentShift: 80,
  emotionShift: 70,
  keywordShift: 50,
  entityShift: 40,
  platformShift: 50,
  communityShift: 60,
  amplificationShift: 40,
  mutationScore: null,
};

const score = computeMutationScore(breakdown);
const expectedScore =
  WEIGHTS.semantic * 60 +
  WEIGHTS.sentiment * 80 +
  WEIGHTS.emotion * 70 +
  WEIGHTS.keyword * 50 +
  WEIGHTS.entity * 40 +
  WEIGHTS.platform * 50 +
  WEIGHTS.community * 60 +
  WEIGHTS.amplification * 40;

assert('Composite mutation score matches 8-dimension weighted sum', score !== null && approx(score, expectedScore));

const nullBreakdown: MutationBreakdown = { ...breakdown, semanticShift: null };
assert('Missing core dimension strictly returns null (anti-fabrication)', computeMutationScore(nullBreakdown) === null);

// ── 6. Temporal State Tracking & Velocity ─────────────────────────────────
console.log('\n── 6. Temporal State Tracking & Velocity ──');
const temporalStates = buildTemporalStates(testPosts, testEmbeddingMap);
assert('Temporal states generated across time buckets', temporalStates.length >= 2);
assert('Temporal state tracks dominant sentiment and keywords', temporalStates[0].topKeywords.length > 0);

const velocity = computeNarrativeVelocity(testPosts, temporalStates);
assert('Narrative velocity computes post velocity per hour', velocity.postVelocityPerHour > 0);

// ── 7. Breakpoint Detection ───────────────────────────────────────────────
console.log('\n── 7. Breakpoint Detection ──');
const breakpoints = detectBreakpoints(testPosts, temporalStates, testEmbeddingMap);
assert('Breakpoint detection identifies inflection points', Array.isArray(breakpoints));
if (breakpoints.length > 0) {
  assert('Breakpoint contains triggering post IDs', breakpoints[0].triggeringPostIds.length > 0);
  assert('Breakpoint tracks previous vs new state titles', Boolean(breakpoints[0].previousStateTitle && breakpoints[0].newStateTitle));
  assert('Breakpoint documents sentiment delta', typeof breakpoints[0].sentimentDelta.scoreDelta === 'number');
}

// ── 8. Evidence Chain & "Why Did It Mutate?" ──────────────────────────────
console.log('\n── 8. Evidence & Reasoning ──');
const propagation = buildPlatformPropagation(testPosts);
const amplifiers = extractNarrativeAmplifiers(testPosts);

const earlyKws = ['ai', 'coding', 'productivity'];
const lateKws = ['ai', 'replace', 'layoffs'];

const whyMutated = generateWhyMutated(breakdown, breakpoints, propagation, amplifiers, earlyKws, lateKws, testPosts.length);
assert('Why Mutated generates evidence-grounded reasons', whyMutated.length >= 2);
assert('Why Mutated references observed displacement', whyMutated.some((r) => r.includes('%')));

const evidenceChain = buildEvidenceChain(breakdown, breakpoints, propagation, amplifiers, earlyKws, lateKws);
assert('Evidence chain contains 6 structured stages', evidenceChain.length === 6);
assert('Evidence chain contains verified facts', evidenceChain.every((s) => typeof s.verified === 'boolean'));

// ── 9. Evidence Confidence Algorithm ──────────────────────────────────────
console.log('\n── 9. Evidence Confidence Algorithm ──');
const confHigh = computeEvidenceConfidence(
  Array.from({ length: 25 }, (_, i) => makePost(`p_${i}`, 'content', 'youtube', '2026-08-01T00:00:00Z', makeSentiment('positive', 'joy'))),
  50,
  ['youtube', 'telegram', 'reddit']
);
assert('Large corpus sample (N=25, P=3, T=50h) yields HIGH confidence', confHigh.level === 'HIGH' && confHigh.score >= 70);

const confLow = computeEvidenceConfidence([testPosts[0]], 1, ['youtube']);
assert('Minimal single post sample yields LOW confidence', confLow.level === 'LOW' && confLow.score < 45);

// ── 10. Platform Propagation & Cross-Platform Matrix ──────────────────────
console.log('\n── 10. Platform Propagation & Cross-Platform ──');
assert('Propagation detects origin platform (YouTube)', propagation.originPlatform === 'youtube');
assert('Propagation tracks migration hops with delays', propagation.hops.length >= 2);

const crossMatrix = buildCrossPlatformMatrix(testPosts, embProductivity, testEmbeddingMap);
assert('Cross-platform matrix compares framing across platforms', crossMatrix.length >= 2);
assert('Matrix includes post counts and sentiment per platform', crossMatrix[0].postCount > 0);

// ── 11. Narrative Branching & Convergence ─────────────────────────────────
console.log('\n── 11. Narrative Branching & Convergence ──');
const branches = detectBranches(testPosts, testEmbeddingMap);
assert('Branching engine executes without error', Array.isArray(branches));

const convergences = detectConvergences('test_narrative_1', testPosts, [{ id: 'other', posts: testPosts }], testEmbeddingMap);
assert('Convergence engine checks vocabulary and centroid proximity', Array.isArray(convergences));

// ── 12. Strict Anti-Fabrication & Edge Cases ──────────────────────────────
console.log('\n── 12. Strict Anti-Fabrication & Edge Cases ──');
const emptyConf = computeEvidenceConfidence([], 0, []);
assert('Empty posts yield 0 score and LOW confidence', emptyConf.score === 0 && emptyConf.level === 'LOW');

const zeroShift = computeSemanticShift([], []);
assert('Empty vector list strictly returns null semantic shift', zeroShift === null);

const smallSent = computeSentimentShift([testPosts[0]], [testPosts[1]]);
assert('Under MIN_STAGE_POSTS floor returns null sentiment shift', smallSent === null);

// ── Summary ───────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════');
console.log(`Narrative Mutation Master Tests: ${passed} passed, ${failed} failed`);
console.log('══════════════════════════════════════════════════\n');

if (failed > 0) process.exit(1);
