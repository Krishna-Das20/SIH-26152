'use client';

import React, { useState, useEffect } from 'react';
import { NexusLayout, TopBar, SectionHeader } from '@/components/nexus';
import { Activity, Users } from 'lucide-react';

export default function AudiencePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics/demographics')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <NexusLayout>
      <TopBar title="Audience Demographics" subtitle="Automated demographic profiling from observed social signals." />
      <main className="px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Activity className="w-6 h-6 text-nexus-muted animate-pulse" />
          </div>
        ) : data ? (
          <>
            {/* Coverage notice */}
            {data.inferenceCoverage !== undefined && (
              <div className="nexus-surface rounded-xl p-4 mb-6 flex items-center gap-3">
                <div className="nexus-dot bg-nexus-warning" />
                <span className="text-[12px] text-nexus-text-secondary">
                  Inference coverage: <span className="text-nexus-text-primary font-medium nexus-metric">
                    {typeof data.inferenceCoverage === 'number'
                      ? `${(data.inferenceCoverage * 100).toFixed(0)}%`
                      : 'Unknown'}
                  </span>
                  <span className="text-nexus-muted ml-2">
                    — Demographic profiling uses regex and lexicon analysis. Unknown values are labeled honestly.
                  </span>
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Age Groups */}
              <div className="nexus-surface rounded-xl p-6">
                <SectionHeader title="Age Distribution" />
                {(data.ageGroups || []).length > 0 ? (
                  <div className="space-y-3">
                    {data.ageGroups.map((ag: any) => {
                      const total = data.ageGroups.reduce((s: number, g: any) => s + g.count, 0) || 1;
                      const pct = Math.round((ag.count / total) * 100);
                      return (
                        <div key={ag.bracket || ag.name}>
                          <div className="flex justify-between mb-1">
                            <span className="text-[12px] text-nexus-text-secondary">{ag.bracket || ag.name}</span>
                            <span className="text-[12px] text-nexus-text-primary nexus-metric">{ag.count} ({pct}%)</span>
                          </div>
                          <div className="h-1.5 bg-nexus-surface-secondary rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-nexus-accent-steel" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[12px] text-nexus-muted py-4">Insufficient data for age distribution.</p>
                )}
              </div>

              {/* Languages */}
              <div className="nexus-surface rounded-xl p-6">
                <SectionHeader title="Detected Languages" />
                {(data.languages || []).length > 0 ? (
                  <div className="space-y-2">
                    {data.languages.map((lang: any) => (
                      <div key={lang.language || lang.name} className="flex items-center justify-between py-1.5 border-b border-nexus-border last:border-0">
                        <span className="text-[12px] text-nexus-text-secondary">{lang.language || lang.name}</span>
                        <span className="text-[12px] text-nexus-text-primary nexus-metric">{lang.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-nexus-muted py-4">No language data available.</p>
                )}
              </div>

              {/* Geographic Distribution */}
              <div className="nexus-surface rounded-xl p-6">
                <SectionHeader title="Geographic Signals" />
                {(data.geographicDistribution || []).length > 0 ? (
                  <div className="space-y-2">
                    {data.geographicDistribution.map((geo: any) => (
                      <div key={geo.location || geo.name} className="flex items-center justify-between py-1.5 border-b border-nexus-border last:border-0">
                        <span className="text-[12px] text-nexus-text-secondary">{geo.location || geo.name}</span>
                        <span className="text-[12px] text-nexus-text-primary nexus-metric">{geo.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-nexus-muted py-4">Insufficient data for geographic signals.</p>
                )}
              </div>

              {/* Interests */}
              <div className="nexus-surface rounded-xl p-6">
                <SectionHeader title="Interest Clusters" />
                {(data.interestClusters || []).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {data.interestClusters.map((ic: any) => (
                      <span key={ic.interest || ic.name} className="text-[11px] px-3 py-1 rounded-md bg-nexus-surface-secondary text-nexus-text-secondary border border-nexus-border">
                        {ic.interest || ic.name}
                        <span className="text-nexus-muted ml-1">({ic.count})</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-nexus-muted py-4">No interest clusters detected.</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="nexus-surface rounded-xl p-10 text-center">
            <Users className="w-8 h-8 text-nexus-muted mx-auto mb-3" strokeWidth={1} />
            <p className="text-nexus-text-secondary text-sm">No demographic data available.</p>
          </div>
        )}
      </main>
    </NexusLayout>
  );
}
