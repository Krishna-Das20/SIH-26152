'use client';

import React from 'react';
import { GraphNode } from '@/types/intelligence';
import { X, ShieldAlert, Sparkles, MapPin, User, Activity, Share2, Globe, Heart } from 'lucide-react';

interface NodeDetailsDrawerProps {
  node: GraphNode | null;
  onClose: () => void;
}

export const NodeDetailsDrawer: React.FC<NodeDetailsDrawerProps> = ({ node, onClose }) => {
  if (!node) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-slate-950/95 backdrop-blur-xl border-l border-intel-border p-5 shadow-2xl overflow-y-auto flex flex-col justify-between animate-in slide-in-from-right duration-300">
      
      {/* Header */}
      <div>
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <User className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                Node Intelligence Dossier
              </span>
              <h3 className="text-base font-bold text-white font-mono">@{node.username}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {node.isKOL && (
            <span className="text-xs bg-amber-950 text-amber-300 border border-amber-700 px-2 py-0.5 rounded-md font-mono font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              KEY OPINION LEADER (KOL)
            </span>
          )}
          {node.isBotSuspicious && (
            <span className="text-xs bg-rose-950 text-rose-300 border border-rose-700 px-2 py-0.5 rounded-md font-mono font-bold flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />
              COORDINATED BOT SUSPECT
            </span>
          )}
          <span className="text-xs bg-slate-900 text-slate-300 border border-slate-800 px-2 py-0.5 rounded-md font-mono capitalize">
            {node.platform}
          </span>
        </div>

        {/* Network Metrics Cards */}
        <div className="grid grid-cols-2 gap-2.5 mb-5 font-mono">
          <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Influence Centrality</span>
            <span className="text-xl font-bold text-purple-400">{node.centralityScore}/100</span>
          </div>
          <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Follower Reach</span>
            <span className="text-xl font-bold text-cyan-400">{node.followerCount.toLocaleString()}</span>
          </div>
          <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-400 block">PageRank Vector</span>
            <span className="text-sm font-bold text-emerald-400">{(node.pageRank * 1000).toFixed(2)}</span>
          </div>
          <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Betweenness Score</span>
            <span className="text-sm font-bold text-amber-400">{node.betweennessCentrality}</span>
          </div>
        </div>

        {/* Inferred Demographics */}
        <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-800/80 space-y-2 mb-5 font-mono text-xs">
          <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 border-b border-slate-800 pb-1 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            Demographic Vectors (Inferred)
          </h4>
          <div className="flex justify-between">
            <span className="text-slate-400">Geographic Hub:</span>
            <span className="text-white font-medium">{node.inferredLocation}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Estimated Age Bracket:</span>
            <span className="text-cyan-400 font-medium">{node.ageBracket} years</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Dominant Sentiment:</span>
            <span className={`capitalize font-bold ${node.dominantSentiment === 'positive' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {node.dominantSentiment}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Dominant Emotion:</span>
            <span className="text-purple-400 capitalize font-medium">{node.dominantEmotion}</span>
          </div>
        </div>

        {/* Narrative Flow Role */}
        <div className="bg-cyan-950/20 border border-cyan-800/40 rounded-lg p-3 text-xs font-mono text-slate-300">
          <span className="text-[10px] font-bold uppercase text-cyan-400 block mb-1">
            Information Propagation Role:
          </span>
          {node.isKOL
            ? 'Acts as a primary narrative seed / amplifier node. Direct retweets and quotes originate frequently from this account.'
            : node.isBotSuspicious
            ? 'High-frequency posting behavior detected with minimal organic follower reciprocation. Flagged for synthetic botnet analysis.'
            : 'Standard participating community node echoing consensus within its cluster.'}
        </div>

      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
        <span>Node ID: {node.id}</span>
        <button
          onClick={onClose}
          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded transition-all"
        >
          Dismiss
        </button>
      </div>

    </div>
  );
};
