'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Sparkles, RefreshCw, ChevronDown, ChevronRight, Network, Heart, TrendingUp, Users } from 'lucide-react';

/**
 * Audience Intelligence Brief — the cross-vector fusion panel.
 *
 * The problem statement names this as the point of the whole exercise:
 * "Combining these four vectors using AI is the key to unlocking true audience
 * intelligence." The other panels each show ONE vector. This one shows only
 * findings that required intersecting two or more, and labels which.
 *
 * Every finding exposes its underlying evidence on demand, so a reader can
 * verify the claim rather than take it on trust.
 */

interface Finding {
  id: string;
  vectors: ('sentiment' | 'demographics' | 'trends' | 'network')[];
  severity: 'info' | 'notable' | 'high';
  headline: string;
  detail: string;
  evidence: Record<string, unknown>;
}

interface BriefResponse {
  corpusSize: number;
  engine?: string;
  findingCount: number;
  findings: Finding[];
  graph?: {
    nodes: number;
    links: number;
    communities: number;
    isolatedAccounts?: number;
    modularity?: number;
  };
  note?: string;
}

const VECTOR_META: Record<Finding['vectors'][number], { label: string; icon: React.ElementType; cls: string }> = {
  sentiment: { label: 'Sentiment', icon: Heart, cls: 'bg-rose-500/15 text-rose-300' },
  demographics: { label: 'Demographics', icon: Users, cls: 'bg-emerald-500/15 text-emerald-300' },
  trends: { label: 'Trends', icon: TrendingUp, cls: 'bg-amber-500/15 text-amber-300' },
  network: { label: 'Network', icon: Network, cls: 'bg-cyan-500/15 text-cyan-300' },
};

const SEVERITY: Record<Finding['severity'], string> = {
  high: 'border-rose-500/40 bg-rose-950/20',
  notable: 'border-amber-500/30 bg-amber-950/15',
  info: 'border-slate-600/40 bg-slate-900/30',
};

interface Props {
  cutoffTime?: string;
  platform?: string;
}

export const AudienceIntelligenceBrief: React.FC<Props> = ({ cutoffTime, platform }) => {
  const [data, setData] = useState<BriefResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (cutoffTime) qs.set('cutoffTime', cutoffTime);
      if (platform && platform !== 'all') qs.set('platform', platform);
      const res = await fetch(`/api/analytics/brief?${qs}`);
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [cutoffTime, platform]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="rounded-xl border border-cyan-700/30 bg-gradient-to-br from-cyan-950/20 to-slate-900/40 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-cyan-200">
            <Sparkles className="h-4 w-4" />
            Audience Intelligence Brief
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Findings that required <span className="text-slate-200">combining</span> two or more
            vectors — not visible in any single panel.
          </p>
        </div>

        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-md border border-slate-600/60 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Re-run
        </button>
      </div>

      {data?.graph && (
        <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 border-y border-slate-700/40 py-2 text-[11px] text-slate-400">
          <span>
            corpus <span className="font-mono text-slate-200">{data.corpusSize}</span>
          </span>
          <span>
            accounts <span className="font-mono text-slate-200">{data.graph.nodes}</span>
          </span>
          <span>
            communities <span className="font-mono text-slate-200">{data.graph.communities}</span>
          </span>
          {typeof data.graph.modularity === 'number' && (
            <span>
              modularity Q{' '}
              <span
                className={`font-mono ${
                  data.graph.modularity > 0.3 ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                {data.graph.modularity.toFixed(2)}
              </span>
              <span className="text-slate-600"> (&gt;0.3 = real structure)</span>
            </span>
          )}
          {data.engine && (
            <span>
              engine{' '}
              <span className={`font-mono ${data.engine === 'ml' ? 'text-emerald-300' : 'text-amber-300'}`}>
                {data.engine === 'ml' ? 'transformer' : 'lexicon fallback'}
              </span>
            </span>
          )}
        </div>
      )}

      {loading && !data ? (
        <p className="py-6 text-center text-xs text-slate-500">Deriving cross-vector findings…</p>
      ) : !data || data.findingCount === 0 ? (
        <p className="rounded-lg border border-slate-700/40 bg-slate-950/30 p-4 text-xs leading-relaxed text-slate-400">
          {data?.note ||
            'No cross-vector pattern crossed its significance threshold on this corpus.'}
        </p>
      ) : (
        <div className="space-y-2.5">
          {data.findings.map((f) => {
            const isOpen = open === f.id;
            return (
              <div key={f.id} className={`rounded-lg border p-3.5 ${SEVERITY[f.severity]}`}>
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  {f.vectors.map((v) => {
                    const meta = VECTOR_META[v];
                    const Icon = meta.icon;
                    return (
                      <span
                        key={v}
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}
                      >
                        <Icon className="h-2.5 w-2.5" />
                        {meta.label}
                      </span>
                    );
                  })}
                  {f.severity === 'high' && (
                    <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                      HIGH
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-medium leading-snug text-slate-100">{f.headline}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">{f.detail}</p>

                <button
                  onClick={() => setOpen(isOpen ? null : f.id)}
                  className="mt-2 flex items-center gap-1 text-[11px] text-cyan-400/80 hover:text-cyan-300"
                >
                  {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {isOpen ? 'Hide' : 'Show'} evidence
                </button>

                {isOpen && (
                  <pre className="mt-2 max-h-56 overflow-auto rounded-md bg-slate-950/60 p-2.5 font-mono text-[10px] leading-relaxed text-slate-400">
                    {JSON.stringify(f.evidence, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
