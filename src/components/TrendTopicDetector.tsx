'use client';

import React from 'react';
import { TrendingUp, Zap, Sparkles, Hash } from 'lucide-react';
import { TrendTopic } from '@/types/intelligence';

interface TrendTopicDetectorProps {
  trends: TrendTopic[];
  onSelectTopic: (topic: string) => void;
}

export const TrendTopicDetector: React.FC<TrendTopicDetectorProps> = ({ trends, onSelectTopic }) => {
  return (
    <div className="intel-card rounded-xl p-4 border border-intel-border mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              Real-Time Trend & Viral Topic Detection
            </h3>
          </div>
        </div>
        <span className="text-xs font-mono text-slate-400">
          Z-Score Anomaly & Spike Scoring
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {trends.map((t) => (
          <div
            key={t.id}
            onClick={() => onSelectTopic(t.keyword)}
            className={`p-3 rounded-lg border transition-all cursor-pointer ${
              t.isSpike
                ? 'bg-amber-950/30 border-amber-500/60 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/10'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-sm text-white truncate max-w-[140px] flex items-center gap-1 font-mono">
                <Hash className="w-3.5 h-3.5 text-cyan-400" />
                {t.keyword.replace('#', '')}
              </span>
              {t.isSpike && (
                <span className="text-[10px] bg-amber-500 text-black font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5 animate-pulse">
                  <Zap className="w-2.5 h-2.5 fill-black" />
                  SPIKE +{t.growthRate}%
                </span>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-2">
              <span>{t.postCount} mentions</span>
              <span className={t.sentimentScore >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {t.sentimentScore > 0 ? `+${t.sentimentScore}` : t.sentimentScore}
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-1 border-t border-slate-800/80 pt-1">
              <span>{t.category}</span>
              <span className="capitalize text-slate-400">{t.dominantEmotion}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
