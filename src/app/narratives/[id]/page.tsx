'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { NexusLayout, TopBar, MetricCard, SectionHeader } from '@/components/nexus';
import {
  TrendingUp,
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  Layers,
  Clock,
  Sparkles,
  Share2,
  Check,
  ExternalLink,
} from 'lucide-react';

interface TimelineEntry {
  timestamp: string;
  platform: string;
  postId: string;
  sentiment: string;
  emotion: string;
  contentSnippet: string;
}

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

const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  telegram: 'Telegram',
  x: 'X',
  reddit: 'Reddit',
  instagram: 'Instagram',
  facebook: 'Facebook',
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function fmtDateShort(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

function metricDisplay(v: number | null, suffix = '%'): string {
  if (v === null) return 'Unknown';
  return `${v.toFixed(1)}${suffix}`;
}

export default function NarrativeDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [narrative, setNarrative] = useState<Narrative | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/analytics/narratives/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.detail || data.error);
        } else {
          setNarrative(data.narrative);
        }
      })
      .catch((e) => setError('Failed to load narrative details.'))
      .finally(() => setLoading(false));
  }, [id]);

  const copyId = () => {
    if (narrative?.id) {
      navigator.clipboard.writeText(narrative.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <NexusLayout>
      <TopBar
        title="Narrative Dossier"
        subtitle={`Deep-dive mutation and trajectory analysis for narrative ${id || ''}`}
      >
        <Link
          href="/narratives"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-nexus-surface border border-nexus-border text-xs text-nexus-text-secondary hover:text-nexus-text-primary hover:bg-nexus-surface-secondary nexus-transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All Narratives
        </Link>
      </TopBar>

      <main className="px-8 py-6 max-w-7xl">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <Activity className="w-6 h-6 text-nexus-muted animate-pulse mx-auto mb-3" />
              <p className="text-nexus-text-secondary text-sm">
                Assembling narrative dossier…
              </p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="nexus-surface rounded-xl p-8 border-nexus-warning/30 text-center">
            <p className="text-nexus-warning text-sm font-medium mb-1">
              Narrative Not Found
            </p>
            <p className="text-nexus-muted text-xs mb-4">{error}</p>
            <Link
              href="/narratives"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-nexus-surface-secondary border border-nexus-border text-xs text-nexus-text-primary hover:border-nexus-accent/40 nexus-transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Return to Narrative Index
            </Link>
          </div>
        )}

        {narrative && !loading && (
          <div className="space-y-8">
            {/* Header Card */}
            <div className="nexus-surface rounded-2xl p-8 relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3">
                    <button
                      onClick={copyId}
                      className="px-2.5 py-1 rounded bg-nexus-surface-secondary border border-nexus-border text-[11px] font-mono text-nexus-text-secondary hover:text-nexus-text-primary flex items-center gap-1.5 nexus-transition"
                      title="Click to copy narrative ID"
                    >
                      <span>ID: {narrative.id}</span>
                      {copied ? (
                        <Check className="w-3 h-3 text-nexus-positive" />
                      ) : (
                        <Share2 className="w-3 h-3 text-nexus-muted" />
                      )}
                    </button>
                    {narrative.platforms.map((p) => (
                      <span
                        key={p}
                        className="text-[10px] px-2 py-0.5 rounded bg-nexus-surface-secondary text-nexus-text-secondary border border-nexus-border font-medium"
                      >
                        {PLATFORM_LABELS[p] || p}
                      </span>
                    ))}
                  </div>

                  <h1 className="text-2xl font-semibold text-nexus-text-primary tracking-tight mb-3">
                    {narrative.title}
                  </h1>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-nexus-muted">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {fmtDate(narrative.firstSeen)} → {fmtDate(narrative.lastSeen)}
                    </span>
                    <span>·</span>
                    <span>{narrative.postCount} observed posts</span>
                    <span>·</span>
                    <span>Total Engagement: {narrative.engagement.toLocaleString()}</span>
                  </div>
                </div>

                {/* Big Mutation Score */}
                <div className="nexus-surface-elevated rounded-xl p-5 border border-nexus-border flex flex-col items-center justify-center min-w-[160px] text-center">
                  <span className="nexus-label mb-1">Composite Mutation</span>
                  <span
                    className={`text-3xl font-bold nexus-metric ${
                      narrative.mutationScore === null
                        ? 'text-nexus-muted'
                        : narrative.mutationScore >= 60
                        ? 'text-nexus-negative'
                        : narrative.mutationScore >= 30
                        ? 'text-nexus-warning'
                        : 'text-nexus-positive'
                    }`}
                  >
                    {metricDisplay(narrative.mutationScore)}
                  </span>
                  <span className="text-[10px] text-nexus-muted mt-1">
                    {narrative.mutationScore !== null && narrative.mutationScore >= 60
                      ? 'Severe Structural Shift'
                      : narrative.mutationScore !== null && narrative.mutationScore >= 30
                      ? 'Moderate Drift'
                      : narrative.mutationScore !== null
                      ? 'Stable Narrative'
                      : 'Unmeasured'}
                  </span>
                </div>
              </div>
            </div>

            {/* Mutation Breakdown Gauges */}
            <div>
              <SectionHeader
                title="Mutation Vector Breakdown"
                subtitle="Four independent axes of transformation between early and late observations."
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <DetailShiftCard
                  title="Semantic Shift"
                  value={narrative.semanticShift}
                  weight="40%"
                  description="Centroid cosine distance of 384-dim all-MiniLM-L6-v2 embeddings."
                />
                <DetailShiftCard
                  title="Sentiment Shift"
                  value={narrative.sentimentShift}
                  weight="25%"
                  description="Total Variation Distance over positive, neutral, negative distributions."
                />
                <DetailShiftCard
                  title="Emotion Shift"
                  value={narrative.emotionShift}
                  weight="20%"
                  description="Dominant RoBERTa GoEmotions transition distance."
                />
                <DetailShiftCard
                  title="Keyword Shift"
                  value={narrative.keywordShift}
                  weight="15%"
                  description="1 - Jaccard similarity across early vs late top-5 extracted terms."
                />
              </div>
            </div>

            {/* Platform Progression Flow */}
            {narrative.platformFlow.length > 0 && (
              <div className="nexus-surface rounded-xl p-6">
                <SectionHeader
                  title="Cross-Platform Temporal Progression"
                  subtitle="Chronological sequence of platforms where this narrative was observed."
                />
                <div className="flex items-center gap-3 overflow-x-auto py-2">
                  {narrative.platformFlow.map((pf, i) => (
                    <React.Fragment key={pf.platform}>
                      {i > 0 && (
                        <div className="flex items-center text-nexus-muted">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      )}
                      <div className="px-5 py-3 rounded-xl bg-nexus-surface-secondary border border-nexus-border flex-shrink-0 min-w-[200px]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-nexus-text-primary">
                            {PLATFORM_LABELS[pf.platform] || pf.platform}
                          </span>
                          <span className="text-[10px] font-mono text-nexus-accent">
                            Stage 0{i + 1}
                          </span>
                        </div>
                        <p className="text-[11px] text-nexus-text-secondary">
                          {pf.postCount} posts observed
                        </p>
                        <p className="text-[10px] text-nexus-muted mt-1">
                          First: {fmtDate(pf.firstSeen)}
                        </p>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
                <p className="text-[11px] text-nexus-muted mt-4 italic">
                  * Note: Temporal sequence indicates chronological observation, not proven cross-platform causality.
                </p>
              </div>
            )}

            {/* Three-Stage Narrative Evolution */}
            {narrative.keywordEvolution.length > 0 && (
              <div>
                <SectionHeader
                  title="Narrative Evolution by Stage"
                  subtitle="How keywords, terms, and framing mutated over the lifecycle."
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {narrative.keywordEvolution.map((stage, idx) => (
                    <div
                      key={stage.stage}
                      className="nexus-surface rounded-xl p-5 border border-nexus-border flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="nexus-label">
                            {stage.stage.toUpperCase()} STAGE
                          </span>
                          <span className="text-[10px] text-nexus-muted font-mono">
                            0{idx + 1} / 03
                          </span>
                        </div>
                        <p className="text-[11px] text-nexus-text-secondary mb-3">
                          {fmtDateShort(stage.periodStart)} – {fmtDateShort(stage.periodEnd)}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {stage.keywords.map((kw) => (
                            <span
                              key={kw}
                              className="text-xs px-2.5 py-1 rounded-md bg-nexus-surface-secondary text-nexus-accent border border-nexus-border"
                            >
                              {kw}
                            </span>
                          ))}
                          {stage.keywords.length === 0 && (
                            <span className="text-xs text-nexus-muted italic">
                              No distinct keywords
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chronological Post Dossier */}
            <div className="nexus-surface rounded-xl p-6">
              <SectionHeader
                title={`Underlying Post Dossier (${narrative.timeline.length} posts)`}
                subtitle="Complete chronological trail of all scored social posts composing this narrative cluster."
              />
              <div className="space-y-3 mt-4">
                {narrative.timeline.map((entry, idx) => (
                  <div
                    key={entry.postId}
                    className="p-4 rounded-lg bg-nexus-surface-secondary/50 border border-nexus-border hover:border-nexus-border/80 nexus-transition"
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-nexus-surface border border-nexus-border font-medium text-nexus-text-primary">
                          {PLATFORM_LABELS[entry.platform] || entry.platform}
                        </span>
                        <span className="text-[11px] text-nexus-muted font-mono">
                          {fmtDate(entry.timestamp)}
                        </span>
                        <span
                          className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded ${
                            entry.sentiment === 'positive'
                              ? 'bg-nexus-positive/10 text-nexus-positive'
                              : entry.sentiment === 'negative'
                              ? 'bg-nexus-negative/10 text-nexus-negative'
                              : 'bg-nexus-surface text-nexus-text-secondary'
                          }`}
                        >
                          {entry.sentiment}
                        </span>
                        <span className="text-[11px] text-nexus-text-secondary">
                          {entry.emotion}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-nexus-muted">
                        #{idx + 1}
                      </span>
                    </div>
                    <p className="text-[13px] text-nexus-text-primary leading-relaxed">
                      {entry.contentSnippet}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </NexusLayout>
  );
}

function DetailShiftCard({
  title,
  value,
  weight,
  description,
}: {
  title: string;
  value: number | null;
  weight: string;
  description: string;
}) {
  const width = value !== null ? Math.min(value, 100) : 0;
  const color =
    value === null
      ? 'bg-nexus-border'
      : value >= 60
      ? 'bg-nexus-negative'
      : value >= 30
      ? 'bg-nexus-warning'
      : 'bg-nexus-positive';

  return (
    <div className="nexus-surface rounded-xl p-5 border border-nexus-border flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-nexus-text-primary">
            {title}
          </span>
          <span className="text-[10px] text-nexus-muted font-mono">
            Weight: {weight}
          </span>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span
            className={`text-2xl font-bold nexus-metric ${
              value === null
                ? 'text-nexus-muted'
                : value >= 60
                ? 'text-nexus-negative'
                : value >= 30
                ? 'text-nexus-warning'
                : 'text-nexus-positive'
            }`}
          >
            {metricDisplay(value)}
          </span>
        </div>
        <div className="h-1.5 bg-nexus-surface-secondary rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full nexus-transition ${color}`}
            style={{ width: `${width}%` }}
          />
        </div>
      </div>
      <p className="text-[10px] text-nexus-muted leading-normal">
        {description}
      </p>
    </div>
  );
}
