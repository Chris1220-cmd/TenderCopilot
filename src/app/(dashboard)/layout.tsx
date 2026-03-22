'use client';

import { useState } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { TopNav } from '@/components/layout/top-nav';
import { CommandPalette } from '@/components/layout/command-palette';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopNav onOpenCommandPalette={() => setCommandPaletteOpen(true)} />
      <main className="relative flex-1 overflow-y-auto scrollbar-thin">
        {/* Top edge accent glow */}
        <div className="pointer-events-none fixed inset-x-0 top-14 h-[200px] bg-gradient-to-b from-primary/[0.04] to-transparent" />
        <div className="relative z-10 mx-auto max-w-[1400px] px-6 py-8">
          {children}
        </div>
      </main>
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      <Toaster />
    </div>
  );
}
