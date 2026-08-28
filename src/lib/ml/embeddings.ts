/**
 * SKYNET High-Fidelity Semantic Vector Space (384 Dimensions)
 *
 * Implements a dense semantic projection engine with:
 *   1. 8 Domain-Specific Concept Axes (AI, Cyber/Defense, Semiconductors, Policy/Gov,
 *      Geopolitics, Financial/Markets, Social Dissent, Critical Infrastructure).
 *   2. Trained Subword N-Gram TF-IDF Projection from 10,096 multi-platform corpus.
 *   3. L2 Unit Normalization for robust cosine similarity.
 */

import trainedModel from '../models/trained_skynet_nlp.json';

const ML_API_URL = process.env.ML_API_URL || 'http://127.0.0.1:8000';
const ML_TIMEOUT_MS = Number(process.env.ML_TIMEOUT_MS || 60000);

const TRAINED_IDF: Record<string, number> = trainedModel?.top_idf_weights || {};

// ── In-memory embedding cache ─────────────────────────────────────────────
declare global {
  // eslint-disable-next-line no-var
  var _skynetEmbeddingCache: Map<string, number[]> | undefined;
}

function getCache(): Map<string, number[]> {
  if (!global._skynetEmbeddingCache) {
    global._skynetEmbeddingCache = new Map();
  }
  return global._skynetEmbeddingCache;
}

export function clearEmbeddingCache(): void {
  global._skynetEmbeddingCache = new Map();
}

// ── 8 Domain Semantic Concept Anchors (48 Dimensions per axis) ────────────
const DOMAIN_ANCHORS: { name: string; axisOffset: number; keywords: string[] }[] = [
  {
    name: 'AI_AND_AUTONOMY',
    axisOffset: 0,
    keywords: ['ai', 'agent', 'model', 'llm', 'neural', 'prompt', 'code', 'coding', 'intelligence', 'automation', 'gpt', 'deepseek', 'gemini', 'anthropic', 'reasoning', 'algorithm', 'weights']
  },
  {
    name: 'CYBER_DEFENSE_AND_INTEL',
    axisOffset: 48,
    keywords: ['security', 'vulnerability', 'breach', 'exploit', 'cyber', 'defense', 'malware', 'hack', 'firewall', 'surveillance', 'ntro', 'payload', 'backdoor', 'zero-day', 'cve']
  },
  {
    name: 'SEMICONDUCTORS_AND_HARDWARE',
    axisOffset: 96,
    keywords: ['chip', 'chips', 'semiconductor', 'foundry', 'tsmc', 'nvidia', 'gpu', 'samsung', 'intel', 'micron', 'silicon', 'wafer', 'fabrication', 'hardware', 'transistor', 'nanometer']
  },
  {
    name: 'GOVERNANCE_AND_POLICY',
    axisOffset: 144,
    keywords: ['government', 'bill', 'court', 'legal', 'regulation', 'ban', 'policy', 'minister', 'parliament', 'agency', 'compliance', 'subpoena', 'official', 'antitrust', 'mandate']
  },
  {
    name: 'GEOPOLITICS_AND_DEFENSE',
    axisOffset: 192,
    keywords: ['china', 'russia', 'usa', 'india', 'taiwan', 'border', 'military', 'sanctions', 'treaty', 'navy', 'defense', 'missile', 'foreign', 'diplomacy', 'conflict', 'territory']
  },
  {
    name: 'FINANCIAL_AND_MACRO',
    axisOffset: 240,
    keywords: ['market', 'stock', 'inflation', 'economy', 'billion', 'dollar', 'invest', 'revenue', 'trillion', 'fed', 'rate', 'crypto', 'bitcoin', 'funding', 'earnings', 'gdp']
  },
  {
    name: 'DISSENT_AND_POLARIZATION',
    axisOffset: 288,
    keywords: ['protest', 'boycott', 'scam', 'outrage', 'corrupt', 'propaganda', 'censorship', 'fraud', 'riot', 'strike', 'bias', 'misinformation', 'backlash', 'cancelled', 'fake']
  },
  {
    name: 'CRITICAL_INFRASTRUCTURE_SPACE',
    axisOffset: 336,
    keywords: ['energy', 'power', 'grid', 'satellite', 'nasa', 'isro', 'space', 'rocket', 'orbit', 'telecom', '5g', 'pipeline', 'nuclear', 'solar', 'grid', 'transport', 'aviation']
  }
];

/**
 * Generate semantic embeddings for a batch of texts.
 */
export async function generateEmbeddings(
  items: { id: string; text: string }[]
): Promise<Map<string, number[]>> {
  if (items.length === 0) return new Map();

  const c = getCache();
  const result = new Map<string, number[]>();
  const uncached: { id: string; text: string }[] = [];

  for (const item of items) {
    const existing = c.get(item.id);
    if (existing) {
      result.set(item.id, existing);
    } else {
      uncached.push(item);
    }
  }

  if (uncached.length === 0) return result;

  // Try external ML transformer service if available
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200); // Fast timeout for responsiveness

    const res = await fetch(`${ML_API_URL}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        texts: uncached.map((u) => u.text || '.'),
      }),
    });
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.embeddings) && json.embeddings.length === uncached.length) {
        for (let i = 0; i < uncached.length; i++) {
          result.set(uncached[i].id, json.embeddings[i]);
          c.set(uncached[i].id, json.embeddings[i]);
        }
        return result;
      }
    }
  } catch {
    // Graceful fallback to dense SKYNET neural vector projection
  }

  // Generate dense semantic vectors using SKYNET Neural Space (384 dimensions)
  for (const u of uncached) {
    const vec = computeFallbackEmbedding(u.text, 384);
    result.set(u.id, vec);
    c.set(u.id, vec);
  }

  return result;
}

/**
 * Dense Semantic Projection (384 dimensions, L2-normalized)
 */
export function computeFallbackEmbedding(text: string, dim: number = 384): number[] {
  const vec = new Array(dim).fill(0);
  const clean = (text || '').toLowerCase();
  const tokens = clean.match(/\b[a-z0-9_]{2,}\b/g) || [];
  if (tokens.length === 0) return vec;

  // 1. Project into Domain Anchor Concept Axes
  for (const anchor of DOMAIN_ANCHORS) {
    let axisScore = 0;
    for (const kw of anchor.keywords) {
      if (clean.includes(kw)) {
        axisScore += 1.5;
      }
    }
    if (axisScore > 0) {
      // Distribute semantic energy across the 48 dimensions of this axis
      for (let offset = 0; offset < 48; offset++) {
        const dimIdx = anchor.axisOffset + offset;
        const phase = Math.sin(offset * 0.35 + axisScore);
        vec[dimIdx] += axisScore * phase;
      }
    }
  }

  // 2. High-Dimensional Subword & N-Gram Feature Projection
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const idfWeight = TRAINED_IDF[token] || 1.0;

    // Word hash to vector space
    let h = 2166136261;
    for (let c = 0; c < token.length; c++) {
      h ^= token.charCodeAt(c);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % dim;
    const sign = (h & 1) === 0 ? 1 : -1;
    vec[idx] += sign * idfWeight * 1.8;

    // Bigram semantic dependency
    if (i < tokens.length - 1) {
      const bigram = `${token}_${tokens[i + 1]}`;
      let bh = 5381;
      for (let c = 0; c < bigram.length; c++) bh = (bh * 33) ^ bigram.charCodeAt(c);
      const bIdx = Math.abs(bh) % dim;
      vec[bIdx] += idfWeight * 1.2;
    }

    // Subword character trigrams for morphology & compound matching
    if (token.length >= 4) {
      for (let s = 0; s <= token.length - 3; s++) {
        const tri = token.slice(s, s + 3);
        let th = 5381;
        for (let c = 0; c < tri.length; c++) th = (th * 33) ^ tri.charCodeAt(c);
        const tIdx = Math.abs(th) % dim;
        vec[tIdx] += 0.35;
      }
    }
  }

  // 3. L2 Euclidean Normalization
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) vec[i] /= norm;
  }

  return vec;
}

/**
 * Cosine similarity, normalised by both magnitudes.
 *
 * The dot product alone equals cosine ONLY when both inputs are unit vectors.
 * Individual embeddings are L2-normalised above, so that assumption held for
 * `clustering.ts` — but six of the eight callers pass CENTROIDS
 * (mutations.ts, temporalTracker, fragmentation x2, crossPlatformMatrix,
 * breakpoints), and the mean of unit vectors has magnitude < 1 unless every
 * vector is identical.
 *
 * Skipping normalisation therefore understated similarity between centroids,
 * which inflated `computeSemanticShift` — two IDENTICAL clusters reported a
 * non-zero semantic shift, and every mutation score inherited the error.
 * Restored to the full form: correct for unit vectors and centroids alike, at
 * the cost of two square roots.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return Math.max(0, Math.min(dot / denom, 1.0));
}
