'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Toaster } from '@/components/ui/toaster';
import { TopNav } from '@/components/layout/top-nav';
import { CommandPalette } from '@/components/layout/command-palette';
import { PageTransition } from '@/components/layout/page-transition';
import { AIAssistantPanel } from '@/components/tender/ai-assistant-panel';
import { cn } from '@/lib/utils';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [tecOpen, setTecOpen] = useState(false);
  const pathname = usePathname();

  // Extract tenderId from URL if on a tender page
  const tenderMatch = pathname.match(/\/tenders\/([^/]+)/);
  const tenderId = tenderMatch?.[1] || null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopNav onOpenCommandPalette={() => setCommandPaletteOpen(true)} />
      <main className="relative flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-[1400px] px-6 py-8">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      <Toaster />

      {/* TEC — Global AI Assistant Button */}
      <button
        onClick={() => setTecOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-50',
          'flex h-14 w-14 items-center justify-center',
          'rounded-2xl shadow-2xl',
          'bg-card border border-border/60',
          'transition-all duration-300 ease-out',
          'hover:scale-105 hover:shadow-primary/20 hover:border-primary/30',
          'active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          'cursor-pointer group',
        )}
        aria-label="TEC Assistant"
      >
        <Image
          src="/images/tec-mascot.png"
          alt="TEC"
          width={36}
          height={36}
          className="rounded-lg group-hover:scale-110 transition-transform duration-200"
        />
        {/* Pulse */}
        <span className="absolute inset-0 rounded-2xl bg-primary/10 animate-ping opacity-20" />
        {/* Label */}
        <span className="absolute -top-1.5 -right-1.5 flex h-5 items-center justify-center rounded-full bg-primary px-1.5 text-[9px] font-bold text-white shadow-lg">
          TEC
        </span>
      </button>

      {/* TEC Panel — only functional on tender pages */}
      {tenderId && (
        <AIAssistantPanel
          tenderId={tenderId}
          open={tecOpen}
          onOpenChange={setTecOpen}
        />
      )}

      {/* TEC info sheet for non-tender pages */}
      {!tenderId && tecOpen && (
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setTecOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-[380px] bg-card border-l border-border shadow-2xl flex flex-col items-center justify-center p-8 text-center">
            <Image src="/images/tec-mascot.png" alt="TEC" width={80} height={80} className="mb-4" />
            <h3 className="text-lg font-semibold text-foreground">TEC</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Ο TEC είναι ο έξυπνος βοηθός σου για διαγωνισμούς. Πήγαινε σε έναν διαγωνισμό για να μιλήσεις μαζί του!
            </p>
            <button
              onClick={() => setTecOpen(false)}
              className="mt-6 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors"
            >
              Κατάλαβα
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
