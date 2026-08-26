'use client';

import React from 'react';
import { Search, RefreshCw, User } from 'lucide-react';

interface TopBarProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  children?: React.ReactNode;
}

export function TopBar({ title, subtitle, onRefresh, refreshing, children }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 bg-nexus-bg/80 backdrop-blur-md border-b border-nexus-border">
      <div className="flex items-center justify-between px-8 py-4">
        {/* Left: Title */}
        <div>
          <h1 className="text-xl font-semibold text-nexus-text-primary tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[13px] text-nexus-text-secondary mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {children}

          {/* Search */}
          <button className="p-2 rounded-lg text-nexus-muted hover:text-nexus-text-secondary hover:bg-nexus-surface nexus-transition">
            <Search className="w-4 h-4" strokeWidth={1.5} />
          </button>

          {/* Refresh */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="p-2 rounded-lg text-nexus-muted hover:text-nexus-text-secondary hover:bg-nexus-surface nexus-transition"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
                strokeWidth={1.5}
              />
            </button>
          )}

          {/* Profile */}
          <div className="w-7 h-7 rounded-full bg-nexus-surface-secondary border border-nexus-border flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-nexus-muted" strokeWidth={1.5} />
          </div>
        </div>
      </div>
    </header>
  );
}
