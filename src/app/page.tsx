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
  Video,
  Key,
} from 'lucide-react';
import { SocialPost, PlatformType } from '@/types/intelligence';
import { SkynetLogo } from '@/components/SkynetLogo';

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
    shortName: 'Unified',
    tagline: 'Cross-Vector Intelligence Command',
    description: 'Aggregated cross-platform intelligence across all intercepted social feeds and communities.',
    icon: '🌐',
    color: 'text-white',
    borderColor: 'border-white/40',
    bgColor: 'bg-white/10',
    live: true,
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    shortName: 'YouTube',
    tagline: 'Official Data API v3 (10,000 Credits/Day)',
    description: 'Long-form discourse analysis, multi-tiered comment threads, video thesis sentiment, and audience reactions.',
    icon: '▶️',
    color: 'text-red-400',
    borderColor: 'border-red-500/40',
    bgColor: 'bg-red-500/10',
    live: true,
  },
  reddit: {
    id: 'reddit',
    name: 'Reddit',
    shortName: 'Reddit',
    tagline: 'Devvit App Stream & Community Feeds',
    description: 'Threaded community debates, upvote consensus scoring, nuanced stance mapping, and specialized interest groups.',
    icon: '💬',
    color: 'text-orange-400',
    borderColor: 'border-orange-500/40',
    bgColor: 'bg-orange-500/10',
    live: true,
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    shortName: 'Instagram',
    tagline: 'Visual OSINT & Real-Time Comments',
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
  x: {
    id: 'x',
    name: 'X (Twitter)',
    shortName: 'X',
    tagline: 'Real-Time Fast Wire & Breaking Discourse',
    description: 'High-velocity breaking narrative detection, micro-blogging discourse, quote tweet amplification, and OSINT.',
    icon: '𝕏',
    color: 'text-neutral-300',
    borderColor: 'border-white/30',
    bgColor: 'bg-white/5',
    live: false,
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    shortName: 'Facebook',
    tagline: 'Public Pages & Demographic Distribution',
    description: 'Public page broadcasting, demographic sentiment spread, cross-generational engagement, and community groups.',
    icon: '👥',
    color: 'text-blue-400',
    borderColor: 'border-blue-500/40',
    bgColor: 'bg-blue-500/10',
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

  // General Ingest Bar State
  const [ingestInput, setIngestInput] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // YouTube Data API v3 (10,000 Credits/Day) State
  const [ytTarget, setYtTarget] = useState('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  const [ytSyncing, setYtSyncing] = useState(false);
  const [ytFeedback, setYtFeedback] = useState<string | null>(null);
  const [ytTelemetry, setYtTelemetry] = useState<{
    dailyLimit: number;
    usedToday: number;
    remaining: number;
    hasApiKey: boolean;
    tier: string;
  }>({
    dailyLimit: 10000,
    usedToday: 0,
    remaining: 10000,
    hasApiKey: false,
    tier: 'YouTube Data API v3 (Free 10,000 Credits/Day)',
  });

  // Instagram Real-Time Sync State
  const [instaSyncActive, setInstaSyncActive] = useState(false);
  const [syncingInsta, setSyncingInsta] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [syncTargetUrl, setSyncTargetUrl] = useState('https://www.instagram.com/reel/DcHEonOvCLB/');

  // Reddit Devvit Live Stream State
  const [devvitTarget, setDevvitTarget] = useState('r/technology');
  const [syncingDevvit, setSyncingDevvit] = useState(false);
  const [devvitFeedback, setDevvitFeedback] = useState<string | null>(null);

  // Load YouTube quota telemetry
  const loadYoutubeTelemetry = useCallback(async () => {
    try {
      const res = await fetch('/api/youtube/sync');
      const data = await res.json();
      if (data.telemetry) setYtTelemetry(data.telemetry);
    } catch {
      // ignore
    }
  }, []);

  const fetchPlatformData = useCallback(
    async (platform: PlatformTab, isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
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

  useEffect(() => {
    fetchPlatformData(activeTab);
    loadYoutubeTelemetry();
  }, [activeTab, fetchPlatformData, loadYoutubeTelemetry]);

  const [showKeyInput, setShowKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  // YouTube Sync Handler
  const handleYoutubeSync = async (targetOverride?: string, keyOverride?: string) => {
    const target = targetOverride || ytTarget;
    if (!target) return;
    setYtSyncing(true);
    setYtFeedback(null);
    try {
      const res = await fetch('/api/youtube/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, limit: 30, apiKey: keyOverride }),
      });
      const data = await res.json();
      if (data.telemetry) setYtTelemetry(data.telemetry);
      if (data.success && data.count > 0) {
        setYtFeedback(`Captured & scored ${data.count} YouTube comments via Data API v3!`);
        await fetchPlatformData(activeTab, true);
      } else {
        setYtFeedback(data.error || `Could not fetch comments for "${target}". Check video ID or API key.`);
      }
    } catch (e: any) {
      setYtFeedback(e.message || 'YouTube sync error');
    } finally {
      setYtSyncing(false);
    }
  };

  // Instagram Sync Handler
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
            setSyncFeedback(`Sync active: ${data.totalExtracted || 0} comments verified.`);
          }
        } else {
          setSyncFeedback(data.message || 'Sync check completed.');
        }
      } catch (e: any) {
        console.error('Instagram sync failed:', e);
      } finally {
        setSyncingInsta(false);
      }
    },
    [syncTargetUrl, activeTab, fetchPlatformData]
  );

  // Reddit Devvit Sync Handler
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

  // General Ingest Handler
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

      <main className="px-8 py-8 max-w-7xl">
        {/* SKYNET Hero Headline */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full liquid-glass-badge">
              <SkynetLogo size={14} withGlow={false} />
              <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-cyan-300 font-bold">
                SKYNET NEURAL OSINT • NTRO CERTIFIED
              </span>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10B981]" />
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight font-display leading-[1.05]">
            SKYNET Intelligence. <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-neutral-500">
              Not everyone sees it.
            </span>
          </h1>
          <p className="text-sm md:text-base text-neutral-400 max-w-2xl mt-3 font-normal leading-relaxed">
            Autonomous neural signal capture across YouTube, Reddit, Instagram, Telegram, and X.
            Continuous ML clustering, narrative mutations, and demographic profiling.
          </p>
        </div>

        {/* CRED Segmented Platform Pill Bar */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-neutral-400 font-bold flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-white animate-pulse" />
              PLATFORM FEEDS
            </span>
            <span className="text-[11px] font-mono text-neutral-400 font-medium">
              {activeTab === 'all'
                ? `${(metrics.unifiedTotalPosts || metrics.totalPosts).toLocaleString()} TOTAL CAPTURES`
                : `${metrics.totalPosts.toLocaleString()} ON ${currentPlatform.shortName.toUpperCase()}`}
            </span>
          </div>

          <div className="liquid-glass-dock p-2 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
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
                  className={`liquid-glass-tab px-3.5 py-3 text-left relative flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? 'liquid-glass-active ring-1 ring-white/50'
                      : 'text-neutral-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base">{p.icon}</span>
                    <span
                      className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        isSelected
                          ? 'liquid-glass-badge'
                          : 'bg-white/10 text-neutral-300 border border-white/10'
                      }`}
                    >
                      {count.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <p className={`text-xs font-black tracking-tight ${isSelected ? 'text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]' : 'text-neutral-300'}`}>
                      {p.shortName}
                    </p>
                    <p className="text-[9px] font-mono uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                      {isSelected ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10B981]" />
                          <span className="text-emerald-300 font-bold">ACTIVE</span>
                        </>
                      ) : (
                        <span className="text-neutral-500">{p.live ? 'LIVE' : 'DORMANT'}</span>
                      )}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            YOUTUBE DATA API V3 (10,000 CREDITS/DAY) LIVE CONSOLE
            ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'youtube' && (
          <div className="relative mb-8 rounded-3xl bg-gradient-to-b from-red-500/20 via-white/[0.03] to-transparent p-[1px] shadow-[0_20px_50px_-20px_rgba(239,68,68,0.2)]">
            <div className="rounded-3xl bg-gradient-to-b from-[#161214] via-[#0e0d10] to-[#08080a] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]">
              {/* Console Top Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center font-bold text-xl shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                    ▶
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-white tracking-tight font-display">
                        YouTube Data API v3 Live Console
                      </h3>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 font-bold uppercase tracking-wider">
                        10,000 Credits / Day
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Fetch authentic YouTube comments, run RoBERTa sentiment, and monitor daily Google Cloud quota.
                    </p>
                  </div>
                </div>

                {/* Quota Telemetry Meter */}
                <div className="flex items-center gap-4 px-4 py-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                  <div>
                    <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-neutral-400 font-bold">
                      DAILY QUOTA REMAINING
                    </div>
                    <div className="text-sm font-mono font-extrabold text-white flex items-baseline gap-1.5">
                      <span>{ytTelemetry.remaining.toLocaleString()}</span>
                      <span className="text-neutral-400 text-xs">/ 10,000 credits</span>
                    </div>
                  </div>
                  <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (ytTelemetry.remaining / 10000) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* YouTube Target Sync Form */}
              <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
                <div className="relative flex-1 w-full">
                  <Video className="w-4 h-4 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Enter YouTube Video URL or ID (e.g. https://www.youtube.com/watch?v=...)"
                    value={ytTarget}
                    onChange={(e) => setYtTarget(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-full bg-white/[0.05] border border-white/15 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/40 font-mono shadow-inner transition-all"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleYoutubeSync()}
                  disabled={ytSyncing || !ytTarget.trim()}
                  className="cred-pill-btn w-full sm:w-auto flex-shrink-0 disabled:opacity-50"
                >
                  {ytSyncing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Syncing Comments…</span>
                    </>
                  ) : (
                    <>
                      <span>Sync YouTube Comments</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* Presets & Info */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-[11px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-neutral-400 font-mono text-[10px] uppercase font-bold">Quick targets:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setYtTarget('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
                      handleYoutubeSync('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
                    }}
                    className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/15 text-neutral-300 font-mono text-[10px] border border-white/10 transition-colors"
                  >
                    Rick Astley (dQw4w9WgXcQ)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setYtTarget('https://www.youtube.com/watch?v=DmFGE-DBQvY');
                      handleYoutubeSync('https://www.youtube.com/watch?v=DmFGE-DBQvY');
                    }}
                    className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/15 text-neutral-300 font-mono text-[10px] border border-white/10 transition-colors"
                  >
                    Semiconductor Mission (DmFGE-DBQvY)
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowKeyInput(!showKeyInput)}
                    className="text-neutral-300 hover:text-white font-mono text-[10px] uppercase flex items-center gap-1.5 transition-colors border border-white/10 px-2.5 py-1 rounded-full bg-white/[0.04]"
                  >
                    <Key className="w-3 h-3 text-emerald-400" />
                    <span>{ytTelemetry.hasApiKey ? 'Update API Key' : '+ Set YouTube API Key'}</span>
                  </button>
                  <span className="text-neutral-400 font-mono text-[10px]">Cost: 1 unit per video comment thread</span>
                </div>
              </div>

              {/* Inline API Key Input */}
              {showKeyInput && (
                <div className="mt-3.5 p-3 rounded-2xl bg-white/[0.04] border border-white/15 flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="password"
                    placeholder="Paste Google Cloud YouTube Data API v3 key (AIzaSy...)"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="flex-1 w-full px-4 py-2.5 rounded-full bg-black/70 border border-white/15 text-xs text-white placeholder:text-neutral-500 font-mono focus:outline-none focus:border-white/40"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!apiKeyInput.trim()) return;
                      await handleYoutubeSync(undefined, apiKeyInput.trim());
                      setShowKeyInput(false);
                      setApiKeyInput('');
                    }}
                    className="cred-pill-btn w-full sm:w-auto text-[10px] py-2 px-5"
                  >
                    Save & Test Key
                  </button>
                </div>
              )}

              {/* Feedback */}
              {ytFeedback && (
                <div className="mt-4 p-3 rounded-2xl bg-white/5 border border-white/15 flex items-center gap-2.5 text-xs text-neutral-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{ytFeedback}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            INSTAGRAM REAL-TIME COMMENT SYNC CONSOLE
            ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'instagram' && (
          <div className="relative mb-8 rounded-3xl bg-gradient-to-b from-pink-500/20 via-white/[0.03] to-transparent p-[1px]">
            <div className="rounded-3xl bg-gradient-to-b from-[#161014] via-[#0e0d10] to-[#08080a] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-pink-500/20 border border-pink-500/40 text-pink-400 flex items-center justify-center font-bold text-xl">
                    📸
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white tracking-tight font-display">
                      Instagram Real-Time Ingestion Console
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Extracts parent reel captions, timestamps, and nested comments with author profiles.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setInstaSyncActive(!instaSyncActive)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                      instaSyncActive
                        ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                        : 'bg-white/10 text-neutral-300 border border-white/15'
                    }`}
                  >
                    {instaSyncActive ? <Play className="w-3.5 h-3.5 fill-black" /> : <Pause className="w-3.5 h-3.5" />}
                    <span>{instaSyncActive ? 'Auto-Polling (15s)' : 'Auto-Poll Paused'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => triggerInstaSync()}
                    disabled={syncingInsta}
                    className="cred-pill-btn"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingInsta ? 'animate-spin' : ''}`} />
                    <span>Sync Now</span>
                  </button>
                </div>
              </div>

              {/* Target input */}
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="text"
                  placeholder="Paste Instagram Reel or Post URL…"
                  value={syncTargetUrl}
                  onChange={(e) => setSyncTargetUrl(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-full bg-white/[0.05] border border-white/15 text-xs text-white placeholder:text-neutral-500 focus:outline-none font-mono"
                />
              </div>

              {syncFeedback && (
                <div className="p-3 rounded-2xl bg-white/5 border border-white/15 text-xs text-neutral-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{syncFeedback}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            REDDIT DEVVIT LIVE STREAM CONSOLE
            ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'reddit' && (
          <div className="relative mb-8 rounded-3xl bg-gradient-to-b from-orange-500/20 via-white/[0.03] to-transparent p-[1px]">
            <div className="rounded-3xl bg-gradient-to-b from-[#16120e] via-[#0e0d10] to-[#08080a] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-orange-500/20 border border-orange-500/40 text-orange-400 flex items-center justify-center font-bold text-xl">
                    💬
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white tracking-tight font-display">
                      Reddit Devvit App Live Stream
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Subreddit post and comment feeds via high-throughput Devvit bridge (no rate limits).
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                    DEVVIT READY
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
                <input
                  type="text"
                  placeholder="Enter Subreddit name (e.g. r/technology, r/science, r/india)…"
                  value={devvitTarget}
                  onChange={(e) => setDevvitTarget(e.target.value)}
                  className="flex-1 w-full px-4 py-3 rounded-full bg-white/[0.05] border border-white/15 text-xs text-white placeholder:text-neutral-500 focus:outline-none font-mono"
                />

                <button
                  type="button"
                  onClick={() => handleDevvitSync()}
                  disabled={syncingDevvit || !devvitTarget.trim()}
                  className="cred-pill-btn w-full sm:w-auto flex-shrink-0 disabled:opacity-50"
                >
                  {syncingDevvit ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Fetching Stream…</span>
                    </>
                  ) : (
                    <>
                      <span>Stream Subreddit</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
                <span className="text-neutral-400 uppercase font-bold">Presets:</span>
                {['r/technology', 'r/artificial', 'r/news', 'r/science', 'r/india', 'r/cybersecurity'].map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => {
                      setDevvitTarget(sub);
                      handleDevvitSync(sub);
                    }}
                    className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/15 text-neutral-300 border border-white/10 transition-colors"
                  >
                    {sub}
                  </button>
                ))}
              </div>

              {devvitFeedback && (
                <div className="mt-4 p-3 rounded-2xl bg-white/5 border border-white/15 text-xs text-neutral-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{devvitFeedback}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            FOUR TOP KPI METRIC CARDS (CRED LUXURY CONTAINERS)
            ══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            label="Sampled Intelligence Corpus"
            value={metrics.totalPosts.toLocaleString()}
            change={
              activeTab === 'all'
                ? 'Master Dataset'
                : `${platformCounts[activeTab] || 0} on ${currentPlatform.shortName}`
            }
            changeType="positive"
            icon={<BarChart3 className="w-4 h-4" />}
            subtitle="Verified multi-platform social captures"
          />

          <MetricCard
            label="Unique Network Entities"
            value={metrics.activeNodes.toLocaleString()}
            change="100% Verified"
            changeType="positive"
            icon={<Users className="w-4 h-4" />}
            subtitle="Active accounts & community nodes"
          />

          <MetricCard
            label="Average Sentiment Stance"
            value={`${metrics.averageSentiment > 0 ? '+' : ''}${metrics.averageSentiment.toFixed(2)}`}
            change={
              metrics.averageSentiment > 0.1
                ? 'Net Positive'
                : metrics.averageSentiment < -0.1
                ? 'Net Opposing'
                : 'Neutral Consensus'
            }
            changeType={metrics.averageSentiment >= 0 ? 'positive' : 'negative'}
            icon={<TrendingUp className="w-4 h-4" />}
            subtitle={`Stance: ${metrics.supportivePercentage}% Supp / ${metrics.opposingPercentage}% Opp`}
          />

          <MetricCard
            label="Threat Level Matrix"
            value={metrics.threatLevel}
            change={`Sarcasm: ${metrics.sarcasmIndex}%`}
            changeType={metrics.threatLevel === 'CRITICAL' ? 'negative' : 'neutral'}
            icon={<AlertTriangle className="w-4 h-4" />}
            subtitle={`${narrativeCount ?? 16} active narrative clusters`}
          />
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            ANALYTICAL BREAKDOWN CARDS
            ══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Emotion Spectrum */}
          <div className="cred-card p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.08]">
              <h3 className="text-xs font-mono uppercase tracking-[0.2em] font-bold text-white flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Emotion Spectrum
              </h3>
              <span className="text-[10px] font-mono text-neutral-400">
                {topEmotions.length} Detected
              </span>
            </div>

            {topEmotions.length === 0 ? (
              <div className="py-12 text-center text-xs font-mono text-neutral-500">
                COMPUTING EMOTION RADAR…
              </div>
            ) : (
              <div className="space-y-3">
                {topEmotions.map((e) => (
                  <div key={e.emotion}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-bold capitalize text-white font-sans">{e.emotion}</span>
                      <span className="font-mono text-neutral-400 text-[11px]">{e.rawCount} signals</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-white to-neutral-400 rounded-full"
                        style={{ width: `${Math.min(100, e.value)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stance & Consensus */}
          <div className="cred-card p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.08]">
              <h3 className="text-xs font-mono uppercase tracking-[0.2em] font-bold text-white flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                Stance Consensus
              </h3>
              <span className="text-[10px] font-mono text-neutral-400">
                Triple Alignment
              </span>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-bold text-emerald-400">Supportive</span>
                  <span className="font-mono text-white">{metrics.supportivePercentage}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                    style={{ width: `${metrics.supportivePercentage}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-bold text-neutral-300">Neutral</span>
                  <span className="font-mono text-white">
                    {Math.max(0, 100 - metrics.supportivePercentage - metrics.opposingPercentage)}%
                  </span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white/50 rounded-full"
                    style={{
                      width: `${Math.max(0, 100 - metrics.supportivePercentage - metrics.opposingPercentage)}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-bold text-rose-400">Opposing</span>
                  <span className="font-mono text-white">{metrics.opposingPercentage}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.5)]"
                    style={{ width: `${metrics.opposingPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sarcasm & Volatility */}
          <div className="cred-card p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.08]">
                <h3 className="text-xs font-mono uppercase tracking-[0.2em] font-bold text-white flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-amber-400" />
                  Sarcasm & Subversion
                </h3>
                <span className="text-[10px] font-mono text-neutral-400">
                  RoBERTa Sarcasm
                </span>
              </div>

              <div className="my-3">
                <div className="text-4xl font-extrabold text-white tracking-tight font-display mb-1">
                  {metrics.sarcasmIndex}%
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Percentage of messages containing ironical markers, contrarian emojis, or contextual subversion.
                </p>
              </div>
            </div>

            <Link
              href="/narratives"
              className="cred-pill-btn-outline w-full text-center"
            >
              <span>Explore Narrative Graph</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            LIVE INTERCEPTED SOCIAL STREAM
            ══════════════════════════════════════════════════════════════════ */}
        <PlatformFeed
          posts={posts}
          platformName={currentPlatform.name}
        />
      </main>
    </NexusLayout>
  );
}
