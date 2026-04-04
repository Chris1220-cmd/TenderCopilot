'use client';

import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';

export function UsageIndicator() {
  const { data } = trpc.subscription.current.useQuery(undefined, {
    staleTime: 60_000,
  });

  if (!data) return null;

  const { subscription, metrics } = data;

  const limitedMetrics = metrics.filter(
    (m: { unlimited: boolean }) => !m.unlimited,
  );
  const topMetrics = limitedMetrics.slice(0, 2);
  const warningMetric = limitedMetrics.find(
    (m: { percentage: number }) => m.percentage >= 80,
  );

  const compactLabel = topMetrics
    .map(
      (m: { current: number; max: number; label: string }) =>
        `${m.current}/${m.max} ${m.label}`,
    )
    .join(' | ');

  const trialEnd =
    subscription?.status === 'TRIAL' && subscription.trialEndsAt
      ? new Date(subscription.trialEndsAt).toLocaleDateString()
      : null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 text-xs text-muted-foreground cursor-default select-none">
            <span className="hidden sm:inline">{compactLabel}</span>
            {warningMetric && (
              <Badge
                variant="outline"
                className="border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] px-1.5 py-0"
              >
                {warningMetric.percentage}%
              </Badge>
            )}
            {trialEnd && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0"
              >
                Trial ends {trialEnd}
              </Badge>
            )}
          </div>
        </TooltipTrigger>

        <TooltipContent
          side="bottom"
          align="end"
          className="w-64 space-y-3 p-4"
        >
          <p className="text-xs font-semibold">
            Usage — {data.plan?.name ?? 'Current Plan'}
          </p>

          {limitedMetrics.map(
            (m: {
              key: string;
              label: string;
              current: number;
              max: number;
              percentage: number;
            }) => (
              <div key={m.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span>{m.label}</span>
                  <span className="tabular-nums">
                    {m.current} / {m.max}
                  </span>
                </div>
                <Progress
                  value={m.percentage}
                  className={
                    m.percentage >= 80
                      ? '[&>div]:bg-amber-500'
                      : ''
                  }
                />
              </div>
            ),
          )}

          {trialEnd && (
            <p className="text-[11px] text-muted-foreground pt-1">
              Trial ends on {trialEnd}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
