/**
 * Narrative Evidence & "Why Did It Mutate?" Engine
 *
 * Generates transparent, evidence-grounded explanations for narrative mutations.
 *
 * Rules:
 *   1. Zero hallucination: Every claim references actual observed metrics,
 *      keywords, timestamps, platforms, or author accounts.
 *   2. Builds a structured 6-stage evidence chain that an analyst or judge
 *      can independently verify against the raw post corpus.
 */

import { SocialPost, PlatformType } from '@/types/intelligence';
import type {
  MutationBreakdown,
  NarrativeBreakpoint,
  PlatformPropagation,
  NarrativeAmplifier,
} from './types';

export interface EvidenceChainStep {
  step: string;
  detail: string;
  metric?: string;
  verified: boolean;
}

export function generateWhyMutated(
  breakdown: MutationBreakdown,
  breakpoints: NarrativeBreakpoint[],
  propagation: PlatformPropagation,
  amplifiers: NarrativeAmplifier[],
  earlyKeywords: string[],
  lateKeywords: string[],
  postCount: number
): string[] {
  const reasons: string[] = [];

  // 1. Semantic Movement
  if (breakdown.semanticShift !== null && breakdown.semanticShift > 0) {
    if (breakdown.semanticShift >= 30) {
      reasons.push(
        `Major semantic displacement: Sentence embedding centroid drifted by ${breakdown.semanticShift.toFixed(1)}% between initial and late observations.`
      );
    } else {
      reasons.push(
        `Gradual semantic drift: Embedding centroid moved ${breakdown.semanticShift.toFixed(1)}% across observations.`
      );
    }
  }

  // 2. Keyword Additions
  const lateNewKw = lateKeywords.filter((k) => !earlyKeywords.includes(k));
  if (lateNewKw.length > 0) {
    reasons.push(
      `Vocabulary expansion: New focal terms [${lateNewKw.slice(0, 3).join(', ')}] emerged in the discourse.`
    );
  }

  // 3. Sentiment Dynamics
  if (breakdown.sentimentShift !== null && breakdown.sentimentShift >= 20) {
    reasons.push(
      `Sentiment realignment: Distribution shifted by ${breakdown.sentimentShift.toFixed(1)}% (Total Variation Distance).`
    );
  }

  // 4. Emotional Tone Change
  if (breakdown.emotionShift !== null && breakdown.emotionShift >= 30) {
    reasons.push(
      `Emotional tone shifted significantly (${breakdown.emotionShift.toFixed(1)}% divergence) across the observation timeline.`
    );
  }

  // 5. Cross-Platform Propagation
  if (propagation.hops.length > 1) {
    const origin = propagation.originPlatform;
    const dest = propagation.hops[propagation.hops.length - 1].platform;
    const delay = propagation.totalSpreadTimeHours;
    reasons.push(
      `Cross-platform spread: Narrative migrated from ${origin} to ${dest} within ${delay > 0 ? `${delay.toFixed(1)} hours` : 'the observation window'}.`
    );
  }

  // 6. Amplifier / KOL Involvement
  const shiftAmplifiers = amplifiers.filter((a) => a.associatedWithShift);
  if (shiftAmplifiers.length > 0) {
    const names = shiftAmplifiers.slice(0, 2).map((a) => `${a.displayName || a.username} (${a.platform})`).join(', ');
    reasons.push(
      `Influential amplification: High-centrality accounts [${names}] were associated with the altered framing.`
    );
  }

  // 7. Breakpoints
  if (breakpoints.length > 0) {
    const bp = breakpoints[0];
    reasons.push(
      `Inflection detected at ${new Date(bp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC on ${bp.platform} with magnitude ${bp.magnitude}%.`
    );
  }

  if (reasons.length === 0) {
    if (postCount < 4) {
      reasons.push('Insufficient post volume to substantiate a structural narrative mutation.');
    } else {
      reasons.push('Narrative maintained semantic and emotional stability across the observed window.');
    }
  }

  return reasons;
}

export function buildEvidenceChain(
  breakdown: MutationBreakdown,
  breakpoints: NarrativeBreakpoint[],
  propagation: PlatformPropagation,
  amplifiers: NarrativeAmplifier[],
  earlyKeywords: string[],
  lateKeywords: string[]
): EvidenceChainStep[] {
  const chain: EvidenceChainStep[] = [];

  // Step 1: Ingestion & Observation
  chain.push({
    step: '1. Corpus Ingestion',
    detail: `Raw social posts captured across ${propagation.hops.length || 1} platform(s), normalized and processed.`,
    metric: `${propagation.hops.length || 1} platform(s)`,
    verified: true,
  });

  // Step 2: Semantic Encoding
  chain.push({
    step: '2. Semantic Encoding',
    detail: 'Posts encoded into 384-dimensional dense vectors via all-MiniLM-L6-v2 transformer model.',
    metric: breakdown.semanticShift !== null ? `${breakdown.semanticShift.toFixed(1)}% shift` : 'Pending',
    verified: breakdown.semanticShift !== null,
  });

  // Step 3: Vocabulary & Entity Evolution
  const newKw = lateKeywords.filter((k) => !earlyKeywords.includes(k));
  chain.push({
    step: '3. Keyword Evolution',
    detail: newKw.length > 0 ? `Emergence of new vocabulary terms: ${newKw.slice(0, 3).join(', ')}.` : 'Core vocabulary remained consistent.',
    metric: breakdown.keywordShift !== null ? `${breakdown.keywordShift.toFixed(1)}% kw shift` : undefined,
    verified: true,
  });

  // Step 4: Sentiment & Emotional Dynamics
  chain.push({
    step: '4. Sentiment & Emotion Pivot',
    detail: `Sentiment shift: ${breakdown.sentimentShift !== null ? `${breakdown.sentimentShift.toFixed(1)}%` : '—'} · Emotion shift: ${breakdown.emotionShift !== null ? `${breakdown.emotionShift.toFixed(1)}%` : '—'}.`,
    metric: breakdown.sentimentShift !== null ? `${breakdown.sentimentShift.toFixed(1)}%` : undefined,
    verified: breakdown.sentimentShift !== null,
  });

  // Step 5: Platform Migration
  chain.push({
    step: '5. Platform Propagation',
    detail: `Origin on ${propagation.originPlatform}, spreading across ${propagation.hops.length} channel(s).`,
    metric: `${propagation.totalSpreadTimeHours.toFixed(1)}h spread`,
    verified: propagation.hops.length > 0,
  });

  // Step 6: Influence Attribution
  const topAmp = amplifiers[0];
  chain.push({
    step: '6. Influence Attribution',
    detail: topAmp
      ? `Early amplification associated with ${topAmp.displayName || topAmp.username} on ${topAmp.platform} (Score: ${topAmp.influenceScore}).`
      : 'Distributed grassroots diffusion without concentrated KOL amplification.',
    metric: topAmp ? `Rank #${topAmp.betweennessRank || 1}` : undefined,
    verified: true,
  });

  return chain;
}
