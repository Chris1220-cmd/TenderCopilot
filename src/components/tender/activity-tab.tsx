'use client';

import { cn, formatDate, getInitials } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  FileText,
  Upload,
  CheckCircle2,
  Link2,
  Pencil,
  UserPlus,
  Sparkles,
  AlertCircle,
  Activity,
  Clock,
} from 'lucide-react';

interface ActivityTabProps {
  tenderId: string;
}

const actionIconMap: Record<string, { icon: typeof FileText; color: string; bgColor: string }> = {
  uploaded_document: {
    icon: Upload,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  requirement_mapped: {
    icon: Link2,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  task_completed: {
    icon: CheckCircle2,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10',
  },
  task_created: {
    icon: Pencil,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/10',
  },
  status_changed: {
    icon: Activity,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-500/10',
  },
  document_generated: {
    icon: Sparkles,
    color: 'text-pink-600 dark:text-pink-400',
    bgColor: 'bg-pink-500/10',
  },
  member_added: {
    icon: UserPlus,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  compliance_check: {
    icon: AlertCircle,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-500/10',
  },
};

const defaultAction = {
  icon: Activity,
  color: 'text-gray-600 dark:text-gray-400',
  bgColor: 'bg-gray-500/10',
};

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Μόλις τώρα';
  if (diffMins < 60) return `${diffMins} λεπτά πριν`;
  if (diffHours < 24) return `${diffHours} ώρες πριν`;
  if (diffDays < 7) return `${diffDays} ημέρες πριν`;

  return date.toLocaleDateString('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ActivityTab({ tenderId }: ActivityTabProps) {
  const timelineQuery = trpc.analytics.getTenderTimeline.useQuery(
    { tenderId },
    { retry: false }
  );

  const activities = (timelineQuery.data ?? []) as any[];

  if (timelineQuery.isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <GlassCard>
        <GlassCardContent className="flex flex-col items-center justify-center py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Activity className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-base font-semibold">Χωρίς δραστηριότητα</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Δεν υπάρχει δραστηριότητα ακόμα.
          </p>
        </GlassCardContent>
      </GlassCard>
    );
  }

  return (
    <BlurFade delay={0.05} inView>
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

      <div className="space-y-0">
        {activities.map((activity, index) => {
          const actionConfig = actionIconMap[activity?.action] ?? defaultAction;
          const ActionIcon = actionConfig.icon;

          return (
            <div
              key={activity.id ?? index}
              className={cn(
                'relative flex gap-4 py-4 pl-0 group',
                index < activities.length - 1 && 'border-b-0'
              )}
            >
              {/* Icon */}
              <div
                className={cn(
                  'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-background',
                  actionConfig.bgColor,
                  'transition-transform duration-200 group-hover:scale-110'
                )}
              >
                <ActionIcon className={cn('h-4 w-4', actionConfig.color)} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm leading-relaxed">
                  {activity?.details ?? activity?.action ?? ''}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  {activity.user ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={activity.user?.image ?? undefined} />
                        <AvatarFallback className="text-[9px] bg-primary/10">
                          {getInitials(activity.user?.name ?? '')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">
                        {activity.user?.name ?? activity.user?.email ?? 'Άγνωστος'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Σύστημα</span>
                  )}
                  {activity.createdAt && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatTimestamp(activity.createdAt as string)}
                  </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </BlurFade>
  );
}
