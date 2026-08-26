'use client';

import React from 'react';
import { Sidebar } from './Sidebar';

interface NexusLayoutProps {
  children: React.ReactNode;
}

export function NexusLayout({ children }: NexusLayoutProps) {
  return (
    <div className="min-h-screen bg-nexus-bg">
      <Sidebar />
      <div className="ml-[240px] min-h-screen">
        {children}
      </div>
    </div>
  );
}
