'use client';

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export function ClarificationRemindersWidget() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data, isLoading } = trpc.aiRoles.getClarificationReminders.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const utils = trpc.useUtils();

  const markCheckedMutation = trpc.aiRoles.markClarificationsChecked.useMutation({
    onSuccess: () => {
      toast({ title: t('clarifications.checkedNow') });
      utils.aiRoles.getClarificationReminders.invalidate();
    },
  });

  const reminders = (data ?? []) as any[];

  return (
    <motion.div variants={itemVariants} className="lg:col-span-3">
      <div className="group rounded-xl border border-border/60 bg-card transition-colors hover:border-primary/20">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-title text-foreground">{t('clarifications.remindersTitle')}</h2>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="border-t border-border/40">
          {isLoading ? (
            <div className="space-y-1 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : reminders.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
              <p className="text-body text-muted-foreground">{t('clarifications.allChecked')}</p>
            </div>
          ) : (
            <div>
              {reminders.map((r: any) => (
                <div
                  key={r.tenderId}
                  className="flex items-center gap-3 px-6 py-3.5 border-b border-border/30 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/tenders/${r.tenderId}?tab=legal`}
                      className="text-body font-medium text-foreground truncate hover:text-primary transition-colors cursor-pointer block"
                    >
                      {r.tenderTitle}
                    </Link>
                    <span className="text-[10px] text-muted-foreground">
                      {t('clarifications.daysSinceCheck').replace('{{days}}', String(r.daysSinceCheck))}
                    </span>
                  </div>
                  <span
                    className={cn(
                      'text-[12px] font-semibold tabular-nums shrink-0',
                      r.urgency === 'critical' ? 'text-[#ef4444]' :
                      r.urgency === 'warning' ? 'text-[#f59e0b]' :
                      'text-muted-foreground'
                    )}
                  >
                    {r.daysToDeadline}d
                  </span>
                  {r.platformUrl && (
                    <a
                      href={r.platformUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cursor-pointer shrink-0 text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => markCheckedMutation.mutate({ tenderId: r.tenderId })}
                    disabled={markCheckedMutation.isPending}
                    className="cursor-pointer h-7 text-xs shrink-0"
                  >
                    {markCheckedMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
