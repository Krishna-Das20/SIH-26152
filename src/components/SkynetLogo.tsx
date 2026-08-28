'use client';

import React from 'react';

interface SkynetLogoProps {
  size?: number;
  className?: string;
  withGlow?: boolean;
}

export function SkynetLogo({ size = 32, className = '', withGlow = true }: SkynetLogoProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {withGlow && (
        <div
          className="absolute inset-0 rounded-2xl bg-cyan-500/25 blur-md animate-pulse pointer-events-none"
          style={{ transform: 'scale(1.2)' }}
        />
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 drop-shadow-[0_0_12px_rgba(0,240,255,0.45)]"
      >
        <defs>
          <linearGradient id="skynetGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00F0FF" />
            <stop offset="50%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
          <linearGradient id="skynetCoreGradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00F0FF" />
            <stop offset="100%" stopColor="#FFFFFF" />
          </linearGradient>
          <radialGradient id="skynetOcularGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#00F0FF" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#00F0FF" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer Orbital Targeting Ring (Segmented) */}
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke="url(#skynetGradient)"
          strokeWidth="2"
          strokeDasharray="14 8 32 8"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* Inner Cybernetic Hexagon Frame */}
        <path
          d="M50 14 L81 32 L81 68 L50 86 L19 68 L19 32 Z"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="1.5"
          fill="rgba(8,12,20,0.6)"
        />

        {/* Hexagon Node Vertices */}
        <circle cx="50" cy="14" r="2.5" fill="#00F0FF" />
        <circle cx="81" cy="32" r="2.5" fill="#00F0FF" />
        <circle cx="81" cy="68" r="2.5" fill="#10B981" />
        <circle cx="50" cy="86" r="2.5" fill="#10B981" />
        <circle cx="19" cy="68" r="2.5" fill="#00F0FF" />
        <circle cx="19" cy="32" r="2.5" fill="#00F0FF" />

        {/* Distinctive Stylized 'S' Neural Vector Core */}
        <path
          d="M68 34 C68 25 57 23 48 24 C38 25 32 30 32 39 C32 49 46 51 55 54 C64 57 68 62 68 70 C68 80 57 82 48 81 C37 80 30 73 30 65"
          stroke="url(#skynetCoreGradient)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Cybernetic Ocular Focal Point (The Skynet Eye) */}
        <circle cx="50" cy="50" r="12" fill="url(#skynetOcularGlow)" />
        <circle cx="50" cy="50" r="4.5" fill="#FFFFFF" />
        <circle cx="50" cy="50" r="2" fill="#00F0FF" />

        {/* Optical Scanning Ray Crosshairs */}
        <line x1="50" y1="6" x2="50" y2="12" stroke="#00F0FF" strokeWidth="2" strokeLinecap="round" />
        <line x1="50" y1="88" x2="50" y2="94" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
        <line x1="6" y1="50" x2="12" y2="50" stroke="#00F0FF" strokeWidth="2" strokeLinecap="round" />
        <line x1="88" y1="50" x2="94" y2="50" stroke="#00F0FF" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}
