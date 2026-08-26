/**
 * Narrative Title Generator — extractive approach.
 *
 * Generates a human-readable title for a narrative cluster from the actual
 * content of its posts.  Does NOT use an LLM.
 *
 * Strategy:
 *   1. Collect all keywords from the posts' existing ML analysis
 *   2. Pick the shortest post containing ≥2 top keywords as the "representative"
 *   3. Extract a title-length fragment from that post
 *   4. Fallback: join top keywords
 *   5. Final fallback: "Unnamed narrative"
 */

import { SocialPost } from '@/types/intelligence';

// Common English stopwords — used for keyword frequency counting
const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'don', 'now', 'and', 'but', 'or', 'if', 'this', 'that', 'these',
  'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him',
  'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their', 'what',
  'which', 'who', 'whom', 'up', 'about', 'also', 'get', 'like', 'one',
  'make', 'go', 'know', 'take', 'come', 'think', 'see', 'look', 'want',
  'give', 'use', 'find', 'tell', 'ask', 'work', 'seem', 'feel', 'try',
  'leave', 'call', 'really', 'much', 'even', 'still', 'well', 'back',
  'sir', 'hi', 'hey', 'yes', 'yeah', 'ok', 'okay', 'thank', 'thanks',
  'please', 'video', 'channel', 'subscribe', 'comment', 'watch',
]);

/** Max title length in characters. */
const MAX_TITLE_LENGTH = 80;

/**
 * Generate a title for a narrative from its posts.
 */
export function generateNarrativeTitle(posts: SocialPost[]): string {
  if (posts.length === 0) return 'Unnamed narrative';

  // 1. Collect keywords from ML analysis + extract from text
  const topKeywords = extractTopKeywords(posts, 5);

  if (topKeywords.length === 0) return 'Unnamed narrative';

  // 2. Find the best representative post
  const representative = findRepresentativePost(posts, topKeywords);

  if (representative) {
    const title = extractTitleFromPost(representative, topKeywords);
    if (title.length >= 10) return title;
  }

  // 3. Fallback: join top keywords into a phrase
  const joined = topKeywords.slice(0, 4).join(' ');
  if (joined.length >= 5) {
    // Capitalize first letter
    return joined.charAt(0).toUpperCase() + joined.slice(1);
  }

  return 'Unnamed narrative';
}

/**
 * Extract top-k keywords from a set of posts using term frequency.
 * Also includes ML-extracted keywords if available.
 */
export function extractTopKeywords(posts: SocialPost[], k: number = 5): string[] {
  const freq = new Map<string, number>();

  for (const post of posts) {
    // ML-extracted keywords (from existing sentiment analysis)
    for (const kw of post.sentiment.keywords || []) {
      const normalised = kw.toLowerCase().trim();
      if (normalised.length >= 2 && !STOPWORDS.has(normalised)) {
        freq.set(normalised, (freq.get(normalised) || 0) + 2); // weight ML keywords
      }
    }

    // Term frequency from content
    const tokens = tokenize(post.content);
    for (const token of tokens) {
      if (token.length >= 2 && !STOPWORDS.has(token)) {
        freq.set(token, (freq.get(token) || 0) + 1);
      }
    }
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([word]) => word);
}

/**
 * Tokenize text into lowercase words, removing punctuation and URLs.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '') // remove URLs
    .replace(/[^\w\s]/g, ' ')       // remove punctuation
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/**
 * Find the post that best represents the narrative.
 * Prefers shorter posts that contain more top keywords.
 */
function findRepresentativePost(
  posts: SocialPost[],
  topKeywords: string[]
): SocialPost | null {
  let bestPost: SocialPost | null = null;
  let bestScore = -1;

  for (const post of posts) {
    const lower = post.content.toLowerCase();
    let matchCount = 0;
    for (const kw of topKeywords) {
      if (lower.includes(kw)) matchCount++;
    }
    if (matchCount < 2) continue;

    // Score: keyword matches / content length (prefer shorter, keyword-rich posts)
    const score = matchCount / Math.max(post.content.length, 1);
    if (score > bestScore) {
      bestScore = score;
      bestPost = post;
    }
  }

  return bestPost;
}

/**
 * Extract a title-length fragment from a post.
 */
function extractTitleFromPost(post: SocialPost, keywords: string[]): string {
  let text = post.content
    .replace(/https?:\/\/\S+/g, '')       // remove URLs
    .replace(/\n+/g, ' ')                  // newlines to spaces
    .replace(/\s+/g, ' ')                  // collapse whitespace
    .trim();

  // If the post is already short enough, use it
  if (text.length <= MAX_TITLE_LENGTH) {
    return text.length > 0 ? text : 'Unnamed narrative';
  }

  // Try to find a sentence containing a top keyword
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 10);
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    const hasKeyword = keywords.some((kw) => lower.includes(kw));
    if (hasKeyword && sentence.length <= MAX_TITLE_LENGTH) {
      return sentence;
    }
  }

  // Truncate to max length at a word boundary
  if (text.length > MAX_TITLE_LENGTH) {
    const truncated = text.slice(0, MAX_TITLE_LENGTH);
    const lastSpace = truncated.lastIndexOf(' ');
    text = lastSpace > 20 ? truncated.slice(0, lastSpace) + '…' : truncated + '…';
  }

  return text;
}
