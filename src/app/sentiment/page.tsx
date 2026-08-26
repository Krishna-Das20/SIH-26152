'use client';

import React, { useState, useEffect } from 'react';
import { NexusLayout, TopBar, MetricCard, SectionHeader } from '@/components/nexus';
import { Activity } from 'lucide-react';

export default function SentimentPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics/sentiment')
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <NexusLayout>
      <TopBar
        title="Sentiment & Emotion Analysis"
        subtitle="Multi-dimensional sentiment classification, GoEmotions distribution, and stance mapping."
      />
      <main className="px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Activity className="w-6 h-6 text-nexus-muted animate-pulse" />
          </div>
        ) : data ? (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <MetricCard label="Total Scored Posts" value={data.totalPosts || 0} />
              <MetricCard
                label="Sarcasm Index"
                value={`${data.sarcasmRate || 0}%`}
                subtitle="Posts identified with sarcastic framing"
              />
              <MetricCard
                label="Dominant Stance"
                value={
                  data.stanceDistribution?.sort((a: any, b: any) => b.value - a.value)[0]?.name || '—'
                }
              />
              <MetricCard
                label="Dominant Emotion"
                value={
                  data.emotionRadar
                    ?.filter((e: any) => e.rawCount > 0)
                    .sort((a: any, b: any) => b.rawCount - a.rawCount)[0]?.emotion || '—'
                }
              />
            </div>

            {/* Stance & Emotion Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Stance Distribution */}
              <div className="nexus-surface rounded-xl p-6">
                <SectionHeader
                  title="Stance Distribution"
                  subtitle="Supportive vs opposing sentiment split across corpus"
                />
                <div className="space-y-4">
                  {(data.stanceDistribution || []).map((item: any) => {
                    const total =
                      data.stanceDistribution.reduce((s: number, i: any) => s + i.value, 0) || 1;
                    const pct = Math.round((item.value / total) * 100);
                    const color = item.name.includes('Supportive')
                      ? 'bg-nexus-positive'
                      : item.name.includes('Opposing')
                      ? 'bg-nexus-negative'
                      : 'bg-nexus-accent-steel';
                    return (
                      <div key={item.name}>
                        <div className="flex justify-between mb-1.5">
                          <span className="text-[12px] text-nexus-text-secondary">{item.name}</span>
                          <span className="text-[12px] font-medium text-nexus-text-primary nexus-metric">
                            {item.value} posts ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 bg-nexus-surface-secondary rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Emotion Breakdown */}
              <div className="nexus-surface rounded-xl p-6">
                <SectionHeader
                  title="Dominant Emotion Classification"
                  subtitle="28-label GoEmotions transformer model predictions"
                />
                <div className="space-y-3">
                  {(data.emotionRadar || [])
                    .filter((e: any) => e.rawCount > 0)
                    .sort((a: any, b: any) => b.rawCount - a.rawCount)
                    .slice(0, 7)
                    .map((e: any) => (
                      <div
                        key={e.emotion}
                        className="flex items-center justify-between py-2 border-b border-nexus-border last:border-0"
                      >
                        <span className="text-[13px] text-nexus-text-secondary">{e.emotion}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-nexus-muted">{e.rawCount} mentions</span>
                          <span className="text-[12px] font-medium text-nexus-text-primary nexus-metric w-12 text-right">
                            {e.value}%
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Temporal Timeline */}
            {data.temporalTimeline && data.temporalTimeline.length > 0 && (
              <div className="nexus-surface rounded-xl p-6">
                <SectionHeader
                  title="Sentiment Dynamics Over Time"
                  subtitle="Hourly sentiment scores (-1.0 to +1.0) and post volume"
                />
                <div className="overflow-x-auto pt-4 pb-2">
                  <div className="flex items-center gap-2 min-w-[700px] h-40 relative px-2">
                    {/* Zero baseline */}
                    <div className="absolute left-0 right-0 top-1/2 h-px bg-nexus-border z-0" />

                    {data.temporalTimeline.map((point: any, i: number) => {
                      const score = point.sentimentScore || 0;
                      const isPositive = score >= 0;
                      const barHeight = Math.max(Math.min(Math.abs(score) * 60, 60), 8);

                      return (
                        <div
                          key={i}
                          className="flex-1 h-full flex flex-col items-center justify-center relative group z-10"
                        >
                          {/* Upper half (Positive) */}
                          <div className="h-1/2 w-full flex items-end justify-center pb-0.5">
                            {isPositive && (
                              <div
                                className="w-full max-w-[18px] bg-nexus-positive/80 hover:bg-nexus-positive rounded-t-sm transition-all"
                                style={{ height: `${barHeight}px` }}
                                title={`${point.timestamp}: Score +${score.toFixed(2)} (${point.postVolume} posts)`}
                              />
                            )}
                          </div>

                          {/* Lower half (Negative) */}
                          <div className="h-1/2 w-full flex items-start justify-center pt-0.5">
                            {!isPositive && (
                              <div
                                className="w-full max-w-[18px] bg-nexus-negative/80 hover:bg-nexus-negative rounded-b-sm transition-all"
                                style={{ height: `${barHeight}px` }}
                                title={`${point.timestamp}: Score ${score.toFixed(2)} (${point.postVolume} posts)`}
                              />
                            )}
                          </div>

                          {/* Timestamp label */}
                          <span className="absolute -bottom-5 text-[9px] font-mono text-nexus-muted whitespace-nowrap">
                            {point.timestamp?.replace(':00 UTC', 'h')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-nexus-muted text-sm">No sentiment data available.</p>
        )}
      </main>
    </NexusLayout>
  );
}
