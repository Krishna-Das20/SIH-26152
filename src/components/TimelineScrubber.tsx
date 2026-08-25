'use client';

import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Clock, FastForward } from 'lucide-react';

interface TimelineScrubberProps {
  startTime: string;
  endTime: string;
  currentTime: string;
  onTimeChange: (time: string) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  startTime,
  endTime,
  currentTime,
  onTimeChange,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onSpeedChange
}) => {
  const startMs = new Date(startTime || '2026-08-25T00:00:00.000Z').getTime();
  const endMs = new Date(endTime || '2026-08-25T23:59:59.000Z').getTime();
  const currentMs = new Date(currentTime || endTime).getTime();

  const progressPercent = Math.min(100, Math.max(0, ((currentMs - startMs) / Math.max(1, endMs - startMs)) * 100));

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const newMs = startMs + (val / 100) * (endMs - startMs);
    onTimeChange(new Date(newMs).toISOString());
  };

  const formatDisplayTime = (isoString: string) => {
    if (!isoString) return '--:--:--';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' }) + ' UTC';
    } catch {
      return isoString;
    }
  };

  return (
    <div className="intel-card rounded-xl p-4 border border-intel-border mb-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-3">
        
        {/* Timeline Title & Current Playhead Time */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              Timeline Chronology Playback
              {isPlaying && (
                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded animate-pulse">
                  PLAYING ({playbackSpeed}x)
                </span>
              )}
            </h3>
            <div className="text-xs font-mono text-cyan-400 mt-0.5">
              Active Playhead: <span className="text-white font-bold">{formatDisplayTime(currentTime)}</span>
            </div>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onTimeChange(startTime)}
            title="Reset to Beginning (T0)"
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={onTogglePlay}
            className={`px-4 py-2 rounded-lg font-medium text-xs flex items-center gap-2 transition-all ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-black font-semibold'
                : 'bg-intel-cyan hover:bg-cyan-400 text-black font-bold shadow-lg shadow-cyan-500/20'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isPlaying ? 'PAUSE REPLAY' : 'START REPLAY'}</span>
          </button>

          {/* Speed Toggle */}
          <button
            onClick={() => onSpeedChange(playbackSpeed === 1 ? 2 : playbackSpeed === 2 ? 5 : 1)}
            className="px-2.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-300 border border-slate-800 flex items-center gap-1 transition-all"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>{playbackSpeed}x</span>
          </button>
        </div>

      </div>

      {/* Interactive Range Slider */}
      <div className="relative pt-1">
        <input
          type="range"
          min="0"
          max="100"
          step="0.5"
          value={progressPercent}
          onChange={handleSliderChange}
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
        />
        <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
          <span>T₀: {formatDisplayTime(startTime)}</span>
          <span className="text-cyan-400">Scrubber Progress: {progressPercent.toFixed(1)}%</span>
          <span>Tₙ: {formatDisplayTime(endTime)}</span>
        </div>
      </div>
    </div>
  );
};
