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
    <div className="nexus-surface rounded-xl p-6 border border-nexus-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-nexus-border">
        <div>
          <h3 className="text-sm font-bold text-nexus-text-primary flex items-center gap-2">
            <span>Intercepted {platformName} Stream</span>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-nexus-surface-secondary text-nexus-text-secondary border border-nexus-border">
              {filtered.length} posts
            </span>
          </h3>
          <p className="text-[11px] text-nexus-muted mt-0.5">
            Verified social messages, sentiment scoring, and original post/video source links.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-nexus-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={`Search ${platformName} posts…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-nexus-surface-secondary border border-nexus-border text-xs text-nexus-text-primary placeholder:text-nexus-muted focus:outline-none focus:border-nexus-accent transition-colors"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-nexus-muted text-xs">
          {posts.length === 0
            ? `No posts available for ${platformName}. Connect the platform or ingest posts.`
            : `No ${platformName} posts match "${search}".`}
        </div>
      ) : (
        <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
          {filtered.map((post) => {
            const isPositive = post.sentiment.label === 'positive';
            const isNegative = post.sentiment.label === 'negative';
            const directUrl = getPostUrl(post);
            const parentSource = getParentSource(post);

            return (
              <div
                key={post.id}
                className="p-4 rounded-xl bg-nexus-surface-secondary/40 border border-nexus-border hover:bg-nexus-surface-secondary/70 transition-all text-xs"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-nexus-surface border border-nexus-border flex items-center justify-center text-nexus-muted font-bold text-xs uppercase">
                      {post.author.displayName?.[0] || post.author.username?.[1] || '?'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-nexus-text-primary">
                          {post.author.displayName || post.author.username}
                        </span>
                        {post.author.verified && (
                          <CheckCircle2 className="w-3 h-3 text-nexus-accent" />
                        )}
                        <span className="text-[11px] text-nexus-muted font-mono">
                          {post.author.username}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-nexus-muted flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(post.timestamp).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
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
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-nexus-accent hover:underline bg-nexus-accent/10 px-2 py-0.5 rounded border border-nexus-accent/30 transition-all"
                        title="Open direct post/comment link in new tab"
                      >
                        <span>Open Post</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Parent Source Link Banner (if this is a comment on a parent video/post) */}
                {parentSource && parentSource.url && (
                  <div className="mb-2.5 p-2 rounded-lg bg-nexus-surface border border-nexus-border/80 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-nexus-muted">
                      <Link2 className="w-3.5 h-3.5 text-nexus-accent" />
                      <span>
                        Comment on {parentSource.label}:{' '}
                        <strong className="text-nexus-text-secondary font-mono">{parentSource.id}</strong>
                      </span>
                    </div>
                    <a
                      href={parentSource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-nexus-text-primary hover:text-nexus-accent font-medium transition-colors"
                    >
                      <span>View Source {parentSource.label.split(' ')[1] || 'Post'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {/* Content */}
                <p className="text-nexus-text-secondary leading-relaxed mb-3">
                  {post.content}
                </p>

                {/* Hashtags */}
                {post.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {post.hashtags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-nexus-surface text-nexus-accent font-mono"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer metrics */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-nexus-border/60 text-[10px]">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded font-semibold capitalize ${
                        isPositive
                          ? 'bg-nexus-positive/10 text-nexus-positive border border-nexus-positive/30'
                          : isNegative
                          ? 'bg-nexus-negative/10 text-nexus-negative border border-nexus-negative/30'
                          : 'bg-nexus-surface text-nexus-muted border border-nexus-border'
                      }`}
                    >
                      {post.sentiment.label} ({post.sentiment.score > 0 ? '+' : ''}
                      {post.sentiment.score.toFixed(2)})
                    </span>

                    {post.sentiment.nuancedEmotion && (
                      <span className="px-2 py-0.5 rounded bg-nexus-surface text-nexus-text-secondary border border-nexus-border capitalize">
                        {post.sentiment.nuancedEmotion}
                      </span>
                    )}

                    {post.sentiment.engine === 'ml' && (
                      <span className="px-1.5 py-0.5 rounded bg-nexus-accent/10 text-nexus-accent font-mono text-[9px]">
                        RoBERTa ML
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-nexus-muted font-mono">
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3" /> {post.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <Share2 className="w-3 h-3" /> {post.shares}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" /> {post.replies}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
