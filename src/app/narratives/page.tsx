'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Shield,
  ArrowLeft,
  TrendingUp,
  BarChart3,
  Globe,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

// ── Types (mirrors server types) ──────────────────────────────────────────

interface PlatformFlowEntry {
  platform: string;
  firstSeen: string;
  postCount: number;
}

interface KeywordStage {
  stage: string;
  keywords: string[];
  periodStart: string;
  periodEnd: string;
}

interface TimelineEntry {
  timestamp: string;
  platform: string;
  postId: string;
  sentiment: string;
  emotion: string;
  contentSnippet: string;
}

interface Narrative {
  id: string;
  title: string;
  postIds: string[];
  platforms: string[];
  firstSeen: string;
  lastSeen: string;
  postCount: number;
  engagement: number;
  mutationScore: number | null;
  semanticShift: number | null;
  sentimentShift: number | null;
  emotionShift: number | null;
  keywordShift: number | null;
  dominantSentiment: string | null;
  dominantEmotion: string | null;
  timeline: TimelineEntry[];
  platformFlow: PlatformFlowEntry[];
  keywordEvolution: KeywordStage[];
}

interface NarrativeResponse {
  narratives: Narrative[];
  availablePlatforms: string[];
  totalPostsAnalyzed: number;
  coverage: { sentiment: number; emotion: number; embeddings: number };
  method: {
    clustering: string;
    similarityThreshold: number;
    embeddingModel: string;
    mutationFormula: string;
  };
  error?: string;
  note?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  youtube: 'bg-red-500/20 text-red-400 border-red-500/30',
  telegram: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  x: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  reddit: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  instagram: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  facebook: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
};

const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  telegram: 'Telegram',
  x: 'X',
  reddit: 'Reddit',
  instagram: 'Instagram',
  facebook: 'Facebook',
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'text-emerald-400',
  negative: 'text-rose-400',
  neutral: 'text-slate-400',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Unknown';
  }
}

function formatDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '?';
  }
}

function displayValue(value: number | null | undefined, suffix: string = ''): string {
  if (value === null || value === undefined) return 'Insufficient data';
  return `${value.toFixed(1)}${suffix}`;
}

function mutationColor(score: number | null): string {
  if (score === null) return 'text-slate-500';
  if (score >= 60) return 'text-rose-400';
  if (score >= 30) return 'text-amber-400';
  return 'text-emerald-400';
}

function mutationBgColor(score: number | null): string {
  if (score === null) return 'bg-slate-800';
  if (score >= 60) return 'bg-rose-500/10 border-rose-500/30';
  if (score >= 30) return 'bg-amber-500/10 border-amber-500/30';
  return 'bg-emerald-500/10 border-emerald-500/30';
}

// ── Component ─────────────────────────────────────────────────────────────

export default function NarrativesPage() {
  const [data, setData] = useState<NarrativeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);

  const fetchNarratives = async (forceReanalyze = false) => {
    try {
      if (forceReanalyze) setReanalyzing(true);
      else setLoading(true);

      const url = '/api/analytics/narratives';
      const options = forceReanalyze
        ? { method: 'POST' as const }
        : { method: 'GET' as const };

      const res = await fetch(url, options);
      const json = await res.json();

      if (json.error) {
        setError(json.note || json.error);
      } else {
        setData(json);
        setError(null);
      }
    } catch (e) {
      setError('Failed to load narrative analysis. Is the ML service running?');
    } finally {
      setLoading(false);
      setReanalyzing(false);
    }
  };

  useEffect(() => {
    fetchNarratives();
  }, []);

  const highMutationCount = data
    ? data.narratives.filter((n) => n.mutationScore !== null && n.mutationScore >= 30).length
    : 0;

  return (
    <div className="min-h-screen bg-[#07090e] pb-16">
      {/* Header */}
      <header className="sticky top-0 z-50 intel-card border-b border-intel-border px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/40 text-purple-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="font-mono text-xs uppercase tracking-wider px-2 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800">
                Narrative Mutation Tracker
              </span>
              <h1 className="text-lg font-bold tracking-tight text-white mt-0.5">
                Cross-Platform Narrative Evolution
              </h1>
            </div>
          </div>

          <button
            onClick={() => fetchNarratives(true)}
            disabled={reanalyzing}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reanalyzing ? 'animate-spin' : ''}`} />
            Re-analyze
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-6">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" />
              <p className="text-slate-400 text-sm">
                Generating embeddings and clustering narratives…
              </p>
              <p className="text-slate-500 text-xs mt-1">
                This requires the ML service at port 8000
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="intel-card rounded-xl p-6 border border-amber-500/30 bg-amber-500/5 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-300 font-medium text-sm">Analysis Unavailable</p>
                <p className="text-slate-400 text-xs mt-1">{error}</p>
                <p className="text-slate-500 text-xs mt-2">
                  Start the ML service: <code className="text-cyan-400 bg-slate-800 px-1 rounded">cd ml &amp;&amp; .venv/Scripts/python.exe -m uvicorn main:app --port 8000</code>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        {data && !loading && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <SummaryCard
                icon={<FileText className="w-4 h-4" />}
                label="Narratives Detected"
                value={data.narratives.length.toString()}
                color="text-purple-400"
              />
              <SummaryCard
                icon={<TrendingUp className="w-4 h-4" />}
                label="High Mutation"
                value={highMutationCount.toString()}
                color="text-rose-400"
              />
              <SummaryCard
                icon={<Globe className="w-4 h-4" />}
                label="Platforms Observed"
                value={data.availablePlatforms.map((p) => PLATFORM_LABELS[p] || p).join(', ')}
                color="text-cyan-400"
                small
              />
              <SummaryCard
                icon={<BarChart3 className="w-4 h-4" />}
                label="Posts Analyzed"
                value={data.totalPostsAnalyzed.toString()}
                color="text-emerald-400"
              />
            </div>

            {/* Coverage & Method Info */}
            <div className="intel-card rounded-xl p-4 mb-6 border border-slate-800">
              <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                <span>
                  Embedding coverage:{' '}
                  <span className="text-cyan-400">{(data.coverage.embeddings * 100).toFixed(0)}%</span>
                </span>
                <span>
                  Clustering: <span className="text-slate-300">{data.method.clustering}</span>
                </span>
                <span>
                  Threshold: <span className="text-slate-300">{data.method.similarityThreshold}</span>
                </span>
                <span>
                  Model: <span className="text-slate-300">{data.method.embeddingModel}</span>
                </span>
              </div>
            </div>

            {/* No Narratives */}
            {data.narratives.length === 0 && (
              <div className="intel-card rounded-xl p-8 text-center border border-slate-800">
                <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm mb-1">No narratives detected</p>
                <p className="text-slate-500 text-xs">
                  The current corpus does not contain enough semantically similar posts
                  above the similarity threshold ({data.method.similarityThreshold}).
                  This is a real result, not an error.
                </p>
              </div>
            )}

            {/* Narrative Cards */}
            {data.narratives.map((narrative) => (
              <NarrativeCard
                key={narrative.id}
                narrative={narrative}
                expanded={expandedId === narrative.id}
                onToggle={() =>
                  setExpandedId(expandedId === narrative.id ? null : narrative.id)
                }
              />
            ))}
          </>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
  color,
  small,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  small?: boolean;
}) {
  return (
    <div className="intel-card rounded-xl p-4 border border-slate-800">
      <div className="flex items-center gap-2 mb-2">
        <span className={color}>{icon}</span>
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
          {label}
        </span>
      </div>
      <span className={`${small ? 'text-sm' : 'text-2xl'} font-bold ${color}`}>
        {value}
      </span>
    </div>
  );
}

function NarrativeCard({
  narrative,
  expanded,
  onToggle,
}: {
  narrative: Narrative;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="intel-card rounded-xl mb-4 border border-slate-800 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 hover:bg-slate-800/30 transition-all"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded border ${mutationBgColor(
                narrative.mutationScore
              )}`}
            >
              <span className={mutationColor(narrative.mutationScore)}>
                {narrative.mutationScore !== null
                  ? `${narrative.mutationScore.toFixed(1)}%`
                  : 'N/A'}
              </span>
              <span className="text-slate-500 ml-1">mutation</span>
            </span>

            {narrative.platforms.map((p) => (
              <span
                key={p}
                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                  PLATFORM_COLORS[p] || 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {PLATFORM_LABELS[p] || p}
              </span>
            ))}
          </div>

          <h3 className="text-white font-semibold text-sm truncate">
            {narrative.title}
          </h3>

          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
            <span>{narrative.postCount} posts</span>
            <span>•</span>
            <span>{formatDate(narrative.firstSeen)} → {formatDate(narrative.lastSeen)}</span>
            <span>•</span>
            <span className={SENTIMENT_COLORS[narrative.dominantSentiment || ''] || 'text-slate-500'}>
              {narrative.dominantSentiment || 'Unknown'} sentiment
            </span>
            <span>•</span>
            <span>{narrative.dominantEmotion || 'Unknown'} emotion</span>
          </div>
        </div>

        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0 mt-1" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0 mt-1" />
        )}
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-slate-800 px-5 py-4 space-y-5">
          {/* Mutation Breakdown */}
          <section>
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-3">
              Mutation Breakdown
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MutationBar label="Semantic" value={narrative.semanticShift} />
              <MutationBar label="Sentiment" value={narrative.sentimentShift} />
              <MutationBar label="Emotion" value={narrative.emotionShift} />
              <MutationBar label="Keywords" value={narrative.keywordShift} />
            </div>
          </section>

          {/* Platform Flow */}
          {narrative.platformFlow.length > 0 && (
            <section>
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-3">
                Observed Platform Sequence
              </h4>
              <div className="flex items-center gap-2 flex-wrap">
                {narrative.platformFlow.map((pf, i) => (
                  <React.Fragment key={pf.platform}>
                    {i > 0 && <span className="text-slate-600">→</span>}
                    <div
                      className={`px-3 py-1.5 rounded-lg border text-xs ${
                        PLATFORM_COLORS[pf.platform] || 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      <span className="font-medium">
                        {PLATFORM_LABELS[pf.platform] || pf.platform}
                      </span>
                      <span className="ml-2 opacity-70">
                        {pf.postCount} posts · {formatDateShort(pf.firstSeen)}
                      </span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
              <p className="text-[10px] text-slate-600 mt-1.5 italic">
                Temporal association only — does not imply propagation causality.
              </p>
            </section>
          )}

          {/* Keyword Evolution */}
          {narrative.keywordEvolution.length > 0 && (
            <section>
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-3">
                Keyword Evolution
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {narrative.keywordEvolution.map((stage) => (
                  <div
                    key={stage.stage}
                    className="bg-slate-900/60 rounded-lg p-3 border border-slate-800"
                  >
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
                      {stage.stage}
                      <span className="ml-2 normal-case text-slate-600">
                        {formatDateShort(stage.periodStart)} –{' '}
                        {formatDateShort(stage.periodEnd)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {stage.keywords.map((kw) => (
                        <span
                          key={kw}
                          className="text-[11px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20"
                        >
                          {kw}
                        </span>
                      ))}
                      {stage.keywords.length === 0 && (
                        <span className="text-[11px] text-slate-600 italic">
                          No keywords extracted
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Timeline */}
          {narrative.timeline.length > 0 && (
            <section>
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-3">
                Narrative Timeline ({narrative.timeline.length} posts)
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {narrative.timeline.map((entry, i) => (
                  <div
                    key={entry.postId}
                    className="flex items-start gap-3 text-xs"
                  >
                    <div className="flex-shrink-0 flex flex-col items-center">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          entry.sentiment === 'positive'
                            ? 'bg-emerald-400'
                            : entry.sentiment === 'negative'
                            ? 'bg-rose-400'
                            : 'bg-slate-500'
                        }`}
                      />
                      {i < narrative.timeline.length - 1 && (
                        <div className="w-px h-8 bg-slate-800" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pb-2">
                      <div className="flex items-center gap-2 text-slate-500 mb-0.5">
                        <span
                          className={`text-[10px] px-1 rounded ${
                            PLATFORM_COLORS[entry.platform] ||
                            'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {PLATFORM_LABELS[entry.platform] || entry.platform}
                        </span>
                        <span>{formatDate(entry.timestamp)}</span>
                        <span className={SENTIMENT_COLORS[entry.sentiment] || ''}>
                          {entry.sentiment}
                        </span>
                        <span className="text-slate-600">{entry.emotion}</span>
                      </div>
                      <p className="text-slate-300 truncate">
                        {entry.contentSnippet}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function MutationBar({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  const width = value !== null ? Math.min(value, 100) : 0;
  const color =
    value === null
      ? 'bg-slate-700'
      : value >= 60
      ? 'bg-rose-500'
      : value >= 30
      ? 'bg-amber-500'
      : 'bg-emerald-500';

  return (
    <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-800">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">
          {label}
        </span>
        <span className={`text-xs font-mono ${mutationColor(value)}`}>
          {displayValue(value, '%')}
        </span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
