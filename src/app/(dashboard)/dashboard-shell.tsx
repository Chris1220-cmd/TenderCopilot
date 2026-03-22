'use client';

import { useState } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { TopNav } from '@/components/layout/top-nav';
import { CommandPalette } from '@/components/layout/command-palette';
import { PageTransition } from '@/components/layout/page-transition';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#FAFAFA]">
      <TopNav onOpenCommandPalette={() => setCommandPaletteOpen(true)} />
      <main className="relative flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-[1400px] px-6 py-8">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      <Toaster />
    </div>
  );
}
