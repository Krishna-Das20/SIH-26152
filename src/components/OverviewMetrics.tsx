'use client';

import React from 'react';
import { Radio, Users, Flame, Smile, AlertOctagon, TrendingUp } from 'lucide-react';

interface OverviewMetricsProps {
  metrics: {
    totalPosts: number;
    activeNodes: number;
    averageSentiment: number;
    sarcasmIndex: number;
    threatLevel: string;
    supportivePercentage: number;
    opposingPercentage: number;
  };
}

export const OverviewMetrics: React.FC<OverviewMetricsProps> = ({ metrics }) => {
  const getThreatBadge = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'text-rose-400 bg-rose-950/60 border-rose-800 animate-pulse';
      case 'HIGH':
        return 'text-amber-400 bg-amber-950/60 border-amber-800';
      case 'ELEVATED':
        return 'text-cyan-400 bg-cyan-950/60 border-cyan-800';
      default:
        return 'text-emerald-400 bg-emerald-950/60 border-emerald-800';
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      
      {/* 1. Ingested Volume */}
      <div className="intel-card rounded-xl p-3.5 border border-intel-border">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-xs font-medium uppercase tracking-wider">Ingested Posts</span>
          <Radio className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="text-2xl font-bold text-white font-mono">{metrics.totalPosts}</div>
        <div className="text-[10px] text-cyan-400/80 font-mono mt-0.5">Chronologically Mapped</div>
      </div>

      {/* 2. Active Nodes */}
      <div className="intel-card rounded-xl p-3.5 border border-intel-border">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-xs font-medium uppercase tracking-wider">Active Nodes</span>
          <Users className="w-4 h-4 text-purple-400" />
        </div>
        <div className="text-2xl font-bold text-white font-mono">{metrics.activeNodes}</div>
        <div className="text-[10px] text-purple-400/80 font-mono mt-0.5">Authors & Influencers</div>
      </div>

      {/* 3. Average Sentiment */}
      <div className="intel-card rounded-xl p-3.5 border border-intel-border">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-xs font-medium uppercase tracking-wider">Sentiment Index</span>
          <Smile className={`w-4 h-4 ${metrics.averageSentiment >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
        </div>
        <div className={`text-2xl font-bold font-mono ${metrics.averageSentiment >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {metrics.averageSentiment > 0 ? `+${metrics.averageSentiment}` : metrics.averageSentiment}
        </div>
        <div className="text-[10px] text-slate-400 font-mono mt-0.5">Scale: [-1.00 to +1.00]</div>
      </div>

      {/* 4. Sarcasm Rate */}
      <div className="intel-card rounded-xl p-3.5 border border-intel-border">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-xs font-medium uppercase tracking-wider">Sarcasm Rate</span>
          <Flame className="w-4 h-4 text-amber-400" />
        </div>
        <div className="text-2xl font-bold text-amber-400 font-mono">{metrics.sarcasmIndex}%</div>
        <div className="text-[10px] text-amber-400/80 font-mono mt-0.5">Linguistic Irony Ratio</div>
      </div>

      {/* 5. Stance Balance */}
      <div className="intel-card rounded-xl p-3.5 border border-intel-border">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-xs font-medium uppercase tracking-wider">Stance Ratio</span>
          <TrendingUp className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="text-lg font-bold text-white font-mono flex items-center gap-1">
          <span className="text-emerald-400">{metrics.supportivePercentage}%</span>
          <span className="text-slate-500">/</span>
          <span className="text-rose-400">{metrics.opposingPercentage}%</span>
        </div>
        <div className="text-[10px] text-slate-400 font-mono mt-0.5">Supportive vs Opposing</div>
      </div>

      {/* 6. Threat / Volatility Status */}
      <div className="intel-card rounded-xl p-3.5 border border-intel-border">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-xs font-medium uppercase tracking-wider">Volatility Level</span>
          <AlertOctagon className="w-4 h-4 text-rose-400" />
        </div>
        <div className="mt-1">
          <span className={`inline-block text-xs font-bold font-mono px-2 py-1 rounded border ${getThreatBadge(metrics.threatLevel)}`}>
            {metrics.threatLevel || 'LOW'}
          </span>
        </div>
        <div className="text-[10px] text-slate-400 font-mono mt-1">Disinformation & Panic Alert</div>
      </div>

    </div>
  );
};
