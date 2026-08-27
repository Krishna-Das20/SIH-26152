'use client';

import React from 'react';
import { Sidebar } from './Sidebar';

interface NexusLayoutProps {
  children: React.ReactNode;
}

export function NexusLayout({ children }: NexusLayoutProps) {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
      {/* CRED-style subtle radial ambient illumination */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,255,255,0.06),rgba(0,0,0,0))]" />
      <Sidebar />
      <div className="relative z-10 ml-[240px] min-h-screen smooth-enter">
        {children}
      </div>
    </div>
  );
}
