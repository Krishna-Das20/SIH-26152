'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { NexusLayout, TopBar, MetricCard, SectionHeader, PlatformFeed } from '@/components/nexus';
import {
  BarChart3,
  Users,
  TrendingUp,
  AlertTriangle,
  Activity,
  Layers,
  ExternalLink,
  ShieldCheck,
  Zap,
  Globe,
  Radio,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import { SocialPost, PlatformType } from '@/types/intelligence';

type PlatformTab = 'all' | 'instagram' | 'telegram' | 'youtube' | 'x' | 'reddit' | 'facebook';

interface PlatformMeta {
  id: PlatformTab;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  icon: string;
  color: string;
  borderColor: string;
  bgColor: string;
  live: boolean;
}

const PLATFORMS: Record<PlatformTab, PlatformMeta> = {
  all: {
    id: 'all',
    name: 'All Platforms',
    shortName: 'Unified Fusion',
    tagline: 'Cross-Vector Intelligence Command',
    description: 'Aggregated cross-platform intelligence across all intercepted social feeds and communities.',
    icon: '🌐',
    color: 'text-nexus-accent',
    borderColor: 'border-nexus-accent/50',
    bgColor: 'bg-nexus-accent/10',
    live: true,
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    shortName: 'Instagram',
    tagline: 'Visual OSINT & Reels Intelligence',
    description: 'Visual culture tracking, viral audio/video resonance, hashtag communities, and creator engagement.',
    icon: '📸',
    color: 'text-pink-400',
    borderColor: 'border-pink-500/40',
    bgColor: 'bg-pink-500/10',
    live: true,
  },
  telegram: {
    id: 'telegram',
    name: 'Telegram',
    shortName: 'Telegram',
    tagline: 'Channel Broadcast & Virality Radar',
    description: 'Public channel dispatches, forward cascade tracking, broadcast velocity, and uncensored sentiment.',
    icon: '✈️',
    color: 'text-sky-400',
    borderColor: 'border-sky-500/40',
    bgColor: 'bg-sky-500/10',
    live: true,
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    shortName: 'YouTube',
    tagline: 'Video & Discussion Stream Intelligence',
    description: 'Long-form discourse analysis, multi-tiered comment threads, video thesis sentiment, and audience reactions.',
    icon: '▶️',
    color: 'text-red-400',
    borderColor: 'border-red-500/40',
    bgColor: 'bg-red-500/10',
    live: true,
  },
  x: {
    id: 'x',
    name: 'X (Twitter)',
    shortName: 'X / Twitter',
    tagline: 'Real-Time Fast Wire & Breaking Discourse',
    description: 'High-velocity breaking narrative detection, micro-blogging discourse, quote tweet amplification, and OSINT.',
    icon: '𝕏',
    color: 'text-slate-300',
    borderColor: 'border-slate-400/40',
    bgColor: 'bg-slate-400/10',
    live: false,
  },
  reddit: {
    id: 'reddit',
    name: 'Reddit',
    shortName: 'Reddit',
    tagline: 'Subreddit Communities & Consensus Analysis',
    description: 'Threaded community debates, upvote consensus scoring, nuanced stance mapping, and specialized interest groups.',
    icon: '💬',
    color: 'text-orange-400',
    borderColor: 'border-orange-500/40',
    bgColor: 'bg-orange-500/10',
    live: false,
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    shortName: 'Facebook',
    tagline: 'Public Pages & Demographic Distribution',
    description: 'Public page broadcasting, demographic sentiment spread, cross-generational engagement, and community groups.',
    icon: '👥',
    color: 'text-indigo-400',
    borderColor: 'border-indigo-500/40',
    bgColor: 'bg-indigo-500/10',
    live: false,
  },
};

export default function OverviewPage() {
  const [activeTab, setActiveTab] = useState<PlatformTab>('all');
  const [metrics, setMetrics] = useState({
    totalPosts: 0,
    activeNodes: 0,
    averageSentiment: 0,
    sarcasmIndex: 0,
    threatLevel: 'LOW',
    supportivePercentage: 0,
    opposingPercentage: 0,
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
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPlatformData = useCallback(
    async (platform: PlatformTab, isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const queryParam = platform !== 'all' ? `?platform=${platform}` : '';
        const postQuery = platform !== 'all' ? `?platform=${platform}&limit=100` : '?limit=100';

        const [overviewRes, sentRes, trendsRes, narrativeRes, postsRes] = await Promise.all([
          fetch(`/api/analytics/overview${queryParam}`).then((r) => r.json()),
          fetch(`/api/analytics/sentiment${queryParam}`).then((r) => r.json()),
          fetch(`/api/analytics/trends${queryParam}`).then((r) => r.json()),
          fetch(`/api/analytics/narratives${queryParam}`).then((r) => r.json()).catch(() => null),
          fetch(`/api/posts${postQuery}`).then((r) => r.json()).catch(() => null),
        ]);

        if (overviewRes && !overviewRes.error) setMetrics(overviewRes);
        if (sentRes && !sentRes.error) setSentimentData(sentRes);
        if (trendsRes?.trends) setTrends(trendsRes.trends);
        if (narrativeRes?.narratives) setNarrativeCount(narrativeRes.narratives.length);
        if (postsRes?.posts) setPosts(postsRes.posts);
      } catch (e) {
        console.error('Failed to load analytics:', e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchPlatformData(activeTab);
  }, [activeTab, fetchPlatformData]);

  const currentPlatform = PLATFORMS[activeTab];
  const platformCounts = metrics.platformBreakdown || {};

  const topEmotions = sentimentData.emotionRadar
    .filter((e) => e.rawCount > 0)
    .sort((a, b) => b.rawCount - a.rawCount)
    .slice(0, 5);

  const emergingTrends = trends
    .filter((t: any) => t.isSpike || (t.zScore && t.zScore > 0))
    .slice(0, 5);

  return (
    <NexusLayout>
      <TopBar
        title="Social Media Intelligence Command"
        subtitle="Real-time multi-platform OSINT, cross-vector sentiment, and narrative transformation."
        onRefresh={() => fetchPlatformData(activeTab, true)}
        refreshing={refreshing}
      />

      <main className="px-8 py-6 max-w-7xl">
        {/* Multi-Platform Screen Navigation Ribbon */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono uppercase text-nexus-muted flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-nexus-accent animate-pulse" />
              <span>Select Platform Command Screen</span>
            </span>
            <span className="text-[11px] text-nexus-muted">
              {metrics.totalPosts} total intercepted posts in active scope
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {(Object.keys(PLATFORMS) as PlatformTab[]).map((pKey) => {
              const p = PLATFORMS[pKey];
              const isSelected = activeTab === pKey;
              const count = pKey === 'all' ? metrics.totalPosts : platformCounts[pKey] || 0;

              return (
                <button
                  key={pKey}
                  onClick={() => setActiveTab(pKey)}
                  className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                    isSelected
                      ? `bg-nexus-surface-secondary ${p.borderColor} shadow-lg ring-1 ring-nexus-accent/30`
                      : 'bg-nexus-surface border-nexus-border hover:border-nexus-border/90 hover:bg-nexus-surface-secondary/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg">{p.icon}</span>
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        count > 0
                          ? 'bg-nexus-surface text-nexus-text-primary border border-nexus-border'
                          : 'bg-nexus-surface text-nexus-muted border border-nexus-border/50'
                      }`}
                    >
                      {count}
                    </span>
                  </div>

                  <div>
                    <p
                      className={`text-xs font-bold leading-tight ${
                        isSelected ? p.color : 'text-nexus-text-primary'
                      }`}
                    >
                      {p.shortName}
                    </p>
                    <span className="text-[9px] text-nexus-muted uppercase font-mono block mt-0.5">
                      {pKey === 'all'
                        ? 'Unified'
                        : p.live || count > 0
                        ? 'Live Corpus'
                        : 'Dormant'}
                    </span>
                  </div>

                  {isSelected && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-nexus-accent" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Platform Screen Header Banner */}
        <div
          className={`rounded-2xl p-6 mb-8 border transition-all ${
            activeTab === 'all'
              ? 'bg-nexus-surface border-nexus-border'
              : `${currentPlatform.bgColor} ${currentPlatform.borderColor}`
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-nexus-surface border border-nexus-border flex items-center justify-center text-2xl shadow-inner flex-shrink-0">
                {currentPlatform.icon}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-bold text-nexus-text-primary">
                    {currentPlatform.name} Intelligence Screen
                  </h2>
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                      activeTab === 'all' || platformCounts[activeTab] > 0
                        ? 'bg-nexus-positive/10 text-nexus-positive border border-nexus-positive/30'
                        : 'bg-nexus-warning/10 text-nexus-warning border border-nexus-warning/30'
                    }`}
                  >
                    {activeTab === 'all'
                      ? '6 Platforms Active'
                      : platformCounts[activeTab] > 0
                      ? 'Corpus Scored & Live'
                      : 'Connector Ready'}
                  </span>
                </div>
                <p className="text-xs text-nexus-text-secondary max-w-2xl leading-relaxed">
                  {currentPlatform.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href="/narratives"
                className="px-3 py-1.5 rounded-lg bg-nexus-surface border border-nexus-border text-xs font-semibold text-nexus-text-primary hover:border-nexus-accent flex items-center gap-1.5 transition-all"
              >
                <TrendingUp className="w-3.5 h-3.5 text-nexus-accent" />
                <span>Narrative Tracker</span>
              </Link>

              <Link
                href="/sources"
                className="px-3 py-1.5 rounded-lg bg-nexus-surface border border-nexus-border text-xs font-medium text-nexus-muted hover:text-nexus-text-primary transition-all flex items-center gap-1"
              >
                <span>Sources</span>
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Activity className="w-6 h-6 text-nexus-muted animate-pulse mx-auto mb-3" />
              <p className="text-nexus-text-secondary text-sm">
                Scanning {currentPlatform.name} intelligence channels…
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* 4 Core KPIs for this Screen */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <MetricCard
                label={`${currentPlatform.shortName} Volume`}
                value={metrics.totalPosts.toLocaleString()}
                icon={<BarChart3 className="w-4 h-4" strokeWidth={1.5} />}
                subtitle="Captured & ML-Scored Posts"
              />
              <MetricCard
                label="Identified Authors / Nodes"
                value={metrics.activeNodes.toLocaleString()}
                icon={<Users className="w-4 h-4" strokeWidth={1.5} />}
                subtitle="Unique accounts analyzed"
              />
              <MetricCard
                label="Narrative Footprint"
                value={narrativeCount !== null ? narrativeCount.toString() : '—'}
                icon={<TrendingUp className="w-4 h-4" strokeWidth={1.5} />}
                subtitle="Active clusters on channel"
              />
              <MetricCard
                label="Channel Stance & Threat"
                value={metrics.threatLevel}
                icon={<AlertTriangle className="w-4 h-4" strokeWidth={1.5} />}
                subtitle={`Avg Score: ${metrics.averageSentiment > 0 ? '+' : ''}${metrics.averageSentiment}`}
              />
            </div>

            {/* Platform Detail Grids: Sentiment & Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Sentiment Distribution */}
              <div className="nexus-surface rounded-xl p-6 border border-nexus-border">
                <SectionHeader
                  title={`${currentPlatform.shortName} Stance Breakdown`}
                  subtitle="Supportive vs opposing stance distributions"
                />
                <div className="space-y-3 mt-4">
                  {sentimentData.stanceDistribution.map((item) => {
                    const total =
                      sentimentData.stanceDistribution.reduce((s, i) => s + i.value, 0) || 1;
                    const pct = Math.round((item.value / total) * 100);
                    const color = item.name.includes('Supportive')
                      ? 'bg-nexus-positive'
                      : item.name.includes('Opposing')
                      ? 'bg-nexus-negative'
                      : 'bg-nexus-accent-steel';

                    return (
                      <div key={item.name}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-nexus-text-secondary">{item.name}</span>
                          <span className="text-xs font-semibold text-nexus-text-primary nexus-metric">
                            {pct}% ({item.value})
                          </span>
                        </div>
                        <div className="h-1.5 bg-nexus-surface-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${color}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Top Nuanced GoEmotions */}
                <div className="mt-6 pt-4 border-t border-nexus-border">
                  <span className="text-[10px] font-mono uppercase text-nexus-muted block mb-2">
                    Top Observed GoEmotions
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {topEmotions.map((e) => (
                      <span
                        key={e.emotion}
                        className="text-[11px] px-2.5 py-1 rounded-md bg-nexus-surface-secondary text-nexus-text-secondary border border-nexus-border capitalize font-medium"
                      >
                        {e.emotion} <span className="text-nexus-muted">({e.rawCount})</span>
                      </span>
                    ))}
                    {topEmotions.length === 0 && (
                      <span className="text-xs text-nexus-muted italic">
                        No fine-grained emotions detected.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Emerging Trends & Vocabulary */}
              <div className="nexus-surface rounded-xl p-6 border border-nexus-border">
                <SectionHeader
                  title={`${currentPlatform.shortName} Trending Signals`}
                  subtitle="Frequency spikes, z-scores, and key vocabulary"
                />
                <div className="space-y-3 mt-4">
                  {emergingTrends.length > 0 ? (
                    emergingTrends.map((trend: any, i: number) => {
                      const keyword = trend.keyword || trend.topic || 'Unknown';
                      const count = trend.postCount || trend.count || 0;
                      const score =
                        trend.sentimentScore !== undefined ? trend.sentimentScore : 0;
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
                              <p className="text-xs font-semibold text-nexus-text-primary">
                                {keyword}
                              </p>
                              <p className="text-[10px] text-nexus-muted">
                                {count} mentions{' '}
                                {trend.isSpike
                                  ? '· Spike'
                                  : trend.zScore
                                  ? `· z=${trend.zScore.toFixed(1)}`
                                  : ''}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span
                              className={`text-xs font-semibold nexus-metric ${
                                isPositive
                                  ? 'text-nexus-positive'
                                  : isNegative
                                  ? 'text-nexus-negative'
                                  : 'text-nexus-text-secondary'
                              }`}
                            >
                              {score > 0 ? '+' : ''}
                              {score.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-nexus-muted py-6 text-center">
                      No emerging trends detected for {currentPlatform.name}.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Intercepted Posts Stream for this Screen */}
            <div className="mb-8">
              <PlatformFeed posts={posts} platformName={currentPlatform.name} />
            </div>

            {/* If dormant connector, show connector telemetry & setup action */}
            {activeTab !== 'all' && (platformCounts[activeTab] || 0) === 0 && (
              <div className="nexus-surface rounded-xl p-6 border border-nexus-border/80 bg-nexus-surface-secondary/40">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-nexus-accent mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-nexus-text-primary">
                      {currentPlatform.name} Connector Integration
                    </h4>
                    <p className="text-[11px] text-nexus-text-secondary mt-1 leading-relaxed">
                      The {currentPlatform.name} ingestion connector is fully implemented in{' '}
                      <code>src/lib/ingestion/{activeTab}.ts</code>. To ingest live data from{' '}
                      {currentPlatform.name}, configure the credentials in <code>.env</code> or visit
                      the Connected Accounts page.
                    </p>
                    <div className="mt-3">
                      <Link
                        href="/settings/accounts"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-nexus-surface border border-nexus-border text-xs font-semibold text-nexus-text-primary hover:border-nexus-accent transition-all"
                      >
                        <span>Configure {currentPlatform.name} Credentials</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </NexusLayout>
  );
}
