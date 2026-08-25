/**
 * Narrative Mutation Tracker — Type Definitions
 *
 * These types define the internal representation of a narrative: a cluster
 * of semantically similar posts whose evolution is tracked across time,
 * platform, sentiment, emotion, and keywords.
 *
 * Every field that might be unknowable is nullable.  The frontend renders
 * null as "Unknown" or "Insufficient data" — never a fabricated value.
 */

import { PlatformType, EmotionType } from '@/types/intelligence';

// ── Core narrative ────────────────────────────────────────────────────────

export interface Narrative {
  id: string;
  title: string;
  postIds: string[];
  platforms: PlatformType[];
  firstSeen: string;
  lastSeen: string;
  postCount: number;
  engagement: number;

  // Mutation metrics — null when the underlying data is insufficient
  mutationScore: number | null;
  semanticShift: number | null;
  sentimentShift: number | null;
  emotionShift: number | null;
  keywordShift: number | null;

  dominantSentiment: 'positive' | 'negative' | 'neutral' | null;
  dominantEmotion: EmotionType | null;

  timeline: NarrativeTimelineEntry[];
  platformFlow: PlatformFlowEntry[];
  keywordEvolution: KeywordStage[];
}

// ── Timeline ──────────────────────────────────────────────────────────────

export interface NarrativeTimelineEntry {
  timestamp: string;
  platform: PlatformType;
  postId: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  emotion: EmotionType;
  contentSnippet: string;
}

// ── Platform flow ─────────────────────────────────────────────────────────

export interface PlatformFlowEntry {
  platform: PlatformType;
  firstSeen: string;
  postCount: number;
}

// ── Keyword evolution ─────────────────────────────────────────────────────

export interface KeywordStage {
  stage: 'early' | 'middle' | 'latest';
  keywords: string[];
  periodStart: string;
  periodEnd: string;
}

// ── Mutation components (for API transparency) ────────────────────────────

export interface MutationBreakdown {
  semanticShift: number | null;
  sentimentShift: number | null;
  emotionShift: number | null;
  keywordShift: number | null;
  mutationScore: number | null;
}

// ── API response shapes ───────────────────────────────────────────────────

export interface NarrativeAnalysisResponse {
  narratives: Narrative[];
  availablePlatforms: PlatformType[];
  totalPostsAnalyzed: number;
  coverage: {
    sentiment: number;
    emotion: number;
    embeddings: number;
  };
  method: {
    clustering: string;
    similarityThreshold: number;
    embeddingModel: string;
    mutationFormula: string;
  };
}
