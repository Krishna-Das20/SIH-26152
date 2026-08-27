'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  TrendingUp,
  Heart,
  Zap,
  Users,
  Network,
  FileText,
  Database,
  Settings,
  Shield,
  ExternalLink,
} from 'lucide-react';

import { SkynetLogo } from '../SkynetLogo';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard, tag: 'LIVE' },
  { href: '/narratives', label: 'Narratives', icon: TrendingUp, tag: 'AI' },
  { href: '/sentiment', label: 'Sentiment', icon: Heart },
  { href: '/trends', label: 'Trends', icon: Zap },
  { href: '/audience', label: 'Audience', icon: Users },
  { href: '/network', label: 'Network', icon: Network },
  { href: '/brief', label: 'Reports', icon: FileText },
];

const BOTTOM_ITEMS = [
  { href: '/sources', label: 'Data Sources', icon: Database },
  { href: '/settings/accounts', label: 'Connected Accounts', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[240px] bg-black/95 backdrop-blur-2xl border-r border-white/[0.08] flex flex-col z-50">
      {/* SKYNET Neural Brand Header */}
      <div className="px-5 py-5 border-b border-white/[0.08]">
        <Link href="/" className="flex items-center gap-3 group">
          <SkynetLogo size={34} className="transition-transform duration-300 group-hover:scale-110" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black text-white tracking-[0.2em] font-display uppercase">
                SKYNET
              </h1>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#00F0FF]" />
            </div>
            <p className="text-[9px] font-mono tracking-[0.22em] text-cyan-400/80 uppercase font-bold">
              NEURAL OSINT
            </p>
          </div>
        </Link>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[9px] font-mono uppercase tracking-[0.25em] text-neutral-500 font-bold">
          INTELLIGENCE
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-white/15 to-white/5 text-white border border-white/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.05] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-white' : 'text-neutral-500'
                  }`}
                  strokeWidth={isActive ? 2.2 : 1.7}
                />
                <span className="tracking-wide">{item.label}</span>
              </div>
              {item.tag && (
                <span
                  className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-white text-black'
                      : 'bg-white/10 text-neutral-300'
                  }`}
                >
                  {item.tag}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Nav & Platform Telemetry Pill */}
      <div className="p-3 border-t border-white/[0.08] space-y-2">
        <div className="px-3 py-1 text-[9px] font-mono uppercase tracking-[0.25em] text-neutral-500 font-bold">
          SYSTEM
        </div>
        {BOTTOM_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-white/10 text-white border border-white/15'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 text-neutral-500" strokeWidth={1.7} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* CRED Luxury Security Badge */}
        <div className="mt-2 p-3 rounded-xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/10 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[9px] font-mono font-extrabold uppercase tracking-widest text-neutral-300 mb-1">
            <Shield className="w-3 h-3 text-emerald-400" />
            NTRO • HIGH SECURITY
          </div>
          <p className="text-[10px] text-neutral-400 font-sans leading-tight">
            Single-tenant isolated enclave
          </p>
        </div>
      </div>
    </aside>
  );
}
