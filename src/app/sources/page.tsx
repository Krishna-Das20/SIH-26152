'use client';

import React, { useState, useEffect } from 'react';
import { NexusLayout, TopBar, MetricCard, SectionHeader } from '@/components/nexus';
import { Activity, CheckCircle, Lock, Info, ExternalLink } from 'lucide-react';

interface PlatformInfo {
  platform: string;
  displayName: string;
  tier: 'essential' | 'desirable' | 'appreciable';
  configured: boolean;
  worksWithoutCredentials: boolean;
  cost: string;
  targetHint?: string;
  setupDoc?: string;
  notes?: string;
}

export default function SourcesPage() {
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/platforms')
      .then((r) => r.json())
      .then((d) => {
        setPlatforms(d.platforms || []);
        setSummary(d.summary || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <NexusLayout>
      <TopBar
        title="Data Sources & Connectors"
        subtitle="Live platform connectors, credential status, and ingestion capabilities across all 6 channels."
      />
      <main className="px-8 py-6 max-w-7xl">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Activity className="w-6 h-6 text-nexus-muted animate-pulse" />
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <MetricCard label="Total Connectors" value={platforms.length || 6} />
              <MetricCard
                label="Active / Live Channels"
                value={platforms.filter((p) => p.configured || p.worksWithoutCredentials).length}
                subtitle="Ready for ingestion"
              />
              <MetricCard
                label="Zero-Setup Channels"
                value={platforms.filter((p) => p.worksWithoutCredentials).length}
                subtitle="Public scrape without API keys"
              />
              <MetricCard
                label="Credentialed Connectors"
                value={platforms.filter((p) => !p.worksWithoutCredentials).length}
                subtitle="Requires API credentials"
              />
            </div>

            {/* Platform List */}
            <div className="space-y-3">
              {platforms.map((p) => {
                const isLive = p.configured || p.worksWithoutCredentials;

                return (
                  <div
                    key={p.platform}
                    className="nexus-surface rounded-xl p-6 border border-nexus-border flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-nexus-border/80 nexus-transition"
                  >
                    <div className="flex items-start gap-4 flex-1">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0 ${
                          isLive
                            ? 'bg-nexus-positive/10 border-nexus-positive/30 text-nexus-positive'
                            : 'bg-nexus-warning/10 border-nexus-warning/30 text-nexus-warning'
                        }`}
                      >
                        {isLive ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <Lock className="w-5 h-5" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-[15px] font-semibold text-nexus-text-primary">
                            {p.displayName}
                          </h3>
                          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-nexus-surface-secondary text-nexus-muted border border-nexus-border">
                            Tier: {p.tier}
                          </span>
                          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-nexus-surface-secondary text-nexus-muted border border-nexus-border">
                            Cost: {p.cost}
                          </span>
                        </div>
                        <p className="text-[12px] text-nexus-text-secondary leading-relaxed">
                          {p.notes}
                        </p>
                        {p.targetHint && (
                          <p className="text-[11px] text-nexus-muted mt-1">
                            <span className="text-nexus-text-secondary font-medium">Input Target:</span> {p.targetHint}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider ${
                          isLive
                            ? 'bg-nexus-positive/10 text-nexus-positive border border-nexus-positive/20'
                            : 'bg-nexus-warning/10 text-nexus-warning border border-nexus-warning/20'
                        }`}
                      >
                        {isLive ? 'LIVE' : 'CREDENTIALS NEEDED'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </NexusLayout>
  );
}
