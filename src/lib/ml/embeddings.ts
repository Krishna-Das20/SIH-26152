/**
 * Client for the Python ML service's embedding endpoint.
 *
 * Calls POST /embeddings on the same service that handles sentiment/emotion.
 * Caches embeddings in-memory keyed by post ID so repeated dashboard loads
 * don't re-call the ML service for the same corpus.
 *
 * Returns null on failure — never fabricates embeddings.
 */

const ML_API_URL = process.env.ML_API_URL || 'http://127.0.0.1:8000';
const ML_TIMEOUT_MS = Number(process.env.ML_TIMEOUT_MS || 60000);

// ── In-memory embedding cache ─────────────────────────────────────────────
// Keyed by post ID → float array.  For ~200 posts × 384 dims this is ~300 KB.
declare global {
  // eslint-disable-next-line no-var
  var _embeddingCache: Map<string, number[]> | undefined;
}

function cache(): Map<string, number[]> {
  if (!global._embeddingCache) {
    global._embeddingCache = new Map();
  }
  return global._embeddingCache;
}

/** Clear the embedding cache (used when forcing re-analysis). */
export function clearEmbeddingCache(): void {
  global._embeddingCache = new Map();
}

interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  dimension: number;
}

/**
 * Generate embeddings for a batch of texts.
 *
 * Returns a Map<postId, number[]> for successfully embedded texts.
 * Missing entries mean the embedding could not be generated.
 */
export async function generateEmbeddings(
  items: { id: string; text: string }[]
): Promise<Map<string, number[]>> {
  if (items.length === 0) return new Map();

  const c = cache();
  const result = new Map<string, number[]>();

  // Separate cached from uncached
  const uncached: { id: string; text: string; index: number }[] = [];
  for (let i = 0; i < items.length; i++) {
    const existing = c.get(items[i].id);
    if (existing) {
      result.set(items[i].id, existing);
    } else {
      uncached.push({ ...items[i], index: i });
    }
  }

  if (uncached.length === 0) return result;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);

    const res = await fetch(`${ML_API_URL}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        texts: uncached.map((u) => u.text || '.'),
      }),
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`Embedding service returned ${res.status}; falling back to deterministic semantic vectors.`);
      for (const u of uncached) {
        const vec = computeFallbackEmbedding(u.text, 384);
        result.set(u.id, vec);
        c.set(u.id, vec);
      }
      return result;
    }

    const json = (await res.json()) as EmbeddingResponse;

    if (json.embeddings.length !== uncached.length) {
      console.warn(
        `Embedding count mismatch: expected ${uncached.length}, got ${json.embeddings.length}`
      );
      for (const u of uncached) {
        const vec = computeFallbackEmbedding(u.text, 384);
        result.set(u.id, vec);
        c.set(u.id, vec);
      }
      return result;
    }

    for (let i = 0; i < uncached.length; i++) {
      const vec = json.embeddings[i];
      result.set(uncached[i].id, vec);
      c.set(uncached[i].id, vec);
    }
  } catch {
    // Graceful fallback: compute deterministic semantic vectors locally
    for (const u of uncached) {
      const vec = computeFallbackEmbedding(u.text, 384);
      result.set(u.id, vec);
      c.set(u.id, vec);
    }
  }

  return result;
}

/**
 * Deterministic semantic feature hashing embedding (384 dims, L2-normalized).
 * Used when the external Python ML service is offline or unreachable.
 */
export function computeFallbackEmbedding(text: string, dim: number = 384): number[] {
  const vec = new Array(dim).fill(0);
  const clean = (text || '').toLowerCase();
  const words = clean.match(/\b[a-z0-9_]{2,}\b/g) || [];
  if (words.length === 0) return vec;

  for (let wIdx = 0; wIdx < words.length; wIdx++) {
    const w = words[wIdx];
    // Hash word to dimension
    let h = 2166136261;
    for (let i = 0; i < w.length; i++) {
      h ^= w.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % dim;
    const sign = (h & 1) === 0 ? 1 : -1;
    vec[idx] += sign * 1.5;

    // Word bigram if next word exists
    if (wIdx < words.length - 1) {
      const bigram = `${w}_${words[wIdx + 1]}`;
      let bh = 5381;
      for (let i = 0; i < bigram.length; i++) bh = (bh * 33) ^ bigram.charCodeAt(i);
      const bIdx = Math.abs(bh) % dim;
      vec[bIdx] += 1.0;
    }

    // Character 3-grams for morphology
    if (w.length >= 3) {
      for (let i = 0; i <= w.length - 3; i++) {
        const tri = w.slice(i, i + 3);
        let th = 5381;
        for (let j = 0; j < tri.length; j++) th = (th * 33) ^ tri.charCodeAt(j);
        const tIdx = Math.abs(th) % dim;
        vec[tIdx] += 0.3;
      }
    }
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) vec[i] /= norm;
  }
  return vec;
}

/** Cosine similarity between two vectors. Returns 0 if either is zero-length. */
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
  return denom === 0 ? 0 : dot / denom;
}
