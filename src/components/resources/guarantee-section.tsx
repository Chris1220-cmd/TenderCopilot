'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Loader2, Landmark } from 'lucide-react';
import Link from 'next/link';
import { GuaranteeFormSheet } from './guarantee-form-sheet';

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const statusColors: Record<string, string> = {
  REQUESTED: 'bg-[#f59e0b]/20 text-[#f59e0b]',
  ISSUED: 'bg-[#48A4D6]/20 text-[#48A4D6]',
  ACTIVE: 'bg-emerald-500/20 text-emerald-400',
  RELEASED: 'bg-muted/40 text-muted-foreground',
  EXPIRED: 'bg-[#ef4444]/20 text-[#ef4444]',
};

type GuaranteeOverview = {
  guarantees: any[];
  creditLine: number | null;
  committed: number;
  available: number | null;
};

function formatEur(n: number) {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

export function GuaranteeSection({ data }: { data: GuaranteeOverview }) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingGuarantee, setEditingGuarantee] = useState<any>(null);

  const deleteMutation = trpc.resources.deleteGuarantee.useMutation({
    onSuccess: () => utils.resources.invalidate(),
  });

  const percentage =
    data.creditLine && data.creditLine > 0
      ? Math.round((data.committed / data.creditLine) * 100)
      : null;
  const barColor =
    percentage === null
      ? ''
      : percentage <= 50
        ? 'bg-emerald-500'
        : percentage <= 80
          ? 'bg-[#f59e0b]'
          : 'bg-[#ef4444]';

  return (
    <motion.div
      variants={itemVariants}
      className="rounded-xl border border-border/60 bg-card overflow-hidden"
    >
      <div className="px-5 py-4 flex items-center justify-between border-b border-border/40">
        <h3 className="text-sm font-semibold text-foreground">
          {t('resources.guarantees.title')}
        </h3>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 cursor-pointer"
          onClick={() => {
            setEditingGuarantee(null);
            setSheetOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" /> {t('resources.guarantees.add')}
        </Button>
      </div>

      <div className="px-5 py-4">
        {/* Progress bar */}
        {data.creditLine !== null && data.creditLine > 0 ? (
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">
                {t('resources.guarantees.committed')}:{' '}
                <span className="font-semibold text-foreground">
                  {formatEur(data.committed)}
                </span>
              </span>
              <span className="text-muted-foreground">
                {t('resources.guarantees.creditLine')}:{' '}
                <span className="font-semibold text-foreground">
                  {formatEur(data.creditLine)}
                </span>
              </span>
            </div>
            <div className="h-5 bg-muted/30 rounded-lg overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-lg flex items-center justify-center text-[11px] font-semibold transition-all duration-500',
                  barColor,
                  percentage! > 80 ? 'text-white' : 'text-black'
                )}
                style={{ width: `${Math.min(percentage!, 100)}%` }}
              >
                {percentage}%
              </div>
            </div>
            {data.available !== null && data.available > 0 && (
              <p className="text-xs text-muted-foreground mt-1.5">
                {t('resources.guarantees.available')}: {formatEur(data.available)}{' '}
                — {t('resources.guarantees.maxTenderValue')} ~
                {formatEur(data.available / 0.02)}
              </p>
            )}
          </div>
        ) : (
          <div className="mb-4 rounded-lg bg-muted/20 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              <Link
                href="/company"
                className="text-[#48A4D6] hover:underline cursor-pointer"
              >
                {t('resources.guarantees.noCreditLine')}
              </Link>
            </p>
          </div>
        )}

        {/* Guarantee list */}
        {data.guarantees.length === 0 ? (
          <div className="py-6 text-center">
            <Landmark className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {t('resources.guarantees.empty')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {data.guarantees.map((g: any) => {
              const isActive = ['REQUESTED', 'ISSUED', 'ACTIVE'].includes(
                g.status
              );
              return (
                <div
                  key={g.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg',
                    isActive ? 'bg-muted/10' : 'bg-muted/5 opacity-60'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/tenders/${g.tenderId}`}
                      className="text-sm font-medium text-foreground hover:underline cursor-pointer truncate block"
                    >
                      {g.tender?.title ?? g.tenderId}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-[10px]',
                          statusColors[g.status] ?? ''
                        )}
                      >
                        {t(`resources.guarantees.status.${g.status}`)}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {t(`resources.guarantees.type.${g.type}`)}
                      </span>
                      {g.bank && (
                        <span className="text-[10px] text-muted-foreground">
                          • {g.bank}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      'text-sm font-semibold tabular-nums shrink-0',
                      isActive
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    {formatEur(g.amount)}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 cursor-pointer"
                      onClick={() => {
                        setEditingGuarantee(g);
                        setSheetOpen(true);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 cursor-pointer text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(t('resources.guarantees.deleteConfirm'))) {
                          deleteMutation.mutate({ id: g.id });
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <GuaranteeFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSuccess={() => setEditingGuarantee(null)}
        editData={
          editingGuarantee
            ? {
                id: editingGuarantee.id,
                tenderId: editingGuarantee.tenderId,
                type: editingGuarantee.type,
                amount: editingGuarantee.amount,
                bank: editingGuarantee.bank ?? '',
                referenceNumber: editingGuarantee.referenceNumber ?? '',
                status: editingGuarantee.status,
                notes: editingGuarantee.notes ?? '',
              }
            : undefined
        }
      />
    </motion.div>
  );
}
