'use client';

import React from 'react';
import { Sidebar } from './Sidebar';

interface SkynetLayoutProps {
  children: React.ReactNode;
}

export function SkynetLayout({ children }: SkynetLayoutProps) {
  return (
    <div className="min-h-screen bg-skynet-bg">
      <Sidebar />
      <div className="ml-[240px] min-h-screen">
        {children}
      </div>
    </div>
  );
}
