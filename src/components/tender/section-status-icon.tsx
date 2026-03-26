'use client';

import { cn } from '@/lib/utils';
import { Circle, CircleDot, CheckCircle2, AlertTriangle } from 'lucide-react';

export type SectionStatus = 'not_started' | 'in_progress' | 'complete' | 'has_issues';

const statusConfig: Record<SectionStatus, { icon: typeof Circle; className: string }> = {
  not_started: { icon: Circle, className: 'text-muted-foreground/40' },
  in_progress: { icon: CircleDot, className: 'text-[#f59e0b]' },
  complete: { icon: CheckCircle2, className: 'text-emerald-500' },
  has_issues: { icon: AlertTriangle, className: 'text-[#ef4444]' },
};

export function SectionStatusIcon({
  status,
  className,
}: {
  status: SectionStatus;
  className?: string;
}) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return <Icon className={cn('h-4 w-4 shrink-0', config.className, className)} />;
}
