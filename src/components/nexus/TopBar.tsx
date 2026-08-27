'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, RefreshCw, User, ShieldCheck, X, Key, Database, ExternalLink, Shield } from 'lucide-react';
import { SkynetLogo } from '../SkynetLogo';

interface TopBarProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  children?: React.ReactNode;
}

export function TopBar({ title, subtitle, onRefresh, refreshing, children }: TopBarProps) {
  const [showAnalystModal, setShowAnalystModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleRefreshClick = () => {
    if (onRefresh) {
      onRefresh();
      setToastMessage('Intelligence synchronization initiated. Refreshing feeds & scores…');
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-2xl border-b border-white/[0.08]">
        <div className="flex items-center justify-between px-8 py-4">
          {/* Left: Title with SKYNET Brand Emblem & Typography */}
          <div className="flex items-center gap-3.5">
            <SkynetLogo size={36} className="hidden sm:inline-flex" />
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00F0FF] animate-pulse" />
                <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-cyan-400 font-bold">
                  SKYNET NEURAL COMMAND • SIH-26152
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight font-display">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs text-neutral-400 mt-0.5 font-medium">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {children}

            {/* Functional Sync Intel Button */}
            {onRefresh && (
              <button
                onClick={handleRefreshClick}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 rounded-full liquid-glass-btn text-white text-xs font-bold tracking-wider uppercase transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
                  strokeWidth={2}
                />
                <span className="hidden sm:inline">
                  {refreshing ? 'Syncing Intel…' : 'Sync Intel'}
                </span>
              </button>
            )}

            {/* Functional Analyst Clearance Button */}
            <button
              onClick={() => setShowAnalystModal(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 transition-all active:scale-95 group"
              title="Click to view Analyst Security Clearance & Enclave Telemetry"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-200 font-bold">
                ANALYST
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Floating Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="liquid-glass-dock px-5 py-3 flex items-center gap-3 text-xs text-white shadow-2xl border border-white/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-sans font-medium">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Interactive Analyst Clearance Modal */}
      {showAnalystModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md liquid-glass-dock p-6 border border-white/20 shadow-2xl text-left smooth-enter">
            {/* Header */}
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white font-display">
                    Analyst Security Enclave
                  </h3>
                  <p className="text-[11px] font-mono text-neutral-400">
                    ID: OP-26152-SEC • NTRO ENCLAVE
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAnalystModal(false)}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Enclave Details */}
            <div className="space-y-3 mb-6 text-xs">
              <div className="flex justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <span className="text-neutral-400 font-mono">ENCLAVE CLEARANCE</span>
                <span className="text-emerald-400 font-mono font-bold">TOP SECRET // SIH-26152</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <span className="text-neutral-400 font-mono">TENANT ISOLATION</span>
                <span className="text-white font-mono font-bold">Single-Tenant Mode (Active)</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <span className="text-neutral-400 font-mono">YOUTUBE API QUOTA</span>
                <span className="text-red-400 font-mono font-bold">10,000 Credits / Day Tier</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <span className="text-neutral-400 font-mono">REDDIT LIVE STREAM</span>
                <span className="text-orange-400 font-mono font-bold">Devvit Bridge Active</span>
              </div>
            </div>

            {/* Navigation Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/settings/accounts"
                onClick={() => setShowAnalystModal(false)}
                className="cred-pill-btn-outline text-center text-[10px] py-2.5 flex items-center justify-center gap-1.5"
              >
                <Key className="w-3.5 h-3.5 text-neutral-300" />
                <span>API Keys & Auth</span>
              </Link>
              <Link
                href="/sources"
                onClick={() => setShowAnalystModal(false)}
                className="cred-pill-btn-outline text-center text-[10px] py-2.5 flex items-center justify-center gap-1.5"
              >
                <Database className="w-3.5 h-3.5 text-neutral-300" />
                <span>Data Sources</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
