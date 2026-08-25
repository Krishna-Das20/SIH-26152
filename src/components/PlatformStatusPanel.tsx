'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, CreditCard, ExternalLink, RefreshCw } from 'lucide-react';

/**
 * Component A coverage panel.
 *
 * Shows every platform the problem statement names, grouped by the tier the
 * problem statement assigns, with a truthful live/needs-credentials state read
 * from /api/platforms at runtime. The point is that a reader can verify
 * coverage instead of taking a claim on trust -- and that an unconfigured
 * platform is visibly "not connected", never silently absent.
 */

interface Capability {
  platform: string;
  displayName: string;
  tier: 'essential' | 'desirable' | 'appreciable';
  requiredEnv: string[];
  configured: boolean;
  worksWithoutCredentials: boolean;
  cost: 'free' | 'paid' | 'none';
  targetHint: string;
  setupDoc: string;
  notes?: string;
}

interface PlatformsResponse {
  implemented: number;
  live: number;
  platforms: Capability[];
  summary: Record<string, { total: number; live: number }>;
}

const TIER_LABEL: Record<Capability['tier'], string> = {
  essential: 'Essential (Must-Have)',
  desirable: 'Desirable (Good-to-Have)',
  appreciable: 'Appreciable Addition',
};

const TIER_ACCENT: Record<Capability['tier'], string> = {
  essential: 'text-cyan-300 border-cyan-500/30',
  desirable: 'text-emerald-300 border-emerald-500/30',
  appreciable: 'text-amber-300 border-amber-500/30',
};

export const PlatformStatusPanel: React.FC = () => {
  const [data, setData] = useState<PlatformsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/platforms');
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-5 text-sm text-slate-400">
        Checking platform connectors…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-rose-700/40 bg-rose-950/20 p-5 text-sm text-rose-300">
        Could not read platform status.
      </div>
    );
  }

  const tiers: Capability['tier'][] = ['essential', 'desirable', 'appreciable'];

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
            Component A — Platform Coverage
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            <span className="font-semibold text-slate-200">{data.implemented}/6</span> connectors
            implemented ·{' '}
            <span className="font-semibold text-emerald-300">{data.live}</span> live right now
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-md border border-slate-600/60 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Recheck
        </button>
      </div>

      <div className="space-y-4">
        {tiers.map((tier) => {
          const items = data.platforms.filter((p) => p.tier === tier);
          if (items.length === 0) return null;

          return (
            <div key={tier}>
              <div className={`mb-2 border-l-2 pl-2 text-[11px] font-semibold uppercase tracking-wider ${TIER_ACCENT[tier]}`}>
                {TIER_LABEL[tier]}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {items.map((p) => (
                  <div
                    key={p.platform}
                    className={`rounded-lg border p-3 transition ${
                      p.configured
                        ? 'border-emerald-600/30 bg-emerald-950/20'
                        : 'border-slate-700/50 bg-slate-950/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-slate-100">{p.displayName}</span>

                      {p.configured ? (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          {p.worksWithoutCredentials ? 'LIVE · NO KEY' : 'LIVE'}
                        </span>
                      ) : (
                        <span
                          className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            p.cost === 'paid'
                              ? 'bg-amber-500/15 text-amber-300'
                              : 'bg-slate-500/15 text-slate-400'
                          }`}
                        >
                          {p.cost === 'paid' ? (
                            <CreditCard className="h-3 w-3" />
                          ) : (
                            <KeyRound className="h-3 w-3" />
                          )}
                          {p.cost === 'paid' ? 'NEEDS PAID API' : 'NEEDS KEY'}
                        </span>
                      )}
                    </div>

                    <p className="mt-1.5 text-[11px] leading-snug text-slate-400">{p.targetHint}</p>

                    {!p.configured && p.requiredEnv.length > 0 && (
                      <p className="mt-1.5 font-mono text-[10px] leading-snug text-slate-500">
                        {p.requiredEnv.join(' · ')}
                      </p>
                    )}

                    {!p.configured && (
                      <span className="mt-1.5 flex items-center gap-1 text-[10px] text-cyan-400/80">
                        <ExternalLink className="h-2.5 w-2.5" />
                        {p.setupDoc}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 border-t border-slate-700/40 pt-3 text-[11px] leading-relaxed text-slate-500">
        Status is read from the running environment, not declared. A connector marked
        &ldquo;needs key&rdquo; is fully implemented and starts returning data as soon as its
        credentials are set — no platform is simulated.
      </p>
    </div>
  );
};
