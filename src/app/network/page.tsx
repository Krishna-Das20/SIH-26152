'use client';

import React, { useState, useEffect } from 'react';
import { NexusLayout, TopBar, MetricCard, SectionHeader } from '@/components/nexus';
import { Activity, Network as NetworkIcon, Award, Users } from 'lucide-react';

export default function NetworkPage() {
  const [topology, setTopology] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics/graph')
      .then((r) => r.json())
      .then((d) => {
        setTopology(d.topology || null);
        setMeta(d.meta || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <NexusLayout>
      <TopBar
        title="Network Topology"
        subtitle="Louvain community detection, Brandes betweenness, and Key Opinion Leader centrality."
      />
      <main className="px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Activity className="w-6 h-6 text-nexus-muted animate-pulse" />
          </div>
        ) : topology ? (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <MetricCard label="Observed Nodes" value={topology.nodes?.length || meta?.totalNodes || 0} />
              <MetricCard label="Interaction Edges" value={topology.links?.length || meta?.totalLinks || 0} />
              <MetricCard
                label="Communities"
                value={topology.communities?.length || meta?.communitiesCount || 0}
                subtitle="Louvain modularity partition"
              />
              <MetricCard
                label="Graph Modularity"
                value={topology.modularity !== undefined ? topology.modularity.toFixed(4) : '—'}
                subtitle={topology.modularity > 0.3 ? 'High community clustering (Q > 0.3)' : undefined}
              />
            </div>

            {/* Top KOLs */}
            {topology.topKOLs && topology.topKOLs.length > 0 && (
              <div className="nexus-surface rounded-xl p-6 mb-8">
                <SectionHeader
                  title="Key Opinion Leaders (KOLs)"
                  subtitle="Ranked by Brandes betweenness centrality and interaction reach."
                />
                <div className="space-y-0">
                  {topology.topKOLs.map((kol: any, i: number) => (
                    <div
                      key={kol.id || kol.username || i}
                      className="flex items-center justify-between py-3.5 border-b border-nexus-border last:border-0 hover:bg-nexus-surface-secondary/30 nexus-transition px-2 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-mono text-nexus-muted w-5">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <p className="text-[13px] text-nexus-text-primary font-medium">
                            {kol.displayName || kol.username || kol.id}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-nexus-surface-secondary text-nexus-muted border border-nexus-border">
                              {kol.platform}
                            </span>
                            {kol.betweennessRank && (
                              <span className="text-[10px] text-nexus-muted">
                                Centrality Rank #{kol.betweennessRank}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <span className="text-[13px] font-semibold text-nexus-text-primary nexus-metric">
                            {kol.influenceScore !== undefined ? kol.influenceScore : '—'}
                          </span>
                          <p className="text-[10px] text-nexus-muted">Influence Score</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Communities */}
            {topology.communities && topology.communities.length > 0 && (
              <div className="nexus-surface rounded-xl p-6">
                <SectionHeader
                  title="Louvain Community Partition"
                  subtitle={`${topology.communities.length} clusters identified with strong intra-community density`}
                />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {topology.communities.slice(0, 8).map((comm: any, i: number) => {
                    const memberCount = comm.members?.length || comm.size || 0;
                    return (
                      <div
                        key={comm.id ?? i}
                        className="rounded-xl bg-nexus-surface-secondary/60 border border-nexus-border p-4 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="nexus-label">Community {comm.id ?? i + 1}</span>
                            <span className="text-[10px] text-nexus-muted font-mono">
                              C0{i + 1}
                            </span>
                          </div>
                          <p className="text-2xl font-bold text-nexus-text-primary nexus-metric">
                            {memberCount}
                          </p>
                          <p className="text-[11px] text-nexus-text-secondary mt-0.5">
                            account nodes
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="nexus-surface rounded-xl p-10 text-center">
            <NetworkIcon className="w-8 h-8 text-nexus-muted mx-auto mb-3" strokeWidth={1} />
            <p className="text-nexus-text-secondary text-sm">No network data available.</p>
          </div>
        )}
      </main>
    </NexusLayout>
  );
}
