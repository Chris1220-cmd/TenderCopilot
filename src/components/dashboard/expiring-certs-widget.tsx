'use client';

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { useTranslation } from '@/lib/i18n';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
  },
};

function daysUntilExpiry(dateStr: string | Date): number {
  const d = new Date(dateStr);
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

export function ExpiringCertsWidget() {
  const { t } = useTranslation();
  const { data, isLoading } = trpc.company.getExpiringDocuments.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const allDocs = [
    ...(data?.certificates ?? []).map((c: any) => ({
      id: c.id,
      name: c.title,
      expiryDate: c.expiryDate,
      tenderCount: c._count?.deadlinePlanItems ?? 0,
      kind: 'cert' as const,
    })),
    ...(data?.legalDocs ?? []).map((d: any) => ({
      id: d.id,
      name: d.title,
      expiryDate: d.expiryDate,
      tenderCount: d._count?.deadlinePlanItems ?? 0,
      kind: 'legal' as const,
    })),
  ]
    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())
    .slice(0, 5);

  return (
    <motion.div variants={itemVariants} className="lg:col-span-2">
      <div className="group rounded-xl border border-border/60 bg-card transition-colors hover:border-primary/20">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-title text-foreground">{t('certs.expiringTitle')}</h2>
          <Link
            href="/company"
            className="flex items-center gap-1 text-caption text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {t('certs.renew')} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Body */}
        <div className="border-t border-border/40">
          {isLoading ? (
            <div className="space-y-1 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : allDocs.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
              <p className="text-body text-muted-foreground">
                {t('certs.allGood')}
              </p>
            </div>
          ) : (
            <div>
              {allDocs.map((doc) => {
                const days = daysUntilExpiry(doc.expiryDate);
                const isExpired = days <= 0;

                return (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 px-6 py-3.5 border-b border-border/30 last:border-0"
                  >
                    <AlertTriangle
                      className={cn(
                        'h-4 w-4 shrink-0',
                        isExpired ? 'text-[#ef4444]' : 'text-[#f59e0b]'
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-body font-medium text-foreground truncate">
                        {doc.name}
                      </p>
                      {doc.tenderCount > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {t('certs.usedInTenders').replace('{{count}}', String(doc.tenderCount))}
                        </span>
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-[12px] font-semibold tabular-nums shrink-0',
                        isExpired ? 'text-[#ef4444]' : 'text-[#f59e0b]'
                      )}
                    >
                      {isExpired
                        ? t('certs.expired')
                        : t('certs.expiresIn').replace('{{days}}', String(days))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
