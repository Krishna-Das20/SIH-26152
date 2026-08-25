'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import {
  Link2, Unlink, AlertTriangle, CheckCircle2, ShieldAlert,
  Loader2, ExternalLink, Trash2,
} from 'lucide-react';

/**
 * Connected accounts screen.
 *
 * Distinguishes two independent failure modes, because a user can do nothing
 * about the first and everything about the second:
 *   - the provider is not enabled on this deployment (our app credentials are
 *     missing, or the platform's app review has not cleared)
 *   - the user simply has not connected their account yet
 */

interface Account {
  provider: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  connectedAt: string;
  lastSyncedAt?: string;
  expiresAt?: string;
  needsReauth: boolean;
  tokenHint?: string;
}

interface ProviderRow {
  provider: string;
  displayName: string;
  authKind: string;
  scopes: string[];
  deploymentReady: boolean;
  connected: boolean;
  account: Account | null;
  needsReauth: boolean;
  userPrerequisite?: string;
  cost: { model: string; detail: string };
  launchGate: { required: boolean; process: string; estimatedDuration: string };
  docsUrl: string;
}

const BRAND: Record<string, string> = {
  instagram: 'from-fuchsia-500/20 to-orange-400/10 border-fuchsia-500/30',
  facebook: 'from-blue-500/20 to-blue-400/5 border-blue-500/30',
  x: 'from-slate-400/20 to-slate-500/5 border-slate-400/30',
  reddit: 'from-orange-500/20 to-orange-400/5 border-orange-500/30',
  youtube: 'from-red-500/20 to-red-400/5 border-red-500/30',
  telegram: 'from-sky-500/20 to-cyan-400/5 border-sky-500/30',
};

function AccountsPageInner() {
  const { status } = useSession();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [encryptionReady, setEncryptionReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'warn' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/connections');
      if (res.status === 401) {
        setRows([]);
        return;
      }
      const data = await res.json();
      setRows(data.providers || []);
      setEncryptionReady(Boolean(data.encryptionConfigured));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') load();
    else if (status === 'unauthenticated') setLoading(false);
  }, [status, load]);

  // Surface the outcome the OAuth callback redirected back with.
  useEffect(() => {
    const s = searchParams.get('status');
    const detail = searchParams.get('detail');
    if (!s) return;
    if (s === 'connected') setBanner({ kind: 'ok', text: `Connected ${detail || 'account'}.` });
    else if (s === 'cancelled') setBanner({ kind: 'warn', text: 'Connection cancelled.' });
    else if (s === 'error') setBanner({ kind: 'error', text: detail || 'Connection failed.' });
  }, [searchParams]);

  const disconnect = async (provider: string) => {
    setBusy(provider);
    try {
      const res = await fetch(`/api/connect/${provider}/disconnect`, { method: 'POST' });
      const data = await res.json();
      setBanner({
        kind: data.revokedRemotely ? 'ok' : 'warn',
        text: data.note || 'Disconnected.',
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const deleteEverything = async () => {
    if (!confirm('Delete all connected accounts and ingested data? This cannot be undone.')) return;
    setBusy('__all__');
    try {
      const res = await fetch('/api/privacy/data-deletion', { method: 'POST' });
      const data = await res.json();
      setBanner({
        kind: 'ok',
        text: `Deleted. Confirmation code ${data.confirmationCode}.`,
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-16 text-slate-300">
        <Loader2 className="h-5 w-5 animate-spin" />
      </main>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <main className="mx-auto max-w-4xl px-5 py-16">
        <h1 className="text-xl font-semibold text-slate-100">Connected accounts</h1>
        <p className="mt-2 text-sm text-slate-400">
          Sign in to connect your social accounts.
        </p>
        <a
          href="/auth/signin?callbackUrl=/settings/accounts"
          className="mt-5 inline-block rounded-lg bg-cyan-500/90 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400"
        >
          Sign in
        </a>
      </main>
    );
  }

  const connectedCount = rows.filter((r) => r.connected).length;

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-slate-100">Connected accounts</h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Connect your own accounts to see insights across platforms.{' '}
          <span className="text-slate-300">{connectedCount} of {rows.length} connected.</span>
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Access tokens are encrypted before storage and are never shown in full. You can
          disconnect or erase everything at any time.
        </p>
      </header>

      {!encryptionReady && (
        <div className="mb-5 flex gap-2.5 rounded-lg border border-rose-600/40 bg-rose-950/25 p-3.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <div className="text-xs leading-relaxed text-rose-200">
            <strong>Connections are disabled.</strong> This deployment has no{' '}
            <code className="font-mono">TOKEN_ENCRYPTION_KEY</code>, so tokens could not be
            stored encrypted. Connecting is refused rather than storing them in plaintext.
          </div>
        </div>
      )}

      {banner && (
        <div
          className={`mb-5 flex items-start gap-2.5 rounded-lg border p-3.5 text-xs leading-relaxed ${
            banner.kind === 'ok'
              ? 'border-emerald-600/40 bg-emerald-950/25 text-emerald-200'
              : banner.kind === 'warn'
              ? 'border-amber-600/40 bg-amber-950/25 text-amber-200'
              : 'border-rose-600/40 bg-rose-950/25 text-rose-200'
          }`}
        >
          {banner.kind === 'ok' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.provider}
            className={`rounded-xl border bg-gradient-to-br p-4 ${
              BRAND[row.provider] || 'from-slate-700/20 to-slate-800/5 border-slate-700/40'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-100">{row.displayName}</span>

                  {row.connected && !row.needsReauth && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      CONNECTED
                    </span>
                  )}
                  {row.needsReauth && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                      RECONNECT NEEDED
                    </span>
                  )}
                  {!row.deploymentReady && (
                    <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                      UNAVAILABLE
                    </span>
                  )}
                </div>

                {row.connected && row.account ? (
                  <p className="mt-1 truncate text-xs text-slate-300">
                    {row.account.displayName}
                    {row.account.username ? ` · @${row.account.username}` : ''}
                    {row.account.tokenHint ? (
                      <span className="ml-2 font-mono text-slate-500">{row.account.tokenHint}</span>
                    ) : null}
                  </p>
                ) : (
                  <p className="mt-1 text-xs leading-snug text-slate-400">
                    {row.deploymentReady
                      ? row.userPrerequisite || 'Not connected yet.'
                      : `Not enabled on this deployment. ${
                          row.launchGate.required
                            ? `Requires ${row.launchGate.process.split('.')[0]}.`
                            : ''
                        }`}
                  </p>
                )}

                {row.connected && row.account?.expiresAt && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Access expires {new Date(row.account.expiresAt).toLocaleDateString()} — refreshed automatically.
                  </p>
                )}
              </div>

              <div className="flex shrink-0 gap-2">
                {row.connected ? (
                  <>
                    {row.needsReauth && (
                      <a
                        href={`/api/connect/${row.provider}`}
                        className="rounded-lg bg-amber-500/90 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-amber-400"
                      >
                        Reconnect
                      </a>
                    )}
                    <button
                      onClick={() => disconnect(row.provider)}
                      disabled={busy === row.provider}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-600/60 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                    >
                      {busy === row.provider ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Unlink className="h-3 w-3" />
                      )}
                      Disconnect
                    </button>
                  </>
                ) : (
                  <a
                    href={row.deploymentReady ? `/api/connect/${row.provider}` : row.docsUrl}
                    target={row.deploymentReady ? undefined : '_blank'}
                    rel={row.deploymentReady ? undefined : 'noreferrer'}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                      row.deploymentReady && encryptionReady
                        ? 'bg-cyan-500/90 text-slate-950 hover:bg-cyan-400'
                        : 'pointer-events-none border border-slate-700 text-slate-500 opacity-60'
                    }`}
                  >
                    {row.deploymentReady ? (
                      <>
                        <Link2 className="h-3 w-3" />
                        Connect
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-3 w-3" />
                        Unavailable
                      </>
                    )}
                  </a>
                )}
              </div>
            </div>

            {row.cost.model !== 'free' && (
              <p className="mt-2.5 border-t border-slate-700/30 pt-2 text-[11px] leading-relaxed text-slate-500">
                {row.cost.detail}
              </p>
            )}
          </div>
        ))}
      </div>

      <section className="mt-8 rounded-xl border border-rose-800/40 bg-rose-950/10 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-rose-200">
          <Trash2 className="h-4 w-4" />
          Delete my data
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
          Permanently removes every connected account and all content collected on your
          behalf, and returns a confirmation code. This cannot be undone.
        </p>
        <button
          onClick={deleteEverything}
          disabled={busy === '__all__'}
          className="mt-3 rounded-lg border border-rose-600/50 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-950/40 disabled:opacity-50"
        >
          {busy === '__all__' ? 'Deleting…' : 'Delete everything'}
        </button>
      </section>
    </main>
  );
}

/**
 * useSearchParams() opts a route into client-side rendering, so Next requires
 * a Suspense boundary around it or the static export of this page fails.
 */
export default function AccountsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-4xl px-5 py-16 text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin" />
        </main>
      }
    >
      <AccountsPageInner />
    </Suspense>
  );
}
