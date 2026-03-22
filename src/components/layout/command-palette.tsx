'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import {
  Search,
  LayoutDashboard,
  FileText,
  Compass,
  BarChart3,
  Building2,
  CheckSquare,
  Settings,
  Plus,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  category: 'pages' | 'actions' | 'tenders';
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const navigate = useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router]
  );

  const allItems: CommandItem[] = useMemo(
    () => [
      // Pages
      { id: 'dashboard', label: 'Dashboard', description: 'Overview & stats', icon: LayoutDashboard, category: 'pages', action: () => navigate('/dashboard') },
      { id: 'tenders', label: 'Tenders', description: 'View all tenders', icon: FileText, category: 'pages', action: () => navigate('/tenders') },
      { id: 'discovery', label: 'Discovery', description: 'Find new opportunities', icon: Compass, category: 'pages', action: () => navigate('/discovery') },
      { id: 'analytics', label: 'Analytics', description: 'Charts & insights', icon: BarChart3, category: 'pages', action: () => navigate('/analytics') },
      { id: 'company', label: 'Company', description: 'Company profile', icon: Building2, category: 'pages', action: () => navigate('/company') },
      { id: 'tasks', label: 'Tasks', description: 'Task management', icon: CheckSquare, category: 'pages', action: () => navigate('/tasks') },
      { id: 'settings', label: 'Settings', description: 'App settings', icon: Settings, category: 'pages', action: () => navigate('/settings') },
      // Actions
      { id: 'new-tender', label: 'Create New Tender', description: 'Start a new tender submission', icon: Plus, category: 'actions', action: () => navigate('/tenders/new') },
      { id: 'ai-assistant', label: 'AI Assistant', description: 'Open AI helper', icon: Sparkles, category: 'actions', action: () => navigate('/dashboard') },
    ],
    [navigate]
  );

  const filtered = useMemo(() => {
    if (!query) return allItems;
    const q = query.toLowerCase();
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.category.includes(q)
    );
  }, [query, allItems]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      const group = map.get(item.category) || [];
      group.push(item);
      map.set(item.category, group);
    }
    return map;
  }, [filtered]);

  const flatItems = useMemo(() => filtered, [filtered]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Clamp index
  useEffect(() => {
    if (selectedIndex >= flatItems.length) {
      setSelectedIndex(Math.max(0, flatItems.length - 1));
    }
  }, [flatItems.length, selectedIndex]);

  // Keyboard nav
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % flatItems.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => (i - 1 + flatItems.length) % flatItems.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (flatItems[selectedIndex]) {
            flatItems[selectedIndex].action();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onOpenChange(false);
          break;
      }
    },
    [flatItems, selectedIndex, onOpenChange]
  );

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const categoryLabels: Record<string, string> = {
    pages: 'Pages',
    actions: 'Actions',
    tenders: 'Recent Tenders',
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            className="fixed left-1/2 top-[20%] z-[101] w-full max-w-[560px] -translate-x-1/2"
          >
            <div
              className="overflow-hidden rounded-xl border border-border/60 bg-popover shadow-2xl shadow-black/40"
              onKeyDown={handleKeyDown}
            >
              {/* Search Input */}
              <div className="flex items-center gap-3 border-b border-border/60 px-4">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search pages, actions, tenders..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  className="h-12 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
                />
                <kbd className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/60">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div ref={listRef} className="max-h-[320px] overflow-y-auto p-2 scrollbar-thin">
                {flatItems.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No results found
                  </div>
                ) : (
                  Array.from(grouped.entries()).map(([category, items]) => {
                    return (
                      <div key={category} className="mb-1">
                        <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">
                          {categoryLabels[category] || category}
                        </div>
                        {items.map((item) => {
                          const globalIndex = flatItems.indexOf(item);
                          const isSelected = globalIndex === selectedIndex;
                          return (
                            <button
                              key={item.id}
                              data-index={globalIndex}
                              onClick={() => item.action()}
                              onMouseEnter={() => setSelectedIndex(globalIndex)}
                              className={cn(
                                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-75 cursor-pointer',
                                isSelected
                                  ? 'bg-primary/10 text-foreground'
                                  : 'text-muted-foreground hover:text-foreground'
                              )}
                            >
                              <div
                                className={cn(
                                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                                  isSelected
                                    ? 'bg-primary/20 text-primary'
                                    : 'bg-muted/50 text-muted-foreground'
                                )}
                              >
                                <item.icon className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium">{item.label}</div>
                                {item.description && (
                                  <div className="text-xs text-muted-foreground/60 truncate">
                                    {item.description}
                                  </div>
                                )}
                              </div>
                              {isSelected && (
                                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-4 border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground/40">
                <span><kbd className="font-mono">↑↓</kbd> navigate</span>
                <span><kbd className="font-mono">↵</kbd> select</span>
                <span><kbd className="font-mono">esc</kbd> close</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
