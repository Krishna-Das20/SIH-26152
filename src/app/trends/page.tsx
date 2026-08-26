'use client';

import React, { useState, useEffect } from 'react';
import { NexusLayout, TopBar, SectionHeader, MetricCard } from '@/components/nexus';
import { Activity, TrendingUp, ArrowUpRight, ArrowDownRight, Minus, Zap } from 'lucide-react';

interface TrendItem {
  id: string;
  keyword: string;
  category?: string;
  postCount: number;
  growthRate: number;
  sentimentScore: number;
  dominantEmotion: string;
  isSpike: boolean;
  zScore: number;
  firstDetectedAt: string;
  peakTime: string;
  platforms: string[];
}

export default function TrendsPage() {
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [method, setMethod] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics/trends')
      .then((r) => r.json())
      .then((d) => {
        setTrends(d.trends || []);
        setMethod(d.method || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const getStatus = (t: TrendItem) => {
    if (t.isSpike) return { label: 'SPIKE', color: 'text-nexus-negative', icon: Zap };
    if (t.zScore >= 2) return { label: 'EMERGING', color: 'text-nexus-positive', icon: ArrowUpRight };
    if (t.zScore > 0) return { label: 'RISING', color: 'text-nexus-accent', icon: ArrowUpRight };
    if (t.growthRate < 0) return { label: 'DECLINING', color: 'text-nexus-muted', icon: ArrowDownRight };
    return { label: 'STABLE', color: 'text-nexus-text-secondary', icon: Minus };
  };

  const sorted = [...trends].sort((a, b) => (b.zScore || 0) - (a.zScore || 0));

  return (
    <NexusLayout>
      <TopBar
        title="Trend Detection"
        subtitle="Z-score anomaly detection and keyword velocity across observed social content."
      />
      <main className="px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Activity className="w-6 h-6 text-nexus-muted animate-pulse" />
          </div>
        ) : sorted.length > 0 ? (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <MetricCard label="Active Trends" value={sorted.length} />
              <MetricCard
                label="Spikes Detected"
                value={sorted.filter((t) => t.isSpike).length}
                subtitle="z-score > 2 threshold"
              />
              <MetricCard
                label="Highest Velocity"
                value={sorted[0]?.keyword || '—'}
                subtitle={`z-score: ${sorted[0]?.zScore?.toFixed(2)}`}
              />
              <MetricCard
                label="Analysis Window"
                value={method ? `${method.bucketCount || 0} buckets` : '1440m'}
                subtitle="1-day aggregation buckets"
              />
            </div>

            {/* Trends Table */}
            <div className="nexus-surface rounded-xl overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-nexus-border bg-nexus-surface-secondary/40">
                <span className="col-span-1 nexus-label">#</span>
                <span className="col-span-4 nexus-label">Topic / Keyword</span>
                <span className="col-span-2 nexus-label">Status</span>
                <span className="col-span-2 nexus-label text-right">Mentions</span>
                <span className="col-span-1 nexus-label text-right">Z-Score</span>
                <span className="col-span-2 nexus-label text-right">Sentiment</span>
              </div>

              {sorted.map((trend, i) => {
                const status = getStatus(trend);
                const Icon = status.icon;
                const isPositive = trend.sentimentScore > 0.1;
                const isNegative = trend.sentimentScore < -0.1;

                return (
                  <div
                    key={trend.id || trend.keyword || i}
                    className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-nexus-border last:border-0 hover:bg-nexus-surface-secondary/30 nexus-transition items-center"
                  >
                    <span className="col-span-1 text-[12px] font-mono text-nexus-muted">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="col-span-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-nexus-text-primary font-medium">
                          {trend.keyword}
                        </span>
                        {trend.category && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-nexus-surface-secondary text-nexus-muted border border-nexus-border">
                            {trend.category}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {trend.platforms?.map((p) => (
                          <span key={p} className="text-[10px] text-nexus-muted">
                            {p}
                          </span>
                        ))}
                        {trend.dominantEmotion && (
                          <span className="text-[10px] text-nexus-muted">
                            · {trend.dominantEmotion}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="col-span-2 flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 ${status.color}`} />
                      <span className={`text-[11px] font-medium tracking-wide ${status.color}`}>
                        {status.label}
                      </span>
                    </div>

                    <span className="col-span-2 text-[13px] text-nexus-text-primary nexus-metric text-right">
                      {trend.postCount} posts
                    </span>

                    <span className="col-span-1 text-[12px] text-nexus-text-primary nexus-metric text-right font-medium">
                      {trend.zScore !== undefined ? trend.zScore.toFixed(2) : '—'}
                    </span>

                    <div className="col-span-2 text-right">
                      <span
                        className={`text-[12px] font-medium nexus-metric ${
                          isPositive
                            ? 'text-nexus-positive'
                            : isNegative
                            ? 'text-nexus-negative'
                            : 'text-nexus-text-secondary'
                        }`}
                      >
                        {trend.sentimentScore > 0 ? '+' : ''}
                        {trend.sentimentScore.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="nexus-surface rounded-xl p-10 text-center">
            <TrendingUp className="w-8 h-8 text-nexus-muted mx-auto mb-3" strokeWidth={1} />
            <p className="text-nexus-text-secondary text-sm">No trends detected</p>
            <p className="text-nexus-muted text-xs mt-1">
              Trends are computed from actual post volume using z-score detection.
            </p>
          </div>
        )}
      </main>
    </NexusLayout>
  );
}
