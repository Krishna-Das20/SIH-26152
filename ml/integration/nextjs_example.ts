/**
 * Example: Calling the ML NLP service from Next.js API routes.
 *
 * This shows how the existing Next.js backend can send normalized
 * Reddit data to the Python ML service and receive analysis results.
 *
 * Usage:
 *   1. Set ML_API_URL in your .env (default: http://localhost:8000)
 *   2. Import and call analyzeRedditPosts() from your API routes
 */

// ── Types ────────────────────────────────────────────────────────

interface NormalizedRedditContent {
  platform: string;
  content_id: string;
  author_id?: string | null;
  text?: string | null;
  timestamp?: string | null;
  content_type: string;
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number | null;
  parent_id?: string | null;
  community?: string | null;
  url?: string | null;
}

interface MLAnalysisResponse {
  platform: string;
  total_items: number;
  results: Array<{
    content_id: string;
    sentiment: {
      label: 'positive' | 'negative' | 'neutral';
      positive: number;
      negative: number;
      neutral: number;
      confidence: number;
    };
    emotion: {
      joy: number;
      sadness: number;
      anger: number;
      fear: number;
      surprise: number;
      disgust: number;
      dominant_emotion: string;
    };
    sarcasm: {
      is_sarcastic: boolean;
      confidence: number;
    };
    toxicity: {
      is_toxic: boolean;
      toxicity: number;
    };
    keywords: string[];
    skipped: boolean;
  }>;
  topics: Array<{
    topic_id: number;
    topic_name: string;
    keywords: string[];
    num_posts: number;
    average_sentiment: number;
  }>;
  trends: Array<{
    topic: string;
    current_mentions: number;
    growth_percentage: number;
    trend_score: number;
    status: string;
  }>;
  timeline: Array<{
    timestamp: string;
    positive: number;
    negative: number;
    neutral: number;
  }>;
  summary: {
    total_posts: number;
    positive_percentage: number;
    negative_percentage: number;
    neutral_percentage: number;
    dominant_emotion: string;
    top_topic: string;
    rising_topic: string;
    average_engagement: number;
  };
}

// ── ML Service Client ────────────────────────────────────────────

const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8000';

/**
 * Send normalized Reddit posts to the Python ML service for NLP analysis.
 *
 * @param posts - Array of normalized Reddit content objects
 * @returns Complete analysis response with per-item results, topics, trends, etc.
 *
 * @example
 * ```ts
 * // In an API route (e.g., src/app/api/analyze/page/route.ts):
 * import { analyzeRedditPosts } from '@/lib/ml/client';
 *
 * const posts = await fetchLiveRedditPosts('technology', 25);
 * const normalizedPosts = posts.map(p => ({
 *   platform: 'reddit',
 *   content_id: p.id,
 *   author_id: p.author.id,
 *   text: p.content,
 *   timestamp: p.timestamp,
 *   content_type: 'post',
 *   likes: p.likes,
 *   comments: p.replies,
 *   shares: p.shares,
 *   community: p.hashtags[0]?.replace('#r_', ''),
 *   url: p.url,
 * }));
 * const analysis = await analyzeRedditPosts(normalizedPosts);
 * ```
 */
export async function analyzeRedditPosts(
  posts: NormalizedRedditContent[]
): Promise<MLAnalysisResponse> {
  const response = await fetch(`${ML_API_URL}/analyze/reddit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ posts }),
  });

  if (!response.ok) {
    throw new Error(
      `ML service error: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Check if the ML service is healthy and reachable.
 */
export async function checkMLHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${ML_API_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}
