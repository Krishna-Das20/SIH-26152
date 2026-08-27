'use client';

import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  subtitle?: string;
}

export function MetricCard({
  label,
  value,
  change,
  changeType = 'neutral',
  icon,
  subtitle,
}: MetricCardProps) {
  const changeStyles = {
    positive: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
    negative: 'text-rose-400 bg-rose-500/10 border-rose-500/25',
    neutral: 'text-neutral-300 bg-white/5 border-white/10',
  };

  return (
    <div className="relative group rounded-2xl bg-gradient-to-b from-white/[0.08] via-white/[0.03] to-transparent p-[1px] transition-all duration-300 hover:from-white/20 hover:via-white/10 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.9)]">
      <div className="h-full rounded-2xl bg-gradient-to-b from-[#131317] via-[#0d0d10] to-[#08080a] p-5 flex flex-col justify-between shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-neutral-400">
            {label}
          </span>
          {icon && (
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white transition-colors group-hover:border-white/20 group-hover:bg-white/[0.08]">
              {icon}
            </div>
          )}
        </div>

        {/* Big Number */}
        <div className="flex items-baseline gap-3 my-1">
          <span className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight font-display">
            {value}
          </span>
          {change && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${changeStyles[changeType]}`}
            >
              {change}
            </span>
          )}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-[11px] text-neutral-400 mt-2 font-medium">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
