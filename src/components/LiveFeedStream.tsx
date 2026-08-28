'use client';

import React, { useState } from 'react';
import { SocialPost, PlatformType } from '@/types/intelligence';
import { Radio, MessageSquare, Heart, Repeat2, ExternalLink, ShieldCheck, Flame, Send } from 'lucide-react';

interface LiveFeedStreamProps {
  posts: SocialPost[];
  /** Counts of posts scored by the transformer service vs the lexicon fallback. */
  engineBreakdown?: { ml: number; lexicon: number };
  onManualPostSubmit: (text: string, platform: PlatformType) => Promise<void>;
  isLoading: boolean;
}

export const LiveFeedStream: React.FC<LiveFeedStreamProps> = ({
  posts,
  engineBreakdown,
  onManualPostSubmit,
  isLoading
}) => {
  const [manualText, setManualText] = useState('');
  const [manualPlatform, setManualPlatform] = useState<PlatformType>('x');

  const getPlatformBadge = (p: PlatformType) => {
    switch (p) {
      case 'x':
        return <span className="bg-black text-white px-1.5 py-0.5 rounded text-[10px] font-bold border border-slate-700">X / Twitter</span>;
      case 'telegram':
        return <span className="bg-sky-950 text-sky-400 px-1.5 py-0.5 rounded text-[10px] font-bold border border-sky-800">Telegram</span>;
      case 'reddit':
        return <span className="bg-orange-950 text-orange-400 px-1.5 py-0.5 rounded text-[10px] font-bold border border-orange-800">Reddit</span>;
      case 'youtube':
        return <span className="bg-red-950 text-red-400 px-1.5 py-0.5 rounded text-[10px] font-bold border border-red-800">YouTube</span>;
      case 'instagram':
        return <span className="bg-pink-950 text-pink-400 px-1.5 py-0.5 rounded text-[10px] font-bold border border-pink-800">Instagram</span>;
      case 'facebook':
        return <span className="bg-blue-950 text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-bold border border-blue-800">Facebook</span>;
    }
  };

  const getEmotionPill = (emotion: string) => {
    switch (emotion) {
      case 'excitement':
      case 'joy':
        return 'text-emerald-400 bg-emerald-950/60 border-emerald-800';
      case 'anxiety':
      case 'fear':
        return 'text-amber-400 bg-amber-950/60 border-amber-800';
      case 'anger':
      case 'against':
        return 'text-rose-400 bg-rose-950/60 border-rose-800';
      default:
        return 'text-cyan-400 bg-cyan-950/60 border-cyan-800';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    await onManualPostSubmit(manualText, manualPlatform);
    setManualText('');
  };

  return (
    <div className="intel-card rounded-xl p-4 border border-intel-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              Multi-Platform Raw Ingestion Feed
            </h3>
          </div>
        </div>
        <span className="text-xs font-mono text-slate-400">
          {posts.length} Active Posts Streamed
        </span>
      </div>

      {/* Manual Intelligence Ingest Box (for live testing) */}
      <form onSubmit={handleSubmit} className="mb-4 bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 flex flex-col sm:flex-row gap-2">
        <select
          value={manualPlatform}
          onChange={(e) => setManualPlatform(e.target.value as PlatformType)}
          className="bg-slate-950 border border-slate-800 text-xs text-white rounded px-2 py-1 focus:outline-none"
        >
          <option value="x">X / Twitter</option>
          <option value="telegram">Telegram</option>
          <option value="reddit">Reddit</option>
          <option value="youtube">YouTube</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
        </select>

        <input
          type="text"
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          placeholder="Inject custom post to test instant emotion, sarcasm, and topology updates..."
          className="flex-1 bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none px-2"
        />

        <button
          type="submit"
          disabled={isLoading || !manualText.trim()}
          className="bg-intel-cyan hover:bg-cyan-400 text-black font-bold text-xs px-3 py-1.5 rounded flex items-center justify-center gap-1 transition-all disabled:opacity-50"
        >
          <Send className="w-3 h-3" />
          <span>Inject</span>
        </button>
      </form>

      {/* Stream List */}
      <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
        {posts.map((post) => (
          <div
            key={post.id}
            className="p-3 bg-slate-900/50 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-lg transition-all"
          >
            {/* Header: Author & Platform */}
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div className="flex items-center gap-2">
                {getPlatformBadge(post.platform)}
                <span className="font-bold text-white font-mono">@{post.author.username}</span>
                {post.author.verified && <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />}
                <span className="text-[10px] text-slate-500 font-mono">
                  {post.author.inferredLocation}
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-400">
                {new Date(post.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>

            {/* Post Content */}
            <p className="text-xs text-slate-200 leading-relaxed mb-2 font-sans">
              {post.content}
            </p>

            {/* NLP Sentiment & Emotion Pills */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/60 pt-2 text-[10px] font-mono">
              <div className="flex items-center gap-1.5">
                <span className={`px-2 py-0.5 rounded border capitalize ${getEmotionPill(post.sentiment.nuancedEmotion)}`}>
                  {post.sentiment.nuancedEmotion}
                </span>

                {post.sentiment.sarcasmScore > 0.4 && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-700 text-amber-300 flex items-center gap-0.5">
                    <Flame className="w-2.5 h-2.5" />
                    Sarcasm ({(post.sentiment.sarcasmScore * 100).toFixed(0)}%)
                  </span>
                )}

                <span className="text-slate-400">
                  Stance: <span className="text-white capitalize">{post.sentiment.stance}</span>
                </span>
              </div>

              {/* Engagement Metrics */}
              <div className="flex items-center gap-3 text-slate-400">
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3 text-rose-500" />
                  {post.likes ?? "n/a"}
                </span>
                <span className="flex items-center gap-1">
                  <Repeat2 className="w-3 h-3 text-cyan-400" />
                  {post.shares ?? "n/a"}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3 text-purple-400" />
                  {post.replies ?? "n/a"}
                </span>
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
};
