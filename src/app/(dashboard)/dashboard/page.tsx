'use client';

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { motion } from 'motion/react';
import { cn, formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PremiumStatCardV2 } from '@/components/ui/premium-stat-card-v2';
import {
  FileText,
  CheckSquare,
  Target,
  Calendar,
  Plus,
  Sparkles,
  ArrowRight,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { BlurFade } from '@/components/ui/blur-fade';
import { useTranslation } from '@/lib/i18n';

/* ------------------------------------------------------------------ */
/*  Status map                                                         */
/* ------------------------------------------------------------------ */
const statusVariants: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  DRAFT: 'secondary',
  DISCOVERY: 'default',
  GO_NO_GO: 'default',
  IN_PROGRESS: 'warning',
  REVIEW: 'default',
  SUBMITTED: 'success',
  WON: 'success',
  LOST: 'destructive',
};

const statusKeys: Record<string, string> = {
  DRAFT: 'dashboard.statusDraft',
  DISCOVERY: 'dashboard.statusDiscovery',
  GO_NO_GO: 'dashboard.statusGoNoGo',
  IN_PROGRESS: 'dashboard.statusInProgress',
  REVIEW: 'dashboard.statusReview',
  SUBMITTED: 'dashboard.statusSubmitted',
  WON: 'dashboard.statusWon',
  LOST: 'dashboard.statusLost',
};

/* ------------------------------------------------------------------ */
/*  Stagger container                                                  */
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
/*  Main dashboard                                                     */
/* ------------------------------------------------------------------ */
export default function DashboardPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] || '';

  const tenderStats = trpc.analytics.getTenderStats.useQuery(undefined, { retry: false });
  const companyStats = trpc.analytics.getCompanyStats.useQuery(undefined, { retry: false });
  const tendersQuery = trpc.tender.list.useQuery(undefined, { retry: false });

  const isLoading = tenderStats.isLoading || companyStats.isLoading || tendersQuery.isLoading;

  const countByStatus = tenderStats.data?.countByStatus ?? {};
  const activeTenders =
    (countByStatus['IN_PROGRESS'] ?? 0) + (countByStatus['DISCOVERY'] ?? 0) + (countByStatus['GO_NO_GO'] ?? 0);
  const pendingTasks =
    tenderStats.data?.totalTenders != null
      ? tenderStats.data.totalTenders - (countByStatus['WON'] ?? 0) - (countByStatus['LOST'] ?? 0) - (countByStatus['SUBMITTED'] ?? 0)
      : 0;
  const complianceScore = Math.round(tenderStats.data?.avgComplianceScore ?? 0);
  const upcomingDeadlinesCount = tenderStats.data?.upcomingDeadlines ?? 0;

  const recentTenders = useMemo(() => {
    if (tendersQuery.data && Array.isArray(tendersQuery.data)) return tendersQuery.data.slice(0, 5);
    return [];
  }, [tendersQuery.data]);

  const upcomingDeadlines = useMemo(() => {
    return recentTenders
      .filter((t: any) => t.submissionDeadline)
      .map((t: any) => {
        const deadline = new Date(t.submissionDeadline);
        const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / 86400000));
        return { id: t.id, title: t.title, deadline: t.submissionDeadline, daysLeft };
      })
      .sort((a: any, b: any) => a.daysLeft - b.daysLeft)
      .slice(0, 5);
  }, [recentTenders]);

  const statsCards = [
    { title: t('dashboard.activeTenders'), value: activeTenders, subtitle: t('dashboard.activeTendersSub'), icon: FileText },
    { title: t('dashboard.pendingTasks'), value: pendingTasks, subtitle: t('dashboard.pendingTasksSub'), icon: CheckSquare },
    { title: t('dashboard.compliance'), value: complianceScore, suffix: '%', subtitle: t('dashboard.complianceSub'), icon: Target },
    { title: t('dashboard.upcomingDeadlines'), value: upcomingDeadlinesCount, subtitle: t('dashboard.upcomingDeadlinesSub'), icon: Calendar },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Welcome Header */}
      <BlurFade delay={0.1}>
        <motion.div
          variants={itemVariants}
          className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <h1 className="text-display text-foreground">
              {t('dashboard.welcome').replace('{name}', firstName)}
            </h1>
            <p className="mt-1 text-body text-muted-foreground">
              {t('dashboard.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              asChild
              size="sm"
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-5 cursor-pointer shadow-sm"
            >
              <Link href="/tenders/new">
                <Plus className="h-4 w-4" />
                {t('dashboard.newTender')}
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-2 border-border text-muted-foreground hover:text-foreground hover:bg-primary/5 rounded-full px-5 cursor-pointer"
            >
              <Link href="/discovery">
                <Sparkles className="h-4 w-4" />
                {t('dashboard.discovery')}
              </Link>
            </Button>
          </div>
        </motion.div>
      </BlurFade>

      {/* Stats Grid — PremiumStatCardV2 with NumberTicker */}
      <BlurFade delay={0.15}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <motion.div key={i} variants={itemVariants}>
                  <div className="rounded-xl border border-border/60 bg-card p-5 sm:p-6 animate-pulse">
                    <div className="h-3 w-20 bg-muted rounded mb-4" />
                    <div className="h-8 w-14 bg-muted rounded mb-2" />
                    <div className="h-3 w-28 bg-muted rounded" />
                  </div>
                </motion.div>
              ))
            : statsCards.map((card, i) => (
                <PremiumStatCardV2
                  key={card.title}
                  title={card.title}
                  value={card.value}
                  suffix={card.suffix}
                  subtitle={card.subtitle}
                  icon={card.icon}
                  index={i}
                />
              ))}
        </div>
      </BlurFade>

      {/* Recent Tenders + Upcoming Deadlines */}
      <BlurFade delay={0.2}>
        <div className="grid gap-6 lg:grid-cols-5">
        {/* Recent Tenders */}
        <motion.div variants={itemVariants} className="lg:col-span-3">
          <div className="group rounded-xl border border-border/60 bg-card transition-colors hover:border-primary/20">
            <div className="flex items-center justify-between px-6 py-4">
              <h2 className="text-title text-foreground">{t('dashboard.recentTenders')}</h2>
              <Link
                href="/tenders"
                className="flex items-center gap-1 text-caption text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {t('dashboard.viewAll')} <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="border-t border-border/40">
              {isLoading ? (
                <div className="space-y-1 p-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : recentTenders.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="relative mx-auto mb-4 h-[120px] w-[160px]">
                    <Image src="/images/illustrations/empty-tenders.png" alt="" fill className="object-contain opacity-70" />
                  </div>
                  <p className="text-body text-muted-foreground">{t('dashboard.noTenders')}</p>
                  <Button asChild variant="outline" size="sm" className="mt-4 rounded-full border-border cursor-pointer">
                    <Link href="/tenders/new">
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> {t('dashboard.newTender')}
                    </Link>
                  </Button>
                </div>
              ) : (
                <div>
                  {recentTenders.map((tender: any) => {
                    const variant = statusVariants[tender.status] || statusVariants.DRAFT;
                    const statusLabel = t(statusKeys[tender.status] || statusKeys.DRAFT);
                    return (
                      <Link
                        key={tender.id}
                        href={`/tenders/${tender.id}`}
                        className="flex items-center justify-between px-6 py-3.5 transition-colors hover:bg-muted/50 cursor-pointer border-b border-border/30 last:border-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body font-medium text-foreground">
                            {tender.title}
                          </p>
                          <p className="text-caption mt-0.5">
                            {tender.referenceNumber}
                            {tender.submissionDeadline && <> &middot; {formatDate(tender.submissionDeadline)}</>}
                          </p>
                        </div>
                        <Badge variant={variant} className="ml-3 shrink-0">
                          {statusLabel}
                        </Badge>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Upcoming Deadlines */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <div className="group rounded-xl border border-border/60 bg-card transition-colors hover:border-primary/20">
            <div className="flex items-center justify-between px-6 py-4">
              <h2 className="text-title text-foreground">{t('dashboard.upcomingDeadlines')}</h2>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="border-t border-border/40">
              {isLoading ? (
                <div className="space-y-1 p-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : upcomingDeadlines.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="relative mx-auto mb-4 h-[120px] w-[160px]">
                    <Image src="/images/illustrations/empty-deadlines.png" alt="" fill className="object-contain opacity-70" />
                  </div>
                  <p className="text-body text-muted-foreground">{t('dashboard.noDeadlines')}</p>
                </div>
              ) : (
                <div>
                  {upcomingDeadlines.map((dl: any) => (
                    <Link
                      key={dl.id}
                      href={`/tenders/${dl.id}`}
                      className="flex items-center justify-between px-6 py-3.5 transition-colors hover:bg-muted/50 cursor-pointer border-b border-border/30 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body font-medium text-foreground">{dl.title}</p>
                        <p className="text-caption mt-0.5">{formatDate(dl.deadline)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 ml-3 shrink-0">
                        {dl.daysLeft <= 7 && <AlertTriangle className="h-3 w-3 text-destructive" />}
                        <span
                          className={cn(
                            'text-[12px] font-semibold tabular-nums',
                            dl.daysLeft <= 7
                              ? 'text-destructive'
                              : dl.daysLeft <= 30
                                ? 'text-warning'
                                : 'text-muted-foreground'
                          )}
                        >
                          {dl.daysLeft}d
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
      </BlurFade>
    </motion.div>
  );
}
