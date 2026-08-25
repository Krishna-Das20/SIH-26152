'use client';

import React from 'react';
import { MapPin, Globe, UserCheck, Briefcase } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

interface DemographicRadarViewProps {
  data: {
    ageGroups: { bracket: string; percentage: number; count: number }[];
    geographicDistribution: { region: string; count: number; percentage: number }[];
    languages: { language: string; count: number; percentage: number }[];
    interestClusters: { topic: string; affinityScore: number }[];
    totalAudienceSampled?: number;
  };
}

export const DemographicRadarView: React.FC<DemographicRadarViewProps> = ({ data }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      
      {/* 1. Age Bracket Distribution */}
      <div className="intel-card rounded-xl p-4 border border-intel-border flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider">
              Age Demographics
            </h4>
          </div>
          <span className="text-[10px] font-mono text-cyan-400">Inferred</span>
        </div>

        <div className="space-y-2 my-auto">
          {data.ageGroups.map((age) => (
            <div key={age.bracket}>
              <div className="flex justify-between text-xs font-mono mb-0.5">
                <span className="text-slate-300">{age.bracket} yrs</span>
                <span className="text-cyan-400 font-bold">{age.percentage}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-intel-cyan h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${age.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="text-[10px] text-slate-400 font-mono text-center mt-2 border-t border-slate-800/60 pt-1.5">
          Based on vocabulary, emoji density & bio text
        </div>
      </div>

      {/* 2. Geographic Distribution */}
      <div className="intel-card rounded-xl p-4 border border-intel-border flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider">
              Geographic Heatmap
            </h4>
          </div>
          <span className="text-[10px] font-mono text-emerald-400">Top Hubs</span>
        </div>

        <div className="space-y-1.5 my-auto max-h-44 overflow-y-auto pr-1">
          {data.geographicDistribution.slice(0, 5).map((geo, idx) => (
            <div key={geo.region} className="flex items-center justify-between bg-slate-900/60 p-1.5 rounded text-xs font-mono">
              <span className="text-slate-300 truncate max-w-[130px]">
                {idx + 1}. {geo.region}
              </span>
              <span className="text-emerald-400 font-bold">{geo.percentage}%</span>
            </div>
          ))}
        </div>

        <div className="text-[10px] text-slate-400 font-mono text-center mt-2 border-t border-slate-800/60 pt-1.5">
          Geo-Entity Named Recognition Extraction
        </div>
      </div>

      {/* 3. Language & Code-Mixed Spectrum */}
      <div className="intel-card rounded-xl p-4 border border-intel-border flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-purple-400" />
            <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider">
              Language & Vernacular
            </h4>
          </div>
          <span className="text-[10px] font-mono text-purple-400">Multi-Script</span>
        </div>

        <div className="space-y-2 my-auto">
          {data.languages.slice(0, 4).map((lang) => (
            <div key={lang.language}>
              <div className="flex justify-between text-xs font-mono mb-0.5">
                <span className="text-slate-300 truncate max-w-[140px]">{lang.language}</span>
                <span className="text-purple-400 font-bold">{lang.percentage}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-purple-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${lang.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="text-[10px] text-slate-400 font-mono text-center mt-2 border-t border-slate-800/60 pt-1.5">
          Detects English, Hindi, Hinglish & Regional Scripts
        </div>
      </div>

      {/* 4. Professional Interests & Affinities */}
      <div className="intel-card rounded-xl p-4 border border-intel-border flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider">
              Domain Affinities
            </h4>
          </div>
          <span className="text-[10px] font-mono text-amber-400">Interests</span>
        </div>

        <div className="space-y-2 my-auto">
          {data.interestClusters.slice(0, 4).map((interest) => (
            <div key={interest.topic}>
              <div className="flex justify-between text-xs font-mono mb-0.5">
                <span className="text-slate-300 truncate max-w-[130px]">{interest.topic}</span>
                <span className="text-amber-400 font-bold">{interest.affinityScore}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${interest.affinityScore}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="text-[10px] text-slate-400 font-mono text-center mt-2 border-t border-slate-800/60 pt-1.5">
          Inferred from bio context and topic interactions
        </div>
      </div>

    </div>
  );
};
