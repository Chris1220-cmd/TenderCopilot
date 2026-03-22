'use client';

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { cn, formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BlurFade } from '@/components/ui/blur-fade';
import { NumberTicker } from '@/components/ui/number-ticker';
import Image from 'next/image';
import {
  FileText,
  CheckSquare,
  Target,
  Calendar,
  Plus,
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
/*  Main dashboard                                                     */
/* ------------------------------------------------------------------ */
export default function DashboardPage() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] || 'Χρηστη';

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
      isCompliance: false,
    },
    {
      title: 'Εκκρεμεις Εργασιες',
      value: pendingTasks,
      subtitle: 'Αναμενουν ενεργεια',
      icon: CheckSquare,
      isCompliance: false,
    },
    {
      title: 'Compliance Score',
      value: complianceScore,
      subtitle: complianceScore >= 70 ? 'Σε καλο επιπεδο' : 'Χρειαζεται βελτιωση',
      icon: Target,
      isCompliance: true,
    },
    {
      title: 'Προσεχεις Deadlines',
      value: upcomingDeadlinesCount,
      subtitle: 'Εντος 30 ημερων',
      icon: Calendar,
      isCompliance: false,
    },
  ];

  return (
    <div className="space-y-10">
      {/* ====== Welcome Section ====== */}
      <BlurFade delay={0} inView>
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Καλως ηρθατε, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ακολουθει η συνοψη των διαγωνισμων σας.
          </p>
        </div>
      </BlurFade>

      {/* ====== Stats Grid ====== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <BlurFade key={i} delay={0.05 + i * 0.05} inView>
                <div className="rounded-xl bg-card p-5 sm:p-6 shadow-sm ring-1 ring-white/[0.04] animate-pulse">
                  <div className="h-3 w-24 bg-muted rounded mb-4" />
                  <div className="h-8 w-16 bg-muted rounded mb-2" />
                  <div className="h-3 w-32 bg-muted rounded" />
                </div>
              </BlurFade>
            ))
          : statsCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <BlurFade key={card.title} delay={0.05 + i * 0.05} inView>
                  <div className="rounded-xl bg-card p-5 sm:p-6 shadow-sm ring-1 ring-white/[0.04] transition-colors hover:bg-card/80">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                        {card.title}
                      </span>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="mt-3">
                      {card.isCompliance ? (
                        <span
                          className={cn(
                            'text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums',
                            complianceScore >= 75
                              ? 'text-emerald-500'
                              : complianceScore >= 50
                                ? 'text-amber-500'
                                : 'text-red-500'
                          )}
                        >
                          {complianceScore}%
                        </span>
                      ) : (
                        <span className="text-2xl sm:text-3xl font-semibold tracking-tight">
                          <NumberTicker value={card.value} delay={0.3} />
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{card.subtitle}</p>
                  </div>
                </BlurFade>
              );
            })}
      </div>

      {/* ====== Recent Tenders + Upcoming Deadlines ====== */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recent Tenders - 3 cols */}
        <BlurFade delay={0.2} inView className="lg:col-span-3">
          <div className="rounded-xl bg-card shadow-sm ring-1 ring-white/[0.04]">
            <div className="flex items-center justify-between p-5 sm:p-6 pb-0 sm:pb-0">
              <h2 className="text-base font-medium">Προσφατοι Διαγωνισμοι</h2>
              <Link
                href="/tenders"
                className="text-xs text-primary hover:underline cursor-pointer"
              >
                Ολοι &rarr;
              </Link>
            </div>
            <div className="p-3 sm:p-4">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : recentTenders.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="relative mx-auto mb-4 h-[120px] w-[150px]">
                    <Image
                      src="/images/illustrations/empty-tenders.png"
                      alt=""
                      fill
                      className="object-contain opacity-60"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Δεν υπαρχουν διαγωνισμοι
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-3 cursor-pointer">
                    <Link href="/tenders/new">Νεος Διαγωνισμος</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {recentTenders.map((tender: any) => {
                    const status = statusMap[tender.status] || statusMap.DRAFT;
                    return (
                      <Link
                        key={tender.id}
                        href={`/tenders/${tender.id}`}
                        className="flex items-center justify-between rounded-lg px-3 py-3 transition-colors hover:bg-secondary/50 cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {tender.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {tender.referenceNumber} &middot;{' '}
                            {formatDate(tender.submissionDeadline)}
                          </p>
                        </div>
                        <Badge variant={status.variant} className="ml-3 shrink-0">
                          {status.label}
                        </Badge>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </BlurFade>

        {/* Upcoming Deadlines - 2 cols */}
        <BlurFade delay={0.25} inView className="lg:col-span-2">
          <div className="rounded-xl bg-card shadow-sm ring-1 ring-white/[0.04]">
            <div className="flex items-center justify-between p-5 sm:p-6 pb-0 sm:pb-0">
              <h2 className="text-base font-medium">Προσεχεις Deadlines</h2>
            </div>
            <div className="p-3 sm:p-4">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : upcomingDeadlines.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="relative mx-auto mb-4 h-[120px] w-[150px]">
                    <Image
                      src="/images/illustrations/empty-deadlines.png"
                      alt=""
                      fill
                      className="object-contain opacity-60"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Δεν υπαρχουν deadlines
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {upcomingDeadlines.map((item: any) => (
                    <Link
                      key={item.id}
                      href={`/tenders/${item.id}`}
                      className="flex items-center justify-between rounded-lg px-3 py-3 transition-colors hover:bg-secondary/50 cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {item.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(item.deadline)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'text-xs font-semibold tabular-nums shrink-0 ml-3',
                          item.daysLeft <= 7
                            ? 'text-red-400'
                            : item.daysLeft <= 30
                              ? 'text-amber-400'
                              : 'text-muted-foreground'
                        )}
                      >
                        {item.daysLeft}d
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </BlurFade>
      </div>
    </div>
  );
}
