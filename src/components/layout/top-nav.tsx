'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Compass,
  BarChart3,
  Bell,
  Search,
  LogOut,
  Settings,
  Building2,
  CheckSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import { useState, useEffect, useCallback } from 'react';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Tenders', href: '/tenders', icon: FileText },
  { label: 'Discovery', href: '/discovery', icon: Compass },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
];

export function TopNav({ onOpenCommandPalette }: { onOpenCommandPalette?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const main = document.querySelector('main');
      setScrolled(main ? main.scrollTop > 10 : false);
    };
    const main = document.querySelector('main');
    main?.addEventListener('scroll', handleScroll, { passive: true });
    return () => main?.removeEventListener('scroll', handleScroll);
  }, []);

  // Ctrl+K / Cmd+K shortcut
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenCommandPalette?.();
      }
    },
    [onOpenCommandPalette]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between border-b px-6',
        'bg-card/80 backdrop-blur-xl backdrop-saturate-[180%]',
        'border-border/60 transition-shadow duration-300',
        scrolled && 'shadow-[0_1px_3px_rgba(0,0,0,0.4)]'
      )}
    >
      {/* Left: Logo + Nav Tabs */}
      <div className="flex items-center gap-1">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="group mr-6 flex items-center gap-2.5 cursor-pointer"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-[0_0_12px_rgba(168,85,247,0.2)] transition-shadow duration-200 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]">
            <span className="text-xs font-bold text-white tracking-tight">TC</span>
          </div>
          <span className="hidden text-sm font-semibold text-foreground/90 md:block">
            TenderCopilot
          </span>
        </Link>

        {/* Nav Tabs with animated underline */}
        <nav className="flex items-center">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium transition-colors duration-150 cursor-pointer rounded-md',
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                )}
              >
                <item.icon className="h-[15px] w-[15px]" />
                <span className="hidden sm:inline">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-x-2 -bottom-[11px] h-[2px] rounded-full bg-gradient-to-r from-primary to-accent"
                    transition={{
                      type: 'spring',
                      stiffness: 500,
                      damping: 30,
                    }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right: Search trigger + Notifications + User */}
      <div className="flex items-center gap-1.5">
        {/* Command Palette Trigger */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-foreground cursor-pointer h-8 px-2.5"
          onClick={onOpenCommandPalette}
        >
          <Search className="h-[15px] w-[15px]" />
          <kbd className="pointer-events-none hidden rounded-[4px] border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/70 md:inline">
            Ctrl K
          </kbd>
        </Button>

        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground cursor-pointer h-8 w-8"
        >
          <Bell className="h-[15px] w-[15px]" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-8 w-8 rounded-full cursor-pointer"
            >
              <Avatar className="h-7 w-7">
                <AvatarImage
                  src={session?.user?.image || undefined}
                  alt={session?.user?.name || ''}
                />
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-[10px] font-semibold text-white">
                  {getInitials(session?.user?.name || 'U')}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {session?.user?.name || 'User'}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {session?.user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/company" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Company
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/tasks" className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4" /> Tasks
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
