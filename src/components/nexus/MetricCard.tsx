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
    positive: 'text-nexus-positive',
    negative: 'text-nexus-negative',
    neutral: 'text-nexus-text-secondary',
  };

  return (
    <div className="nexus-surface rounded-xl p-5 nexus-card-hover">
      <div className="flex items-start justify-between mb-3">
        <span className="nexus-label">{label}</span>
        {icon && (
          <span className="text-nexus-muted">{icon}</span>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-nexus-text-primary nexus-metric">
          {value}
        </span>
        {change && (
          <span className={`text-xs font-medium ${changeColors[changeType]}`}>
            {change}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="text-[11px] text-nexus-muted mt-1.5">{subtitle}</p>
      )}
    </div>
  );
}
