'use client';

import React, { useState, useEffect } from 'react';
import { SkynetLayout, TopBar, SectionHeader } from '@/components/skynet';
import { Activity, FileText, AlertTriangle, Info, AlertCircle } from 'lucide-react';

interface Finding {
  id: string;
  vectors: string[];
  severity: 'high' | 'notable' | 'info';
  headline: string;
  detail: string;
  evidence?: any;
}

interface BriefData {
  corpusSize: number;
  generatedAt: string;
  engine: string;
  graph: { nodes: number; links: number; communities: number; isolatedAccounts: number; modularity: number };
  findingCount: number;
  findings: Finding[];
  note?: string;
}

const SEVERITY_CONFIG = {
  high: { icon: AlertTriangle, color: 'text-skynet-negative', bg: 'bg-skynet-negative/5', border: 'border-skynet-negative/20', label: 'HIGH' },
  notable: { icon: AlertCircle, color: 'text-skynet-warning', bg: 'bg-skynet-warning/5', border: 'border-skynet-warning/20', label: 'NOTABLE' },
  info: { icon: Info, color: 'text-skynet-accent-steel', bg: 'bg-skynet-accent-steel/5', border: 'border-skynet-accent-steel/20', label: 'INFO' },
};

export default function BriefPage() {
  const [data, setData] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics/brief')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <SkynetLayout>
      <TopBar title="Intelligence Brief" subtitle="Cross-vector analysis synthesizing sentiment, trends, demographics, network, and narratives." />
      <main className="px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Activity className="w-6 h-6 text-skynet-muted animate-pulse" />
          </div>
        ) : data ? (
          <>
            {/* Meta */}
            <div className="flex flex-wrap gap-6 text-[11px] text-skynet-muted mb-8 px-1">
              <span>Corpus: <span className="text-skynet-text-secondary">{data.corpusSize} posts</span></span>
              <span>Engine: <span className="text-skynet-text-secondary">{data.engine}</span></span>
              <span>Graph: <span className="text-skynet-text-secondary">{data.graph.nodes} nodes, {data.graph.links} edges, {data.graph.communities} communities</span></span>
              <span>Modularity: <span className="text-skynet-text-secondary">{data.graph.modularity?.toFixed(2)}</span></span>
              <span>Generated: <span className="text-skynet-text-secondary">{new Date(data.generatedAt).toLocaleString()}</span></span>
            </div>

            {/* Findings */}
            {data.findings.length > 0 ? (
              <div className="space-y-4">
                {data.findings.map((finding, i) => {
                  const config = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.info;
                  const Icon = config.icon;
                  return (
                    <div key={finding.id || i} className={`skynet-surface rounded-xl p-6 border ${config.border}`}>
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${config.bg}`}>
                          <Icon className={`w-4 h-4 ${config.color}`} strokeWidth={1.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-medium uppercase tracking-wider ${config.color}`}>
                              {config.label}
                            </span>
                            {finding.vectors.map(v => (
                              <span key={v} className="text-[9px] px-1.5 py-0.5 rounded bg-skynet-surface-secondary text-skynet-muted border border-skynet-border">
                                {v}
                              </span>
                            ))}
                          </div>
                          <h3 className="text-[14px] font-medium text-skynet-text-primary mb-2">
                            {finding.headline}
                          </h3>
                          <p className="text-[12px] text-skynet-text-secondary leading-relaxed">
                            {finding.detail}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="skynet-surface rounded-xl p-10 text-center">
                <FileText className="w-8 h-8 text-skynet-muted mx-auto mb-3" strokeWidth={1} />
                <p className="text-skynet-text-secondary text-sm">No cross-vector findings</p>
                <p className="text-skynet-muted text-xs mt-1 max-w-lg mx-auto">
                  {data.note || 'No patterns crossed their significance threshold on this corpus. This is a real result.'}
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-skynet-muted text-sm">Unable to generate intelligence brief.</p>
        )}
      </main>
    </SkynetLayout>
  );
}
