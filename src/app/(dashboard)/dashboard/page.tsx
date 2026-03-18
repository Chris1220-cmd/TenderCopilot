'use client';

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { cn, formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  CheckSquare,
  Target,
  Calendar,
  ArrowUpRight,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts';

/* ------------------------------------------------------------------ */
/*  Sparkline placeholder — no hardcoded data, use empty arrays       */
/* ------------------------------------------------------------------ */
const sparkActive: { v: number }[] = [];
const sparkTasks: { v: number }[] = [];
const sparkCompliance: { v: number }[] = [];
const sparkDeadlines: { v: number }[] = [];

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
/*  SVG Progress Ring                                                  */
/* ------------------------------------------------------------------ */
function ProgressRing({
  value,
  size = 52,
  strokeWidth = 4,
  color,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/30"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-700 ease-out"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Sparkline                                                          */
/* ------------------------------------------------------------------ */
function MiniSparkline({
  data,
  color,
}: {
  data: { v: number }[];
  color: string;
}) {
  return (
    <div className="h-8 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive
            animationDuration={1200}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Compliance bar                                                     */
/* ------------------------------------------------------------------ */
function ComplianceBar({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'bg-emerald-500'
      : score >= 60
        ? 'bg-amber-500'
        : 'bg-red-500';

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
/*  Stats card skeleton                                                */
/* ------------------------------------------------------------------ */
function StatsCardSkeleton() {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border-l-4 border-l-muted p-5',
        'bg-white/60 dark:bg-white/[0.06] backdrop-blur-xl',
        'border border-white/20 dark:border-white/10',
        'shadow-lg'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-3 flex-1">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-36" />
        </div>
        <Skeleton className="h-11 w-11 rounded-xl" />
      </div>
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
      sparkData: sparkActive,
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
      sparkData: sparkTasks,
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
      sparkData: sparkCompliance,
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
      sparkData: sparkDeadlines,
    },
  ];

  return (
    <div className="space-y-8">
      {/* ====== Welcome Section ====== */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">
          <span
            className={cn(
              'inline-block bg-gradient-to-r from-[#1E40AF] via-[#3B82F6] to-[#F59E0B]',
              'bg-clip-text text-transparent',
              'animate-[gradient-shift_6s_ease-in-out_infinite]',
              'bg-[length:200%_auto]'
            )}
          >
            Καλως ηρθατε, {firstName}
          </span>
        </h1>
        <p className="text-muted-foreground">
          Ακολουθει η συνοψη των διαγωνισμων σας.
        </p>
      </div>

      {/* ====== Stats Grid ====== */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <StatsCardSkeleton key={i} />
            ))
          : statsCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className={cn(
                    'group relative overflow-hidden rounded-2xl',
                    'border-l-4',
                    card.borderColor,
                    'bg-white/60 dark:bg-white/[0.06]',
                    'backdrop-blur-xl',
                    'border border-white/20 dark:border-white/10',
                    'shadow-lg',
                    'transition-all duration-300 ease-out',
                    'hover:-translate-y-1 hover:shadow-2xl',
                    'hover:border-white/40 dark:hover:border-white/20',
                    'p-5'
                  )}
                >
                  {/* Subtle gradient overlay on hover */}
                  <div
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{
                      background: `radial-gradient(ellipse at top right, ${card.accentColor}08, transparent 60%)`,
                    }}
                  />

                  <div className="relative flex items-start justify-between">
                    <div className="space-y-1.5 flex-1">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {card.title}
                      </p>

                      <div className="flex items-end gap-3">
                        {/* Main value */}
                        {card.isCompliance ? (
                          <div className="flex items-center gap-3">
                            <span className="text-3xl font-bold tracking-tight">
                              {card.value}
                            </span>
                            <ProgressRing
                              value={complianceScore}
                              color={card.accentColor}
                            />
                          </div>
                        ) : (
                          <span className="text-3xl font-bold tracking-tight">
                            {card.value}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <p className="text-xs text-muted-foreground">
                          {card.subtitle}
                        </p>
                        <MiniSparkline
                          data={card.sparkData}
                          color={card.accentColor}
                        />
                      </div>
                    </div>

                    {/* Icon circle */}
                    <div
                      className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                        'transition-transform duration-300 group-hover:scale-110',
                        card.bgCircle
                      )}
                    >
                      <Icon className={cn('h-5 w-5', card.textCircle)} />
                    </div>
                  </div>

                  {/* Bottom glow line */}
                  <div
                    className="absolute bottom-0 left-0 h-[2px] w-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{
                      background: `linear-gradient(90deg, ${card.accentColor}, transparent)`,
                    }}
                  />
                </div>
              );
            })}
      </div>

      {/* ====== Recent Tenders + Upcoming Deadlines ====== */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Tenders - 2 cols */}
        <div
          className={cn(
            'lg:col-span-2 overflow-hidden rounded-2xl',
            'bg-white/60 dark:bg-white/[0.06]',
            'backdrop-blur-xl',
            'border border-white/20 dark:border-white/10',
            'shadow-lg'
          )}
        >
          <div className="flex items-center justify-between px-6 pt-6 pb-2">
            <h2 className="text-base font-semibold">
              Προσφατοι Διαγωνισμοι
            </h2>
            <Link
              href="/tenders"
              className="flex items-center gap-1 text-sm font-medium text-[#3B82F6] transition-colors duration-200 hover:text-[#1E40AF] cursor-pointer"
            >
              Ολοι
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="px-6 pb-6">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {recentTenders.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Δεν υπαρχουν διαγωνισμοι ακομα. Δημιουργηστε τον πρωτο σας!
                  </div>
                )}
                {recentTenders.map((tender: any) => {
                  const status =
                    statusMap[tender.status] || statusMap.DRAFT;
                  const score =
                    tender.complianceScore ?? tender.compliance_score ?? 0;

                  return (
                    <Link
                      key={tender.id}
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
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Deadlines - 1 col */}
        <div
          className={cn(
            'overflow-hidden rounded-2xl',
            'bg-white/60 dark:bg-white/[0.06]',
            'backdrop-blur-xl',
            'border border-white/20 dark:border-white/10',
            'shadow-lg'
          )}
        >
          <div className="flex items-center justify-between px-6 pt-6 pb-2">
            <h2 className="text-base font-semibold">
              Προσεχεις Deadlines
            </h2>
            <Link
              href="/tenders"
              className="flex items-center gap-1 text-sm font-medium text-[#F97316] transition-colors duration-200 hover:text-[#EA580C] cursor-pointer"
            >
              Ολα
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="px-6 pb-6">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingDeadlines.map((item: any) => (
                  <Link
                    key={item.id}
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
                ))}

                {upcomingDeadlines.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Δεν υπαρχουν προσεχεις deadlines.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ====== Keyframe for gradient animation (injected via style tag) ====== */}
      <style jsx global>{`
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% center; }
          50% { background-position: 100% center; }
        }
      `}</style>
    </div>
  );
}
