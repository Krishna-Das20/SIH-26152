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
  const changeColors = {
    positive: 'text-skynet-positive',
    negative: 'text-skynet-negative',
    neutral: 'text-skynet-text-secondary',
  };

  return (
    <div className="skynet-surface rounded-xl p-5 skynet-card-hover">
      <div className="flex items-start justify-between mb-3">
        <span className="skynet-label">{label}</span>
        {icon && (
          <span className="text-skynet-muted">{icon}</span>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-skynet-text-primary skynet-metric">
          {value}
        </span>
        {change && (
          <span className={`text-xs font-medium ${changeColors[changeType]}`}>
            {change}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="text-[11px] text-skynet-muted mt-1.5">{subtitle}</p>
      )}
    </div>
  );
}
