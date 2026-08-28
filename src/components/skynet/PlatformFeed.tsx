'use client';

import React, { useState } from 'react';
import { SocialPost } from '@/types/intelligence';
import {
  Search,
  Heart,
  Share2,
  MessageCircle,
  CheckCircle2,
  Calendar,
  ExternalLink,
  Link2,
} from 'lucide-react';
import { getPostUrl, getParentSource } from '@/lib/urls';

interface Props {
  posts: SocialPost[];
  platformName: string;
}

export function PlatformFeed({ posts, platformName }: Props) {
  const [search, setSearch] = useState('');

  const filtered = posts.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.content.toLowerCase().includes(q) ||
      p.author.displayName.toLowerCase().includes(q) ||
      p.author.username.toLowerCase().includes(q) ||
      p.hashtags.some((h) => h.toLowerCase().includes(q))
    );
  });

  return (
    <div className="relative rounded-2xl bg-gradient-to-b from-white/[0.08] via-white/[0.03] to-transparent p-[1px] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)]">
      <div className="rounded-2xl bg-gradient-to-b from-[#131317] via-[#0d0d10] to-[#08080a] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]">
        {/* Header bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-neutral-400 font-bold">
                STREAM DISCOVERY
              </span>
            </div>
            <h3 className="text-base font-extrabold text-white tracking-tight font-display flex items-center gap-2.5">
              <span>{platformName} Real-Time Intelligence</span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-white/10 text-neutral-200 border border-white/15">
                {filtered.length} captured
              </span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5 font-medium">
              Live platform captures with transformer sentiment scoring and links to the original post.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Filter ${platformName} intelligence…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-full bg-white/[0.05] border border-white/15 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/40 focus:bg-white/[0.08] transition-all font-sans"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-neutral-500 text-xs font-mono">
            {posts.length === 0
              ? `NO POSTS INGESTED FOR ${platformName.toUpperCase()}. USE SYNC CONSOLE ABOVE.`
              : `NO CAPTURES MATCH "${search.toUpperCase()}".`}
          </div>
        ) : (
          <div className="space-y-3.5 max-h-[580px] overflow-y-auto pr-1">
            {filtered.map((post) => {
              const isPositive = post.sentiment.label === 'positive';
              const isNegative = post.sentiment.label === 'negative';
              const directUrl = getPostUrl(post);
              const parentSource = getParentSource(post);

              return (
                <div
                  key={post.id}
                  className="group relative p-4 rounded-xl bg-gradient-to-b from-[#18181d] to-[#0f0f12] border border-white/[0.08] hover:border-white/20 transition-all duration-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white font-black text-xs uppercase shadow-inner">
                        {post.author.displayName?.[0] || post.author.username?.[1] || '?'}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-xs tracking-tight">
                            {post.author.displayName || post.author.username}
                          </span>
                          {post.author.verified && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                          <span className="text-[11px] text-neutral-400 font-mono">
                            @{post.author.username}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-neutral-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-neutral-400" />
                        {new Date(post.timestamp).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          // The feed mixes posts from 2021 to 2026. Without a
                          // year, an ordered feed looks randomly shuffled.
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>

                      {/* Direct external post link */}
                      {directUrl && (
                        <a
                          href={directUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-white hover:text-black hover:bg-white bg-white/10 px-2.5 py-1 rounded-full border border-white/20 transition-all tracking-wider uppercase"
                          title="Open direct post link"
                        >
                          <span>Source</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Parent Source Link Banner */}
                  {parentSource && parentSource.url && (
                    <div className="mb-2.5 p-2 rounded-lg bg-black/40 border border-white/[0.08] flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 text-neutral-400">
                        <Link2 className="w-3.5 h-3.5 text-neutral-300" />
                        <span>
                          Comment on {parentSource.label}:{' '}
                          <strong className="text-white font-mono">{parentSource.id}</strong>
                        </span>
                      </div>
                      <a
                        href={parentSource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-white hover:underline font-semibold transition-colors"
                      >
                        <span>View Source</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {/* Content */}
                  <p className="text-neutral-300 leading-relaxed text-xs mb-3 font-normal">
                    {post.content}
                  </p>

                  {/* Hashtags */}
                  {post.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {post.hashtags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[9px] px-2 py-0.5 rounded-full bg-white/[0.06] text-neutral-300 font-mono font-semibold border border-white/[0.08]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer metrics */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-white/[0.06] text-[10px]">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[9px] tracking-wider border ${
                          isPositive
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : isNegative
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : 'bg-white/5 text-neutral-400 border-white/10'
                        }`}
                      >
                        {post.sentiment.label} ({post.sentiment.score > 0 ? '+' : ''}
                        {post.sentiment.score.toFixed(2)})
                      </span>

                      {post.sentiment.nuancedEmotion && (
                        <span className="px-2 py-0.5 rounded-full bg-white/5 text-neutral-300 border border-white/10 capitalize font-medium">
                          {post.sentiment.nuancedEmotion}
                        </span>
                      )}

                      {post.sentiment.engine === 'ml' && (
                        <span className="px-2 py-0.5 rounded-full bg-white/10 text-white font-mono text-[9px] border border-white/15 font-bold">
                          ML SCORED
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-neutral-400 font-mono">
                      <span className="flex items-center gap-1 hover:text-white transition-colors">
                        <Heart className="w-3 h-3 text-rose-500/80" /> {post.likes ?? "n/a"}
                      </span>
                      <span className="flex items-center gap-1 hover:text-white transition-colors">
                        <Share2 className="w-3 h-3 text-neutral-400" /> {post.shares ?? "n/a"}
                      </span>
                      <span className="flex items-center gap-1 hover:text-white transition-colors">
                        <MessageCircle className="w-3 h-3 text-neutral-400" /> {post.replies ?? "n/a"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
