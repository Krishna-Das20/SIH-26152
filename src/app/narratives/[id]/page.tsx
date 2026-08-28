'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { SkynetLayout, TopBar, MetricCard, SectionHeader } from '@/components/skynet';
import {
  NarrativeEvolutionMap,
  MutationBreakpointDrawer,
  EvidenceChainViewer,
  CrossPlatformMatrix,
} from '@/components/narratives';
import {
  ArrowLeft,
  Activity,
  Layers,
  Zap,
  Users,
  ShieldCheck,
  Split,
  MessageSquare,
  User,
  Clock,
  ExternalLink,
  Link2,
} from 'lucide-react';
import type { Narrative, NarrativeBreakpoint } from '@/lib/narratives/types';
import { getPostUrl, getParentSource } from '@/lib/urls';

export default function NarrativeDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [narrative, setNarrative] = useState<Narrative | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBreakpoint, setSelectedBreakpoint] = useState<NarrativeBreakpoint | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/analytics/narratives/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.narrative) {
          setNarrative(d.narrative);
          setError(null);
        } else {
          setError(d.detail || d.error || 'Narrative not found');
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load narrative dossier.');
        setLoading(false);
      });
  }, [id]);

  return (
    <SkynetLayout>
      <TopBar
        title={`Narrative Dossier • ${id}`}
        subtitle="Deep-dive forensic evidence, temporal states, and cross-platform propagation analysis."
      />

      <main className="px-8 py-6 max-w-7xl">
        {/* Back link */}
        <div className="mb-6">
          <Link
            href="/narratives"
            className="inline-flex items-center gap-2 text-xs text-skynet-muted hover:text-skynet-text-primary transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Narrative Intelligence Workstation</span>
          </Link>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <Activity className="w-8 h-8 text-skynet-accent animate-pulse mx-auto mb-3" />
            <p className="text-skynet-text-primary text-sm font-medium">Loading narrative intelligence dossier…</p>
          </div>
        )}

        {error && !loading && (
          <div className="skynet-surface rounded-xl p-8 border-skynet-warning/40 text-center">
            <p className="text-skynet-warning text-sm font-bold">Dossier Unavailable</p>
            <p className="text-skynet-text-secondary text-xs mt-1">{error}</p>
          </div>
        )}

        {narrative && !loading && (
          <>
            {/* Header KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <MetricCard
                label="Composite Mutation"
                value={narrative.mutationScore !== null ? `${narrative.mutationScore}%` : 'N/A'}
                subtitle="8-dimension weighted calculation"
              />
              <MetricCard
                label="Corpus Footprint"
                value={`${narrative.postCount} posts`}
                subtitle={`Across ${narrative.platforms.join(', ')}`}
              />
              <MetricCard
                label="Confidence Level"
                value={narrative.confidence?.level || 'HIGH'}
                subtitle={`Score: ${narrative.confidence?.score || 0}%`}
              />
              <MetricCard
                label="Observation Span"
                value={`${narrative.timeSpanHours} hours`}
                subtitle="First seen to latest post"
              />
            </div>

            {/* Hero Evolution Map */}
            <div className="mb-8">
              <NarrativeEvolutionMap
                narrative={narrative}
                onSelectBreakpoint={(bp) => setSelectedBreakpoint(bp)}
              />
            </div>

            {/* 8-Dimension Shift Breakdown Grid */}
            <div className="skynet-surface rounded-xl p-6 mb-8 border border-skynet-border">
              <SectionHeader
                title="8-Dimension Mutation Vector Analysis"
                subtitle="Mathematical breakdown of shifts between initial and latest narrative stages"
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3 mt-4">
                <div className="p-3 rounded-xl bg-skynet-surface-secondary/50 border border-skynet-border text-center">
                  <span className="text-[10px] font-mono uppercase text-skynet-muted block">Semantic</span>
                  <span className="text-base font-bold text-skynet-text-primary skynet-metric">
                    {narrative.semanticShift !== null ? `${narrative.semanticShift}%` : '—'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-skynet-surface-secondary/50 border border-skynet-border text-center">
                  <span className="text-[10px] font-mono uppercase text-skynet-muted block">Sentiment</span>
                  <span className="text-base font-bold text-skynet-text-primary skynet-metric">
                    {narrative.sentimentShift !== null ? `${narrative.sentimentShift}%` : '—'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-skynet-surface-secondary/50 border border-skynet-border text-center">
                  <span className="text-[10px] font-mono uppercase text-skynet-muted block">Emotion</span>
                  <span className="text-base font-bold text-skynet-text-primary skynet-metric">
                    {narrative.emotionShift !== null ? `${narrative.emotionShift}%` : '—'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-skynet-surface-secondary/50 border border-skynet-border text-center">
                  <span className="text-[10px] font-mono uppercase text-skynet-muted block">Keyword</span>
                  <span className="text-base font-bold text-skynet-text-primary skynet-metric">
                    {narrative.keywordShift !== null ? `${narrative.keywordShift}%` : '—'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-skynet-surface-secondary/50 border border-skynet-border text-center">
                  <span className="text-[10px] font-mono uppercase text-skynet-muted block">Entity</span>
                  <span className="text-base font-bold text-skynet-text-primary skynet-metric">
                    {narrative.entityShift !== null ? `${narrative.entityShift}%` : '—'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-skynet-surface-secondary/50 border border-skynet-border text-center">
                  <span className="text-[10px] font-mono uppercase text-skynet-muted block">Platform</span>
                  <span className="text-base font-bold text-skynet-text-primary skynet-metric">
                    {narrative.platformShift !== null ? `${narrative.platformShift}%` : '—'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-skynet-surface-secondary/50 border border-skynet-border text-center">
                  <span className="text-[10px] font-mono uppercase text-skynet-muted block">Community</span>
                  <span className="text-base font-bold text-skynet-text-primary skynet-metric">
                    {narrative.communityShift !== null ? `${narrative.communityShift}%` : '—'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-skynet-surface-secondary/50 border border-skynet-border text-center">
                  <span className="text-[10px] font-mono uppercase text-skynet-muted block">Amplification</span>
                  <span className="text-base font-bold text-skynet-text-primary skynet-metric">
                    {narrative.amplificationShift !== null ? `${narrative.amplificationShift}%` : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Evidence & Why Mutated */}
            <div className="mb-8">
              <EvidenceChainViewer
                evidenceChain={narrative.evidenceChain}
                whyMutated={narrative.whyMutated}
              />
            </div>

            {/* Cross-Platform Framing Matrix */}
            {narrative.crossPlatformMatrix && narrative.crossPlatformMatrix.length > 0 && (
              <div className="mb-8">
                <CrossPlatformMatrix matrix={narrative.crossPlatformMatrix} />
              </div>
            )}

            {/* Propagation Path & Amplifiers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Propagation Timeline */}
              <div className="skynet-surface rounded-xl p-6 border border-skynet-border">
                <SectionHeader
                  title="Cross-Platform Propagation Journey"
                  subtitle={`Origin on ${narrative.propagation.originPlatform} spreading across ${narrative.propagation.hops.length} channels`}
                />
                <div className="space-y-3 mt-4">
                  {narrative.propagation.hops.map((hop, idx) => (
                    <div
                      key={hop.platform + idx}
                      className="flex items-center justify-between p-3 rounded-xl bg-skynet-surface-secondary/50 border border-skynet-border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-skynet-surface border border-skynet-border flex items-center justify-center text-[10px] font-mono font-bold text-skynet-accent">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-skynet-text-primary uppercase tracking-wider">
                            {hop.platform}
                          </p>
                          <p className="text-[10px] text-skynet-muted">
                            {hop.postCount} posts observed
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-skynet-text-primary">
                          +{hop.delayHours}h
                        </span>
                        <p className="text-[10px] text-skynet-muted">from origin</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Influential Amplifiers */}
              <div className="skynet-surface rounded-xl p-6 border border-skynet-border">
                <SectionHeader
                  title="Associated Key Opinion Leaders"
                  subtitle="Accounts associated with early amplification or mutation shift"
                />
                <div className="space-y-3 mt-4">
                  {narrative.topAmplifiers && narrative.topAmplifiers.length > 0 ? (
                    narrative.topAmplifiers.map((amp, idx) => (
                      <div
                        key={amp.id || idx}
                        className="flex items-center justify-between p-3 rounded-xl bg-skynet-surface-secondary/50 border border-skynet-border"
                      >
                        <div className="flex items-center gap-3">
                          <User className="w-4 h-4 text-skynet-muted" />
                          <div>
                            <p className="text-xs font-semibold text-skynet-text-primary">
                              {amp.displayName || amp.username}
                            </p>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-skynet-surface text-skynet-muted border border-skynet-border">
                              {amp.platform}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-mono font-semibold text-skynet-accent">
                            Score: {amp.influenceScore}
                          </span>
                          {amp.associatedWithShift && (
                            <span className="text-[10px] text-skynet-warning block">
                              Associated with shift
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-skynet-muted py-3">
                      Grassroots dispersion without concentrated KOL amplifiers.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Full Chronological Post Audit Trail */}
            <div className="skynet-surface rounded-xl p-6 border border-skynet-border">
              <SectionHeader
                title="Chronological Post Evidence Trail"
                subtitle={`Complete audit trail of all ${narrative.timeline?.length || 0} posts grouped in this cluster`}
              />
              <div className="space-y-3 mt-4">
                {narrative.timeline?.map((post, idx) => (
                  <div
                    key={post.postId || idx}
                    className={`p-4 rounded-xl border transition-all text-xs ${
                      post.isBreakpointTrigger
                        ? 'bg-skynet-surface-secondary border-skynet-warning/50'
                        : 'bg-skynet-surface-secondary/40 border-skynet-border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-skynet-text-primary">
                          {post.authorDisplayName || post.authorUsername}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-skynet-surface text-skynet-muted border border-skynet-border">
                          {post.platform}
                        </span>
                        {post.isBreakpointTrigger && (
                          <span className="text-[10px] font-bold text-skynet-warning bg-skynet-warning/15 px-2 py-0.5 rounded border border-skynet-warning/30 flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            <span>TRIGGER ANCHOR</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-skynet-muted">
                        {new Date(post.timestamp).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          // Corpus spans 2024-2026 -- without the year an
                          // ordered timeline looks like it runs backwards.
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        UTC
                      </span>
                    </div>

                    <p className="text-skynet-text-secondary leading-relaxed mb-2">
                      &ldquo;{post.contentSnippet}&rdquo;
                    </p>

                    {/* Source post link if comment */}
                    {(() => {
                      const directUrl = getPostUrl({
                        id: post.postId,
                        platform: post.platform,
                        url: post.url,
                        inReplyToPostId: post.inReplyToPostId,
                      });
                      const parentSource = getParentSource({
                        id: post.postId,
                        platform: post.platform,
                        url: post.url,
                        inReplyToPostId: post.inReplyToPostId,
                      });

                      return (
                        <div className="space-y-1.5 mb-2.5">
                          {parentSource && parentSource.url && (
                            <div className="p-2 rounded-lg bg-skynet-surface border border-skynet-border/60 flex items-center justify-between text-[11px]">
                              <span className="text-skynet-muted flex items-center gap-1.5">
                                <Link2 className="w-3 h-3 text-skynet-accent" />
                                <span>Comment on {parentSource.label}:</span>
                                <strong className="text-skynet-text-secondary font-mono">
                                  {parentSource.id}
                                </strong>
                              </span>
                              <a
                                href={parentSource.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-skynet-accent hover:underline flex items-center gap-1 font-semibold"
                              >
                                <span>Source Video/Post</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}

                          {directUrl && (
                            <a
                              href={directUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-skynet-accent hover:underline"
                            >
                              <span>View Original Post on {post.platform}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      );
                    })()}

                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="px-2 py-0.5 rounded bg-skynet-surface text-skynet-muted border border-skynet-border capitalize">
                        Sentiment: {post.sentiment}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-skynet-surface text-skynet-muted border border-skynet-border capitalize">
                        Emotion: {post.emotion}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Breakpoint Inspection Drawer */}
      <MutationBreakpointDrawer
        breakpoint={selectedBreakpoint}
        timelinePosts={narrative?.timeline || []}
        onClose={() => setSelectedBreakpoint(null)}
      />
    </SkynetLayout>
  );
}
