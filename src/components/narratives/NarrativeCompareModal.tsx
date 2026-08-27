'use client';

import React, { useState } from 'react';
import { Narrative } from '@/lib/narratives/types';
import { X, GitCompare, ArrowRight, ShieldCheck } from 'lucide-react';

interface Props {
  narratives: Narrative[];
  initialNarrativeId?: string;
  onClose: () => void;
}

export function NarrativeCompareModal({ narratives, initialNarrativeId, onClose }: Props) {
  const [selectedId1, setSelectedId1] = useState<string>(initialNarrativeId || narratives[0]?.id || '');
  const [selectedId2, setSelectedId2] = useState<string>(
    narratives.find((n) => n.id !== initialNarrativeId)?.id || narratives[1]?.id || ''
  );

  const n1 = narratives.find((n) => n.id === selectedId1);
  const n2 = narratives.find((n) => n.id === selectedId2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-skynet-surface border border-skynet-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-skynet-border flex items-center justify-between bg-skynet-surface-secondary/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-skynet-accent/15 border border-skynet-accent/30 flex items-center justify-center text-skynet-accent">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-skynet-text-primary">
                Narrative Comparison Engine
              </h3>
              <p className="text-xs text-skynet-muted">
                Side-by-side comparative analysis of semantic vectors, sentiment trajectory, and platform footprint.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-skynet-surface border border-skynet-border text-skynet-muted hover:text-skynet-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comparators */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Narrative Selector */}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-mono uppercase text-skynet-muted block mb-1.5">
                  Narrative A:
                </label>
                <select
                  value={selectedId1}
                  onChange={(e) => setSelectedId1(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-skynet-surface-secondary border border-skynet-border text-xs text-skynet-text-primary focus:outline-none focus:border-skynet-accent"
                >
                  {narratives.map((n) => (
                    <option key={n.id} value={n.id}>
                      [{n.id}] {n.title}
                    </option>
                  ))}
                </select>
              </div>

              {n1 && (
                <div className="p-4 rounded-xl bg-skynet-surface-secondary/50 border border-skynet-border space-y-3 text-xs">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-skynet-muted block">Title:</span>
                    <p className="font-semibold text-skynet-text-primary mt-0.5">{n1.title}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-skynet-border">
                    <div>
                      <span className="text-[10px] font-mono text-skynet-muted block">Volume:</span>
                      <span className="font-semibold text-skynet-text-primary">{n1.postCount} posts</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-skynet-muted block">Mutation:</span>
                      <span className="font-semibold text-skynet-accent">
                        {n1.mutationScore !== null ? `${n1.mutationScore}%` : 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-skynet-border">
                    <div>
                      <span className="text-[10px] font-mono text-skynet-muted block">Sentiment:</span>
                      <span className="capitalize font-medium text-skynet-text-primary">{n1.dominantSentiment}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-skynet-muted block">Emotion:</span>
                      <span className="capitalize font-medium text-skynet-text-primary">{n1.dominantEmotion || 'neutral'}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-skynet-border">
                    <span className="text-[10px] font-mono text-skynet-muted block mb-1">Keywords:</span>
                    <div className="flex flex-wrap gap-1">
                      {n1.keywordEvolution[0]?.keywords.slice(0, 4).map((k) => (
                        <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-skynet-surface text-skynet-text-secondary border border-skynet-border">
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Narrative Selector */}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-mono uppercase text-skynet-muted block mb-1.5">
                  Narrative B:
                </label>
                <select
                  value={selectedId2}
                  onChange={(e) => setSelectedId2(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-skynet-surface-secondary border border-skynet-border text-xs text-skynet-text-primary focus:outline-none focus:border-skynet-accent"
                >
                  {narratives.map((n) => (
                    <option key={n.id} value={n.id}>
                      [{n.id}] {n.title}
                    </option>
                  ))}
                </select>
              </div>

              {n2 && (
                <div className="p-4 rounded-xl bg-skynet-surface-secondary/50 border border-skynet-border space-y-3 text-xs">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-skynet-muted block">Title:</span>
                    <p className="font-semibold text-skynet-text-primary mt-0.5">{n2.title}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-skynet-border">
                    <div>
                      <span className="text-[10px] font-mono text-skynet-muted block">Volume:</span>
                      <span className="font-semibold text-skynet-text-primary">{n2.postCount} posts</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-skynet-muted block">Mutation:</span>
                      <span className="font-semibold text-skynet-accent">
                        {n2.mutationScore !== null ? `${n2.mutationScore}%` : 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-skynet-border">
                    <div>
                      <span className="text-[10px] font-mono text-skynet-muted block">Sentiment:</span>
                      <span className="capitalize font-medium text-skynet-text-primary">{n2.dominantSentiment}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-skynet-muted block">Emotion:</span>
                      <span className="capitalize font-medium text-skynet-text-primary">{n2.dominantEmotion || 'neutral'}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-skynet-border">
                    <span className="text-[10px] font-mono text-skynet-muted block mb-1">Keywords:</span>
                    <div className="flex flex-wrap gap-1">
                      {n2.keywordEvolution[0]?.keywords.slice(0, 4).map((k) => (
                        <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-skynet-surface text-skynet-text-secondary border border-skynet-border">
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
