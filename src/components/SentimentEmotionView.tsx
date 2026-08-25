'use client';

import React from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { Smile, Flame, Target } from 'lucide-react';

interface SentimentEmotionViewProps {
  data: {
    emotionRadar: { emotion: string; value: number; rawCount: number }[];
    sarcasmRate: number;
    stanceDistribution: { name: string; value: number; color: string }[];
    temporalTimeline: any[];
  };
}

export const SentimentEmotionView: React.FC<SentimentEmotionViewProps> = ({ data }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      
      {/* 1. Nuanced Emotion Radar (GoEmotions Spectrum) */}
      <div className="intel-card rounded-xl p-4 border border-intel-border flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Smile className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider">
              Nuanced Emotion Spectrum
            </h4>
          </div>
          <span className="text-[10px] font-mono text-slate-400">7 Core Vectors</span>
        </div>

        <div className="w-full h-56">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data.emotionRadar}>
              <PolarGrid stroke="#1e293b" />
              <PolarAngleAxis dataKey="emotion" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 9 }} />
              <Radar
                name="Intensity"
                dataKey="value"
                stroke="#00f0ff"
                fill="#00f0ff"
                fillOpacity={0.4}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="text-[10px] text-slate-400 font-mono text-center mt-1">
          Detects Anxiety, Excitement, Anger, Joy, Fear, Supportive & Opposing Nuances
        </div>
      </div>

      {/* 2. Temporal Sentiment & Sarcasm Flow Timeline */}
      <div className="intel-card rounded-xl p-4 border border-intel-border flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider">
              Temporal Sentiment & Sarcasm Flow
            </h4>
          </div>
          <span className="text-[10px] font-mono text-amber-400">Sarcasm: {data.sarcasmRate}%</span>
        </div>

        <div className="w-full h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.temporalTimeline}>
              <defs>
                <linearGradient id="colorSentiment" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.5}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorSarcasm" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.5}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="timestamp" tick={{ fill: '#64748b', fontSize: 9 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 9 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '11px' }}
              />
              <Area type="monotone" dataKey="sentimentScore" stroke="#10b981" fillOpacity={1} fill="url(#colorSentiment)" name="Sentiment Polarity" />
              <Area type="monotone" dataKey="sarcasmCount" stroke="#f59e0b" fillOpacity={1} fill="url(#colorSarcasm)" name="Sarcastic Posts" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="flex justify-between text-[10px] font-mono text-slate-400 px-2 mt-1">
          <span className="text-emerald-400">● Positive Polarity</span>
          <span className="text-amber-400">● Sarcasm Spikes</span>
        </div>
      </div>

      {/* 3. Stance Distribution (Supportive vs Opposing vs Neutral) */}
      <div className="intel-card rounded-xl p-4 border border-intel-border flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-purple-400" />
            <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider">
              Audience Stance Orientation
            </h4>
          </div>
          <span className="text-[10px] font-mono text-purple-400">Stance Balance</span>
        </div>

        <div className="w-full h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.stanceDistribution}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={4}
                dataKey="value"
              >
                {data.stanceDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '11px' }}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="text-[10px] text-slate-400 font-mono text-center mt-1">
          Identifies Polarized Echo-Chambers & Consensus Drift
        </div>
      </div>

    </div>
  );
};
