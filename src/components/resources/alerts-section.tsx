'use client';

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
  },
};

type AlertImpact = { tenderId: string; tenderTitle: string; deadline: Date | null };
type Alert = {
  id: string;
  type: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  impact: AlertImpact[];
  action: string;
  daysLeft: number | null;
};

function formatDaysLeft(
  days: number | null,
  t: (k: string) => string
): { text: string; bgColor: string; textColor: string } {
  if (days === null)
    return { text: 'INFO', bgColor: 'bg-[#48A4D6]', textColor: 'text-white' };
  if (days <= 0)
    return {
      text: t('resources.alerts.expired'),
      bgColor: 'bg-[#ef4444]',
      textColor: 'text-white',
    };
  if (days === 1)
    return {
      text: t('resources.alerts.oneDay'),
      bgColor: 'bg-[#ef4444]',
      textColor: 'text-white',
    };
  if (days <= 3)
    return {
      text: t('resources.alerts.daysLeft').replace('{{count}}', String(days)),
      bgColor: 'bg-[#ef4444]',
      textColor: 'text-white',
    };
  if (days <= 7)
    return {
      text: t('resources.alerts.daysLeft').replace('{{count}}', String(days)),
      bgColor: 'bg-[#f59e0b]',
      textColor: 'text-black',
    };
  return {
    text: t('resources.alerts.daysLeft').replace('{{count}}', String(days)),
    bgColor: 'bg-[#48A4D6]',
    textColor: 'text-white',
  };
}

const actionKeyMap: Record<string, string> = {
  orderCertificate: 'resources.alerts.action.orderCertificate',
  callBank: 'resources.alerts.action.callBank',
  signDocuments: 'resources.alerts.action.signDocuments',
  checkClarifications: 'resources.alerts.action.checkClarifications',
  checkReadiness: 'resources.alerts.action.checkReadiness',
};

export function AlertsSection({ alerts }: { alerts: Alert[] }) {
  const { t } = useTranslation();

  if (alerts.length === 0) {
    return (
      <motion.div
        variants={itemVariants}
        className="rounded-xl border border-border/60 bg-card p-8 text-center"
      >
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
        <p className="text-body text-muted-foreground">
          {t('resources.alerts.empty')}
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div variants={itemVariants} className="flex flex-col gap-3">
      {alerts.map((alert) => {
        const badge = formatDaysLeft(alert.daysLeft, t);
        const actionText = actionKeyMap[alert.action]
          ? t(actionKeyMap[alert.action])
          : alert.action;

        return (
          <div
            key={alert.id}
            className={cn(
              'rounded-xl border border-border/40 bg-card/50 px-5 py-4 flex items-start gap-3',
              alert.severity === 'CRITICAL' && 'border-[#ef4444]/30',
              alert.severity === 'WARNING' && 'border-[#f59e0b]/30'
            )}
          >
            <span
              className={cn(
                'shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold',
                badge.bgColor,
                badge.textColor
              )}
            >
              {badge.text}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{alert.title}</p>
              {alert.impact.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('resources.alerts.affects')}:{' '}
                  {alert.impact.map((imp, i) => (
                    <span key={imp.tenderId}>
                      {i > 0 && ' + '}
                      <Link
                        href={`/tenders/${imp.tenderId}`}
                        className="text-foreground hover:underline cursor-pointer"
                      >
                        {imp.tenderTitle}
                      </Link>
                      {imp.deadline && (
                        <span className="text-muted-foreground">
                          {' '}
                          (
                          {new Date(imp.deadline).toLocaleDateString('el-GR', {
                            day: '2-digit',
                            month: '2-digit',
                          })}
                          )
                        </span>
                      )}
                    </span>
                  ))}
                </p>
              )}
              <p className="text-xs text-muted-foreground/70 mt-1 flex items-center gap-1">
                <ArrowRight className="h-3 w-3" /> {actionText}
              </p>
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}
