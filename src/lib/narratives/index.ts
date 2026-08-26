/**
 * Narrative Mutation Tracker — Public API
 *
 * Re-exports the main entry points for narrative intelligence.
 */

export { analyzeNarratives, resetNarrativeCache } from './analyzer';
export { clusterNarratives, NARRATIVE_SIMILARITY_THRESHOLD } from './clustering';
export { generateNarrativeTitle, extractTopKeywords } from './titleGenerator';
export {
  computeSemanticShift,
  computeSentimentShift,
  computeEmotionShift,
  computeKeywordShift,
  computeEntityShift,
  computePlatformShift,
  computeCommunityShift,
  computeAmplificationShift,
  computeMutationScore,
  computeEvidenceConfidence,
  determineLifecycleState,
  buildKeywordEvolution,
  WEIGHTS,
} from './mutations';
export { buildTemporalStates, computeNarrativeVelocity, extractEntities } from './temporalTracker';
export { detectBreakpoints } from './breakpoints';
export { generateWhyMutated, buildEvidenceChain } from './evidenceExplainer';
export { buildPlatformPropagation, extractNarrativeAmplifiers } from './propagationTracker';
export { buildCrossPlatformMatrix } from './crossPlatformMatrix';
export { detectBranches, detectConvergences } from './fragmentation';

export type {
  Narrative,
  NarrativeLifecycleState,
  NarrativeShiftLevel,
  NarrativeConfidence,
  TemporalBucketState,
  NarrativeBreakpoint,
  PlatformPropagation,
  PropagationHop,
  CrossPlatformComparison,
  NarrativeBranch,
  NarrativeConvergence,
  MutationBreakdown,
  NarrativeAmplifier,
  NarrativeTimelineEntry,
  PlatformFlowEntry,
  KeywordStage,
  TimeWindowFilter,
  NarrativeAnalysisResponse,
} from './types';
