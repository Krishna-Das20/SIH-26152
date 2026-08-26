'use client';

import React from 'react';
import { NarrativeBreakpoint, NarrativeTimelineEntry } from '@/lib/narratives/types';
import { X, Zap, ArrowRight, ShieldCheck, MessageSquare, User, Calendar, ExternalLink } from 'lucide-react';

interface Props {
  breakpoint: NarrativeBreakpoint | null;
  timelinePosts?: NarrativeTimelineEntry[];
  onClose: () => void;
}

export function MutationBreakpointDrawer({ breakpoint, timelinePosts = [], onClose }: Props) {
  if (!breakpoint) return null;

  // Filter triggering posts from timeline
  const triggeringTimelinePosts = timelinePosts.filter((p) =>
    breakpoint.triggeringPostIds.includes(p.postId)
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-2xl bg-nexus-surface border-l border-nexus-border h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-6 border-b border-nexus-border flex items-center justify-between bg-nexus-surface-secondary/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-nexus-warning/15 border border-nexus-warning/30 flex items-center justify-center text-nexus-warning">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-nexus-warning">
                  BREAKPOINT · {breakpoint.id}
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-nexus-surface text-nexus-text-secondary border border-nexus-border">
                  Magnitude: {breakpoint.magnitude}%
                </span>
              </div>
              <h3 className="text-base font-bold text-nexus-text-primary mt-0.5">
                Mutation Inflection Detail
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-nexus-surface border border-nexus-border text-nexus-muted hover:text-nexus-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Scrollable */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Transition Header */}
          <div className="rounded-xl bg-nexus-surface-secondary/70 border border-nexus-border p-4">
            <span className="text-[10px] font-mono uppercase text-nexus-muted mb-2 block">
              Narrative State Transition
            </span>
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-nexus-surface/80 border border-nexus-border">
                <span className="text-[10px] uppercase font-mono text-nexus-muted block mb-1">
                  Previous Framing:
                </span>
                <p className="text-xs text-nexus-text-secondary font-medium">
                  {breakpoint.previousStateTitle}
                </p>
              </div>

              <div className="flex justify-center my-1">
                <ArrowRight className="w-4 h-4 text-nexus-accent rotate-90 md:rotate-0" />
              </div>

              <div className="p-3 rounded-lg bg-nexus-surface/80 border border-nexus-warning/40">
                <span className="text-[10px] uppercase font-mono text-nexus-warning block mb-1">
                  Mutated New Framing:
                </span>
                <p className="text-sm text-nexus-text-primary font-semibold">
                  {breakpoint.newStateTitle}
                </p>
              </div>
            </div>
          </div>

          {/* Metric Deltas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-nexus-surface-secondary/50 border border-nexus-border p-3.5">
              <span className="text-[10px] font-mono uppercase text-nexus-muted block mb-1">
                Sentiment Transition
              </span>
              <p className="text-xs font-semibold text-nexus-text-primary">
                <span className="capitalize">{breakpoint.sentimentDelta.from}</span> →{' '}
                <span className="capitalize text-nexus-accent">{breakpoint.sentimentDelta.to}</span>
              </p>
              <span className="text-[10px] text-nexus-muted mt-1 block">
                Net score delta: {breakpoint.sentimentDelta.scoreDelta > 0 ? '+' : ''}
                {breakpoint.sentimentDelta.scoreDelta}
              </span>
            </div>

            <div className="rounded-xl bg-nexus-surface-secondary/50 border border-nexus-border p-3.5">
              <span className="text-[10px] font-mono uppercase text-nexus-muted block mb-1">
                Emotional Pivot
              </span>
              <p className="text-xs font-semibold text-nexus-text-primary">
                <span className="capitalize">{breakpoint.emotionDelta.from}</span> →{' '}
                <span className="capitalize text-nexus-accent">{breakpoint.emotionDelta.to}</span>
              </p>
              <span className="text-[10px] text-nexus-muted mt-1 block">
                Platform: <strong className="text-nexus-text-secondary uppercase">{breakpoint.platform}</strong>
              </span>
            </div>
          </div>

          {/* Keyword & Entity Diffs */}
          <div className="rounded-xl bg-nexus-surface-secondary/50 border border-nexus-border p-4">
            <span className="text-[10px] font-mono uppercase text-nexus-muted mb-2.5 block">
              Linguistic & Vocabulary Shifts
            </span>
            <div className="space-y-3">
              <div>
                <span className="text-[11px] text-nexus-positive font-medium block mb-1.5">
                  + New Emerging Keywords:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {breakpoint.addedKeywords.length > 0 ? (
                    breakpoint.addedKeywords.map((k) => (
                      <span
                        key={k}
                        className="text-[11px] px-2 py-0.5 rounded bg-nexus-positive/10 text-nexus-positive border border-nexus-positive/25 font-mono"
                      >
                        +{k}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-nexus-muted">No new top keywords</span>
                  )}
                </div>
              </div>

              {breakpoint.removedKeywords.length > 0 && (
                <div>
                  <span className="text-[11px] text-nexus-negative font-medium block mb-1.5">
                    - Faded / Replaced Keywords:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {breakpoint.removedKeywords.map((k) => (
                      <span
                        key={k}
                        className="text-[11px] px-2 py-0.5 rounded bg-nexus-negative/10 text-nexus-negative border border-nexus-negative/25 line-through font-mono"
                      >
                        -{k}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Triggering Posts */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono uppercase text-nexus-muted">
                Triggering Posts ({breakpoint.triggeringPostIds.length})
              </span>
              <span className="text-[10px] text-nexus-muted">
                Observed displacement anchors
              </span>
            </div>

            <div className="space-y-3">
              {triggeringTimelinePosts.length > 0 ? (
                triggeringTimelinePosts.map((p) => (
                  <div
                    key={p.postId}
                    className="p-4 rounded-xl bg-nexus-surface-secondary/70 border border-nexus-border text-xs"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-nexus-muted" />
                        <span className="font-semibold text-nexus-text-primary">
                          {p.authorDisplayName || p.authorUsername}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-nexus-surface text-nexus-muted border border-nexus-border">
                          {p.platform}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-nexus-muted">
                        {new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
                      </span>
                    </div>

                    <p className="text-nexus-text-secondary leading-relaxed mb-2">
                      &ldquo;{p.contentSnippet}&rdquo;
                    </p>

                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="px-1.5 py-0.5 rounded bg-nexus-surface text-nexus-muted border border-nexus-border capitalize">
                        Sentiment: {p.sentiment}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-nexus-surface text-nexus-muted border border-nexus-border capitalize">
                        Emotion: {p.emotion}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-xl bg-nexus-surface-secondary/40 border border-nexus-border text-xs text-nexus-muted">
                  Triggering post IDs: {breakpoint.triggeringPostIds.join(', ')}
                </div>
              )}
            </div>
          </div>

          {/* Why Summary */}
          <div className="rounded-xl bg-nexus-surface-secondary/60 border border-nexus-border p-4">
            <span className="text-[10px] font-mono uppercase text-nexus-accent mb-2 block flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Evidence-Grounded Shift Summary</span>
            </span>
            <ul className="space-y-1.5 text-xs text-nexus-text-secondary">
              {breakpoint.whySummary.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-nexus-accent font-bold">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
