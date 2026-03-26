'use client';

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { FileWarning } from 'lucide-react';
import Link from 'next/link';

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
  },
};

type CellStatus = 'OK' | 'MARGINAL' | 'EXPIRING' | 'EXPIRED' | 'NA';

type MatrixData = {
  tenders: { id: string; title: string; deadline: Date }[];
  documents: {
    id: string;
    title: string;
    type: string;
    expiryDate: Date;
    kind: 'cert' | 'legal';
  }[];
  cells: { docId: string; tenderId: string; status: CellStatus }[];
};

const statusConfig: Record<
  CellStatus,
  { key: string; bg: string; text: string }
> = {
  OK: { key: 'resources.matrix.ok', bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  MARGINAL: { key: 'resources.matrix.marginal', bg: 'bg-[#f59e0b]/20', text: 'text-[#f59e0b]' },
  EXPIRING: { key: 'resources.matrix.expiring', bg: 'bg-[#ef4444]/20', text: 'text-[#ef4444]' },
  EXPIRED: { key: 'resources.matrix.expired', bg: 'bg-[#ef4444]/30', text: 'text-[#ef4444]' },
  NA: { key: 'resources.matrix.na', bg: 'bg-muted/20', text: 'text-muted-foreground' },
};

function daysUntil(date: Date): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

export function CertificateMatrix({ data }: { data: MatrixData }) {
  const { t } = useTranslation();

  if (data.documents.length === 0 || data.tenders.length === 0) {
    return (
      <motion.div
        variants={itemVariants}
        className="rounded-xl border border-border/60 bg-card p-8 text-center"
      >
        <FileWarning className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-body text-muted-foreground">
          {t('resources.matrix.empty')}
        </p>
      </motion.div>
    );
  }

  const cellMap = new Map<string, CellStatus>();
  for (const c of data.cells) {
    cellMap.set(`${c.docId}-${c.tenderId}`, c.status);
  }

  return (
    <motion.div
      variants={itemVariants}
      className="rounded-xl border border-border/60 bg-card overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                {t('resources.matrix.certificate')}
              </th>
              <th className="text-center px-3 py-3 text-xs font-medium text-muted-foreground">
                {t('resources.matrix.expires')}
              </th>
              {data.tenders.map((tender) => {
                const days = daysUntil(tender.deadline);
                return (
                  <th key={tender.id} className="text-center px-3 py-3 min-w-[90px]">
                    <Link
                      href={`/tenders/${tender.id}`}
                      className="hover:underline cursor-pointer"
                    >
                      <div className="text-xs font-medium text-foreground truncate max-w-[100px] mx-auto">
                        {tender.title}
                      </div>
                      <div
                        className={cn(
                          'text-[10px] font-semibold mt-0.5',
                          days <= 3
                            ? 'text-[#ef4444]'
                            : days <= 7
                              ? 'text-[#f59e0b]'
                              : 'text-muted-foreground'
                        )}
                      >
                        {new Date(tender.deadline).toLocaleDateString('el-GR', {
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </div>
                    </Link>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.documents.map((doc) => (
              <tr
                key={doc.id}
                className="border-b border-border/20 last:border-0"
              >
                <td className="px-4 py-2.5 text-sm text-foreground font-medium">
                  {doc.title}
                </td>
                <td className="text-center px-3 py-2.5">
                  <span
                    className={cn(
                      'text-xs font-semibold tabular-nums',
                      daysUntil(doc.expiryDate) <= 0
                        ? 'text-[#ef4444]'
                        : daysUntil(doc.expiryDate) <= 7
                          ? 'text-[#f59e0b]'
                          : 'text-emerald-400'
                    )}
                  >
                    {new Date(doc.expiryDate).toLocaleDateString('el-GR', {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </span>
                </td>
                {data.tenders.map((tender) => {
                  const status =
                    cellMap.get(`${doc.id}-${tender.id}`) ?? 'NA';
                  const config = statusConfig[status];
                  return (
                    <td key={tender.id} className="text-center px-3 py-2.5">
                      <span
                        className={cn(
                          'inline-block rounded px-2 py-0.5 text-[11px] font-semibold',
                          config.bg,
                          config.text
                        )}
                      >
                        {t(config.key)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
