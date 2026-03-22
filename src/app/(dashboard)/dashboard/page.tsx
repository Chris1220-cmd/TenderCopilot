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
import Image from 'next/image';
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
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  Status map                                                         */
/* ------------------------------------------------------------------ */
const statusMap: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }
> = {
  DRAFT: { label: 'Προχειρο', variant: 'secondary' },
  IN_PROGRESS: { label: 'Σε εξελιξη', variant: 'warning' },
  SUBMITTED: { label: 'Υποβληθηκε', variant: 'success' },
  WON: { label: 'Κερδηθηκε', variant: 'success' },
  LOST: { label: 'Χαθηκε', variant: 'destructive' },
};

/* ------------------------------------------------------------------ */
/*  Stagger animation variants                                         */
/* ------------------------------------------------------------------ */
const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const item = {
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
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] || 'there';

  /* ---- tRPC queries with graceful fallback ---- */
  const tenderStats = trpc.analytics.getTenderStats.useQuery(undefined, {
    retry: false,
  });
  const companyStats = trpc.analytics.getCompanyStats.useQuery(undefined, {
    retry: false,
  });
  const tendersQuery = trpc.tender.list.useQuery(undefined, {
    retry: false,
  });

  const isLoading =
    tenderStats.isLoading || companyStats.isLoading || tendersQuery.isLoading;

  /* ---- Derived data ---- */
  const countByStatus = tenderStats.data?.countByStatus ?? {};
  const activeTenders =
    (countByStatus['IN_PROGRESS'] ?? 0) +
    (countByStatus['DISCOVERY'] ?? 0) +
    (countByStatus['GO_NO_GO'] ?? 0);
  const pendingTasks =
    tenderStats.data?.totalTenders != null
      ? tenderStats.data.totalTenders - (countByStatus['WON'] ?? 0) - (countByStatus['LOST'] ?? 0) - (countByStatus['SUBMITTED'] ?? 0)
      : 0;
  const complianceScore = Math.round(tenderStats.data?.avgComplianceScore ?? 0);
  const upcomingDeadlinesCount = tenderStats.data?.upcomingDeadlines ?? 0;

  const recentTenders = useMemo(() => {
    if (tendersQuery.data && Array.isArray(tendersQuery.data)) {
      return tendersQuery.data.slice(0, 5);
    }
    return [];
  }, [tendersQuery.data]);

  const upcomingDeadlines = useMemo(() => {
    const items = recentTenders
      .filter((t: any) => t.submissionDeadline)
      .map((t: any) => {
        const deadline = new Date(t.submissionDeadline);
        const now = new Date();
        const diffMs = deadline.getTime() - now.getTime();
        const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        return {
          id: t.id,
          title: t.title,
          deadline: t.submissionDeadline,
          daysLeft,
          urgent: daysLeft <= 14,
        };
      })
      .sort((a: any, b: any) => a.daysLeft - b.daysLeft);
    return items.slice(0, 5);
  }, [recentTenders]);

  /* ---- Stats config ---- */
  const statsCards = [
    {
      title: 'Ενεργοι Διαγωνισμοι',
      value: activeTenders,
      subtitle: 'Τρεχοντες διαγωνισμοι',
      icon: FileText,
    },
    {
      title: 'Εκκρεμεις Εργασιες',
      value: pendingTasks,
      subtitle: 'Αναμενουν ενεργεια',
      icon: CheckSquare,
    },
    {
      title: 'Compliance Score',
      value: complianceScore,
      suffix: '%',
      subtitle: complianceScore >= 70 ? 'Σε καλο επιπεδο' : 'Χρειαζεται βελτιωση',
      icon: Target,
      colorClass:
        complianceScore >= 75
          ? 'from-emerald-400 to-emerald-500'
          : complianceScore >= 50
            ? 'from-amber-400 to-amber-500'
            : 'from-red-400 to-red-500',
    },
    {
      title: 'Προσεχεις Deadlines',
      value: upcomingDeadlinesCount,
      subtitle: 'Εντος 30 ημερων',
      icon: Calendar,
    },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* ====== Welcome Section ====== */}
      <motion.div variants={item} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.025em] text-foreground">
            Καλως ηρθατε, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ακολουθει η συνοψη των διαγωνισμων σας.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            className="gap-2 bg-gradient-to-r from-primary to-accent text-white shadow-[0_0_16px_rgba(168,85,247,0.2)] hover:shadow-[0_0_24px_rgba(168,85,247,0.3)] transition-shadow cursor-pointer"
          >
            <Link href="/tenders/new">
              <Plus className="h-4 w-4" />
              Νεος Διαγωνισμος
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-2 border-border/60 cursor-pointer"
          >
            <Link href="/discovery">
              <Sparkles className="h-4 w-4" />
              Discovery
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* ====== Stats Grid ====== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <motion.div key={i} variants={item}>
                <div className="rounded-xl border border-border/60 bg-card p-5 sm:p-6 animate-pulse">
                  <div className="h-3 w-24 bg-muted rounded mb-4" />
                  <div className="h-8 w-16 bg-muted rounded mb-2" />
                  <div className="h-3 w-32 bg-muted rounded" />
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
                colorClass={card.colorClass}
              />
            ))}
      </div>

      {/* ====== Recent Tenders + Upcoming Deadlines ====== */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recent Tenders - 3 cols */}
        <motion.div variants={item} className="lg:col-span-3">
          <div className="rounded-xl border border-border/60 bg-card">
            <div className="flex items-center justify-between px-5 py-4 sm:px-6">
              <h2 className="text-sm font-semibold tracking-[-0.01em]">Προσφατοι Διαγωνισμοι</h2>
              <Link
                href="/tenders"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Ολοι
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="border-t border-border/40">
              {isLoading ? (
                <div className="space-y-1 p-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : recentTenders.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
                    <FileText className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Δεν υπαρχουν διαγωνισμοι
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-4 cursor-pointer">
                    <Link href="/tenders/new">
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Νεος Διαγωνισμος
                    </Link>
                  </Button>
                </div>
              ) : (
                <div>
                  {recentTenders.map((tender: any, i: number) => {
                    const status = statusMap[tender.status] || statusMap.DRAFT;
                    return (
                      <motion.div
                        key={tender.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + i * 0.04, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <Link
                          href={`/tenders/${tender.id}`}
                          className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-muted/30 cursor-pointer border-b border-border/30 last:border-0"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {tender.title}
                            </p>
                            <p className="text-xs text-muted-foreground/60 mt-0.5">
                              {tender.referenceNumber}
                              {tender.submissionDeadline && (
                                <> &middot; {formatDate(tender.submissionDeadline)}</>
                              )}
                            </p>
                          </div>
                          <Badge variant={status.variant} className="ml-3 shrink-0">
                            {status.label}
                          </Badge>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Upcoming Deadlines - 2 cols */}
        <motion.div variants={item} className="lg:col-span-2">
          <div className="rounded-xl border border-border/60 bg-card">
            <div className="flex items-center justify-between px-5 py-4 sm:px-6">
              <h2 className="text-sm font-semibold tracking-[-0.01em]">Προσεχεις Deadlines</h2>
              <Clock className="h-4 w-4 text-muted-foreground/50" />
            </div>
            <div className="border-t border-border/40">
              {isLoading ? (
                <div className="space-y-1 p-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : upcomingDeadlines.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
                    <Calendar className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Δεν υπαρχουν deadlines
                  </p>
                </div>
              ) : (
                <div>
                  {upcomingDeadlines.map((dl: any, i: number) => (
                    <motion.div
                      key={dl.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 + i * 0.04, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <Link
                        href={`/tenders/${dl.id}`}
                        className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-muted/30 cursor-pointer border-b border-border/30 last:border-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {dl.title}
                          </p>
                          <p className="text-xs text-muted-foreground/60 mt-0.5">
                            {formatDate(dl.deadline)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 ml-3 shrink-0">
                          {dl.daysLeft <= 7 && (
                            <AlertTriangle className="h-3 w-3 text-red-400" />
                          )}
                          <span
                            className={cn(
                              'text-xs font-semibold tabular-nums',
                              dl.daysLeft <= 7
                                ? 'text-red-400'
                                : dl.daysLeft <= 30
                                  ? 'text-amber-400'
                                  : 'text-muted-foreground'
                            )}
                          >
                            {dl.daysLeft}d
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
