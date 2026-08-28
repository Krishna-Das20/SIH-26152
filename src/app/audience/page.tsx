'use client';

import React, { useState, useEffect } from 'react';
import { SkynetLayout, TopBar, SectionHeader } from '@/components/skynet';
import { Activity, Users, MapPin, Globe, Compass, BarChart3, ShieldCheck } from 'lucide-react';

export default function AudiencePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics/demographics')
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <SkynetLayout>
      <TopBar
        title="Audience Demographics"
        subtitle="Automated demographic profiling and socio-linguistic mapping from observed social intelligence signals."
      />
      <main className="px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <Activity className="w-7 h-7 text-nexus-muted animate-pulse mx-auto mb-3" />
              <p className="text-xs text-nexus-text-secondary">Profiling audience signals across channels…</p>
            </div>
          </div>
        ) : data ? (
          <>
            {/* Top KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="nexus-surface rounded-xl p-4 border border-nexus-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wider text-nexus-muted font-mono">Sampled Audience</span>
                  <Users className="w-4 h-4 text-nexus-accent-cyan" />
                </div>
                <div className="text-2xl font-bold text-nexus-text-primary font-mono">
                  {(data.totalAudienceSampled || 0).toLocaleString()}
                </div>
                <span className="text-[10px] text-nexus-muted">Unique Authors & Commenters</span>
              </div>

              <div className="nexus-surface rounded-xl p-4 border border-nexus-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wider text-nexus-muted font-mono">Language Coverage</span>
                  <Globe className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-emerald-400 font-mono">
                  {data.coverage?.language ?? 0}%
                </div>
                <span className="text-[10px] text-nexus-muted">Identified Natural Dialects</span>
              </div>

              <div className="nexus-surface rounded-xl p-4 border border-nexus-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wider text-nexus-muted font-mono">Geo Signals</span>
                  <MapPin className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-amber-400 font-mono">
                  {data.coverage?.location ?? 0}%
                </div>
                <span className="text-[10px] text-nexus-muted">Explicit Location Matches</span>
              </div>

              <div className="nexus-surface rounded-xl p-4 border border-nexus-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wider text-nexus-muted font-mono">Interest Affinity</span>
                  <Compass className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-purple-400 font-mono">
                  {data.coverage?.interests ?? 0}%
                </div>
                <span className="text-[10px] text-nexus-muted">Topical Category Matches</span>
              </div>
            </div>

            {/* Coverage note */}
            <div className="nexus-surface rounded-xl p-4 mb-6 flex items-center justify-between gap-3 border border-nexus-border/60 bg-nexus-surface/50">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-nexus-accent-cyan flex-shrink-0" />
                <span className="text-[12px] text-nexus-text-secondary">
                  Demographic inferences are generated strictly through linguistic markers, script recognition, and explicit entity matching.
                  Unasserted dimensions are truthfully labeled as <span className="text-nexus-text-primary font-mono font-medium">Unknown</span> without synthetic guessing.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Age Distribution */}
              <div className="nexus-surface rounded-xl p-6 border border-nexus-border">
                <SectionHeader title="Age Distribution" />
                {(data.ageGroups || []).length > 0 ? (
                  <div className="space-y-3.5 mt-4">
                    {data.ageGroups.map((ag: any) => {
                      const total = data.ageGroups.reduce((s: number, g: any) => s + (g.count || 0), 0) || 1;
                      const pct = ag.percentage ?? Math.round(((ag.count || 0) / total) * 100);
                      const isUnknown = ag.bracket === 'Unknown';
                      return (
                        <div key={ag.bracket || ag.name}>
                          <div className="flex justify-between mb-1.5 items-center">
                            <span className={`text-[12px] font-mono ${isUnknown ? 'text-nexus-muted' : 'text-nexus-text-primary font-medium'}`}>
                              {ag.bracket || ag.name}
                            </span>
                            <span className="text-[12px] text-nexus-text-primary font-mono">
                              {ag.count} <span className="text-nexus-muted text-[10px]">({pct}%)</span>
                            </span>
                          </div>
                          <div className="h-2 bg-nexus-surface-secondary rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isUnknown ? 'bg-nexus-muted/40' : 'bg-gradient-to-r from-nexus-accent-cyan to-blue-500'
                              }`}
                              style={{ width: `${Math.max(pct, 1)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[12px] text-nexus-muted py-4">Insufficient data for age distribution.</p>
                )}
              </div>

              {/* Detected Languages */}
              <div className="nexus-surface rounded-xl p-6 border border-nexus-border">
                <SectionHeader title="Detected Languages & Scripts" />
                {(data.languages || []).length > 0 ? (
                  <div className="space-y-3 mt-4">
                    {data.languages.map((lang: any) => {
                      const total = data.languages.reduce((s: number, l: any) => s + (l.count || 0), 0) || 1;
                      const pct = lang.percentage ?? Math.round(((lang.count || 0) / total) * 100);
                      const isUnknown = lang.language === 'Unknown' || lang.name === 'Unknown';
                      return (
                        <div key={lang.language || lang.name}>
                          <div className="flex justify-between mb-1.5 items-center">
                            <span className={`text-[12px] ${isUnknown ? 'text-nexus-muted' : 'text-nexus-text-primary font-medium'}`}>
                              {lang.language || lang.name}
                            </span>
                            <span className="text-[12px] text-nexus-text-primary font-mono">
                              {lang.count} <span className="text-nexus-muted text-[10px]">({pct}%)</span>
                            </span>
                          </div>
                          <div className="h-2 bg-nexus-surface-secondary rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isUnknown ? 'bg-nexus-muted/40' : 'bg-gradient-to-r from-emerald-400 to-teal-500'
                              }`}
                              style={{ width: `${Math.max(pct, 1)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[12px] text-nexus-muted py-4">No language data available.</p>
                )}
              </div>

              {/* Geographic Distribution */}
              <div className="nexus-surface rounded-xl p-6 border border-nexus-border">
                <SectionHeader title="Geographic Signals & Regional Clusters" />
                {(data.geographicDistribution || []).length > 0 ? (
                  <div className="space-y-2.5 mt-4 max-h-80 overflow-y-auto pr-1">
                    {data.geographicDistribution.map((geo: any) => {
                      const locName = geo.region || geo.location || geo.name || 'Unknown';
                      const isUnknown = locName === 'Unknown';
                      return (
                        <div
                          key={locName}
                          className="flex items-center justify-between py-2 px-3 rounded-lg bg-nexus-surface-secondary/40 border border-nexus-border/40"
                        >
                          <div className="flex items-center gap-2">
                            <MapPin className={`w-3.5 h-3.5 ${isUnknown ? 'text-nexus-muted' : 'text-amber-400'}`} />
                            <span className={`text-[12px] ${isUnknown ? 'text-nexus-muted' : 'text-nexus-text-primary font-medium'}`}>
                              {locName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] text-nexus-text-primary font-mono">{geo.count}</span>
                            {geo.percentage !== undefined && (
                              <span className="text-[10px] text-nexus-muted font-mono">({geo.percentage}%)</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[12px] text-nexus-muted py-4">Insufficient data for geographic signals.</p>
                )}
              </div>

              {/* Interest Clusters */}
              <div className="nexus-surface rounded-xl p-6 border border-nexus-border">
                <SectionHeader title="Interest Clusters & Topical Affinities" />
                {(data.interestClusters || []).length > 0 ? (
                  <div className="space-y-3 mt-4">
                    {data.interestClusters.map((ic: any) => {
                      const topicName = ic.topic || ic.interest || ic.name || 'General';
                      const score = ic.affinityScore ?? ic.count ?? 0;
                      return (
                        <div key={topicName}>
                          <div className="flex justify-between mb-1 items-center">
                            <span className="text-[12px] text-nexus-text-primary font-medium">{topicName}</span>
                            <span className="text-[11px] text-purple-300 font-mono">
                              Affinity: {score}%
                            </span>
                          </div>
                          <div className="h-2 bg-nexus-surface-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all duration-500"
                              style={{ width: `${Math.min(score * 3, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[12px] text-nexus-muted py-4">No interest clusters detected.</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="nexus-surface rounded-xl p-12 text-center border border-nexus-border">
            <Users className="w-8 h-8 text-nexus-muted mx-auto mb-3" strokeWidth={1} />
            <p className="text-nexus-text-secondary text-sm">No demographic data available.</p>
          </div>
        )}
      </main>
    </SkynetLayout>
  );
}
