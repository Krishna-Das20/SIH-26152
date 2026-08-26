'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { NexusLayout, TopBar, MetricCard, SectionHeader } from '@/components/nexus';
import { BarChart3, Users, TrendingUp, AlertTriangle, Activity, FileText } from 'lucide-react';
import { SocialPost, NetworkTopology, PlatformType } from '@/types/intelligence';

export default function OverviewPage() {
  const [metrics, setMetrics] = useState({
    totalPosts: 0, activeNodes: 0, averageSentiment: 0, sarcasmIndex: 0,
    threatLevel: 'LOW', supportivePercentage: 0, opposingPercentage: 0,
    platformBreakdown: {} as Record<string, number>,
  });
  const [sentimentData, setSentimentData] = useState({
    emotionRadar: [] as { emotion: string; value: number; rawCount: number }[],
    sarcasmRate: 0,
    stanceDistribution: [] as { name: string; value: number }[],
    temporalTimeline: [] as any[],
  });
  const [trends, setTrends] = useState<any[]>([]);
  const [narrativeCount, setNarrativeCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [overviewRes, sentRes, trendsRes, narrativeRes] = await Promise.all([
        fetch('/api/analytics/overview').then(r => r.json()),
        fetch('/api/analytics/sentiment').then(r => r.json()),
        fetch('/api/analytics/trends').then(r => r.json()),
        fetch('/api/analytics/narratives').then(r => r.json()).catch(() => null),
      ]);
      if (overviewRes && !overviewRes.error) setMetrics(overviewRes);
      if (sentRes && !sentRes.error) setSentimentData(sentRes);
      if (trendsRes?.trends) setTrends(trendsRes.trends);
      if (narrativeRes?.narratives) setNarrativeCount(narrativeRes.narratives.length);
    } catch (e) {
      console.error('Failed to load analytics:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const threatColors: Record<string, string> = {
    LOW: 'text-nexus-positive',
    ELEVATED: 'text-nexus-warning',
    HIGH: 'text-nexus-negative',
    CRITICAL: 'text-nexus-negative',
  };

  const topEmotions = sentimentData.emotionRadar
    .filter(e => e.rawCount > 0)
    .sort((a, b) => b.rawCount - a.rawCount)
    .slice(0, 4);

  const emergingTrends = trends
    .filter((t: any) => t.isSpike || (t.zScore && t.zScore > 0))
    .slice(0, 5);

  return (
    <NexusLayout>
      <TopBar
        title="Social Intelligence"
        subtitle="See what people are saying. Understand why the conversation is changing."
        onRefresh={() => fetchAll(true)}
        refreshing={refreshing}
      />

      <main className="px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Activity className="w-6 h-6 text-nexus-muted animate-pulse mx-auto mb-3" />
              <p className="text-nexus-text-secondary text-sm">Loading intelligence…</p>
            </div>
          </div>
        ) : (
          <>
            {/* KPI Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <MetricCard
                label="Posts Analyzed"
                value={metrics.totalPosts.toLocaleString()}
                icon={<BarChart3 className="w-4 h-4" strokeWidth={1.5} />}
                subtitle={`${Object.entries(metrics.platformBreakdown || {}).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(' · ') || 'No platform data'}`}
              />
              <MetricCard
                label="Active Accounts"
                value={metrics.activeNodes.toLocaleString()}
                icon={<Users className="w-4 h-4" strokeWidth={1.5} />}
              />
              <MetricCard
                label="Active Narratives"
                value={narrativeCount !== null ? narrativeCount.toString() : '—'}
                icon={<TrendingUp className="w-4 h-4" strokeWidth={1.5} />}
                subtitle={narrativeCount === null ? 'ML service required' : undefined}
              />
              <MetricCard
                label="Threat Assessment"
                value={metrics.threatLevel}
                icon={<AlertTriangle className="w-4 h-4" strokeWidth={1.5} />}
                subtitle={`Sentiment: ${metrics.averageSentiment > 0 ? '+' : ''}${metrics.averageSentiment}`}
              />
            </div>

            {/* Two-column: Sentiment + Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Sentiment Overview */}
              <div className="nexus-surface rounded-xl p-6">
                <SectionHeader title="Sentiment Distribution" />
                <div className="space-y-3">
                  {sentimentData.stanceDistribution.map((item) => {
                    const total = sentimentData.stanceDistribution.reduce((s, i) => s + i.value, 0) || 1;
                    const pct = Math.round((item.value / total) * 100);
                    const color = item.name.includes('Supportive')
                      ? 'bg-nexus-positive'
                      : item.name.includes('Opposing')
                      ? 'bg-nexus-negative'
                      : 'bg-nexus-accent-steel';
                    return (
                      <div key={item.name}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[12px] text-nexus-text-secondary">{item.name}</span>
                          <span className="text-[12px] font-medium text-nexus-text-primary nexus-metric">{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-nexus-surface-secondary rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Top Emotions */}
                <div className="mt-6 pt-4 border-t border-nexus-border">
                  <span className="nexus-label">Dominant Emotions</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {topEmotions.map((e) => (
                      <span
                        key={e.emotion}
                        className="text-[11px] px-2.5 py-1 rounded-md bg-nexus-surface-secondary text-nexus-text-secondary border border-nexus-border"
                      >
                        {e.emotion} <span className="text-nexus-muted">({e.rawCount})</span>
                      </span>
                    ))}
                    {topEmotions.length === 0 && (
                      <span className="text-[11px] text-nexus-muted italic">No emotion data</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Emerging Trends */}
              <div className="nexus-surface rounded-xl p-6">
                <SectionHeader title="Emerging Trends" />
                {emergingTrends.length > 0 ? (
                  <div className="space-y-3">
                    {emergingTrends.map((trend: any, i: number) => {
                      const keyword = trend.keyword || trend.topic || 'Unknown';
                      const count = trend.postCount || trend.count || 0;
                      const score = trend.sentimentScore !== undefined ? trend.sentimentScore : 0;
                      const isPositive = score > 0.1;
                      const isNegative = score < -0.1;

                      return (
                        <div
                          key={trend.id || keyword || i}
                          className="flex items-center justify-between py-2.5 border-b border-nexus-border last:border-0"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] font-mono text-nexus-muted w-5">
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            <div>
                              <p className="text-[13px] text-nexus-text-primary font-medium">
                                {keyword}
                              </p>
                              <p className="text-[11px] text-nexus-muted">
                                {count} mentions {trend.isSpike ? '· Spike' : trend.zScore ? `· z=${trend.zScore.toFixed(1)}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-medium nexus-metric ${
                              isPositive ? 'text-nexus-positive' :
                              isNegative ? 'text-nexus-negative' :
                              'text-nexus-text-secondary'
                            }`}>
                              {score > 0 ? '+' : ''}{score.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[12px] text-nexus-muted py-4">
                    No emerging trends detected in the current corpus.
                  </p>
                )}
              </div>
            </div>

            {/* Platform Breakdown */}
            <div className="nexus-surface rounded-xl p-6 mb-8">
              <SectionHeader title="Platform Coverage" />
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                {['youtube', 'telegram', 'x', 'reddit', 'instagram', 'facebook'].map(platform => {
                  const count = (metrics.platformBreakdown || {})[platform] || 0;
                  return (
                    <div key={platform} className="text-center py-3 rounded-lg bg-nexus-surface-secondary/50 border border-nexus-border">
                      <span className="text-lg font-semibold text-nexus-text-primary nexus-metric">{count}</span>
                      <p className="text-[10px] text-nexus-muted uppercase tracking-wider mt-1">
                        {platform === 'x' ? 'X' : platform.charAt(0).toUpperCase() + platform.slice(1)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sarcasm Index */}
            <div className="nexus-surface rounded-xl p-6">
              <SectionHeader title="Signal Quality" />
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <span className="nexus-label">Sarcasm Index</span>
                  <p className="text-xl font-semibold text-nexus-text-primary nexus-metric mt-1">
                    {metrics.sarcasmIndex}%
                  </p>
                  <p className="text-[11px] text-nexus-muted mt-0.5">of posts flagged as sarcastic</p>
                </div>
                <div>
                  <span className="nexus-label">Supportive</span>
                  <p className="text-xl font-semibold text-nexus-positive nexus-metric mt-1">
                    {metrics.supportivePercentage}%
                  </p>
                </div>
                <div>
                  <span className="nexus-label">Opposing</span>
                  <p className="text-xl font-semibold text-nexus-negative nexus-metric mt-1">
                    {metrics.opposingPercentage}%
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </NexusLayout>
  );
}
