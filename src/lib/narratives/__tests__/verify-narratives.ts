/**
 * Narrative Mutation Tracker — Verification Suite
 *
 * Run: npx tsx src/lib/narratives/__tests__/verify-narratives.ts
 *
 * Uses a deterministic test fixture (NOT from frozenCorpus.json).
 * Tests clustering, mutation calculations, title generation, and edge cases.
 */

import { cosineSimilarity } from '@/lib/ml/embeddings';
import { clusterNarratives } from '@/lib/narratives/clustering';
import {
  computeSemanticShift,
  computeSentimentShift,
  computeEmotionShift,
  computeKeywordShift,
  computeMutationScore,
  buildKeywordEvolution,
} from '@/lib/narratives/mutations';
import { generateNarrativeTitle, extractTopKeywords, tokenize } from '@/lib/narratives/titleGenerator';
import type { MutationBreakdown } from '@/lib/narratives/types';
import { SocialPost, SentimentAnalysis, AuthorProfile, EmotionType } from '@/types/intelligence';

// ── Test Fixture ──────────────────────────────────────────────────────────
// These are ONLY for testing. NOT from frozenCorpus.json.

function makeAuthor(id: string): AuthorProfile {
  return {
    id,
    username: `@test_${id}`,
    displayName: `Test ${id}`,
    platform: 'youtube',
    followerCount: null,
    verified: false,
    estimatedAgeBracket: null,
    inferredLocation: null,
    detectedLanguage: 'English',
    interests: [],
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
  platform: 'youtube' | 'telegram',
  timestamp: string,
  sentiment: SentimentAnalysis
): SocialPost {
  return {
    id,
    platform,
    author: makeAuthor(`author_${id}`),
    content,
    timestamp,
    likes: 10,
    shares: 2,
    replies: 3,
    hashtags: [],
    sentiment,
  };
}

// Test posts about AI and software development
const testPosts: SocialPost[] = [
  makePost(
    'test_a',
    'AI coding tools help programmers write code faster and more efficiently',
    'youtube',
    '2026-08-01T10:00:00Z',
    makeSentiment('positive', 'excitement', ['AI', 'coding', 'programmers'])
  ),
  makePost(
    'test_b',
    'AI assistants are changing software development practices worldwide',
    'youtube',
    '2026-08-02T11:00:00Z',
    makeSentiment('positive', 'excitement', ['AI', 'software', 'development'])
  ),
  makePost(
    'test_c',
    'AI could replace software developers in many routine tasks',
    'telegram',
    '2026-08-03T13:00:00Z',
    makeSentiment('negative', 'anxiety', ['AI', 'replace', 'developers'])
  ),
  makePost(
    'test_d',
    'Developers may lose jobs because of AI automation and machine learning',
    'telegram',
    '2026-08-04T15:00:00Z',
    makeSentiment('negative', 'anger', ['developers', 'jobs', 'AI', 'automation'])
  ),
];

// Unrelated post (should NOT cluster with the AI narrative)
const unrelatedPost = makePost(
  'test_unrelated',
  'The weather is beautiful today in Paris, perfect for a walk',
  'youtube',
  '2026-08-02T12:00:00Z',
  makeSentiment('positive', 'joy', ['weather', 'Paris', 'beautiful'])
);

// ── Test Runner ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? `: ${detail}` : ''}`);
  }
}

function section(name: string) {
  console.log(`\n── ${name} ──`);
}

// ── Tests ─────────────────────────────────────────────────────────────────

section('Cosine Similarity');

assert(
  Math.abs(cosineSimilarity([1, 0, 0], [1, 0, 0]) - 1.0) < 0.0001,
  'Identical vectors → 1.0'
);

assert(
  Math.abs(cosineSimilarity([1, 0, 0], [0, 1, 0])) < 0.0001,
  'Orthogonal vectors → 0.0'
);

assert(
  cosineSimilarity([1, 1, 1], [1, 1, 1]) > 0.99,
  'Same direction → ~1.0'
);

assert(
  cosineSimilarity([], []) === 0,
  'Empty vectors → 0'
);

assert(
  cosineSimilarity([0, 0, 0], [1, 1, 1]) === 0,
  'Zero vector → 0'
);

section('Union-Find Clustering');

// Simulate embeddings: similar items have similar vectors
const mockEmbeddings = [
  { id: 'a', embedding: [1.0, 0.0, 0.0] },
  { id: 'b', embedding: [0.95, 0.05, 0.0] },  // similar to a
  { id: 'c', embedding: [0.0, 1.0, 0.0] },     // different
  { id: 'd', embedding: [0.0, 0.98, 0.02] },   // similar to c
];

const clusters = clusterNarratives(mockEmbeddings, 0.90);

assert(
  clusters.length === 2,
  `Two clusters found (got ${clusters.length})`,
  `Expected 2, got ${clusters.length}`
);

// Verify determinism
const clusters2 = clusterNarratives(mockEmbeddings, 0.90);
assert(
  JSON.stringify(clusters) === JSON.stringify(clusters2),
  'Clustering is deterministic'
);

// Single item → no clusters
assert(
  clusterNarratives([{ id: 'solo', embedding: [1, 0, 0] }]).length === 0,
  'Single item → 0 clusters'
);

// Empty → no clusters
assert(
  clusterNarratives([]).length === 0,
  'Empty input → 0 clusters'
);

section('Narrative IDs');

const c1 = clusterNarratives(mockEmbeddings, 0.90);
assert(
  c1.every((c) => c.narrativeId.startsWith('N')),
  'Narrative IDs start with N'
);

assert(
  c1.every((c) => c.narrativeId.length > 2),
  'Narrative IDs have meaningful length'
);

section('Semantic Shift');

assert(
  computeSemanticShift([[1, 0, 0]], [[1, 0, 0]]) === 0,
  'Identical embeddings → 0% shift'
);

assert(
  computeSemanticShift([[1, 0, 0]], [[0, 1, 0]]) === 100,
  'Orthogonal embeddings → 100% shift'
);

assert(
  computeSemanticShift([], [[1, 0, 0]]) === null,
  'No early embeddings → null'
);

assert(
  computeSemanticShift([[1, 0, 0]], []) === null,
  'No late embeddings → null'
);

const partialShift = computeSemanticShift([[1, 0, 0]], [[0.7, 0.7, 0]]);
assert(
  partialShift !== null && partialShift > 0 && partialShift < 100,
  `Partial shift in (0, 100): ${partialShift?.toFixed(1)}%`
);

section('Sentiment Shift');

const earlyPositive = [testPosts[0], testPosts[1]]; // positive
const lateNegative = [testPosts[2], testPosts[3]];   // negative

const sentShift = computeSentimentShift(earlyPositive, lateNegative);
assert(
  sentShift !== null && sentShift > 50,
  `Positive→Negative shift is large: ${sentShift?.toFixed(1)}%`
);

assert(
  computeSentimentShift([], lateNegative) === null,
  'No early posts → null'
);

const noShift = computeSentimentShift(earlyPositive, earlyPositive);
assert(
  noShift !== null && noShift < 5,
  `Same distribution → near zero: ${noShift?.toFixed(1)}%`
);

section('Emotion Shift');

assert(
  computeEmotionShift(earlyPositive, earlyPositive) === 0,
  'Same dominant emotion → 0'
);

assert(
  computeEmotionShift(earlyPositive, lateNegative) === 100,
  'Different dominant emotion → 100'
);

assert(
  computeEmotionShift([], lateNegative) === null,
  'No early posts → null'
);

section('Keyword Shift');

const kwShift = computeKeywordShift(earlyPositive, lateNegative);
assert(
  kwShift !== null && kwShift > 0,
  `Different keywords → positive shift: ${kwShift?.toFixed(1)}%`
);

assert(
  computeKeywordShift([], lateNegative) === null,
  'No early posts → null'
);

const sameKwShift = computeKeywordShift(earlyPositive, earlyPositive);
assert(
  sameKwShift !== null && sameKwShift < 5,
  `Same keywords → near zero: ${sameKwShift?.toFixed(1)}%`
);

section('Mutation Score');

const fullBreakdown: MutationBreakdown = {
  semanticShift: 50,
  sentimentShift: 60,
  emotionShift: 100,
  keywordShift: 40,
  mutationScore: null,
};
const score = computeMutationScore(fullBreakdown);
assert(
  score !== null,
  'All components present → score is not null'
);

// 0.40*50 + 0.25*60 + 0.20*100 + 0.15*40 = 20+15+20+6 = 61
assert(
  score !== null && Math.abs(score - 61) < 0.5,
  `Weighted sum correct: ${score} (expected ~61)`
);

const partialBreakdown: MutationBreakdown = {
  semanticShift: 50,
  sentimentShift: null,
  emotionShift: 100,
  keywordShift: 40,
  mutationScore: null,
};
assert(
  computeMutationScore(partialBreakdown) === null,
  'Missing component → null score'
);

section('Keyword Evolution');

const evolution = buildKeywordEvolution(testPosts);
assert(
  evolution.length >= 2,
  `At least 2 stages: ${evolution.length}`
);

assert(
  evolution.every((s) => s.keywords.length > 0 || s.stage === 'middle'),
  'Each stage has keywords or is middle (may be empty)'
);

section('Title Generation');

assert(
  generateNarrativeTitle(testPosts).length > 0,
  'Title is non-empty'
);

assert(
  generateNarrativeTitle(testPosts) !== 'Unnamed narrative',
  'Title is not the fallback'
);

assert(
  generateNarrativeTitle([]) === 'Unnamed narrative',
  'Empty posts → fallback title'
);

section('Tokenization');

const tokens = tokenize('AI will improve software development!');
assert(
  tokens.includes('ai') && tokens.includes('software'),
  'Tokenizes and lowercases correctly'
);

assert(
  !tokenize('Check out https://example.com today').includes('https'),
  'URLs are removed'
);

section('Top Keywords');

const kw = extractTopKeywords(testPosts, 3);
assert(
  kw.length === 3,
  `Returns requested count: ${kw.length}`
);

assert(
  kw.some((k) => k.toLowerCase().includes('ai')),
  `AI-related keyword in top keywords: [${kw.join(', ')}]`
);

section('Null / Edge Case Handling');

assert(
  computeSemanticShift([[]], [[]]) === null,
  'Zero-dim embeddings → null'
);

assert(
  computeKeywordShift(
    [makePost('e', '', 'youtube', '2026-01-01T00:00:00Z', makeSentiment('neutral', 'neutral'))],
    [makePost('f', '', 'youtube', '2026-01-01T00:00:00Z', makeSentiment('neutral', 'neutral'))]
  ) === null,
  'Empty text posts → null keyword shift'
);

// ── Summary ───────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(50)}`);
console.log(`Narrative Mutation Tests: ${passed} passed, ${failed} failed`);
console.log('═'.repeat(50));

if (failed > 0) {
  process.exit(1);
}
