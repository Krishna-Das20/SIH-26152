'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { SkynetLayout, TopBar, MetricCard, SectionHeader, PlatformFeed } from '@/components/skynet';
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
  CheckCircle2,
  AlertCircle,
  ArrowRight,
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
    description: 'Aggregated cross-platform intelligence across all collected social feeds and communities.',
    icon: '🌐',
    color: 'text-skynet-accent',
    borderColor: 'border-skynet-accent/50',
    bgColor: 'bg-skynet-accent/10',
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
    corpusBreakdown: {} as Record<string, number>,
    corpusTotal: 0,
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
  const [ingestInput, setIngestInput] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchPlatformData = useCallback(
    async (platform: PlatformTab, isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        // When user explicitly clicks Refresh, trigger re-clustering & re-analysis on latest posts
        if (isRefresh) {
          await fetch('/api/analytics/narratives', { method: 'POST' }).catch(() => null);
        }

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

  const handleLiveIngest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const target = ingestInput.trim();
    if (!target) return;

    setIngesting(true);
    setIngestStatus(null);

    try {
      const res = await fetch('/api/analyze/page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, platform: activeTab !== 'all' ? activeTab : undefined }),
      });

      const data = await res.json();
      if (data.success && data.scrapedCount > 0) {
        setIngestStatus({
          type: 'success',
          text: `Captured & ML-scored ${data.scrapedCount} new post from ${data.platform}!`,
        });
        setIngestInput('');
        await fetchPlatformData(activeTab, true);
      } else {
        setIngestStatus({
          type: 'error',
          text: data.message || data.error || 'Failed to ingest target.',
        });
      }
    } catch (err: any) {
      setIngestStatus({
        type: 'error',
        text: err.message || 'Ingestion request failed.',
      });
    } finally {
      setIngesting(false);
    }
  };

  useEffect(() => {
    fetchPlatformData(activeTab);
  }, [activeTab, fetchPlatformData]);

  const currentPlatform = PLATFORMS[activeTab];
  // Navigation counts come from the CORPUS view, so they stay put when a tab
  // is selected. `platformBreakdown` is scoped to the active tab and would
  // zero out every card except the selected one.
  const platformCounts = metrics.corpusBreakdown || {};

  const topEmotions = sentimentData.emotionRadar
    .filter((e) => e.rawCount > 0)
    .sort((a, b) => b.rawCount - a.rawCount)
    .slice(0, 5);

  const emergingTrends = trends
    .filter((t: any) => t.isSpike || (t.zScore && t.zScore > 0))
    .slice(0, 5);

  return (
    <SkynetLayout>
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
            <span className="text-[11px] font-mono uppercase text-skynet-muted flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-skynet-accent animate-pulse" />
              <span>Select Platform Command Screen</span>
            </span>
            <span className="text-[11px] text-skynet-muted">
              {metrics.totalPosts} total collected posts in active scope
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {(Object.keys(PLATFORMS) as PlatformTab[]).map((pKey) => {
              const p = PLATFORMS[pKey];
              const isSelected = activeTab === pKey;
              const count = pKey === 'all' ? metrics.corpusTotal : platformCounts[pKey] || 0;

              return (
                <button
                  key={pKey}
                  onClick={() => setActiveTab(pKey)}
                  className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                    isSelected
                      ? `bg-skynet-surface-secondary ${p.borderColor} shadow-lg ring-1 ring-skynet-accent/30`
                      : 'bg-skynet-surface border-skynet-border hover:border-skynet-border/90 hover:bg-skynet-surface-secondary/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg">{p.icon}</span>
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        count > 0
                          ? 'bg-skynet-surface text-skynet-text-primary border border-skynet-border'
                          : 'bg-skynet-surface text-skynet-muted border border-skynet-border/50'
                      }`}
                    >
                      {count}
                    </span>
                  </div>

                  <div>
                    <p
                      className={`text-xs font-bold leading-tight ${
                        isSelected ? p.color : 'text-skynet-text-primary'
                      }`}
                    >
                      {p.shortName}
                    </p>
                    <span className="text-[9px] text-skynet-muted uppercase font-mono block mt-0.5">
                      {pKey === 'all'
                        ? 'Unified'
                        : p.live || count > 0
                        ? 'Live Corpus'
                        : 'Dormant'}
                    </span>
                  </div>

                  {isSelected && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-skynet-accent" />
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
              ? 'bg-skynet-surface border-skynet-border'
              : `${currentPlatform.bgColor} ${currentPlatform.borderColor}`
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-skynet-surface border border-skynet-border flex items-center justify-center text-2xl shadow-inner flex-shrink-0">
                {currentPlatform.icon}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-bold text-skynet-text-primary">
                    {currentPlatform.name} Intelligence Screen
                  </h2>
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                      activeTab === 'all' || platformCounts[activeTab] > 0
                        ? 'bg-skynet-positive/10 text-skynet-positive border border-skynet-positive/30'
                        : 'bg-skynet-warning/10 text-skynet-warning border border-skynet-warning/30'
                    }`}
                  >
                    {activeTab === 'all'
                      ? '6 Platforms Active'
                      : platformCounts[activeTab] > 0
                      ? 'Corpus Scored & Live'
                      : 'Connector Ready'}
                  </span>
                </div>
                <p className="text-xs text-skynet-text-secondary max-w-2xl leading-relaxed">
                  {currentPlatform.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href="/narratives"
                className="px-3 py-1.5 rounded-lg bg-skynet-surface border border-skynet-border text-xs font-semibold text-skynet-text-primary hover:border-skynet-accent flex items-center gap-1.5 transition-all"
              >
                <TrendingUp className="w-3.5 h-3.5 text-skynet-accent" />
                <span>Narrative Tracker</span>
              </Link>

              <Link
                href="/sources"
                className="px-3 py-1.5 rounded-lg bg-skynet-surface border border-skynet-border text-xs font-medium text-skynet-muted hover:text-skynet-text-primary transition-all flex items-center gap-1"
              >
                <span>Sources</span>
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Live Ingestion & Reel Capture Bar */}
        <div className="skynet-surface rounded-2xl p-5 mb-8 border border-skynet-border">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-mono uppercase text-skynet-accent flex items-center gap-1.5 font-bold">
              <Zap className="w-3.5 h-3.5" />
              <span>Live Collection & Ingestion Console</span>
            </span>
            <span className="text-[10px] text-skynet-muted font-mono">
              Direct Reel, Video, or Channel Targeting
            </span>
          </div>

          <form onSubmit={handleLiveIngest} className="flex flex-col sm:flex-row items-center gap-2.5">
            <div className="relative flex-1 w-full">
              <input
                type="text"
                placeholder={
                  activeTab === 'instagram'
                    ? 'Paste Instagram Reel or Post URL (e.g. https://www.instagram.com/reel/...)'
                    : activeTab === 'youtube'
                    ? 'Paste YouTube Video URL or ID (e.g. https://www.youtube.com/watch?v=...)'
                    : activeTab === 'telegram'
                    ? 'Enter Telegram public channel name (e.g. durov, telegram)'
                    : 'Paste any Reel, Video, Channel, or #hashtag to ingest live…'
                }
                value={ingestInput}
                onChange={(e) => setIngestInput(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-skynet-surface-secondary border border-skynet-border text-xs text-skynet-text-primary placeholder:text-skynet-muted focus:outline-none focus:border-skynet-accent transition-all shadow-inner font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={ingesting || !ingestInput.trim()}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-skynet-accent text-skynet-bg text-xs font-bold hover:bg-skynet-accent/90 transition-all flex items-center justify-center gap-2 shadow-md shadow-skynet-accent/15 disabled:opacity-40 flex-shrink-0"
            >
              {ingesting ? (
                <>
                  <Activity className="w-3.5 h-3.5 animate-spin" />
                  <span>Collecting & Scoring…</span>
                </>
              ) : (
                <>
                  <span>Ingest & Analyze</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Suggestions */}
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-skynet-border/60 text-[11px]">
            <span className="text-skynet-muted">Quick test:</span>
            {activeTab === 'instagram' || activeTab === 'all' ? (
              <>
                <button
                  type="button"
                  onClick={() => setIngestInput('https://www.instagram.com/reel/DcHEonOvCLB/')}
                  className="px-2 py-0.5 rounded bg-skynet-surface-secondary text-skynet-text-secondary hover:text-skynet-text-primary border border-skynet-border font-mono text-[10px] transition-colors"
                >
                  reel/DcHEonOvCLB
                </button>
                <button
                  type="button"
                  onClick={() => setIngestInput('https://www.instagram.com/p/Dbq0GvDv1q_/')}
                  className="px-2 py-0.5 rounded bg-skynet-surface-secondary text-skynet-text-secondary hover:text-skynet-text-primary border border-skynet-border font-mono text-[10px] transition-colors"
                >
                  post/Dbq0GvDv1q_
                </button>
              </>
            ) : null}

            {activeTab === 'telegram' || activeTab === 'all' ? (
              <>
                <button
                  type="button"
                  onClick={() => setIngestInput('durov')}
                  className="px-2 py-0.5 rounded bg-skynet-surface-secondary text-skynet-text-secondary hover:text-skynet-text-primary border border-skynet-border font-mono text-[10px] transition-colors"
                >
                  t.me/durov
                </button>
                <button
                  type="button"
                  onClick={() => setIngestInput('telegram')}
                  className="px-2 py-0.5 rounded bg-skynet-surface-secondary text-skynet-text-secondary hover:text-skynet-text-primary border border-skynet-border font-mono text-[10px] transition-colors"
                >
                  t.me/telegram
                </button>
              </>
            ) : null}

            {activeTab === 'youtube' || activeTab === 'all' ? (
              <button
                type="button"
                onClick={() => setIngestInput('https://www.youtube.com/watch?v=DmFGE-DBQvY')}
                className="px-2 py-0.5 rounded bg-skynet-surface-secondary text-skynet-text-secondary hover:text-skynet-text-primary border border-skynet-border font-mono text-[10px] transition-colors"
              >
                yt/DmFGE-DBQvY
              </button>
            ) : null}
          </div>

          {/* Feedback banner */}
          {ingestStatus && (
            <div
              className={`mt-3 p-3 rounded-xl border flex items-center gap-2 text-xs animate-in fade-in ${
                ingestStatus.type === 'success'
                  ? 'bg-skynet-positive/10 border-skynet-positive/30 text-skynet-positive'
                  : 'bg-skynet-negative/10 border-skynet-negative/30 text-skynet-negative'
              }`}
            >
              {ingestStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{ingestStatus.text}</span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Activity className="w-6 h-6 text-skynet-muted animate-pulse mx-auto mb-3" />
              <p className="text-skynet-text-secondary text-sm">
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
              <div className="skynet-surface rounded-xl p-6 border border-skynet-border">
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
                      ? 'bg-skynet-positive'
                      : item.name.includes('Opposing')
                      ? 'bg-skynet-negative'
                      : 'bg-skynet-accent-steel';

                    return (
                      <div key={item.name}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-skynet-text-secondary">{item.name}</span>
                          <span className="text-xs font-semibold text-skynet-text-primary skynet-metric">
                            {pct}% ({item.value})
                          </span>
                        </div>
                        <div className="h-1.5 bg-skynet-surface-secondary rounded-full overflow-hidden">
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
                <div className="mt-6 pt-4 border-t border-skynet-border">
                  <span className="text-[10px] font-mono uppercase text-skynet-muted block mb-2">
                    Top Observed GoEmotions
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {topEmotions.map((e) => (
                      <span
                        key={e.emotion}
                        className="text-[11px] px-2.5 py-1 rounded-md bg-skynet-surface-secondary text-skynet-text-secondary border border-skynet-border capitalize font-medium"
                      >
                        {e.emotion} <span className="text-skynet-muted">({e.rawCount})</span>
                      </span>
                    ))}
                    {topEmotions.length === 0 && (
                      <span className="text-xs text-skynet-muted italic">
                        No fine-grained emotions detected.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Emerging Trends & Vocabulary */}
              <div className="skynet-surface rounded-xl p-6 border border-skynet-border">
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
                          className="flex items-center justify-between py-2.5 border-b border-skynet-border last:border-0"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] font-mono text-skynet-muted w-5">
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            <div>
                              <p className="text-xs font-semibold text-skynet-text-primary">
                                {keyword}
                              </p>
                              <p className="text-[10px] text-skynet-muted">
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
                              className={`text-xs font-semibold skynet-metric ${
                                isPositive
                                  ? 'text-skynet-positive'
                                  : isNegative
                                  ? 'text-skynet-negative'
                                  : 'text-skynet-text-secondary'
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
                    <p className="text-xs text-skynet-muted py-6 text-center">
                      No emerging trends detected for {currentPlatform.name}.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Collected Posts Stream for this Screen */}
            <div className="mb-8">
              <PlatformFeed posts={posts} platformName={currentPlatform.name} />
            </div>

            {/* If dormant connector, show connector telemetry & setup action */}
            {activeTab !== 'all' && (platformCounts[activeTab] || 0) === 0 && (
              <div className="skynet-surface rounded-xl p-6 border border-skynet-border/80 bg-skynet-surface-secondary/40">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-skynet-accent mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-skynet-text-primary">
                      {currentPlatform.name} Connector Integration
                    </h4>
                    <p className="text-[11px] text-skynet-text-secondary mt-1 leading-relaxed">
                      The {currentPlatform.name} ingestion connector is fully implemented in{' '}
                      <code>src/lib/ingestion/{activeTab}.ts</code>. To ingest live data from{' '}
                      {currentPlatform.name}, configure the credentials in <code>.env</code> or visit
                      the Connected Accounts page.
                    </p>
                    <div className="mt-3">
                      <Link
                        href="/settings/accounts"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-skynet-surface border border-skynet-border text-xs font-semibold text-skynet-text-primary hover:border-skynet-accent transition-all"
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
    </SkynetLayout>
  );
}
