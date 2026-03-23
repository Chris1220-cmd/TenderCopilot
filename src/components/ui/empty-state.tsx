'use client';

import { cn } from '@/lib/utils';
import { FileText, Calendar, CheckSquare, Inbox, Bell, MessageSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type EmptyVariant = 'tenders' | 'deadlines' | 'tasks' | 'actions' | 'reminders' | 'general';

const variantConfig: Record<EmptyVariant, { icon: LucideIcon; accent: string }> = {
  tenders: { icon: FileText, accent: 'text-primary' },
  deadlines: { icon: Calendar, accent: 'text-amber-500' },
  tasks: { icon: CheckSquare, accent: 'text-emerald-500' },
  actions: { icon: Inbox, accent: 'text-primary' },
  reminders: { icon: Bell, accent: 'text-amber-500' },
  general: { icon: Inbox, accent: 'text-muted-foreground' },
};

interface EmptyStateIllustrationProps {
  variant?: EmptyVariant;
  className?: string;
}

export function EmptyStateIllustration({ variant = 'general', className }: EmptyStateIllustrationProps) {
  const { icon: Icon, accent } = variantConfig[variant];

  return (
    <div className={cn('relative mx-auto h-[100px] w-[100px]', className)}>
      {/* Background circle */}
      <div className="absolute inset-0 rounded-full bg-muted/50" />
      {/* Decorative ring */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <circle
          cx="50" cy="50" r="46"
          fill="none"
          strokeWidth="1"
          strokeDasharray="6 4"
          className="stroke-border"
        />
      </svg>
      {/* Icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Icon className={cn('h-8 w-8', accent)} strokeWidth={1.5} />
      </div>
    </div>
  );
}
