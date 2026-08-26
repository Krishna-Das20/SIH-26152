/**
 * Narrative Mutation Tracker — Public API
 *
 * Re-exports the main entry points for narrative analysis.
 */

export { analyzeNarratives, resetNarrativeCache } from './analyzer';
export { clusterNarratives } from './clustering';
export { generateNarrativeTitle } from './titleGenerator';
export {
  computeSemanticShift,
  computeSentimentShift,
  computeEmotionShift,
  computeKeywordShift,
  computeMutationScore,
  buildKeywordEvolution,
} from './mutations';
export type {
  Narrative,
  NarrativeTimelineEntry,
  PlatformFlowEntry,
  KeywordStage,
  MutationBreakdown,
  NarrativeAnalysisResponse,
} from './types';
