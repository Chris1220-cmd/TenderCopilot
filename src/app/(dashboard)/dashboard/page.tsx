'use client';

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { cn, formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PremiumEmptyState } from '@/components/ui/premium-empty-state';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardContent,
  GlassCardAction,
} from '@/components/ui/glass-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { NumberTicker } from '@/components/ui/number-ticker';
import Image from 'next/image';
import {
  FileText,
  CheckSquare,
  Target,
  Calendar,
  ArrowUpRight,
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
      subtitle: complianceScore >= 70 ? 'Σε καλο επιπεδο' : 'Χρειαζεται βελτιωση',
      icon: Target,
      suffix: '%',
    },
    {
      title: 'Προσεχεις Deadlines',
      value: upcomingDeadlinesCount,
      subtitle: 'Εντος 30 ημερων',
      icon: Calendar,
    },
  ];

  return (
    <div className="space-y-10">
      {/* ====== Welcome Section ====== */}
      <BlurFade delay={0} inView>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-display text-foreground">
              Καλως ηρθατε, {firstName}
            </h1>
            <p className="text-body text-muted-foreground">
              Ακολουθει η συνοψη των διαγωνισμων σας.
            </p>
          </div>
          <div className="relative hidden md:block h-[130px] w-[160px] opacity-80 pointer-events-none">
            <Image
              src="/images/illustrations/dashboard-welcome.png"
              alt=""
              fill
              className="object-contain"
              aria-hidden="true"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-6">
          <Link href="/tenders/new">
            <Button variant="default" className="px-5 py-2 text-sm font-semibold cursor-pointer">
              <Plus className="h-4 w-4 mr-1.5" />
              Νέος Διαγωνισμός
            </Button>
          </Link>
        </div>
      </BlurFade>

      {/* ====== Stats Grid ====== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <BlurFade key={i} delay={0.15 + i * 0.08} inView>
                <div className="rounded-xl surface-elevated p-6 animate-pulse">
                  <div className="h-3 w-24 bg-muted rounded mb-4" />
                  <div className="h-8 w-16 bg-muted rounded mb-2" />
                  <div className="h-3 w-32 bg-muted rounded" />
                </div>
              </BlurFade>
            ))
          : statsCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <BlurFade key={card.title} delay={0.15 + i * 0.08} inView>
                  <div className="rounded-xl surface-elevated p-6 transition-all duration-200 hover:bg-secondary/80 cursor-default">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-overline">{card.title}</span>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
                      <NumberTicker value={card.value} delay={0.2} />
                      {card.suffix && <span>{card.suffix}</span>}
                    </div>
                    <p className="text-caption mt-1">{card.subtitle}</p>
                  </div>
                </BlurFade>
              );
            })}
      </div>

      {/* ====== Recent Tenders + Upcoming Deadlines ====== */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent Tenders - 2 cols */}
        <div className="lg:col-span-2 rounded-xl surface-elevated">
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <h2 className="text-title text-foreground">Προσφατοι Διαγωνισμοι</h2>
            <Link
              href="/tenders"
              className="text-caption text-primary hover:text-primary/80 transition-colors cursor-pointer"
            >
              Ολοι &rarr;
            </Link>
          </div>
          <div className="px-6 pb-6">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : recentTenders.length === 0 ? (
              <PremiumEmptyState
                imageSrc="/images/illustrations/empty-tenders.png"
                title="Δεν υπάρχουν διαγωνισμοί"
                description="Δημιουργήστε τον πρώτο σας διαγωνισμό!"
                action={{ label: 'Νέος Διαγωνισμός', href: '/tenders/new' }}
              />
            ) : (
              <div className="space-y-1">
                {recentTenders.map((tender: any, i: number) => {
                  const status =
                    statusMap[tender.status] || statusMap.DRAFT;
                  const score =
                    tender.complianceScore ?? tender.compliance_score ?? 0;

                  return (
                    <BlurFade key={tender.id} delay={0.3 + i * 0.05} inView>
                      <Link
                        href={`/tenders/${tender.id}`}
                        className={cn(
                          'flex items-center justify-between rounded-lg p-4',
                          'transition-colors duration-150',
                          'hover:bg-secondary/50',
                          'cursor-pointer group/row'
                        )}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-foreground group-hover/row:text-primary transition-colors">
                              {tender.title}
                            </p>
                            <Badge variant={status.variant} className="shrink-0">
                              {status.label}
                            </Badge>
                          </div>
                          <p className="text-caption">
                            {tender.referenceNumber} &middot; Υποβολη:{' '}
                            {formatDate(tender.submissionDeadline)}
                          </p>
                        </div>
                        <div className="ml-4 shrink-0">
                          <span
                            className={cn(
                              'text-caption font-medium tabular-nums',
                              score >= 80
                                ? 'text-emerald-500'
                                : score >= 60
                                  ? 'text-amber-500'
                                  : 'text-red-500'
                            )}
                          >
                            {score}%
                          </span>
                        </div>
                      </Link>
                    </BlurFade>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Deadlines - 1 col */}
        <div className="rounded-xl surface-elevated">
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <h2 className="text-title text-foreground">Προσεχεις Deadlines</h2>
            <Link
              href="/tenders"
              className="text-caption text-primary hover:text-primary/80 transition-colors cursor-pointer"
            >
              Ολα &rarr;
            </Link>
          </div>
          <div className="px-6 pb-6">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : upcomingDeadlines.length === 0 ? (
              <PremiumEmptyState
                imageSrc="/images/illustrations/empty-deadlines.png"
                title="Τίποτα επείγον"
                description="Δεν υπάρχουν προσεχείς deadlines."
              />
            ) : (
              <div className="space-y-1">
                {upcomingDeadlines.map((item: any, i: number) => (
                  <BlurFade key={item.id} delay={0.3 + i * 0.05} inView>
                    <Link
                      href={`/tenders/${item.id}`}
                      className={cn(
                        'flex items-center justify-between rounded-lg p-4',
                        'transition-colors duration-150',
                        'hover:bg-secondary/50',
                        'cursor-pointer'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.title}
                        </p>
                        <p className="text-caption">
                          {formatDate(item.deadline)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 text-sm font-medium tabular-nums',
                          item.daysLeft <= 7
                            ? 'text-red-500'
                            : item.daysLeft <= 30
                              ? 'text-amber-500'
                              : 'text-muted-foreground'
                        )}
                      >
                        {item.daysLeft}d
                      </span>
                    </Link>
                  </BlurFade>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
