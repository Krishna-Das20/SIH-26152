import { SentimentAnalysis, EmotionType, StanceType, SocialPost } from '@/types/intelligence';
import { analyzeSentimentAndEmotion } from '@/lib/nlp/emotionEngine';

/**
 * Client for the Python transformer service in `ml/`.
 *
 * The service runs separately (FastAPI, port 8000) because it loads several
 * GB of model weights and holds them in memory -- it cannot live inside a
 * Vercel serverless function. Set ML_API_URL to wherever it is deployed.
 *
 * Every call degrades to the local lexicon engine if the service is
 * unreachable or slow, so the dashboard keeps working when the ML box is
 * down. The `engine` field on each result records which path produced it, so
 * the UI can be honest about what the analyst is looking at.
 */

const ML_API_URL = process.env.ML_API_URL || 'http://127.0.0.1:8000';
/**
 * Generous by default. Measured on CPU: steady-state throughput is ~8 items/s,
 * but the FIRST batch after startup costs ~21s because the topic model fits
 * lazily. A 20s timeout meant the very first real request always fell back to
 * the lexicon -- exactly the request a demo starts with.
 */
const ML_TIMEOUT_MS = Number(process.env.ML_TIMEOUT_MS || 60000);

/** Max items per request, so one slow batch cannot blow the whole timeout. */
const ML_CHUNK_SIZE = Number(process.env.ML_CHUNK_SIZE || 40);
const ML_ENABLED = process.env.ML_ENABLED !== 'false';

// ── Wire types (mirror ml/schemas/social.py) ──────────────────────────────

interface MlSentiment {
  label: string;
  positive: number;
  negative: number;
  neutral: number;
  confidence: number;
}

interface MlEmotion {
  joy: number;
  sadness: number;
  anger: number;
  fear: number;
  surprise: number;
  disgust: number;
  excitement: number;
  love: number;
  optimism: number;
  curiosity: number;
  /** GoEmotions `disapproval` — the signal behind the `against` stance. */
  disapproval?: number;
  /** GoEmotions `nervousness` — distinct from acute fear. */
  nervousness?: number;
  dominant_emotion: string;
}

interface MlSarcasm {
  is_sarcastic: boolean;
  confidence: number;
  model_available: boolean;
}

interface MlResult {
  content_id: string;
  sentiment: MlSentiment;
  emotion: MlEmotion;
  sarcasm: MlSarcasm;
  toxicity?: { is_toxic: boolean; toxicity: number };
  keywords?: string[];
  language?: { language: string; language_confidence: number };
  skipped?: boolean;
}

interface MlBatchResponse {
  total_items: number;
  results: MlResult[];
}

// ── Taxonomy mapping ──────────────────────────────────────────────────────

/**
 * GoEmotions-derived labels do not line up with this project's taxonomy:
 * the model has no `anxiety`, `supportive`, or `against`, and this app has no
 * `surprise`, `disgust`, `love`, `optimism`, or `curiosity`.
 *
 * `fear` covers the same affective ground as `anxiety` here, and `love` /
 * `optimism` are the closest signals to `supportive`. `against` is not an
 * emotion at all -- it is a stance, so it is derived separately below.
 */
const EMOTION_MAP: Record<string, EmotionType> = {
  joy: 'joy',
  sadness: 'sadness',
  anger: 'anger',
  // GoEmotions `disapproval` is the closest thing to an explicit "against"
  // stance. Without this entry the `against` dimension was UNREACHABLE through
  // the ML path -- only the lexicon fallback could ever produce it.
  disapproval: 'against',
  fear: 'fear',
  nervousness: 'anxiety',
  surprise: 'excitement',
  disgust: 'anger',
  excitement: 'excitement',
  love: 'supportive',
  optimism: 'supportive',
  curiosity: 'neutral',
  neutral: 'neutral',
};

export function mapEmotion(mlEmotion: MlEmotion): EmotionType {
  const direct = EMOTION_MAP[(mlEmotion.dominant_emotion || '').toLowerCase()];
  if (direct) return direct;

  // Fall back to the strongest scored dimension when the dominant label is
  // absent or unrecognised.
  const scored: [string, number][] = [
    ['joy', mlEmotion.joy],
    ['sadness', mlEmotion.sadness],
    ['anger', mlEmotion.anger],
    ['disapproval', mlEmotion.disapproval ?? 0],
    ['fear', mlEmotion.fear],
    ['nervousness', mlEmotion.nervousness ?? 0],
    ['surprise', mlEmotion.surprise],
    ['disgust', mlEmotion.disgust],
    ['excitement', mlEmotion.excitement],
    ['love', mlEmotion.love],
    ['optimism', mlEmotion.optimism],
  ];
  scored.sort((a, b) => b[1] - a[1]);
  return (scored[0] && EMOTION_MAP[scored[0][0]]) || 'neutral';
}

/**
 * Stance is not something the transformer stack predicts directly, so it is
 * derived from sentiment polarity and the supportive/hostile emotion mass.
 * This is a documented heuristic, not a model output -- the honest framing is
 * "inferred stance", and a fine-tuned stance classifier is the real fix.
 */
export function deriveStance(sentiment: MlSentiment, emotion: MlEmotion): StanceType {
  // Stance is a POSITION taken toward something, which is not the same as
  // emotional valence. Fear, sadness and nervousness are negative but express
  // no position: "I'm nervous about what happens if this fails" is worry, not
  // opposition. Ranking polarity first made every strongly negative post
  // 'opposing', which inflated the opposing share with anxious and grieving
  // posts and made the supportive/opposing split meaningless.
  //
  // So the explicit stance signals are checked FIRST, and polarity is only a
  // tiebreaker when a stance-bearing emotion is already present.
  const supportMass = emotion.love + emotion.optimism + emotion.joy;
  const opposeMass = emotion.anger + emotion.disgust + (emotion.disapproval ?? 0);

  // Emotions that carry no stance at all, however negative they are.
  const stancelessMass =
    emotion.fear + emotion.sadness + (emotion.nervousness ?? 0) + emotion.curiosity;

  const STRONG = 0.4;

  if (opposeMass >= STRONG && opposeMass > supportMass) return 'opposing';
  if (supportMass >= STRONG && supportMass > opposeMass) return 'supportive';

  // Neither stance signal is strong. If the dominant feeling is a stanceless
  // one, say so rather than inferring a position from mood.
  if (stancelessMass > Math.max(supportMass, opposeMass)) return 'neutral';

  // Weak stance signal — let polarity break the tie, but only when some
  // stance-bearing emotion is actually present.
  if (supportMass > opposeMass && sentiment.positive > 0.6) return 'supportive';
  if (opposeMass > supportMass && sentiment.negative > 0.6) return 'opposing';

  return 'neutral';
}

function toSentimentAnalysis(r: MlResult, fallbackText: string): SentimentAnalysis {
  const s = r.sentiment;
  const e = r.emotion;

  // Signed polarity on [-1, 1] from the model's class probabilities.
  const score = Number((s.positive - s.negative).toFixed(2));

  return {
    score,
    label: s.label === 'positive' || s.label === 'negative' ? s.label : 'neutral',
    nuancedEmotion: mapEmotion(e),
    // When the sarcasm model is unavailable the service reports it rather than
    // guessing; carry that through as 0 instead of inventing a score.
    sarcasmScore: r.sarcasm.model_available ? Number(r.sarcasm.confidence.toFixed(2)) : 0,
    stance: deriveStance(s, e),
    confidence: Number(s.confidence.toFixed(2)),
    keywords: (r.keywords || []).slice(0, 5),
    engine: 'ml',
  };
}

// ── Health / availability ─────────────────────────────────────────────────

let healthCache: { ok: boolean; checkedAt: number } | null = null;
const HEALTH_TTL_MS = 30_000;

export async function isMlAvailable(): Promise<boolean> {
  if (!ML_ENABLED) return false;

  const now = Date.now();
  if (healthCache && now - healthCache.checkedAt < HEALTH_TTL_MS) {
    return healthCache.ok;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${ML_API_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    healthCache = { ok: res.ok, checkedAt: now };
    return res.ok;
  } catch {
    healthCache = { ok: false, checkedAt: now };
    return false;
  }
}

// ── Public API ────────────────────────────────────────────────────────────

export interface AnalyzableItem {
  id: string;
  text: string;
  platform?: string;
  timestamp?: string;
  authorId?: string;
  likes?: number;
  replies?: number;
  shares?: number;
}

/**
 * Analyses a batch of texts, preferring the transformer service and falling
 * back to the lexicon engine per-item on any failure.
 *
 * Always returns one result per input, in input order.
 */
export async function analyzeBatch(items: AnalyzableItem[]): Promise<SentimentAnalysis[]> {
  if (items.length === 0) return [];

  const lexiconFallback = () =>
    items.map((i) => ({ ...analyzeSentimentAndEmotion(i.text), engine: 'lexicon' as const }));

  if (!ML_ENABLED) return lexiconFallback();

  // Chunk so a large corpus does not exceed the timeout as one request.
  if (items.length > ML_CHUNK_SIZE) {
    const out: SentimentAnalysis[] = [];
    for (let i = 0; i < items.length; i += ML_CHUNK_SIZE) {
      out.push(...(await analyzeBatch(items.slice(i, i + ML_CHUNK_SIZE))));
    }
    return out;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);

    const res = await fetch(`${ML_API_URL}/analyze/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        items: items.map((i) => ({
          platform: i.platform || 'reddit',
          content_id: i.id,
          author_id: i.authorId ?? null,
          text: i.text,
          timestamp: i.timestamp ?? null,
          content_type: 'post',
          likes: i.likes ?? 0,
          comments: i.replies ?? 0,
          shares: i.shares ?? 0,
        })),
      }),
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`ML service returned ${res.status}; using lexicon fallback.`);
      return lexiconFallback();
    }

    const json = (await res.json()) as MlBatchResponse;
    const byId = new Map(json.results.map((r) => [r.content_id, r]));

    // Map back by id rather than position: the service may skip empty items,
    // and a positional zip would silently misalign every result after the gap.
    return items.map((item) => {
      const r = byId.get(item.id);
      if (!r || r.skipped) {
        return { ...analyzeSentimentAndEmotion(item.text), engine: 'lexicon' as const };
      }
      return toSentimentAnalysis(r, item.text);
    });
  } catch (err) {
    console.warn('ML service unreachable; using lexicon fallback.', err);
    return lexiconFallback();
  }
}

/** Convenience wrapper for a single text. */
export async function analyzeOne(id: string, text: string): Promise<SentimentAnalysis> {
  const [result] = await analyzeBatch([{ id, text }]);
  return result;
}

/**
 * Enriches already-built posts in place, replacing their `sentiment` field
 * with transformer output where available.
 */
export async function enrichPosts(posts: SocialPost[]): Promise<SocialPost[]> {
  if (posts.length === 0) return posts;

  const analyses = await analyzeBatch(
    posts.map((p) => ({
      id: p.id,
      text: p.content,
      platform: p.platform,
      timestamp: p.timestamp,
      authorId: p.author.id,
      likes: p.likes,
      replies: p.replies,
      shares: p.shares,
    }))
  );

  return posts.map((p, i) => ({ ...p, sentiment: analyses[i] }));
}
