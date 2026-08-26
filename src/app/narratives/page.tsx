'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { NexusLayout, TopBar, MetricCard, SectionHeader } from '@/components/nexus';
import { TrendingUp, Activity, ArrowDown, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────

interface TimelineEntry {
  timestamp: string; platform: string; postId: string;
  sentiment: string; emotion: string; contentSnippet: string;
}
interface PlatformFlowEntry { platform: string; firstSeen: string; postCount: number; }
interface KeywordStage { stage: string; keywords: string[]; periodStart: string; periodEnd: string; }
interface Narrative {
  id: string; title: string; postIds: string[]; platforms: string[];
  firstSeen: string; lastSeen: string; postCount: number; engagement: number;
  mutationScore: number | null; semanticShift: number | null;
  sentimentShift: number | null; emotionShift: number | null; keywordShift: number | null;
  dominantSentiment: string | null; dominantEmotion: string | null;
  timeline: TimelineEntry[]; platformFlow: PlatformFlowEntry[];
  keywordEvolution: KeywordStage[];
}
interface NarrativeResponse {
  narratives: Narrative[]; totalPostsAnalyzed: number;
  availablePlatforms: string[];
  coverage: { sentiment: number; emotion: number; embeddings: number };
  method: { clustering: string; similarityThreshold: number; embeddingModel: string; mutationFormula: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube', telegram: 'Telegram', x: 'X', reddit: 'Reddit',
  instagram: 'Instagram', facebook: 'Facebook',
};

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return '—'; }
}
function fmtDateShort(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  catch { return '—'; }
}
function metricDisplay(v: number | null, suffix = '%'): string {
  if (v === null) return 'Unknown';
  return `${v.toFixed(1)}${suffix}`;
}
function mutationSeverity(score: number | null): { color: string; label: string } {
  if (score === null) return { color: 'text-nexus-muted', label: 'Unknown' };
  if (score >= 60) return { color: 'text-nexus-negative', label: 'High' };
  if (score >= 30) return { color: 'text-nexus-warning', label: 'Notable' };
  return { color: 'text-nexus-positive', label: 'Low' };
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function NarrativesPage() {
  const [data, setData] = useState<NarrativeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchNarratives = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const url = '/api/analytics/narratives';
      const res = await fetch(isRefresh ? url : url, { method: isRefresh ? 'POST' : 'GET' });
      const json = await res.json();
      if (json.error) { setError(json.note || json.error); }
      else { setData(json); setError(null); }
    } catch { setError('Narrative analysis requires the ML service.'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchNarratives(); }, []);

  const highMutation = data ? data.narratives.filter(n => n.mutationScore !== null && n.mutationScore >= 30).length : 0;

  return (
    <NexusLayout>
      <TopBar
        title="Narrative Intelligence"
        subtitle="Understand how conversations change over time."
        onRefresh={() => fetchNarratives(true)}
        refreshing={refreshing}
      />

      <main className="px-8 py-6">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Activity className="w-6 h-6 text-nexus-muted animate-pulse mx-auto mb-3" />
              <p className="text-nexus-text-secondary text-sm">Generating embeddings and clustering narratives…</p>
              <p className="text-nexus-muted text-xs mt-1">Requires ML service at port 8000</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="nexus-surface rounded-xl p-6 border-nexus-warning/30 mb-6">
            <p className="text-nexus-warning text-sm font-medium">Analysis Unavailable</p>
            <p className="text-nexus-text-secondary text-xs mt-1">{error}</p>
          </div>
        )}

        {data && !loading && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <MetricCard label="Narratives Detected" value={data.narratives.length} />
              <MetricCard label="High Mutation" value={highMutation} subtitle={highMutation > 0 ? 'mutation > 30%' : 'None above threshold'} />
              <MetricCard label="Posts Analyzed" value={data.totalPostsAnalyzed} />
              <MetricCard
                label="Embedding Coverage"
                value={`${(data.coverage.embeddings * 100).toFixed(0)}%`}
                subtitle={`${data.method.embeddingModel}`}
              />
            </div>

            {/* Method transparency */}
            <div className="flex flex-wrap gap-4 text-[11px] text-nexus-muted mb-8 px-1">
              <span>Clustering: <span className="text-nexus-text-secondary">{data.method.clustering}</span></span>
              <span>Threshold: <span className="text-nexus-text-secondary">{data.method.similarityThreshold}</span></span>
              <span>Formula: <span className="text-nexus-text-secondary">{data.method.mutationFormula}</span></span>
            </div>

            {/* Empty state */}
            {data.narratives.length === 0 && (
              <div className="nexus-surface rounded-xl p-10 text-center">
                <TrendingUp className="w-8 h-8 text-nexus-muted mx-auto mb-3" strokeWidth={1} />
                {data.coverage.embeddings === 0 ? (
                  <>
                    <p className="text-nexus-text-primary text-sm font-medium mb-1">
                      Narrative detection unavailable
                    </p>
                    <p className="text-nexus-muted text-xs max-w-md mx-auto">
                      Clustering needs sentence embeddings, and the ML service was unreachable, so 0 of {data.totalPostsAnalyzed} posts were embedded.
                      Start the ML service (<code className="text-nexus-accent">uvicorn main:app --port 8000</code> in <code className="text-nexus-accent">ml/</code>) and reload.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-nexus-text-secondary text-sm mb-1">No narratives detected</p>
                    <p className="text-nexus-muted text-xs">
                      All {data.totalPostsAnalyzed} posts were embedded, but none were similar enough to group above the similarity threshold ({data.method.similarityThreshold}). This is a real result.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Narrative cards */}
            <div className="space-y-3">
              {data.narratives.map((n) => (
                <NarrativeCard
                  key={n.id}
                  narrative={n}
                  expanded={expandedId === n.id}
                  onToggle={() => setExpandedId(expandedId === n.id ? null : n.id)}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </NexusLayout>
  );
}

// ── Narrative Card ────────────────────────────────────────────────────────

function NarrativeCard({ narrative: n, expanded, onToggle }: {
  narrative: Narrative; expanded: boolean; onToggle: () => void;
}) {
  const severity = mutationSeverity(n.mutationScore);

  return (
    <div className="nexus-surface rounded-xl overflow-hidden nexus-card-hover">
      {/* Header */}
      <button onClick={onToggle} className="w-full text-left px-6 py-5 flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-3 mb-2">
            <span className={`text-lg font-semibold nexus-metric ${severity.color}`}>
              {n.mutationScore !== null ? `${n.mutationScore.toFixed(1)}%` : '—'}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-nexus-muted">mutation</span>
            {n.platforms.map(p => (
              <span key={p} className="text-[10px] px-2 py-0.5 rounded bg-nexus-surface-secondary text-nexus-text-secondary border border-nexus-border">
                {PLATFORM_LABELS[p] || p}
              </span>
            ))}
          </div>

          <h3 className="text-[15px] font-medium text-nexus-text-primary truncate">{n.title}</h3>

          <div className="flex items-center gap-3 mt-2 text-[11px] text-nexus-muted">
            <span>{n.postCount} posts</span>
            <span>·</span>
            <span>{fmtDate(n.firstSeen)} → {fmtDate(n.lastSeen)}</span>
            <span>·</span>
            <span className={
              n.dominantSentiment === 'positive' ? 'text-nexus-positive' :
              n.dominantSentiment === 'negative' ? 'text-nexus-negative' :
              'text-nexus-text-secondary'
            }>{n.dominantSentiment || 'Unknown'}</span>
            <span>·</span>
            <span>{n.dominantEmotion || 'Unknown'}</span>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-nexus-muted mt-1" /> : <ChevronDown className="w-4 h-4 text-nexus-muted mt-1" />}
      </button>

      {/* Detail */}
      {expanded && (
        <div className="border-t border-nexus-border px-6 py-6 space-y-8">
          {/* Mutation Breakdown */}
          <div>
            <span className="nexus-analytical">Mutation Breakdown</span>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
              <ShiftBar label="Semantic" value={n.semanticShift} weight="40%" />
              <ShiftBar label="Sentiment" value={n.sentimentShift} weight="25%" />
              <ShiftBar label="Emotion" value={n.emotionShift} weight="20%" />
              <ShiftBar label="Keywords" value={n.keywordShift} weight="15%" />
            </div>
          </div>

          {/* Platform Sequence */}
          {n.platformFlow.length > 0 && (
            <div>
              <span className="nexus-analytical">Observed Platform Sequence</span>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                {n.platformFlow.map((pf, i) => (
                  <React.Fragment key={pf.platform}>
                    {i > 0 && <ArrowDown className="w-3 h-3 text-nexus-muted rotate-[-90deg]" />}
                    <div className="px-4 py-2.5 rounded-lg bg-nexus-surface-secondary border border-nexus-border">
                      <span className="text-[12px] font-medium text-nexus-text-primary">
                        {PLATFORM_LABELS[pf.platform] || pf.platform}
                      </span>
                      <span className="text-[10px] text-nexus-muted ml-2">
                        {pf.postCount} posts · {fmtDateShort(pf.firstSeen)}
                      </span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
              <p className="text-[10px] text-nexus-muted mt-2 italic">Temporal association — does not imply propagation causality.</p>
            </div>
          )}

          {/* Keyword Evolution */}
          {n.keywordEvolution.length > 0 && (
            <div>
              <span className="nexus-analytical">Keyword Evolution</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                {n.keywordEvolution.map(stage => (
                  <div key={stage.stage} className="rounded-lg bg-nexus-surface-secondary/60 border border-nexus-border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="nexus-label">{stage.stage}</span>
                      <span className="text-[10px] text-nexus-muted">
                        {fmtDateShort(stage.periodStart)} – {fmtDateShort(stage.periodEnd)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {stage.keywords.map(kw => (
                        <span key={kw} className="text-[11px] px-2 py-0.5 rounded-md bg-nexus-accent/5 text-nexus-accent border border-nexus-accent/10">
                          {kw}
                        </span>
                      ))}
                      {stage.keywords.length === 0 && (
                        <span className="text-[10px] text-nexus-muted italic">No keywords</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          {n.timeline.length > 0 && (
            <div>
              <span className="nexus-analytical">Narrative Timeline ({n.timeline.length} posts)</span>
              <div className="space-y-0 mt-3 max-h-72 overflow-y-auto pr-1">
                {n.timeline.map((entry, i) => (
                  <div key={entry.postId} className="flex items-start gap-3 text-[12px]">
                    <div className="flex flex-col items-center flex-shrink-0 pt-1">
                      <div className={`w-2 h-2 rounded-full ${
                        entry.sentiment === 'positive' ? 'bg-nexus-positive' :
                        entry.sentiment === 'negative' ? 'bg-nexus-negative' :
                        'bg-nexus-accent-steel'
                      }`} />
                      {i < n.timeline.length - 1 && <div className="w-px h-10 bg-nexus-border" />}
                    </div>
                    <div className="pb-4 min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-nexus-muted mb-0.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-nexus-surface-secondary border border-nexus-border">
                          {PLATFORM_LABELS[entry.platform] || entry.platform}
                        </span>
                        <span>{fmtDate(entry.timestamp)}</span>
                        <span className={
                          entry.sentiment === 'positive' ? 'text-nexus-positive' :
                          entry.sentiment === 'negative' ? 'text-nexus-negative' :
                          'text-nexus-text-secondary'
                        }>{entry.sentiment}</span>
                        <span>{entry.emotion}</span>
                      </div>
                      <p className="text-nexus-text-secondary truncate">{entry.contentSnippet}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Link to Full Dossier */}
          <div className="pt-2 flex justify-end">
            <Link
              href={`/narratives/${n.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-nexus-surface-secondary border border-nexus-border text-xs text-nexus-text-primary hover:border-nexus-accent/40 nexus-transition"
            >
              <span>View Full Dossier & Trajectory</span>
              <ExternalLink className="w-3.5 h-3.5 text-nexus-muted" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shift Bar ─────────────────────────────────────────────────────────────

function ShiftBar({ label, value, weight }: { label: string; value: number | null; weight: string }) {
  const width = value !== null ? Math.min(value, 100) : 0;
  const color = value === null ? 'bg-nexus-border' : value >= 60 ? 'bg-nexus-negative' : value >= 30 ? 'bg-nexus-warning' : 'bg-nexus-positive';

  return (
    <div className="rounded-lg bg-nexus-surface-secondary/60 border border-nexus-border p-3">
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <span className="text-[11px] text-nexus-text-secondary">{label}</span>
          <span className="text-[9px] text-nexus-muted ml-1.5">({weight})</span>
        </div>
        <span className={`text-[12px] font-medium nexus-metric ${
          value === null ? 'text-nexus-muted' : value >= 60 ? 'text-nexus-negative' : value >= 30 ? 'text-nexus-warning' : 'text-nexus-positive'
        }`}>
          {metricDisplay(value)}
        </span>
      </div>
      <div className="h-1 bg-nexus-border rounded-full overflow-hidden">
        <div className={`h-full rounded-full nexus-transition ${color}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
