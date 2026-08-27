'use client';

import React, { useState } from 'react';
import { Narrative, NarrativeBreakpoint, PlatformType } from '@/lib/narratives/types';
import {
  TrendingUp,
  Zap,
  ArrowRight,
  GitBranch,
  ShieldAlert,
  Clock,
  Layers,
  Sparkles,
  ChevronRight,
  CheckCircle,
} from 'lucide-react';

interface Props {
  narrative: Narrative;
  onSelectBreakpoint?: (bp: NarrativeBreakpoint) => void;
}

export function NarrativeEvolutionMap({ narrative, onSelectBreakpoint }: Props) {
  const [selectedStageIndex, setSelectedStageIndex] = useState<number>(0);

  const stages = narrative.temporalStates || [];
  const breakpoints = narrative.breakpoints || [];
  const branches = narrative.branches || [];

  const shiftBadgeColor = (level: string) => {
    if (level === 'major_break') return 'bg-skynet-negative/20 text-skynet-negative border-skynet-negative/40';
    if (level === 'significant_mutation') return 'bg-skynet-warning/20 text-skynet-warning border-skynet-warning/40';
    return 'bg-skynet-accent/20 text-skynet-accent border-skynet-accent/40';
  };

  return (
    <div className="skynet-surface rounded-2xl p-6 border border-skynet-border overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-skynet-border">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-skynet-surface-secondary text-skynet-accent border border-skynet-border">
              HERO MAP · {narrative.id}
            </span>
            <span className="text-[11px] font-mono text-skynet-muted">
              Lifecycle: <strong className="text-skynet-text-primary capitalize">{narrative.state}</strong>
            </span>
            {narrative.confidence && (
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                  narrative.confidence.level === 'HIGH'
                    ? 'bg-skynet-positive/15 text-skynet-positive'
                    : narrative.confidence.level === 'MEDIUM'
                    ? 'bg-skynet-warning/15 text-skynet-warning'
                    : 'bg-skynet-muted/20 text-skynet-muted'
                }`}
              >
                {narrative.confidence.level} CONFIDENCE ({narrative.confidence.score}%)
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold text-skynet-text-primary tracking-tight">
            {narrative.title}
          </h2>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <p className="text-xs text-skynet-muted">Composite Mutation</p>
            <p
              className={`text-2xl font-bold skynet-metric ${
                (narrative.mutationScore ?? 0) >= 50
                  ? 'text-skynet-negative'
                  : (narrative.mutationScore ?? 0) >= 25
                  ? 'text-skynet-warning'
                  : 'text-skynet-positive'
              }`}
            >
              {narrative.mutationScore !== null ? `${narrative.mutationScore}%` : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Hero Visual Timeline Flow */}
      <div className="py-6">
        <div className="text-[11px] font-mono uppercase tracking-wider text-skynet-muted mb-4 flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-skynet-accent" />
          <span>Temporal Trajectory & Mutation Inflection Points</span>
        </div>

        {stages.length > 0 ? (
          <div className="relative">
            {/* Connecting baseline bar */}
            <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-skynet-surface-secondary via-skynet-accent/30 to-skynet-negative/30 rounded-full z-0 hidden md:block" />

            {/* Stages Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 relative z-10">
              {stages.map((st, idx) => {
                const isSelected = selectedStageIndex === idx;
                const isOrigin = idx === 0;
                const isLatest = idx === stages.length - 1;
                const matchingBp = breakpoints.find(
                  (b) => new Date(b.timestamp).getTime() <= new Date(st.timestamp).getTime()
                );

                return (
                  <div
                    key={st.timestamp + idx}
                    onClick={() => setSelectedStageIndex(idx)}
                    className={`cursor-pointer rounded-xl p-4 transition-all duration-200 border ${
                      isSelected
                        ? 'bg-skynet-surface-secondary border-skynet-accent shadow-lg shadow-skynet-accent/5'
                        : 'bg-skynet-surface/90 border-skynet-border hover:border-skynet-border/80 hover:bg-skynet-surface-secondary/40'
                    }`}
                  >
                    {/* Stage Header */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-skynet-surface text-skynet-muted border border-skynet-border">
                        {isOrigin ? 'T0 · ORIGIN' : isLatest ? `T${idx} · LATEST` : `T${idx} · TRANSITION`}
                      </span>
                      <span className="text-[10px] font-mono text-skynet-muted">
                        {new Date(st.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    {/* Stage Content */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            st.dominantSentiment === 'positive'
                              ? 'bg-skynet-positive'
                              : st.dominantSentiment === 'negative'
                              ? 'bg-skynet-negative'
                              : 'bg-skynet-accent-steel'
                          }`}
                        />
                        <span className="text-xs font-semibold text-skynet-text-primary capitalize">
                          {st.dominantSentiment} sentiment
                        </span>
                        {st.dominantEmotion && (
                          <span className="text-[11px] text-skynet-muted">
                            · {st.dominantEmotion}
                          </span>
                        )}
                      </div>

                      {/* Keywords pills */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {st.topKeywords.slice(0, 3).map((kw) => (
                          <span
                            key={kw}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-skynet-surface text-skynet-text-secondary border border-skynet-border"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>

                      {/* Shift from prev */}
                      {st.semanticShiftFromPrev !== undefined && st.semanticShiftFromPrev !== null && (
                        <div className="pt-2 border-t border-skynet-border flex items-center justify-between text-[11px]">
                          <span className="text-skynet-muted">Drift vs prior:</span>
                          <span
                            className={`font-semibold skynet-metric ${
                              st.semanticShiftFromPrev >= 30
                                ? 'text-skynet-negative'
                                : st.semanticShiftFromPrev >= 15
                                ? 'text-skynet-warning'
                                : 'text-skynet-positive'
                            }`}
                          >
                            +{st.semanticShiftFromPrev}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-skynet-muted text-xs">Temporal snapshots calculated per post.</p>
        )}
      </div>

      {/* Breakpoints Banner / Callouts */}
      {breakpoints.length > 0 && (
        <div className="mt-4 pt-5 border-t border-skynet-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-skynet-muted flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-skynet-warning" />
              <span>Detected Mutation Breakpoints ({breakpoints.length})</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {breakpoints.map((bp) => (
              <div
                key={bp.id}
                onClick={() => onSelectBreakpoint?.(bp)}
                className="group cursor-pointer rounded-xl bg-skynet-surface-secondary/70 border border-skynet-border hover:border-skynet-warning/60 p-4 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-skynet-warning bg-skynet-warning/10 px-2 py-0.5 rounded border border-skynet-warning/30">
                      {bp.id} · {bp.magnitude}% SHIFT
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${shiftBadgeColor(bp.shiftLevel)}`}>
                      {bp.shiftLevel.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-skynet-muted">
                    {new Date(bp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
                  </span>
                </div>

                <p className="text-[12px] text-skynet-text-primary font-medium mb-2 group-hover:text-skynet-accent transition-colors">
                  {bp.newStateTitle}
                </p>

                {/* Diff highlights */}
                <div className="flex flex-wrap gap-2 text-[10px]">
                  {bp.addedKeywords.slice(0, 3).map((kw) => (
                    <span key={kw} className="text-skynet-positive bg-skynet-positive/10 px-1.5 py-0.5 rounded border border-skynet-positive/30">
                      +{kw}
                    </span>
                  ))}
                  {bp.removedKeywords.slice(0, 2).map((kw) => (
                    <span key={kw} className="text-skynet-negative bg-skynet-negative/10 px-1.5 py-0.5 rounded border border-skynet-negative/30 line-through">
                      -{kw}
                    </span>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-skynet-accent">
                  <span>Inspect evidence & triggering posts</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Branches / Fragmentation if detected */}
      {branches.length > 0 && (
        <div className="mt-4 pt-4 border-t border-skynet-border flex items-center gap-4">
          <div className="flex items-center gap-2 text-skynet-warning text-xs font-medium">
            <GitBranch className="w-4 h-4" />
            <span>Narrative Fragmentation:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {branches.map((b) => (
              <span
                key={b.branchId}
                className="text-[11px] px-2.5 py-1 rounded bg-skynet-surface-secondary text-skynet-text-primary border border-skynet-border flex items-center gap-1.5"
              >
                <span>Branch:</span>
                <strong className="text-skynet-accent font-medium">{b.title}</strong>
                <span className="text-skynet-muted">({b.postCount} posts)</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
