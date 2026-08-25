'use client';

import React, { useState } from 'react';
import { Shield, Activity, RefreshCw, Radio, Database, Sparkles, AlertTriangle } from 'lucide-react';
import { PlatformType } from '@/types/intelligence';

interface NavbarProps {
  activePlatform: string;
  onPlatformChange: (p: string) => void;
  onTriggerIngestion: (subreddit?: string) => Promise<void>;
  onResetDataset: () => Promise<void>;
  isLoading: boolean;
  threatLevel: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activePlatform,
  onPlatformChange,
  onTriggerIngestion,
  onResetDataset,
  isLoading,
  threatLevel
}) => {
  const [subredditInput, setSubredditInput] = useState('india');

  const platforms = [
    { id: 'all', label: 'All Feeds' },
    { id: 'x', label: 'X (Twitter)' },
    { id: 'telegram', label: 'Telegram' },
    { id: 'reddit', label: 'Reddit' },
    { id: 'youtube', label: 'YouTube' },
    { id: 'instagram', label: 'Instagram' },
    { id: 'facebook', label: 'Facebook' }
  ];

  return (
    <header className="sticky top-0 z-50 intel-card border-b border-intel-border px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Brand & Agency Identifier */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-intel-cyan/40 text-intel-cyan flex items-center justify-center">
            <Shield className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                SIH26-26152 • NTRO
              </span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                LIVE INGESTION
              </span>
            </div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              AI-Driven Social Intelligence & Network Topology
            </h1>
          </div>
        </div>

        {/* Platform Ingestion Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto bg-slate-900/80 p-1 rounded-lg border border-slate-800">
          {platforms.map(p => (
            <button
              key={p.id}
              onClick={() => onPlatformChange(p.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activePlatform === p.id
                  ? 'bg-intel-cyan text-black font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Action Controls & Live Ingestion Trigger */}
        <div className="flex items-center gap-3">
          {/* Live Ingestion Input */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1">
            <span className="text-xs text-slate-400">r/</span>
            <input
              type="text"
              value={subredditInput}
              onChange={(e) => setSubredditInput(e.target.value)}
              placeholder="india"
              className="bg-transparent text-xs text-white focus:outline-none w-20"
            />
            <button
              onClick={() => onTriggerIngestion(subredditInput)}
              disabled={isLoading}
              className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white px-2 py-0.5 rounded font-medium disabled:opacity-50 transition-all"
            >
              Fetch Live
            </button>
          </div>

          <button
            onClick={onResetDataset}
            disabled={isLoading}
            title="Reset to initial intelligence baseline"
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>

      </div>
    </header>
  );
};
