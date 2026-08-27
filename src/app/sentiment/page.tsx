'use client';

import React, { useState, useEffect } from 'react';
import { NexusLayout, TopBar, MetricCard, SectionHeader } from '@/components/nexus';
import { Activity, Smile, Frown, Meh, Sparkles, TrendingUp } from 'lucide-react';

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
        subtitle="Multi-dimensional affective classification, GoEmotions distribution, and stance mapping."
      />
      <main className="px-8 py-6 max-w-7xl">
        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 rounded-2xl cred-card shimmer-skeleton border border-white/5" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-72 rounded-2xl cred-card shimmer-skeleton border border-white/5" />
              <div className="h-72 rounded-2xl cred-card shimmer-skeleton border border-white/5" />
            </div>
          </div>
        ) : data ? (
          <div className="space-y-8 smooth-enter">
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Total Scored Posts"
                value={data.totalPosts ? data.totalPosts.toLocaleString() : '0'}
                icon={<Sparkles className="w-4 h-4 text-cyan-400" />}
              />
              <MetricCard
                label="Sarcasm Index"
                value={`${data.sarcasmRate || 0}%`}
                subtitle="Posts identified with sarcastic framing"
                icon={<Meh className="w-4 h-4 text-amber-400" />}
              />
              <MetricCard
                label="Dominant Stance"
                value={
                  data.stanceDistribution?.sort((a: any, b: any) => b.value - a.value)[0]?.name || '—'
                }
                icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
              />
              <MetricCard
                label="Dominant Emotion"
                value={
                  data.emotionRadar
                    ?.filter((e: any) => e.rawCount > 0)
                    .sort((a: any, b: any) => b.rawCount - a.rawCount)[0]?.emotion || '—'
                }
                icon={<Smile className="w-4 h-4 text-cyan-400" />}
              />
            </div>

            {/* Stance & Emotion Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Stance Distribution */}
              <div className="cred-card cred-card-hover rounded-2xl p-6 border border-white/[0.08]">
                <SectionHeader
                  title="Stance Consensus"
                  subtitle="Supportive vs opposing sentiment split across corpus"
                />
                <div className="space-y-4 mt-4">
                  {(data.stanceDistribution || []).map((item: any) => {
                    const total =
                      data.stanceDistribution.reduce((s: number, i: any) => s + i.value, 0) || 1;
                    const pct = Math.round((item.value / total) * 100);
                    const color = item.name.includes('Supportive')
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : item.name.includes('Opposing')
                      ? 'bg-gradient-to-r from-rose-500 to-pink-500'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-500';
                    return (
                      <div key={item.name} className="group">
                        <div className="flex justify-between mb-2">
                          <span className="text-xs text-neutral-300 font-semibold">{item.name}</span>
                          <span className="text-xs font-mono font-bold text-white">
                            {item.value.toLocaleString()} posts ({pct}%)
                          </span>
                        </div>
                        <div className="h-2.5 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                          <div
                            className={`h-full rounded-full ${color} transition-all duration-500 group-hover:brightness-110`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Emotion Breakdown */}
              <div className="cred-card cred-card-hover rounded-2xl p-6 border border-white/[0.08]">
                <SectionHeader
                  title="Dominant Emotion Classification"
                  subtitle="Plutchik 8-emotion distribution & affective vectors"
                />
                <div className="space-y-2.5 mt-4">
                  {(data.emotionRadar || [])
                    .filter((e: any) => e.rawCount > 0)
                    .sort((a: any, b: any) => b.rawCount - a.rawCount)
                    .slice(0, 7)
                    .map((e: any) => (
                      <div
                        key={e.emotion}
                        className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 transition-all duration-200"
                      >
                        <span className="text-xs font-semibold text-neutral-200">{e.emotion}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-mono text-neutral-400">
                            {e.rawCount.toLocaleString()} mentions
                          </span>
                          <span className="liquid-glass-badge text-[10px] font-bold px-2 py-0.5 rounded-full text-cyan-400 border border-cyan-400/30 w-12 text-center">
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
              <div className="cred-card cred-card-hover rounded-2xl p-6 border border-white/[0.08]">
                <SectionHeader
                  title="Sentiment Dynamics Over Time"
                  subtitle="Hourly sentiment scores (-1.0 to +1.0) and post volume"
                />
                <div className="overflow-x-auto pt-6 pb-4">
                  <div className="flex items-center gap-2.5 min-w-[700px] h-44 relative px-3">
                    {/* Zero baseline */}
                    <div className="absolute left-0 right-0 top-1/2 h-px bg-white/10 z-0" />

                    {data.temporalTimeline.map((point: any, i: number) => {
                      const score = point.sentimentScore || 0;
                      const isPositive = score >= 0;
                      const barHeight = Math.max(Math.min(Math.abs(score) * 65, 65), 10);

                      return (
                        <div
                          key={i}
                          className="flex-1 h-full flex flex-col items-center justify-center relative group z-10"
                        >
                          {/* Upper half (Positive) */}
                          <div className="h-1/2 w-full flex items-end justify-center pb-0.5">
                            {isPositive && (
                              <div
                                className="w-full max-w-[20px] bg-emerald-400/80 hover:bg-emerald-400 rounded-t-md transition-all duration-200 shadow-[0_0_12px_rgba(52,211,153,0.3)] hover:scale-105"
                                style={{ height: `${barHeight}px` }}
                                title={`${point.timestamp}: Score +${score.toFixed(2)} (${point.postVolume} posts)`}
                              />
                            )}
                          </div>

                          {/* Lower half (Negative) */}
                          <div className="h-1/2 w-full flex items-start justify-center pt-0.5">
                            {!isPositive && (
                              <div
                                className="w-full max-w-[20px] bg-rose-500/80 hover:bg-rose-500 rounded-b-md transition-all duration-200 shadow-[0_0_12px_rgba(244,63,94,0.3)] hover:scale-105"
                                style={{ height: `${barHeight}px` }}
                                title={`${point.timestamp}: Score ${score.toFixed(2)} (${point.postVolume} posts)`}
                              />
                            )}
                          </div>

                          {/* Timestamp label */}
                          <span className="absolute -bottom-5 text-[9px] font-mono text-neutral-400 whitespace-nowrap group-hover:text-white transition-colors">
                            {point.timestamp?.replace(':00 UTC', 'h')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-neutral-400 text-sm">No sentiment data available.</p>
        )}
      </main>
    </NexusLayout>
  );
}
