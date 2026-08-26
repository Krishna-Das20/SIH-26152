'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { NexusLayout, TopBar, MetricCard, SectionHeader } from '@/components/nexus';
import {
  NarrativeEvolutionMap,
  MutationBreakpointDrawer,
  EvidenceChainViewer,
  CrossPlatformMatrix,
  NarrativeCompareModal,
} from '@/components/narratives';
import {
  TrendingUp,
  Activity,
  Zap,
  GitCompare,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldCheck,
  Filter,
  Layers,
} from 'lucide-react';
import type {
  Narrative,
  NarrativeBreakpoint,
  TimeWindowFilter,
  NarrativeAnalysisResponse,
} from '@/lib/narratives/types';

export default function NarrativesPage() {
  const [data, setData] = useState<NarrativeAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [timeWindow, setTimeWindow] = useState<TimeWindowFilter>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');

  // Interactive Selection
  const [heroNarrativeId, setHeroNarrativeId] = useState<string | null>(null);
  const [selectedBreakpoint, setSelectedBreakpoint] = useState<NarrativeBreakpoint | null>(null);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchNarratives = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const query = new URLSearchParams({
          window: timeWindow,
          platform: selectedPlatform,
        });
        const url = `/api/analytics/narratives?${query.toString()}`;
        const res = await fetch(url, { method: isRefresh ? 'POST' : 'GET' });
        const json = await res.json();

        if (json.error) {
          setError(json.note || json.error);
        } else {
          setData(json);
          setError(null);
          if (json.narratives?.length > 0 && !heroNarrativeId) {
            setHeroNarrativeId(json.narratives[0].id);
          }
        }
      } catch {
        setError('Narrative intelligence analysis requires the Python ML service on port 8000.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [timeWindow, selectedPlatform, heroNarrativeId]
  );

  useEffect(() => {
    fetchNarratives();
  }, [fetchNarratives]);

  const narratives = data?.narratives || [];
  const heroNarrative = narratives.find((n) => n.id === heroNarrativeId) || narratives[0];

  const totalBreakpoints = narratives.reduce((s, n) => s + (n.breakpoints?.length || 0), 0);
  const highConfidenceCount = narratives.filter((n) => n.confidence?.level === 'HIGH').length;

  return (
    <NexusLayout>
      <TopBar
        title="Narrative Intelligence Workstation"
        subtitle="Detect semantic transformations, breakpoint inflections, and cross-platform propagation."
        onRefresh={() => fetchNarratives(true)}
        refreshing={refreshing}
      />

      <main className="px-8 py-6 max-w-7xl">
        {/* Filters & Actions Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-nexus-border">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase text-nexus-muted flex items-center gap-1.5 mr-2">
              <Filter className="w-3.5 h-3.5" /> Time Window:
            </span>
            {(['all', '24h', '7d', '30d'] as TimeWindowFilter[]).map((w) => (
              <button
                key={w}
                onClick={() => setTimeWindow(w)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono uppercase transition-all ${
                  timeWindow === w
                    ? 'bg-nexus-surface-secondary text-nexus-text-primary border border-nexus-accent shadow-sm'
                    : 'bg-nexus-surface text-nexus-muted border border-nexus-border hover:text-nexus-text-primary'
                }`}
              >
                {w}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCompareOpen(true)}
              disabled={narratives.length < 2}
              className="px-3 py-1.5 rounded-lg bg-nexus-surface-secondary text-nexus-text-primary border border-nexus-border hover:border-nexus-accent text-xs font-medium flex items-center gap-2 transition-all disabled:opacity-40"
            >
              <GitCompare className="w-3.5 h-3.5 text-nexus-accent" />
              <span>Compare Narratives</span>
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <Activity className="w-8 h-8 text-nexus-accent animate-pulse mx-auto mb-3" />
              <p className="text-nexus-text-primary text-sm font-medium">
                Executing Narrative Intelligence Pipeline…
              </p>
              <p className="text-nexus-muted text-xs mt-1">
                Encoding semantic vectors and calculating 8-dimension mutation metrics.
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="nexus-surface rounded-xl p-6 border-nexus-warning/40 mb-8">
            <p className="text-nexus-warning text-sm font-semibold">Narrative Analysis Unavailable</p>
            <p className="text-nexus-text-secondary text-xs mt-1 leading-relaxed">{error}</p>
          </div>
        )}

        {data && !loading && (
          <>
            {/* KPI Ribbon */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <MetricCard label="Narratives Identified" value={narratives.length} />
              <MetricCard
                label="Detected Breakpoints"
                value={totalBreakpoints}
                subtitle="Sharp inflection moments"
              />
              <MetricCard
                label="High Confidence"
                value={`${highConfidenceCount} / ${narratives.length}`}
                subtitle="Corpus sample >= 8 posts"
              />
              <MetricCard
                label="Embedding Coverage"
                value={`${Math.round(data.coverage.embeddings * 100)}%`}
                subtitle="all-MiniLM-L6-v2 vectors"
              />
            </div>

            {/* Empty State */}
            {narratives.length === 0 && (
              <div className="nexus-surface rounded-xl p-12 text-center border border-nexus-border">
                <TrendingUp className="w-8 h-8 text-nexus-muted mx-auto mb-3" strokeWidth={1} />
                {data.coverage.embeddings === 0 ? (
                  <>
                    <p className="text-nexus-text-primary text-sm font-medium mb-1">
                      Narrative Detection Offline
                    </p>
                    <p className="text-nexus-muted text-xs max-w-md mx-auto">
                      Clustering requires dense sentence embeddings from the Python ML service.
                      Start the service on port 8000 (<code>uvicorn main:app --port 8000</code> in{' '}
                      <code>ml/</code>) and refresh.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-nexus-text-secondary text-sm mb-1">No Narratives Formed</p>
                    <p className="text-nexus-muted text-xs">
                      All posts were encoded, but none exhibited semantic similarity above the{' '}
                      {data.method.similarityThreshold} threshold.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Hero Evolution Map */}
            {heroNarrative && (
              <div className="mb-10">
                <NarrativeEvolutionMap
                  narrative={heroNarrative}
                  onSelectBreakpoint={(bp) => setSelectedBreakpoint(bp)}
                />
              </div>
            )}

            {/* Narrative Intelligence Dossiers Header */}
            {narratives.length > 0 && (
              <div className="mb-6">
                <SectionHeader
                  title="Narrative Intelligence Dossiers"
                  subtitle="Detailed 8-dimension mutation breakdown, factual evidence, and multi-platform trajectories."
                />
              </div>
            )}

            {/* Dossier Cards List */}
            <div className="space-y-4 mb-10">
              {narratives.map((n) => {
                const isExpanded = expandedId === n.id;
                const isSelectedHero = heroNarrativeId === n.id;

                return (
                  <div
                    key={n.id}
                    className={`nexus-surface rounded-2xl p-6 border transition-all ${
                      isSelectedHero
                        ? 'border-nexus-accent/60 bg-nexus-surface'
                        : 'border-nexus-border hover:border-nexus-border/90'
                    }`}
                  >
                    {/* Top row */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-nexus-surface-secondary text-nexus-accent border border-nexus-border">
                            {n.id}
                          </span>
                          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-nexus-surface-secondary text-nexus-text-secondary border border-nexus-border capitalize">
                            State: {n.state}
                          </span>
                          {n.confidence && (
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                n.confidence.level === 'HIGH'
                                  ? 'bg-nexus-positive/10 text-nexus-positive'
                                  : 'bg-nexus-warning/10 text-nexus-warning'
                              }`}
                            >
                              {n.confidence.level} CONFIDENCE
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-bold text-nexus-text-primary">
                          {n.title}
                        </h3>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-nexus-muted mt-1.5">
                          <span>{n.postCount} posts observed</span>
                          <span>·</span>
                          <span>Platforms: {n.platforms.join(', ')}</span>
                          <span>·</span>
                          <span>Span: {n.timeSpanHours}h</span>
                        </div>
                      </div>

                      {/* Score badges & Controls */}
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-[10px] text-nexus-muted uppercase font-mono">
                            Mutation Score
                          </p>
                          <p
                            className={`text-xl font-bold nexus-metric ${
                              (n.mutationScore ?? 0) >= 50
                                ? 'text-nexus-negative'
                                : (n.mutationScore ?? 0) >= 25
                                ? 'text-nexus-warning'
                                : 'text-nexus-positive'
                            }`}
                          >
                            {n.mutationScore !== null ? `${n.mutationScore}%` : 'N/A'}
                          </p>
                        </div>

                        <button
                          onClick={() => setHeroNarrativeId(n.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            isSelectedHero
                              ? 'bg-nexus-accent/20 text-nexus-accent border-nexus-accent/50'
                              : 'bg-nexus-surface-secondary text-nexus-text-secondary border-nexus-border hover:text-nexus-text-primary'
                          }`}
                        >
                          {isSelectedHero ? 'Active Hero Map' : 'Set as Hero'}
                        </button>

                        <button
                          onClick={() => setExpandedId(isExpanded ? null : n.id)}
                          className="p-1.5 rounded-lg bg-nexus-surface-secondary text-nexus-muted hover:text-nexus-text-primary border border-nexus-border"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* 8-Dimension Shift Gauges (Always Visible) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 pt-5 mt-5 border-t border-nexus-border">
                      <div className="p-2.5 rounded-lg bg-nexus-surface-secondary/40 border border-nexus-border/60 text-center">
                        <span className="text-[9px] font-mono uppercase text-nexus-muted block">Semantic</span>
                        <span className="text-xs font-bold text-nexus-text-primary nexus-metric">
                          {n.semanticShift !== null ? `${n.semanticShift}%` : '—'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-nexus-surface-secondary/40 border border-nexus-border/60 text-center">
                        <span className="text-[9px] font-mono uppercase text-nexus-muted block">Sentiment</span>
                        <span className="text-xs font-bold text-nexus-text-primary nexus-metric">
                          {n.sentimentShift !== null ? `${n.sentimentShift}%` : '—'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-nexus-surface-secondary/40 border border-nexus-border/60 text-center">
                        <span className="text-[9px] font-mono uppercase text-nexus-muted block">Emotion</span>
                        <span className="text-xs font-bold text-nexus-text-primary nexus-metric">
                          {n.emotionShift !== null ? `${n.emotionShift}%` : '—'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-nexus-surface-secondary/40 border border-nexus-border/60 text-center">
                        <span className="text-[9px] font-mono uppercase text-nexus-muted block">Keyword</span>
                        <span className="text-xs font-bold text-nexus-text-primary nexus-metric">
                          {n.keywordShift !== null ? `${n.keywordShift}%` : '—'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-nexus-surface-secondary/40 border border-nexus-border/60 text-center">
                        <span className="text-[9px] font-mono uppercase text-nexus-muted block">Entity</span>
                        <span className="text-xs font-bold text-nexus-text-primary nexus-metric">
                          {n.entityShift !== null ? `${n.entityShift}%` : '—'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-nexus-surface-secondary/40 border border-nexus-border/60 text-center">
                        <span className="text-[9px] font-mono uppercase text-nexus-muted block">Platform</span>
                        <span className="text-xs font-bold text-nexus-text-primary nexus-metric">
                          {n.platformShift !== null ? `${n.platformShift}%` : '—'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-nexus-surface-secondary/40 border border-nexus-border/60 text-center">
                        <span className="text-[9px] font-mono uppercase text-nexus-muted block">Community</span>
                        <span className="text-xs font-bold text-nexus-text-primary nexus-metric">
                          {n.communityShift !== null ? `${n.communityShift}%` : '—'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-nexus-surface-secondary/40 border border-nexus-border/60 text-center">
                        <span className="text-[9px] font-mono uppercase text-nexus-muted block">Amplification</span>
                        <span className="text-xs font-bold text-nexus-text-primary nexus-metric">
                          {n.amplificationShift !== null ? `${n.amplificationShift}%` : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Expanded Detail Workspace */}
                    {isExpanded && (
                      <div className="pt-6 mt-6 border-t border-nexus-border space-y-6 animate-in fade-in duration-200">
                        {/* Evidence Chain & Why Mutated */}
                        <EvidenceChainViewer
                          evidenceChain={n.evidenceChain}
                          whyMutated={n.whyMutated}
                        />

                        {/* Cross Platform Matrix */}
                        {n.crossPlatformMatrix && n.crossPlatformMatrix.length > 1 && (
                          <CrossPlatformMatrix matrix={n.crossPlatformMatrix} />
                        )}

                        {/* Link to Full Dossier */}
                        <div className="pt-2 flex justify-end">
                          <Link
                            href={`/narratives/${n.id}`}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-nexus-accent text-nexus-bg text-xs font-semibold hover:bg-nexus-accent/90 transition-all shadow-md shadow-nexus-accent/10"
                          >
                            <span>Open Dedicated Dossier View</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* Breakpoint Inspection Drawer */}
      <MutationBreakpointDrawer
        breakpoint={selectedBreakpoint}
        timelinePosts={heroNarrative?.timeline || []}
        onClose={() => setSelectedBreakpoint(null)}
      />

      {/* Narrative Compare Modal */}
      {isCompareOpen && (
        <NarrativeCompareModal
          narratives={narratives}
          initialNarrativeId={heroNarrativeId || undefined}
          onClose={() => setIsCompareOpen(false)}
        />
      )}
    </NexusLayout>
  );
}
