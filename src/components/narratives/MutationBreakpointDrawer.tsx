'use client';

import React from 'react';
import { NarrativeBreakpoint, NarrativeTimelineEntry } from '@/lib/narratives/types';
import { X, Zap, ArrowRight, ShieldCheck, MessageSquare, User, Calendar, ExternalLink } from 'lucide-react';
import { getPostUrl, getParentSource } from '@/lib/urls';

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
      <div className="w-full max-w-2xl bg-skynet-surface border-l border-skynet-border h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-6 border-b border-skynet-border flex items-center justify-between bg-skynet-surface-secondary/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-skynet-warning/15 border border-skynet-warning/30 flex items-center justify-center text-skynet-warning">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-skynet-warning">
                  BREAKPOINT · {breakpoint.id}
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-skynet-surface text-skynet-text-secondary border border-skynet-border">
                  Magnitude: {breakpoint.magnitude}%
                </span>
              </div>
              <h3 className="text-base font-bold text-skynet-text-primary mt-0.5">
                Mutation Inflection Detail
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-skynet-surface border border-skynet-border text-skynet-muted hover:text-skynet-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Scrollable */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Transition Header */}
          <div className="rounded-xl bg-skynet-surface-secondary/70 border border-skynet-border p-4">
            <span className="text-[10px] font-mono uppercase text-skynet-muted mb-2 block">
              Narrative State Transition
            </span>
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-skynet-surface/80 border border-skynet-border">
                <span className="text-[10px] uppercase font-mono text-skynet-muted block mb-1">
                  Previous Framing:
                </span>
                <p className="text-xs text-skynet-text-secondary font-medium">
                  {breakpoint.previousStateTitle}
                </p>
              </div>

              <div className="flex justify-center my-1">
                <ArrowRight className="w-4 h-4 text-skynet-accent rotate-90 md:rotate-0" />
              </div>

              <div className="p-3 rounded-lg bg-skynet-surface/80 border border-skynet-warning/40">
                <span className="text-[10px] uppercase font-mono text-skynet-warning block mb-1">
                  Mutated New Framing:
                </span>
                <p className="text-sm text-skynet-text-primary font-semibold">
                  {breakpoint.newStateTitle}
                </p>
              </div>
            </div>
          </div>

          {/* Metric Deltas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-skynet-surface-secondary/50 border border-skynet-border p-3.5">
              <span className="text-[10px] font-mono uppercase text-skynet-muted block mb-1">
                Sentiment Transition
              </span>
              <p className="text-xs font-semibold text-skynet-text-primary">
                <span className="capitalize">{breakpoint.sentimentDelta.from}</span> →{' '}
                <span className="capitalize text-skynet-accent">{breakpoint.sentimentDelta.to}</span>
              </p>
              <span className="text-[10px] text-skynet-muted mt-1 block">
                Net score delta: {breakpoint.sentimentDelta.scoreDelta > 0 ? '+' : ''}
                {breakpoint.sentimentDelta.scoreDelta}
              </span>
            </div>

            <div className="rounded-xl bg-skynet-surface-secondary/50 border border-skynet-border p-3.5">
              <span className="text-[10px] font-mono uppercase text-skynet-muted block mb-1">
                Emotional Pivot
              </span>
              <p className="text-xs font-semibold text-skynet-text-primary">
                <span className="capitalize">{breakpoint.emotionDelta.from}</span> →{' '}
                <span className="capitalize text-skynet-accent">{breakpoint.emotionDelta.to}</span>
              </p>
              <span className="text-[10px] text-skynet-muted mt-1 block">
                Platform: <strong className="text-skynet-text-secondary uppercase">{breakpoint.platform}</strong>
              </span>
            </div>
          </div>

          {/* Keyword & Entity Diffs */}
          <div className="rounded-xl bg-skynet-surface-secondary/50 border border-skynet-border p-4">
            <span className="text-[10px] font-mono uppercase text-skynet-muted mb-2.5 block">
              Linguistic & Vocabulary Shifts
            </span>
            <div className="space-y-3">
              <div>
                <span className="text-[11px] text-skynet-positive font-medium block mb-1.5">
                  + New Emerging Keywords:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {breakpoint.addedKeywords.length > 0 ? (
                    breakpoint.addedKeywords.map((k) => (
                      <span
                        key={k}
                        className="text-[11px] px-2 py-0.5 rounded bg-skynet-positive/10 text-skynet-positive border border-skynet-positive/25 font-mono"
                      >
                        +{k}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-skynet-muted">No new top keywords</span>
                  )}
                </div>
              </div>

              {breakpoint.removedKeywords.length > 0 && (
                <div>
                  <span className="text-[11px] text-skynet-negative font-medium block mb-1.5">
                    - Faded / Replaced Keywords:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {breakpoint.removedKeywords.map((k) => (
                      <span
                        key={k}
                        className="text-[11px] px-2 py-0.5 rounded bg-skynet-negative/10 text-skynet-negative border border-skynet-negative/25 line-through font-mono"
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
              <span className="text-[10px] font-mono uppercase text-skynet-muted">
                Triggering Posts ({breakpoint.triggeringPostIds.length})
              </span>
              <span className="text-[10px] text-skynet-muted">
                Observed displacement anchors
              </span>
            </div>

            <div className="space-y-3">
              {triggeringTimelinePosts.length > 0 ? (
                triggeringTimelinePosts.map((p) => (
                  <div
                    key={p.postId}
                    className="p-4 rounded-xl bg-skynet-surface-secondary/70 border border-skynet-border text-xs"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-skynet-muted" />
                        <span className="font-semibold text-skynet-text-primary">
                          {p.authorDisplayName || p.authorUsername}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-skynet-surface text-skynet-muted border border-skynet-border">
                          {p.platform}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-skynet-muted">
                        {new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
                      </span>
                    </div>

                    <p className="text-skynet-text-secondary leading-relaxed mb-2">
                      &ldquo;{p.contentSnippet}&rdquo;
                    </p>

                    {/* Source post link if comment */}
                    {(() => {
                      const directUrl = getPostUrl({ id: p.postId, platform: p.platform, url: p.url, inReplyToPostId: p.inReplyToPostId });
                      const parentSource = getParentSource({ id: p.postId, platform: p.platform, url: p.url, inReplyToPostId: p.inReplyToPostId });

                      return (
                        <div className="space-y-1.5 mb-2.5">
                          {parentSource && parentSource.url && (
                            <div className="p-1.5 rounded bg-skynet-surface border border-skynet-border/60 flex items-center justify-between text-[10px]">
                              <span className="text-skynet-muted">
                                From {parentSource.label}: <strong className="text-skynet-text-secondary font-mono">{parentSource.id}</strong>
                              </span>
                              <a
                                href={parentSource.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-skynet-accent hover:underline flex items-center gap-1 font-medium"
                              >
                                <span>Source</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                          )}

                          {directUrl && (
                            <a
                              href={directUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-skynet-accent hover:underline"
                            >
                              <span>Open Original Post</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      );
                    })()}

                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="px-1.5 py-0.5 rounded bg-skynet-surface text-skynet-muted border border-skynet-border capitalize">
                        Sentiment: {p.sentiment}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-skynet-surface text-skynet-muted border border-skynet-border capitalize">
                        Emotion: {p.emotion}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-xl bg-skynet-surface-secondary/40 border border-skynet-border text-xs text-skynet-muted">
                  Triggering post IDs: {breakpoint.triggeringPostIds.join(', ')}
                </div>
              )}
            </div>
          </div>

          {/* Why Summary */}
          <div className="rounded-xl bg-skynet-surface-secondary/60 border border-skynet-border p-4">
            <span className="text-[10px] font-mono uppercase text-skynet-accent mb-2 block flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Evidence-Grounded Shift Summary</span>
            </span>
            <ul className="space-y-1.5 text-xs text-skynet-text-secondary">
              {breakpoint.whySummary.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-skynet-accent font-bold">·</span>
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
