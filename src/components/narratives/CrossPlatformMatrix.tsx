'use client';

import React from 'react';
import { CrossPlatformComparison } from '@/lib/narratives/types';
import { Split, MessageCircle, ArrowUpRight } from 'lucide-react';

interface Props {
  matrix: CrossPlatformComparison[];
}

export function CrossPlatformMatrix({ matrix }: Props) {
  if (matrix.length === 0) return null;

  return (
    <div className="nexus-surface rounded-xl p-6 border border-nexus-border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-nexus-text-primary flex items-center gap-2">
            <Split className="w-4 h-4 text-nexus-accent" />
            <span>Cross-Platform Narrative Framing Matrix</span>
          </h3>
          <p className="text-[11px] text-nexus-muted mt-0.5">
            Observes how different platforms frame and contextualize the same underlying narrative.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-nexus-border text-[10px] font-mono uppercase text-nexus-muted">
              <th className="pb-3 pr-4">Platform</th>
              <th className="pb-3 px-4">Volume</th>
              <th className="pb-3 px-4">Stance & Emotion</th>
              <th className="pb-3 px-4">Top Focus Keywords</th>
              <th className="pb-3 px-4">Divergence</th>
              <th className="pb-3 pl-4">Sample Framing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nexus-border/60 text-xs">
            {matrix.map((row) => (
              <tr key={row.platform} className="hover:bg-nexus-surface-secondary/40 transition-colors">
                <td className="py-3.5 pr-4">
                  <span className="font-semibold text-nexus-text-primary uppercase tracking-wider text-[11px]">
                    {row.platform}
                  </span>
                </td>

                <td className="py-3.5 px-4 font-mono text-nexus-text-primary">
                  {row.postCount} posts
                </td>

                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        row.dominantSentiment === 'positive'
                          ? 'bg-nexus-positive'
                          : row.dominantSentiment === 'negative'
                          ? 'bg-nexus-negative'
                          : 'bg-nexus-accent-steel'
                      }`}
                    />
                    <span className="capitalize font-medium text-nexus-text-primary">
                      {row.dominantSentiment}
                    </span>
                    {row.dominantEmotion && (
                      <span className="text-[10px] text-nexus-muted">
                        ({row.dominantEmotion})
                      </span>
                    )}
                  </div>
                </td>

                <td className="py-3.5 px-4">
                  <div className="flex flex-wrap gap-1">
                    {row.topKeywords.slice(0, 3).map((kw) => (
                      <span
                        key={kw}
                        className="text-[10px] px-1.5 py-0.2 rounded bg-nexus-surface-secondary text-nexus-text-secondary border border-nexus-border font-mono"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </td>

                <td className="py-3.5 px-4 font-mono">
                  <span
                    className={`font-semibold ${
                      row.divergenceScore >= 40
                        ? 'text-nexus-negative'
                        : row.divergenceScore >= 20
                        ? 'text-nexus-warning'
                        : 'text-nexus-positive'
                    }`}
                  >
                    {row.divergenceScore}%
                  </span>
                </td>

                <td className="py-3.5 pl-4 text-nexus-text-secondary italic text-[11px] max-w-xs truncate">
                  &ldquo;{row.sampleFramingSnippet}&rdquo;
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
