'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Building2,
  CheckSquare,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';

const navItems = [
  {
    label: 'Πίνακας Ελέγχου',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Διαγωνισμοί',
    href: '/tenders',
    icon: FileText,
  },
  {
    label: 'Εταιρεία',
    href: '/company',
    icon: Building2,
  },
  {
    label: 'Εργασίες',
    href: '/tasks',
    icon: CheckSquare,
  },
  {
    label: 'Αναλυτικά',
    href: '/analytics',
    icon: BarChart3,
  },
];

const bottomItems = [
  {
    label: 'Ρυθμίσεις',
    href: '/settings',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'group/sidebar relative flex h-screen flex-col',
          'bg-white/80 dark:bg-slate-950/80',
          'backdrop-blur-xl',
          'border-r border-white/10 dark:border-white/5',
          'transition-[width] duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]',
          collapsed ? 'w-[68px]' : 'w-[260px]'
        )}
      >
        {/* Subtle glass edge highlight */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-white/20 via-white/5 to-white/20 dark:from-white/10 dark:via-white/[0.02] dark:to-white/10" />

        {/* Logo section */}
        <div className="flex h-16 items-center gap-3 px-4">
          <img src="/images/logo-icon.png" alt="TenderCopilot" className="h-9 w-9 rounded-xl shadow-lg shadow-blue-500/25 shrink-0" />
          <div
            className={cn(
              'flex flex-col overflow-hidden transition-[opacity,transform] duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]',
              collapsed
                ? 'pointer-events-none w-0 -translate-x-2 opacity-0'
                : 'w-auto translate-x-0 opacity-100'
            )}
          >
            <span className="truncate text-sm font-semibold tracking-tight text-foreground">
              TenderCopilot
            </span>
            <span className="truncate text-[11px] font-medium text-muted-foreground/70">
              GR Edition
            </span>
          </div>
        </div>

        <Separator className="opacity-50" />

        {/* Main navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scrollbar-thin">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname?.startsWith(item.href + '/');
            const Icon = item.icon;

            const linkContent = (
              <Link
                href={item.href}
                className={cn(
                  'group/item relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium cursor-pointer',
                  'transition-all duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]',
                  'hover:bg-white/5 dark:hover:bg-white/5',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {/* Active indicator — gradient left border */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-blue-500 to-indigo-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                )}

                <Icon
                  className={cn(
                    'h-[18px] w-[18px] shrink-0 transition-colors duration-200',
                    isActive
                      ? 'text-primary drop-shadow-[0_0_4px_rgba(59,130,246,0.4)]'
                      : 'text-muted-foreground group-hover/item:text-foreground'
                  )}
                />
                <span
                  className={cn(
                    'truncate transition-[opacity,transform] duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]',
                    collapsed
                      ? 'pointer-events-none w-0 -translate-x-2 opacity-0'
                      : 'w-auto translate-x-0 opacity-100'
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent
                    side="right"
                    sideOffset={12}
                    className="border-white/10 bg-slate-900/90 text-white backdrop-blur-md dark:border-white/5"
                  >
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.href}>{linkContent}</div>;
          })}
        </nav>

        {/* Bottom section */}
        <div className="space-y-1 px-3 pb-4">
          <Separator className="mb-3 opacity-50" />
          {bottomItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            const linkContent = (
              <Link
                href={item.href}
                className={cn(
                  'group/item relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium cursor-pointer',
                  'transition-all duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]',
                  'hover:bg-white/5 dark:hover:bg-white/5',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-blue-500 to-indigo-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                )}

                <Icon
                  className={cn(
                    'h-[18px] w-[18px] shrink-0 transition-colors duration-200',
                    isActive
                      ? 'text-primary drop-shadow-[0_0_4px_rgba(59,130,246,0.4)]'
                      : 'text-muted-foreground group-hover/item:text-foreground'
                  )}
                />
                <span
                  className={cn(
                    'truncate transition-[opacity,transform] duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]',
                    collapsed
                      ? 'pointer-events-none w-0 -translate-x-2 opacity-0'
                      : 'w-auto translate-x-0 opacity-100'
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent
                    side="right"
                    sideOffset={12}
                    className="border-white/10 bg-slate-900/90 text-white backdrop-blur-md dark:border-white/5"
                  >
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.href}>{linkContent}</div>;
          })}
        </div>

        {/* Collapse toggle button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className={cn(
                'absolute -right-3.5 top-20 z-10 h-7 w-7 rounded-full cursor-pointer',
                'border border-white/15 dark:border-white/10',
                'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md',
                'shadow-lg shadow-black/5 dark:shadow-black/20',
                'hover:bg-white dark:hover:bg-slate-800',
                'hover:shadow-xl hover:shadow-blue-500/10',
                'transition-all duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]'
              )}
            >
              {collapsed ? (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={8}
            className="border-white/10 bg-slate-900/90 text-white backdrop-blur-md dark:border-white/5"
          >
            {collapsed ? 'Ανάπτυξη' : 'Σύμπτυξη'}
          </TooltipContent>
        </Tooltip>
      </aside>
    </TooltipProvider>
  );
}
