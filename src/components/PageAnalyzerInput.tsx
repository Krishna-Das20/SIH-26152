'use client';

import React, { useState } from 'react';
import { Search, Globe, Sparkles, Loader2, Link2, CheckCircle2 } from 'lucide-react';

interface PageAnalyzerInputProps {
  onAnalyzeSuccess: () => Promise<void>;
}

export const PageAnalyzerInput: React.FC<PageAnalyzerInputProps> = ({ onAnalyzeSuccess }) => {
  const [targetInput, setTargetInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetInput.trim()) return;

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/analyze/page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrlOrHandle: targetInput }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to scrape target.');
      }

      setFeedback({
        type: 'success',
        message: `Successfully scraped & ingested ${data.scrapedCount} live posts for "${targetInput}". Graph & sentiment updated!`,
      });
      setTargetInput('');
      await onAnalyzeSuccess();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Scraping failed.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="intel-card rounded-xl p-4 border border-intel-border mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              Target Page & Channel OSINT Scraper
              <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-1.5 py-0.5 rounded font-mono">
                100% REAL DATA
              </span>
            </h3>
          </div>
        </div>
        <span className="text-xs font-mono text-slate-400 hidden sm:inline">
          Enter any Subreddit, YouTube URL, Telegram Channel, or Topic
        </span>
      </div>

      <form onSubmit={handleAnalyze} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Link2 className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            placeholder="e.g. r/technology, r/india, @handle, YouTube Video URL, or #AI topic..."
            className="w-full bg-slate-900/90 border border-slate-800 focus:border-cyan-500 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none transition-all font-mono"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !targetInput.trim()}
          className="bg-intel-cyan hover:bg-cyan-400 text-black font-bold text-xs px-5 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 shadow-md shadow-cyan-500/20 shrink-0"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Scraping Live...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Analyze & Ingest Page</span>
            </>
          )}
        </button>
      </form>

      {/* Feedback Message */}
      {feedback && (
        <div
          className={`mt-2.5 p-2 rounded-lg text-xs font-mono flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
              : 'bg-rose-950/60 border border-rose-800 text-rose-300'
          }`}
        >
          {feedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}
    </div>
  );
};
