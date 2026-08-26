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
      console.warn(`Embedding service returned ${res.status}; embeddings unavailable.`);
      return result;
    }

    const json = (await res.json()) as EmbeddingResponse;

    if (json.embeddings.length !== uncached.length) {
      console.warn(
        `Embedding count mismatch: expected ${uncached.length}, got ${json.embeddings.length}`
      );
      return result;
    }

    for (let i = 0; i < uncached.length; i++) {
      const vec = json.embeddings[i];
      result.set(uncached[i].id, vec);
      c.set(uncached[i].id, vec);
    }
  } catch (err) {
    console.warn('Embedding service unreachable; embeddings unavailable.', err);
  }

  return result;
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
