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
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/narratives', label: 'Narratives', icon: TrendingUp },
  { href: '/sentiment', label: 'Sentiment', icon: Heart },
  { href: '/trends', label: 'Trends', icon: Zap },
  { href: '/audience', label: 'Audience', icon: Users },
  { href: '/network', label: 'Network', icon: Network },
  { href: '/brief', label: 'Reports', icon: FileText },
];

const BOTTOM_ITEMS = [
  { href: '/sources', label: 'Data Sources', icon: Database },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[240px] bg-nexus-surface border-r border-nexus-border flex flex-col z-50">
      {/* Brand */}
      <div className="px-6 py-6 border-b border-nexus-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-nexus-accent/10 flex items-center justify-center">
            <span className="text-nexus-accent text-xs font-semibold">N</span>
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-nexus-text-primary tracking-tight">
              NEXUS
            </h1>
            <p className="text-[10px] text-nexus-muted tracking-wider uppercase">
              Social Intelligence
            </p>
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
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
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium nexus-transition ${
                isActive
                  ? 'bg-nexus-surface-secondary text-nexus-text-primary'
                  : 'text-nexus-text-secondary hover:text-nexus-text-primary hover:bg-nexus-surface-secondary/50'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive ? 'text-nexus-accent' : 'text-nexus-muted'
                }`}
                strokeWidth={1.5}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Nav */}
      <div className="px-3 py-4 border-t border-nexus-border space-y-0.5">
        {BOTTOM_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium nexus-transition ${
                isActive
                  ? 'bg-nexus-surface-secondary text-nexus-text-primary'
                  : 'text-nexus-text-secondary hover:text-nexus-text-primary hover:bg-nexus-surface-secondary/50'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive ? 'text-nexus-accent' : 'text-nexus-muted'
                }`}
                strokeWidth={1.5}
              />
              {item.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
