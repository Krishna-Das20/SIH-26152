'use client';

import React from 'react';
import { ShieldCheck, CheckCircle2, FileText, ArrowRight, ExternalLink } from 'lucide-react';

interface EvidenceStep {
  step: string;
  detail: string;
  metric?: string;
  verified: boolean;
}

interface Props {
  evidenceChain: EvidenceStep[];
  whyMutated: string[];
}

export function EvidenceChainViewer({ evidenceChain, whyMutated }: Props) {
  return (
    <div className="space-y-6">
      {/* "Why Did It Mutate?" Section */}
      <div className="skynet-surface rounded-xl p-6 border border-skynet-border">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-skynet-accent/15 flex items-center justify-center text-skynet-accent">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-skynet-text-primary">
              Why the Narrative Mutated
            </h3>
            <p className="text-[11px] text-skynet-muted">
              Factual, evidence-based reasoning derived strictly from observed corpus signals.
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {whyMutated.map((reason, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 p-3 rounded-lg bg-skynet-surface-secondary/50 border border-skynet-border/60 text-xs text-skynet-text-secondary leading-relaxed"
            >
              <span className="font-mono font-bold text-skynet-accent flex-shrink-0 mt-0.5">
                0{idx + 1}.
              </span>
              <span>{reason}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 6-Stage Evidence Chain */}
      <div className="skynet-surface rounded-xl p-6 border border-skynet-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-skynet-text-primary">
              Verifiable Evidence Chain
            </h3>
            <p className="text-[11px] text-skynet-muted">
              Step-by-step mathematical & empirical lineage from ingestion to narrative mutation.
            </p>
          </div>
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-skynet-positive/10 text-skynet-positive border border-skynet-positive/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Verified Lineage</span>
          </span>
        </div>

        <div className="space-y-3">
          {evidenceChain.map((item, idx) => (
            <div
              key={idx}
              className="flex items-start justify-between gap-4 p-3.5 rounded-lg bg-skynet-surface-secondary/40 border border-skynet-border hover:bg-skynet-surface-secondary/70 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-skynet-surface border border-skynet-border flex items-center justify-center text-[10px] font-mono font-bold text-skynet-muted flex-shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-skynet-text-primary mb-0.5">
                    {item.step}
                  </h4>
                  <p className="text-[11px] text-skynet-text-secondary leading-relaxed">
                    {item.detail}
                  </p>
                </div>
              </div>

              {item.metric && (
                <span className="text-[11px] font-mono px-2 py-1 rounded bg-skynet-surface text-skynet-accent border border-skynet-border flex-shrink-0">
                  {item.metric}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
