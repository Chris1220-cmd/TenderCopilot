'use client';

import { motion } from 'motion/react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FolderCheck,
  AlertTriangle,
  Clock,
  Plus,
  ArrowRight,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
  },
};

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */
const statusConfig: Record<
  string,
  { label: string; bg: string; text: string; ring: string }
> = {
  READY: { label: 'ΕΤΟΙΜΟΣ', bg: 'bg-success/15', text: 'text-success', ring: 'stroke-emerald-500' },
  AT_RISK: { label: 'ΚΙΝΔΥΝΟΣ', bg: 'bg-warning/15', text: 'text-warning', ring: 'stroke-amber-500' },
  NOT_READY: { label: 'ΜΗ ΕΤΟΙΜΟΣ', bg: 'bg-destructive/15', text: 'text-destructive', ring: 'stroke-red-500' },
  UNCHECKED: { label: 'ΑΝΑΛΥΣΗ ΕΚΚΡΕΜΕΙ', bg: 'bg-muted', text: 'text-muted-foreground', ring: 'stroke-muted-foreground' },
};

function ScoreCircle({ score, status }: { score: number; status: string }) {
  const cfg = statusConfig[status] ?? statusConfig.UNCHECKED;
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <svg width={48} height={48} viewBox="0 0 48 48" className="shrink-0">
      <circle
        cx={24}
        cy={24}
        r={radius}
        fill="none"
        strokeWidth={3}
        className="stroke-border/40"
      />
      <circle
        cx={24}
        cy={24}
        r={radius}
        fill="none"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className={cfg.ring}
        transform="rotate(-90 24 24)"
      />
      <text
        x={24}
        y={24}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground text-[11px] font-semibold"
      >
        {score}%
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function FakeloiPage() {
  const { data: tenders, isLoading } = trpc.fakelos.getWarRoom.useQuery();

  const activeCount = tenders?.length ?? 0;
  const readyCount = tenders?.filter((t: any) => t.status === 'READY').length ?? 0;
  const criticalCount = tenders?.filter((t: any) => (t.criticalGaps ?? 0) > 0).length ?? 0;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-headline text-foreground">
          Οι Φάκελοί Μου
        </h1>
        <p className="mt-1 text-body text-muted-foreground">
          Παρακολουθήστε την ετοιμότητα κάθε φακέλου
        </p>
      </motion.div>

      {/* Stats row */}
      <motion.div variants={itemVariants} className="grid gap-4 grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <p className="text-caption text-muted-foreground">Ενεργοί</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {isLoading ? <Skeleton className="mx-auto h-7 w-8 rounded" /> : activeCount}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <p className="text-caption text-muted-foreground">Έτοιμοι</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-success">
            {isLoading ? <Skeleton className="mx-auto h-7 w-8 rounded" /> : readyCount}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <p className="text-caption text-muted-foreground">Κρίσιμοι</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-destructive">
            {isLoading ? <Skeleton className="mx-auto h-7 w-8 rounded" /> : criticalCount}
          </p>
        </div>
      </motion.div>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div key={i} variants={itemVariants}>
              <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3 animate-pulse">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-3/5 rounded" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-3 w-1/3 rounded" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <Skeleton className="h-4 w-16 rounded" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!tenders || tenders.length === 0) && (
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-border/60 bg-card py-20 text-center">
            <div className="relative mx-auto mb-4 h-[120px] w-[160px]">
              <Image
                src="/images/illustrations/empty-tenders.png"
                alt=""
                fill
                className="object-contain opacity-70"
              />
            </div>
            <h3 className="text-title text-foreground">Δεν υπάρχουν διαγωνισμοί</h3>
            <p className="mt-1 text-body text-muted-foreground">
              Δημιουργήστε τον πρώτο σας διαγωνισμό
            </p>
            <Button
              asChild
              className="mt-5 gap-2 bg-gradient-to-r from-primary to-accent text-white hover:opacity-90 rounded-full px-5 cursor-pointer shadow-sm"
            >
              <Link href="/tenders/new">
                <Plus className="h-4 w-4" />
                Νέος Διαγωνισμός
              </Link>
            </Button>
          </div>
        </motion.div>
      )}

      {/* Tender cards grid */}
      {!isLoading && tenders && tenders.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tenders.map((t: any, i: number) => {
            const cfg = statusConfig[t.status] ?? statusConfig.UNCHECKED;
            const days = t.daysUntilDeadline as number | null;

            return (
              <motion.div
                key={t.tenderId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  href={`/tenders/${t.tenderId}?tab=fakelos`}
                  className="group block rounded-xl border border-border/60 bg-card p-5 transition-all hover:border-primary/20 cursor-pointer"
                >
                  {/* Row 1: Title + status badge */}
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="truncate text-body font-medium text-foreground">
                      {t.title}
                    </h3>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                        cfg.bg,
                        cfg.text,
                      )}
                    >
                      {cfg.label}
                    </span>
                  </div>

                  {/* Row 2: Reference number */}
                  <p className="mt-1 text-caption font-mono text-muted-foreground">
                    {t.referenceNumber}
                  </p>

                  {/* Row 3: Score circle + deadline */}
                  <div className="mt-3 flex items-center justify-between">
                    <ScoreCircle score={t.score ?? 0} status={t.status} />

                    {days != null && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span
                          className={cn(
                            'text-[12px] font-semibold tabular-nums',
                            days <= 7
                              ? 'text-destructive'
                              : days <= 30
                                ? 'text-warning'
                                : 'text-muted-foreground',
                          )}
                        >
                          {days} ημέρ{days === 1 ? 'α' : 'ες'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Row 4: Critical gaps */}
                  {(t.criticalGaps ?? 0) > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span className="text-caption font-medium">
                        {t.criticalGaps} κρίσιμ{t.criticalGaps === 1 ? 'ο' : 'α'} κενά
                      </span>
                    </div>
                  )}
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
