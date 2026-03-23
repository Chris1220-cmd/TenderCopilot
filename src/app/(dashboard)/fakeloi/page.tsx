'use client';

import { motion } from 'motion/react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyStateIllustration } from '@/components/ui/empty-state';
import { useTranslation } from '@/lib/i18n';
import { BlurFade } from '@/components/ui/blur-fade';
import { Ripple } from '@/components/ui/ripple';
import { BorderBeam } from '@/components/ui/border-beam';
import { PremiumStatCardV2 } from '@/components/ui/premium-stat-card-v2';
import {
  FolderCheck,
  AlertTriangle,
  Clock,
  Plus,
  Shield,
  FileCheck,
  Target,
  ChevronRight,
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
const statusKeys: Record<string, string> = {
  READY: 'fakeloi.statusReady',
  AT_RISK: 'fakeloi.statusAtRisk',
  NOT_READY: 'fakeloi.statusNotReady',
  UNCHECKED: 'fakeloi.statusUnchecked',
};

const statusStyles: Record<string, { bg: string; text: string; ring: string; glow: string }> = {
  READY: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    ring: 'stroke-emerald-500',
    glow: 'shadow-emerald-500/5',
  },
  AT_RISK: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    ring: 'stroke-amber-500',
    glow: 'shadow-amber-500/5',
  },
  NOT_READY: {
    bg: 'bg-red-500/10',
    text: 'text-red-600 dark:text-red-400',
    ring: 'stroke-red-500',
    glow: 'shadow-red-500/5',
  },
  UNCHECKED: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    ring: 'stroke-muted-foreground',
    glow: '',
  },
};

/* ------------------------------------------------------------------ */
/*  Score ring                                                         */
/* ------------------------------------------------------------------ */
function ScoreRing({ score, status, size = 56 }: { score: number; status: string; size?: number }) {
  const cfg = statusStyles[status] ?? statusStyles.UNCHECKED;
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={3}
          className="stroke-border/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(cfg.ring, 'transition-all duration-700')}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold tabular-nums text-foreground">{score}%</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Metric pill (inside card)                                          */
/* ------------------------------------------------------------------ */
function MetricPill({ icon: Icon, label, value, color }: {
  icon: typeof Shield;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5">
      <Icon className={cn('h-3.5 w-3.5', color || 'text-muted-foreground')} />
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={cn('ml-auto text-[12px] font-semibold tabular-nums', color || 'text-foreground')}>
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function FakeloiPage() {
  const { t } = useTranslation();
  const { data: tenders, isLoading } = trpc.fakelos.getWarRoom.useQuery();

  const activeCount = tenders?.length ?? 0;
  const readyCount = tenders?.filter((t: any) => t.status === 'READY').length ?? 0;
  const criticalCount = tenders?.filter((t: any) => (t.criticalGaps ?? 0) > 0).length ?? 0;

  const statsCards = [
    { title: t('fakeloi.active'), value: activeCount, icon: FolderCheck, subtitle: t('fakeloi.subtitle') },
    { title: t('fakeloi.ready'), value: readyCount, icon: FileCheck, subtitle: '', colorClass: 'text-emerald-500' },
    { title: t('fakeloi.critical'), value: criticalCount, icon: AlertTriangle, subtitle: '', colorClass: 'text-red-500' },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Header */}
      <BlurFade delay={0.1}>
        <motion.div variants={itemVariants} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-display text-foreground">{t('fakeloi.title')}</h1>
            <p className="mt-1 text-body text-muted-foreground">{t('fakeloi.subtitle')}</p>
          </div>
          <Button
            asChild
            size="sm"
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-5 cursor-pointer shadow-sm"
          >
            <Link href="/tenders/new">
              <Plus className="h-4 w-4" />
              {t('fakeloi.newTender')}
            </Link>
          </Button>
        </motion.div>
      </BlurFade>

      {/* Stats Row */}
      <BlurFade delay={0.15} inView>
        <div className="grid gap-4 grid-cols-3">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <motion.div key={i} variants={itemVariants}>
                  <div className="rounded-xl border border-border/60 bg-card p-5 animate-pulse">
                    <div className="h-3 w-16 bg-muted rounded mb-3" />
                    <div className="h-8 w-10 bg-muted rounded" />
                  </div>
                </motion.div>
              ))
            : statsCards.map((card, i) => (
                <PremiumStatCardV2
                  key={card.title}
                  title={card.title}
                  value={card.value}
                  icon={card.icon}
                  subtitle={card.subtitle}
                  index={i}
                  colorClass={card.colorClass}
                />
              ))}
        </div>
      </BlurFade>

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div key={i} variants={itemVariants}>
              <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-4 animate-pulse">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-3/5 rounded" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-3 w-1/3 rounded" />
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-8 rounded-lg" />
                  <Skeleton className="h-8 rounded-lg" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!tenders || tenders.length === 0) && (
        <BlurFade delay={0.2} inView>
          <motion.div variants={itemVariants}>
            <div className="relative rounded-2xl border border-border/60 bg-card py-20 text-center overflow-hidden">
              <Ripple mainCircleSize={100} mainCircleOpacity={0.06} numCircles={5} />
              <div className="relative z-10">
              <EmptyStateIllustration variant="tenders" className="mb-5" />
              <h3 className="text-title text-foreground">{t('fakeloi.noTenders')}</h3>
              <p className="mt-1 text-body text-muted-foreground">{t('fakeloi.noTendersSub')}</p>
              <Button
                asChild
                className="mt-5 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-5 cursor-pointer shadow-sm"
              >
                <Link href="/tenders/new">
                  <Plus className="h-4 w-4" />
                  {t('fakeloi.newTender')}
                </Link>
              </Button>
              </div>
            </div>
          </motion.div>
        </BlurFade>
      )}

      {/* Tender Cards — Premium Floating */}
      {!isLoading && tenders && tenders.length > 0 && (
        <BlurFade delay={0.2} inView>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {tenders.map((tender: any, i: number) => {
              const status = tender.status || 'UNCHECKED';
              const cfg = statusStyles[status] ?? statusStyles.UNCHECKED;
              const days = tender.daysUntilDeadline as number | null;
              const score = tender.score ?? 0;
              const gaps = tender.criticalGaps ?? 0;

              return (
                <motion.div
                  key={tender.tenderId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link
                    href={`/tenders/${tender.tenderId}?tab=fakelos`}
                    className={cn(
                      'group relative block rounded-2xl border bg-card p-6 transition-all duration-200 cursor-pointer overflow-hidden',
                      'border-border/60 hover:border-primary/20',
                      'hover:shadow-lg hover:-translate-y-0.5',
                      cfg.glow && `hover:${cfg.glow}`,
                    )}
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
                      e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
                    }}
                  >
                    {/* Spotlight */}
                    <div
                      className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ background: 'radial-gradient(300px circle at var(--mx, 50%) var(--my, 50%), rgba(72,164,214,0.08), transparent 60%)' }}
                    />
                    {/* BorderBeam on hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <BorderBeam size={60} duration={6} colorFrom="#48A4D6" colorTo="transparent" borderWidth={1} />
                    </div>
                    {/* Top row: title + status */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[15px] font-semibold text-foreground group-hover:text-primary transition-colors">
                          {tender.title}
                        </h3>
                        <p className="mt-0.5 text-[12px] font-mono text-muted-foreground">
                          {tender.referenceNumber}
                        </p>
                      </div>
                      <span className={cn(
                        'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
                        cfg.bg, cfg.text,
                      )}>
                        {t(statusKeys[status] || statusKeys.UNCHECKED)}
                      </span>
                    </div>

                    {/* Middle: Score ring + metrics grid */}
                    <div className="flex items-center gap-5">
                      <ScoreRing score={score} status={status} />

                      <div className="flex-1 space-y-1.5">
                        <MetricPill
                          icon={Shield}
                          label={t('fakeloi.compliance')}
                          value={`${score}%`}
                          color={score >= 80 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-red-500'}
                        />
                        {gaps > 0 && (
                          <MetricPill
                            icon={Target}
                            label={t('fakeloi.gaps')}
                            value={gaps}
                            color="text-red-500"
                          />
                        )}
                      </div>
                    </div>

                    {/* Bottom: deadline + arrow */}
                    <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
                      {days != null ? (
                        <div className="flex items-center gap-1.5">
                          <Clock className={cn(
                            'h-3.5 w-3.5',
                            days <= 7 ? 'text-red-500' : days <= 30 ? 'text-amber-500' : 'text-muted-foreground',
                          )} />
                          <span className={cn(
                            'text-[12px] font-semibold tabular-nums',
                            days <= 7 ? 'text-red-500' : days <= 30 ? 'text-amber-500' : 'text-muted-foreground',
                          )}>
                            {days} {days === 1 ? t('fakeloi.day') : t('fakeloi.days')}
                          </span>
                        </div>
                      ) : (
                        <span />
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </BlurFade>
      )}
    </motion.div>
  );
}
