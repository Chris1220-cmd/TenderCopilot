'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'motion/react';
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
      <motion.button
        onClick={() => setTecOpen(true)}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.5 }}
        whileHover={{ scale: 1.1, y: -3 }}
        whileTap={{ scale: 0.9 }}
        className={cn(
          'fixed bottom-6 right-6 z-50',
          'flex h-[72px] w-[72px] items-center justify-center',
          'rounded-full shadow-2xl shadow-primary/25',
          'bg-gradient-to-br from-primary to-primary/80',
          'ring-2 ring-primary/20 ring-offset-2 ring-offset-background',
          'transition-shadow duration-300',
          'hover:shadow-primary/40 hover:ring-primary/40',
          'focus-visible:outline-none',
          'cursor-pointer group',
        )}
        aria-label="TEC Assistant"
      >
        <Image
          src="/images/tec-mascot.png"
          alt="TEC"
          width={48}
          height={48}
          className="rounded-full group-hover:rotate-6 transition-transform duration-300"
        />
        {/* Breathing pulse */}
        <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
        {/* TEC label */}
        <span className="absolute -top-1 -right-1 flex h-6 items-center justify-center rounded-full bg-white text-primary px-2 text-[10px] font-extrabold shadow-lg border border-primary/20">
          TEC
        </span>
      </motion.button>

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
