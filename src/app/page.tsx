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
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Play,
  Pause,
  Sparkles,
  Clock,
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
    unifiedTotalPosts: 0,
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
  const [ingestInput, setIngestInput] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Real-time Instagram Comment Sync State
  const [instaSyncActive, setInstaSyncActive] = useState(true);
  const [syncingInsta, setSyncingInsta] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [syncTargetUrl, setSyncTargetUrl] = useState('https://www.instagram.com/reel/DcHEonOvCLB/');

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

        if (overviewRes && !overviewRes.error) {
          setMetrics((prev) => ({
            ...overviewRes,
            unifiedTotalPosts:
              overviewRes.unifiedTotalPosts ??
              (platform === 'all' ? overviewRes.totalPosts : prev.unifiedTotalPosts),
            platformBreakdown:
              overviewRes.platformBreakdown && Object.keys(overviewRes.platformBreakdown).length > 0
                ? overviewRes.platformBreakdown
                : prev.platformBreakdown,
          }));
        }
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

  const triggerInstaSync = useCallback(
    async (targetOverride?: string) => {
      const target = targetOverride || syncTargetUrl;
      if (!target) return;
      setSyncingInsta(true);
      try {
        const res = await fetch('/api/instagram/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUrl: target }),
        });
        const data = await res.json();
        if (data.success) {
          setLastSyncTime(new Date().toLocaleTimeString());
          if (data.newCommentsCount > 0) {
            setSyncFeedback(`Captured & scored ${data.newCommentsCount} new live comment(s)!`);
            await fetchPlatformData(activeTab, false);
          } else {
            setSyncFeedback(`Sync active: ${data.totalExtracted || 0} comments verified & up-to-date.`);
          }
        } else {
          setSyncFeedback(data.message || 'Sync check completed.');
        }
      } catch (e: any) {
        console.error('Real-time sync failed:', e);
      } finally {
        setSyncingInsta(false);
      }
    },
    [syncTargetUrl, activeTab, fetchPlatformData]
  );

  useEffect(() => {
    if (!instaSyncActive || (activeTab !== 'instagram' && activeTab !== 'all')) return;
    const interval = setInterval(() => {
      triggerInstaSync();
    }, 15000);
    return () => clearInterval(interval);
  }, [instaSyncActive, activeTab, triggerInstaSync]);

  // Reddit Devvit Live Stream State
  const [devvitTarget, setDevvitTarget] = useState('r/technology');
  const [syncingDevvit, setSyncingDevvit] = useState(false);
  const [devvitFeedback, setDevvitFeedback] = useState<string | null>(null);

  const handleDevvitSync = async (targetOverride?: string) => {
    const sub = targetOverride || devvitTarget;
    if (!sub) return;
    setSyncingDevvit(true);
    setDevvitFeedback(null);
    try {
      const res = await fetch('/api/devvit/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subreddit: sub }),
      });
      const data = await res.json();
      if (data.success) {
        setDevvitFeedback(data.message || `Captured ${data.ingestedCount} live posts from r/${data.subreddit}!`);
        await fetchPlatformData(activeTab, false);
      } else {
        setDevvitFeedback(data.message || 'Live fetch failed.');
      }
    } catch (e: any) {
      setDevvitFeedback(e.message || 'Devvit sync request failed.');
    } finally {
      setSyncingDevvit(false);
    }
  };

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
              {activeTab === 'all'
                ? `${metrics.unifiedTotalPosts || metrics.totalPosts} total intercepted posts in active scope`
                : `${metrics.totalPosts} on ${currentPlatform.shortName} (${metrics.unifiedTotalPosts || metrics.totalPosts} unified total)`}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {(Object.keys(PLATFORMS) as PlatformTab[]).map((pKey) => {
              const p = PLATFORMS[pKey];
              const isSelected = activeTab === pKey;
              const count =
                pKey === 'all'
                  ? metrics.unifiedTotalPosts || metrics.totalPosts
                  : platformCounts[pKey] ?? 0;

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
                        : count > 0 || p.live
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

        {/* Live Ingestion & Reel Capture Bar */}
        <div className="nexus-surface rounded-2xl p-5 mb-8 border border-nexus-border">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-mono uppercase text-nexus-accent flex items-center gap-1.5 font-bold">
              <Zap className="w-3.5 h-3.5" />
              <span>Live Intercept & Ingestion Console</span>
            </span>
            <span className="text-[10px] text-nexus-muted font-mono">
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
                className="w-full px-4 py-2.5 rounded-xl bg-nexus-surface-secondary border border-nexus-border text-xs text-nexus-text-primary placeholder:text-nexus-muted focus:outline-none focus:border-nexus-accent transition-all shadow-inner font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={ingesting || !ingestInput.trim()}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-nexus-accent text-nexus-bg text-xs font-bold hover:bg-nexus-accent/90 transition-all flex items-center justify-center gap-2 shadow-md shadow-nexus-accent/15 disabled:opacity-40 flex-shrink-0"
            >
              {ingesting ? (
                <>
                  <Activity className="w-3.5 h-3.5 animate-spin" />
                  <span>Intercepting & Scoring…</span>
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
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-nexus-border/60 text-[11px]">
            <span className="text-nexus-muted">Quick test:</span>
            {activeTab === 'instagram' || activeTab === 'all' ? (
              <>
                <button
                  type="button"
                  onClick={() => setIngestInput('https://www.instagram.com/reel/DcHEonOvCLB/')}
                  className="px-2 py-0.5 rounded bg-nexus-surface-secondary text-nexus-text-secondary hover:text-nexus-text-primary border border-nexus-border font-mono text-[10px] transition-colors"
                >
                  reel/DcHEonOvCLB
                </button>
                <button
                  type="button"
                  onClick={() => setIngestInput('https://www.instagram.com/p/Dbq0GvDv1q_/')}
                  className="px-2 py-0.5 rounded bg-nexus-surface-secondary text-nexus-text-secondary hover:text-nexus-text-primary border border-nexus-border font-mono text-[10px] transition-colors"
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
                  className="px-2 py-0.5 rounded bg-nexus-surface-secondary text-nexus-text-secondary hover:text-nexus-text-primary border border-nexus-border font-mono text-[10px] transition-colors"
                >
                  t.me/durov
                </button>
                <button
                  type="button"
                  onClick={() => setIngestInput('telegram')}
                  className="px-2 py-0.5 rounded bg-nexus-surface-secondary text-nexus-text-secondary hover:text-nexus-text-primary border border-nexus-border font-mono text-[10px] transition-colors"
                >
                  t.me/telegram
                </button>
              </>
            ) : null}

            {activeTab === 'youtube' || activeTab === 'all' ? (
              <button
                type="button"
                onClick={() => setIngestInput('https://www.youtube.com/watch?v=DmFGE-DBQvY')}
                className="px-2 py-0.5 rounded bg-nexus-surface-secondary text-nexus-text-secondary hover:text-nexus-text-primary border border-nexus-border font-mono text-[10px] transition-colors"
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
                  ? 'bg-nexus-positive/10 border-nexus-positive/30 text-nexus-positive'
                  : 'bg-nexus-negative/10 border-nexus-negative/30 text-nexus-negative'
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

        {/* Real-Time Instagram Comment Sync Console */}
        {(activeTab === 'instagram' || activeTab === 'all') && (
          <div className="rounded-2xl p-5 mb-8 border border-pink-500/30 bg-gradient-to-r from-pink-950/20 via-nexus-surface to-purple-950/20 relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  {instaSyncActive ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500"></span>
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-500"></span>
                  )}
                </span>
                <span className="text-xs font-mono uppercase font-bold text-pink-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Real-Time Instagram Comment Sync Engine</span>
                </span>
                <span
                  className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded ${
                    instaSyncActive
                      ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {instaSyncActive ? 'Live Polling Active (15s)' : 'Sync Paused'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInstaSyncActive(!instaSyncActive)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    instaSyncActive
                      ? 'bg-nexus-surface border-pink-500/40 text-pink-300 hover:bg-pink-500/10'
                      : 'bg-nexus-surface border-nexus-border text-nexus-text-secondary hover:text-nexus-text-primary'
                  }`}
                >
                  {instaSyncActive ? (
                    <>
                      <Pause className="w-3.5 h-3.5 text-pink-400" />
                      <span>Pause Sync</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-nexus-positive" />
                      <span>Resume Sync</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => triggerInstaSync()}
                  disabled={syncingInsta}
                  className="px-3.5 py-1.5 rounded-lg bg-pink-500 text-white text-xs font-bold hover:bg-pink-600 transition-all flex items-center gap-1.5 shadow-md shadow-pink-500/20 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingInsta ? 'animate-spin' : ''}`} />
                  <span>{syncingInsta ? 'Syncing...' : 'Sync Comments Now'}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <div className="relative flex-1 w-full">
                <input
                  type="text"
                  placeholder="Target Reel/Post URL to sync comments (e.g. https://www.instagram.com/reel/DcHEonOvCLB/)"
                  value={syncTargetUrl}
                  onChange={(e) => setSyncTargetUrl(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-nexus-surface-secondary border border-pink-500/30 text-xs text-nexus-text-primary placeholder:text-nexus-muted focus:outline-none focus:border-pink-500 transition-all font-mono"
                />
              </div>
              <div className="text-[11px] font-mono text-nexus-muted flex items-center gap-2 flex-shrink-0">
                <Clock className="w-3.5 h-3.5 text-pink-400" />
                <span>Last Sync: {lastSyncTime || 'Pending initial pulse'}</span>
              </div>
            </div>

            {/* Sync Feedback Message */}
            {syncFeedback && (
              <div className="mt-2.5 pt-2 border-t border-pink-500/20 flex items-center justify-between text-xs">
                <span className="text-pink-300 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />
                  <span>{syncFeedback}</span>
                </span>
                <span className="text-[10px] text-nexus-muted font-mono">
                  {metrics.platformBreakdown?.instagram || 0} Instagram posts & comments in corpus
                </span>
              </div>
            )}
          </div>
        )}

        {/* Reddit Devvit Live Stream Console */}
        {(activeTab === 'reddit' || activeTab === 'all') && (
          <div className="rounded-2xl p-5 mb-8 border border-orange-500/30 bg-gradient-to-r from-orange-950/20 via-nexus-surface to-amber-950/20 relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                </span>
                <span className="text-xs font-mono uppercase font-bold text-orange-400 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" />
                  <span>Reddit Devvit Live Stream Engine</span>
                </span>
                <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/40">
                  Reddit Developer Platform Active
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDevvitSync()}
                  disabled={syncingDevvit}
                  className="px-3.5 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-all flex items-center gap-1.5 shadow-md shadow-orange-500/20 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingDevvit ? 'animate-spin' : ''}`} />
                  <span>{syncingDevvit ? 'Streaming from Reddit...' : 'Fetch Live via Devvit'}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <div className="relative flex-1 w-full">
                <input
                  type="text"
                  placeholder="Enter Subreddit to stream live (e.g. r/technology, r/artificial, r/news, r/india)"
                  value={devvitTarget}
                  onChange={(e) => setDevvitTarget(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-nexus-surface-secondary border border-orange-500/30 text-xs text-nexus-text-primary placeholder:text-nexus-muted focus:outline-none focus:border-orange-500 transition-all font-mono"
                />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-nexus-muted font-mono">Live presets:</span>
                {['r/technology', 'r/artificial', 'r/news', 'r/science', 'r/india'].map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => {
                      setDevvitTarget(sub);
                      handleDevvitSync(sub);
                    }}
                    className="px-2 py-0.5 rounded bg-nexus-surface-secondary text-orange-300 hover:text-white border border-orange-500/30 font-mono text-[10px] transition-colors"
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

            {/* Sync Feedback Message */}
            {devvitFeedback && (
              <div className="mt-2.5 pt-2 border-t border-orange-500/20 flex items-center justify-between text-xs">
                <span className="text-orange-300 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                  <span>{devvitFeedback}</span>
                </span>
                <span className="text-[10px] text-nexus-muted font-mono">
                  {metrics.platformBreakdown?.reddit || 0} Live Reddit posts in corpus
                </span>
              </div>
            )}
          </div>
        )}

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
