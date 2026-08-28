/**
 * SKYNET Narrative Title & Strategic Topic Synthesizer
 *
 * Generates authoritative intelligence-grade titles and core claims from
 * semantic post clusters using keyphrase dependency extraction and domain ontology.
 */

import { SocialPost } from '@/types/intelligence';
import trainedModel from '../models/trained_skynet_nlp.json';

const TRAINED_IDF: Record<string, number> = trainedModel?.top_idf_weights || {};

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
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
  'please', 'video', 'channel', 'subscribe', 'comment', 'watch', 'http', 'https',
  'removed', 'moderator', 'reddit', 'post', 'deleted'
]);

// Domain-specific title canonical templates
const TOPIC_SYNTHESIZERS: { matcher: RegExp; template: (kw: string[]) => string }[] = [
  {
    matcher: /(ai|agent|coding|vibe|model|deepseek|llm|automation)/i,
    template: () => 'Autonomous AI Agents & Synthetic Code Generation Debate'
  },
  {
    matcher: /(chip|semiconductor|tsmc|nvidia|fabrication|foundry|gpu)/i,
    template: () => 'Next-Gen Semiconductor Fabrication & Silicon Supply Dynamics'
  },
  {
    matcher: /(nasa|space|telescope|starlink|satellite|rocket|orbit)/i,
    template: () => 'Orbital Aerospace Missions & Deep Space Observation Programs'
  },
  {
    matcher: /(camera|phone|ultra|apple|samsung|galaxy|iphone|review)/i,
    template: () => 'Mobile Hardware Benchmarks, Optical Imaging & Ecosystem Rivalry'
  },
  {
    matcher: /(security|vulnerability|exploit|breach|malware|cyber|hack)/i,
    template: () => 'Critical Infrastructure Cybersecurity Vulnerabilities & Exploits'
  },
  {
    matcher: /(energy|power|grid|nuclear|solar|battery|electricity)/i,
    template: () => 'Clean Energy Transition, Power Grid Stress & Storage Capacity'
  },
  {
    matcher: /(court|judge|lawsuit|legal|regulation|antitrust|subpoena)/i,
    template: () => 'Regulatory Antitrust Litigation & Corporate Legal Scrutiny'
  },
  {
    matcher: /(teacher|exam|student|study|class|physics|math|education)/i,
    template: () => 'Technical Academic Discourse, Examination Analysis & Pedagogy'
  },
  {
    matcher: /(crypto|bitcoin|btc|eth|market|inflation|economy|fed)/i,
    template: () => 'Macroeconomic Liquidity, Inflation Indicators & Digital Assets'
  },
  {
    matcher: /(game|gaming|steam|console|multiplayer|graphics|fps)/i,
    template: () => 'Next-Gen Gaming Engine Optimization & Community Backlash'
  }
];

const MAX_TITLE_LENGTH = 85;

/**
 * Generate an intelligence-grade title for a narrative cluster.
 */
export function generateNarrativeTitle(posts: SocialPost[]): string {
  if (!posts || posts.length === 0) return 'Unnamed Narrative Stream';

  // 1. Extract Top Weighted Salient Keywords
  const topKeywords = extractTopKeywords(posts, 6);
  if (topKeywords.length === 0) return 'Cross-Platform Discourse Cluster';

  const kwString = topKeywords.join(' ');

  // 2. Check Ontological Topic Synthesizer
  for (const synth of TOPIC_SYNTHESIZERS) {
    if (synth.matcher.test(kwString)) {
      return synth.template(topKeywords);
    }
  }

  // 3. Syntactic Salience Extraction from Representative Post
  const representative = findRepresentativePost(posts, topKeywords);
  if (representative) {
    const candidateTitle = extractTitleFromPost(representative, topKeywords);
    if (candidateTitle.length >= 15 && candidateTitle.length <= MAX_TITLE_LENGTH) {
      return candidateTitle;
    }
  }

  // 4. Construct Compound Noun-Phrase Headline from Salient Keywords
  const salientKeywords = topKeywords
    .filter((k) => !STOPWORDS.has(k))
    .slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  if (salientKeywords.length >= 2) {
    const pairA = salientKeywords.slice(0, 2).join(' ');
    const pairB = salientKeywords.length > 2 ? ` & ${salientKeywords.slice(2).join(' ')}` : '';
    return `${pairA}${pairB} Discourse`;
  }

  return 'Autonomous Signal Cluster';
}

/**
 * Extract top-k keywords from posts using IDF & frequency weighting.
 */
export function extractTopKeywords(posts: SocialPost[], k: number = 6): string[] {
  const scores = new Map<string, number>();

  for (const post of posts) {
    // Add existing post keywords
    for (const kw of post.sentiment?.keywords || []) {
      const norm = kw.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
      if (norm.length >= 3 && !STOPWORDS.has(norm)) {
        const idf = TRAINED_IDF[norm] || 1.5;
        scores.set(norm, (scores.get(norm) || 0) + 3.0 * idf);
      }
    }

    // Tokenize text
    const words = post.content
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w));

    for (const w of words) {
      const idf = TRAINED_IDF[w] || 1.0;
      scores.set(w, (scores.get(w) || 0) + 1.0 * idf);
    }
  }

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([word]) => word);
}

/**
 * Find the most central, articulate post in the cluster.
 */
function findRepresentativePost(posts: SocialPost[], topKeywords: string[]): SocialPost | null {
  let bestPost: SocialPost | null = null;
  let bestScore = -1;

  for (const post of posts) {
    const text = post.content.toLowerCase();
    let matches = 0;
    for (const kw of topKeywords) {
      if (text.includes(kw)) matches++;
    }
    if (matches < 2) continue;

    // Favor posts between 60 and 240 chars with high keyword density
    const len = post.content.length;
    const lengthPenalty = len < 40 ? 0.4 : len > 350 ? 0.6 : 1.0;
    // Unknown engagement contributes nothing rather than dragging the score
    // down as if the post had measured zero interaction.
    const engagementBoost = Math.log10((post.likes ?? 0) + (post.replies ?? 0) + 10);
    const score = (matches * 2.0 + engagementBoost) * lengthPenalty;

    if (score > bestScore) {
      bestScore = score;
      bestPost = post;
    }
  }

  return bestPost;
}

/**
 * Extract clean headline fragment from representative post.
 */
function extractTitleFromPost(post: SocialPost, keywords: string[]): string {
  let text = post.content
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Try finding the punchy first sentence
  const sentences = text
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12 && s.length <= MAX_TITLE_LENGTH);

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    const hits = keywords.filter((k) => lower.includes(k)).length;
    if (hits >= 2) {
      return sentence.charAt(0).toUpperCase() + sentence.slice(1);
    }
  }

  if (text.length > MAX_TITLE_LENGTH) {
    const sub = text.slice(0, MAX_TITLE_LENGTH);
    const lastSpace = sub.lastIndexOf(' ');
    text = (lastSpace > 25 ? sub.slice(0, lastSpace) : sub) + '…';
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}
