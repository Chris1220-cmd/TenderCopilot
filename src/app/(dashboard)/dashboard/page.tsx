'use client';

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { cn, formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { GradientHeading } from '@/components/ui/gradient-heading';
import { PremiumStatCard } from '@/components/ui/premium-stat-card';
import { PremiumEmptyState } from '@/components/ui/premium-empty-state';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardContent,
  GlassCardAction,
} from '@/components/ui/glass-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import Image from 'next/image';
import {
  FileText,
  CheckSquare,
  Target,
  Calendar,
  ArrowUpRight,
  AlertTriangle,
  Clock,
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
/*  Compliance bar                                                     */
/* ------------------------------------------------------------------ */
function ComplianceBar({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
      : score >= 60
        ? 'bg-gradient-to-r from-amber-400 to-amber-600'
        : 'bg-gradient-to-r from-red-400 to-red-600';

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-medium text-muted-foreground">{score}%</span>
    </div>
  );
}

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

  /* ---- Compliance color ---- */
  const complianceColor =
    complianceScore >= 70 ? '#22C55E' : '#EF4444';

  /* ---- Stats config ---- */
  const statsCards = [
    {
      title: 'Ενεργοι Διαγωνισμοι',
      value: activeTenders,
      subtitle: 'Τρεχοντες διαγωνισμοι',
      icon: FileText,
      accentColor: '#3B82F6',
      borderColor: 'border-l-[#3B82F6]',
      bgCircle: 'bg-blue-500/10',
      textCircle: 'text-blue-500',
    },
    {
      title: 'Εκκρεμεις Εργασιες',
      value: pendingTasks,
      subtitle: 'Αναμενουν ενεργεια',
      icon: CheckSquare,
      accentColor: '#F59E0B',
      borderColor: 'border-l-[#F59E0B]',
      bgCircle: 'bg-amber-500/10',
      textCircle: 'text-amber-500',
    },
    {
      title: 'Μεσο Compliance Score',
      value: `${complianceScore}%`,
      subtitle: complianceScore >= 70 ? 'Σε καλο επιπεδο' : 'Χρειαζεται βελτιωση',
      icon: Target,
      accentColor: complianceColor,
      borderColor:
        complianceScore >= 70
          ? 'border-l-[#22C55E]'
          : 'border-l-[#EF4444]',
      bgCircle:
        complianceScore >= 70
          ? 'bg-emerald-500/10'
          : 'bg-red-500/10',
      textCircle:
        complianceScore >= 70
          ? 'text-emerald-500'
          : 'text-red-500',
      isCompliance: true,
    },
    {
      title: 'Προσεχεις Deadlines',
      value: upcomingDeadlinesCount,
      subtitle: 'Εντος 30 ημερων',
      icon: Calendar,
      accentColor: '#F97316',
      borderColor: 'border-l-orange-500',
      bgCircle: 'bg-orange-500/10',
      textCircle: 'text-orange-500',
    },
  ];

  return (
    <div className="space-y-8">
      {/* ====== Welcome Section ====== */}
      <BlurFade delay={0} inView>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <GradientHeading as="h1" className="text-3xl">
              Καλως ηρθατε, {firstName}
            </GradientHeading>
            <p className="text-muted-foreground">
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
        <div className="flex flex-wrap gap-3 mt-4">
          <Link href="/tenders/new">
            <ShimmerButton
              shimmerColor="#06B6D4"
              shimmerSize="0.05em"
              background="linear-gradient(135deg, #3B82F6, #06B6D4)"
              className="px-5 py-2 text-sm font-semibold cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Νέος Διαγωνισμός
            </ShimmerButton>
          </Link>
        </div>
      </BlurFade>

      {/* ====== Stats Grid ====== */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <BlurFade key={i} delay={0.15 + i * 0.08} inView>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 animate-pulse">
                  <div className="h-4 w-28 bg-muted rounded mb-3" />
                  <div className="h-8 w-16 bg-muted rounded mb-2" />
                  <div className="h-3 w-36 bg-muted rounded" />
                </div>
              </BlurFade>
            ))
          : statsCards.map((card, i) => (
              <PremiumStatCard
                key={card.title}
                title={card.title}
                value={card.isCompliance ? complianceScore : card.value as number}
                subtitle={card.subtitle}
                icon={card.icon}
                accentColor={card.accentColor}
                borderColor={card.borderColor}
                bgCircle={card.bgCircle}
                textCircle={card.textCircle}
                showProgressRing={card.isCompliance}
                progressValue={card.isCompliance ? complianceScore : undefined}
                blurFadeDelay={0.15 + i * 0.08}
              />
            ))}
      </div>

      {/* ====== Recent Tenders + Upcoming Deadlines ====== */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Tenders - 2 cols */}
        <GlassCard className="lg:col-span-2">
          <GlassCardHeader>
            <GlassCardTitle>Προσφατοι Διαγωνισμοι</GlassCardTitle>
            <GlassCardAction>
              <Link
                href="/tenders"
                className="flex items-center gap-1 text-sm font-medium text-[#3B82F6] transition-colors duration-200 hover:text-[#1E40AF] cursor-pointer"
              >
                Ολοι
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </GlassCardAction>
          </GlassCardHeader>
          <GlassCardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
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
              <div className="space-y-2">
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
                          'flex items-center justify-between rounded-xl px-4 py-3',
                          'border border-white/10 dark:border-white/5',
                          'bg-white/40 dark:bg-white/[0.03]',
                          'transition-all duration-200',
                          'hover:bg-white/70 dark:hover:bg-white/[0.08]',
                          'hover:shadow-md',
                          'cursor-pointer group/row'
                        )}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium group-hover/row:text-[#1E40AF] dark:group-hover/row:text-[#3B82F6] transition-colors">
                              {tender.title}
                            </p>
                            <Badge variant={status.variant} className="shrink-0">
                              {status.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {tender.referenceNumber} &middot; Υποβολη:{' '}
                            {formatDate(tender.submissionDeadline)}
                          </p>
                        </div>
                        <div className="ml-4 shrink-0">
                          <ComplianceBar score={score} />
                        </div>
                      </Link>
                    </BlurFade>
                  );
                })}
              </div>
            )}
          </GlassCardContent>
        </GlassCard>

        {/* Upcoming Deadlines - 1 col */}
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle>Προσεχεις Deadlines</GlassCardTitle>
            <GlassCardAction>
              <Link
                href="/tenders"
                className="flex items-center gap-1 text-sm font-medium text-[#F97316] transition-colors duration-200 hover:text-[#EA580C] cursor-pointer"
              >
                Ολα
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </GlassCardAction>
          </GlassCardHeader>
          <GlassCardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : upcomingDeadlines.length === 0 ? (
              <PremiumEmptyState
                imageSrc="/images/illustrations/empty-deadlines.png"
                title="Τίποτα επείγον"
                description="Δεν υπάρχουν προσεχείς deadlines."
              />
            ) : (
              <div className="space-y-2">
                {upcomingDeadlines.map((item: any, i: number) => (
                  <BlurFade key={item.id} delay={0.3 + i * 0.05} inView>
                    <Link
                      href={`/tenders/${item.id}`}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-4 py-3',
                        'border border-white/10 dark:border-white/5',
                        'bg-white/40 dark:bg-white/[0.03]',
                        'transition-all duration-200',
                        'hover:bg-white/70 dark:hover:bg-white/[0.08]',
                        'hover:shadow-md',
                        'cursor-pointer group/deadline'
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                          'transition-transform duration-200 group-hover/deadline:scale-110',
                          item.urgent
                            ? 'bg-red-500/10 text-red-500'
                            : 'bg-amber-500/10 text-amber-500'
                        )}
                      >
                        {item.urgent ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : (
                          <Clock className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {item.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(item.deadline)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums',
                          'transition-colors duration-200',
                          item.urgent
                            ? 'bg-red-500/10 text-red-500'
                            : item.daysLeft <= 30
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {item.daysLeft}d
                      </span>
                    </Link>
                  </BlurFade>
                ))}
              </div>
            )}
          </GlassCardContent>
        </GlassCard>
      </div>
    </div>
  );
}
