/**
 * Narrative Mutation Tracker — Comprehensive Intelligence Type Definitions
 *
 * These types define the complete representation of a narrative: a cluster
 * of semantically similar posts whose evolution is tracked across time,
 * platforms, communities, sentiment, emotion, keywords, and entities.
 *
 * Strict anti-fabrication: nullable fields indicate insufficient data.
 * The system never invents or estimates unobserved numbers.
 */

import { PlatformType, EmotionType } from '@/types/intelligence';
export type { PlatformType, EmotionType };

// ── Lifecycle & Shift Levels ──────────────────────────────────────────────

export type NarrativeLifecycleState =
  | 'emerging'
  | 'growing'
  | 'peaking'
  | 'mutating'
  | 'fragmenting'
  | 'declining'
  | 'dormant';

export type NarrativeShiftLevel =
  | 'stable'
  | 'gradual_shift'
  | 'significant_mutation'
  | 'major_break';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

// ── Evidence Confidence ───────────────────────────────────────────────────

export interface NarrativeConfidence {
  level: ConfidenceLevel;
  score: number; // 0 - 100
  sampleSize: number;
  timeSpanHours: number;
  platformCount: number;
  reasons: string[];
}

// ── Temporal Bucket State ─────────────────────────────────────────────────

export interface TemporalBucketState {
  timestamp: string;
  postCount: number;
  centroid?: number[];
  sentimentDistribution: Record<'positive' | 'negative' | 'neutral', number>;
  dominantSentiment: 'positive' | 'negative' | 'neutral';
  dominantEmotion: EmotionType | null;
  topKeywords: string[];
  topEntities: string[];
  platforms: PlatformType[];
  topCommunityId?: number;
  topAmplifiers: string[];
  semanticShiftFromPrev?: number | null; // vs previous bucket
}

// ── Breakpoint Detection ──────────────────────────────────────────────────

export interface NarrativeBreakpoint {
  id: string;
  timestamp: string;
  previousStateTitle: string;
  newStateTitle: string;
  magnitude: number; // 0 - 100
  shiftLevel: NarrativeShiftLevel;
  triggeringPostIds: string[];
  platform: PlatformType;
  communityId?: number;
  sentimentDelta: {
    from: string;
    to: string;
    scoreDelta: number; // e.g. -0.42
  };
  emotionDelta: {
    from: string;
    to: string;
  };
  addedKeywords: string[];
  removedKeywords: string[];
  addedEntities: string[];
  removedEntities: string[];
  whySummary: string[];
}

// ── Platform Propagation ──────────────────────────────────────────────────

export interface PropagationHop {
  platform: PlatformType;
  timestamp: string;
  delayHours: number; // delay from origin
  postCount: number;
  keyAmplifiers: string[];
}

export interface PlatformPropagation {
  originPlatform: PlatformType;
  originTimestamp: string;
  totalSpreadTimeHours: number;
  hops: PropagationHop[];
}

// ── Cross-Platform Matrix ─────────────────────────────────────────────────

export interface CrossPlatformComparison {
  platform: PlatformType;
  dominantSentiment: 'positive' | 'negative' | 'neutral';
  dominantEmotion: EmotionType | null;
  topKeywords: string[];
  postCount: number;
  divergenceScore: number; // 0 - 100 divergence from overall centroid
  sampleFramingSnippet: string;
}

// ── Narrative Branching & Convergence ─────────────────────────────────────

export interface NarrativeBranch {
  branchId: string;
  title: string;
  splitTimestamp: string;
  postCount: number;
  similarityToParent: number; // 0 - 100
  distinctKeywords: string[];
}

export interface NarrativeConvergence {
  convergedWithNarrativeId: string;
  convergedWithTitle: string;
  timestamp: string;
  sharedKeywords: string[];
  combinedCentroidSim: number;
}

// ── 8-Dimension Mutation Breakdown ────────────────────────────────────────

export interface MutationBreakdown {
  semanticShift: number | null;
  sentimentShift: number | null;
  emotionShift: number | null;
  keywordShift: number | null;
  entityShift: number | null;
  platformShift: number | null;
  communityShift: number | null;
  amplificationShift: number | null;
  mutationScore: number | null;
}

// ── Amplifiers (KOLs associated with narrative shift) ─────────────────────

export interface NarrativeAmplifier {
  id: string;
  username: string;
  displayName: string;
  platform: PlatformType;
  influenceScore: number;
  betweennessRank?: number;
  communityId?: number;
  firstSeenInNarrative: string;
  associatedWithShift: boolean;
}

// ── Core Narrative Entity ─────────────────────────────────────────────────

export interface Narrative {
  id: string;
  title: string;
  summary: string;
  state: NarrativeLifecycleState;
  postIds: string[];
  platforms: PlatformType[];
  firstSeen: string;
  lastSeen: string;
  timeSpanHours: number;
  postCount: number;
  engagement: number;

  // Velocity
  narrativeVelocity: {
    semanticDriftPerHour: number;
    postVelocityPerHour: number;
    isAccelerating: boolean;
  };

  // Mutation metrics
  mutationScore: number | null;
  semanticShift: number | null;
  sentimentShift: number | null;
  emotionShift: number | null;
  keywordShift: number | null;
  entityShift: number | null;
  platformShift: number | null;
  communityShift: number | null;
  amplificationShift: number | null;

  // Evidence & Confidence
  confidence: NarrativeConfidence;
  whyMutated: string[];
  evidenceChain: {
    step: string;
    detail: string;
    metric?: string;
    verified: boolean;
  }[];

  // Breakpoints
  breakpoints: NarrativeBreakpoint[];

  // Propagation & Cross-Platform
  propagation: PlatformPropagation;
  crossPlatformMatrix: CrossPlatformComparison[];

  // Network & Influence
  topAmplifiers: NarrativeAmplifier[];
  topCommunities: number[];

  // Branching / Convergence
  branches: NarrativeBranch[];
  convergences: NarrativeConvergence[];

  // Timeline & Sequences
  dominantSentiment: 'positive' | 'negative' | 'neutral' | null;
  dominantEmotion: EmotionType | null;
  timeline: NarrativeTimelineEntry[];
  platformFlow: PlatformFlowEntry[];
  keywordEvolution: KeywordStage[];
  temporalStates: TemporalBucketState[];
}

// ── Timeline Entry ────────────────────────────────────────────────────────

export interface NarrativeTimelineEntry {
  timestamp: string;
  platform: PlatformType;
  postId: string;
  authorUsername: string;
  authorDisplayName?: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  emotion: EmotionType;
  contentSnippet: string;
  isBreakpointTrigger?: boolean;
  url?: string;
  inReplyToPostId?: string;
}

// ── Platform Flow Entry ───────────────────────────────────────────────────

export interface PlatformFlowEntry {
  platform: PlatformType;
  firstSeen: string;
  postCount: number;
}

// ── Keyword Evolution Stage ───────────────────────────────────────────────

export interface KeywordStage {
  stage: 'early' | 'middle' | 'latest';
  keywords: string[];
  entities: string[];
  periodStart: string;
  periodEnd: string;
}

// ── API Request & Response Shapes ─────────────────────────────────────────

export type TimeWindowFilter = '24h' | '7d' | '30d' | 'all';

export interface NarrativeAnalysisResponse {
  narratives: Narrative[];
  availablePlatforms: PlatformType[];
  totalPostsAnalyzed: number;
  filterApplied?: {
    window: TimeWindowFilter;
    platform: string;
  };
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
    confidenceFormula: string;
  };
}
