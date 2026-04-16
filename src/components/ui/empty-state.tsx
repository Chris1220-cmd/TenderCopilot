'use client';

import { cn } from '@/lib/utils';
import { FileText, Calendar, CheckSquare, Inbox, Bell, MessageSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type EmptyVariant = 'tenders' | 'deadlines' | 'tasks' | 'actions' | 'reminders' | 'general';

const variantConfig: Record<EmptyVariant, { icon: LucideIcon; accent: string; glow: string; gradient: string }> = {
  tenders: { icon: FileText, accent: 'text-[#48A4D6]', glow: 'shadow-[#48A4D6]/20', gradient: 'from-[#48A4D6]/10 to-[#48A4D6]/5' },
  deadlines: { icon: Calendar, accent: 'text-amber-400', glow: 'shadow-amber-400/20', gradient: 'from-amber-400/10 to-amber-400/5' },
  tasks: { icon: CheckSquare, accent: 'text-emerald-400', glow: 'shadow-emerald-400/20', gradient: 'from-emerald-400/10 to-emerald-400/5' },
  actions: { icon: Inbox, accent: 'text-[#48A4D6]', glow: 'shadow-[#48A4D6]/20', gradient: 'from-[#48A4D6]/10 to-[#48A4D6]/5' },
  reminders: { icon: Bell, accent: 'text-amber-400', glow: 'shadow-amber-400/20', gradient: 'from-amber-400/10 to-amber-400/5' },
  general: { icon: Inbox, accent: 'text-muted-foreground', glow: 'shadow-muted/20', gradient: 'from-muted/10 to-muted/5' },
};

interface EmptyStateIllustrationProps {
  variant?: EmptyVariant;
  className?: string;
}

export function EmptyStateIllustration({ variant = 'general', className }: EmptyStateIllustrationProps) {
  const { icon: Icon, accent, glow, gradient } = variantConfig[variant];

  return (
    <div className={cn('relative mx-auto h-[100px] w-[100px]', className)}>
      {/* Outer glow pulse */}
      <div className={cn(
        'absolute inset-[-8px] rounded-full bg-gradient-to-br opacity-60 blur-xl animate-pulse',
        gradient,
      )} />

      {/* Background circle with gradient */}
      <div className={cn(
        'absolute inset-0 rounded-full bg-gradient-to-br from-card to-muted/30 border border-border/50',
        'shadow-lg',
        glow,
      )} />

      {/* Animated ring */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full animate-[spin_30s_linear_infinite]">
        <circle
          cx="50" cy="50" r="46"
          fill="none"
          strokeWidth="0.8"
          strokeDasharray="8 6"
          className="stroke-border/60"
        />
      </svg>

      {/* Inner subtle ring */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full animate-[spin_20s_linear_infinite_reverse]">
        <circle
          cx="50" cy="50" r="38"
          fill="none"
          strokeWidth="0.5"
          strokeDasharray="4 8"
          className="stroke-border/30"
        />
      </svg>

      {/* Icon with backdrop */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={cn(
          'flex h-12 w-12 items-center justify-center rounded-xl',
          'bg-gradient-to-br from-background to-card border border-border/40',
          'shadow-md',
          glow,
        )}>
          <Icon className={cn('h-6 w-6', accent)} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}
