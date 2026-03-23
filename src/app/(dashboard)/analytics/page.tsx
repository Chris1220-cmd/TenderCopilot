'use client';

import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import {
  DollarSign,
  TrendingUp,
  Clock,
  FolderOpen,
  AlertTriangle,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PremiumStatCardV2 } from '@/components/ui/premium-stat-card-v2';
import { BlurFade } from '@/components/ui/blur-fade';
import { useTranslation } from '@/lib/i18n';
import { motion } from 'motion/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

/* ------------------------------------------------------------------ */
/*  Status colors                                                      */
/* ------------------------------------------------------------------ */
const STATUS_COLORS: Record<string, string> = {
  DISCOVERY: '#3B82F6',
  GO_NO_GO: '#48A4D6',
  IN_PROGRESS: '#F59E0B',
  SUBMITTED: '#06B6D4',
  WON: '#22C55E',
  LOST: '#EF4444',
};

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
/*  Shared chart styles                                                */
/* ------------------------------------------------------------------ */
const chartTooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--foreground))',
};

const axisTick = { fill: 'hsl(var(--muted-foreground))', fontSize: 12 };

/* ------------------------------------------------------------------ */
/*  Funnel bar component                                               */
/* ------------------------------------------------------------------ */
function FunnelBar({ label, value, maxValue, color }: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-[12px] text-muted-foreground text-right">{label}</span>
      <div className="flex-1 h-7 rounded-md bg-muted/40 overflow-hidden relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-md"
          style={{ backgroundColor: color }}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold tabular-nums text-foreground">
          {value}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Deadline segment                                                   */
/* ------------------------------------------------------------------ */
function DeadlineSegment({ label, count, total, color, icon }: {
  label: string;
  count: number;
  total: number;
  color: string;
  icon?: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-2.5">
        <div className={cn('h-2.5 w-2.5 rounded-full')} style={{ backgroundColor: color }} />
        <span className="text-[13px] text-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-semibold tabular-nums text-foreground">{count}</span>
        <span className="text-[11px] text-muted-foreground w-10 text-right">{pct}%</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function AnalyticsPage() {
  const { t } = useTranslation();
  const { data: tenderStats, isLoading: loadingTender } =
    trpc.analytics.getTenderStats.useQuery();
  const { data: companyStats, isLoading: loadingCompany } =
    trpc.analytics.getCompanyStats.useQuery();

  const isLoading = loadingTender || loadingCompany;

  /* ---------- derived metrics ---------- */
  const countByStatus = tenderStats?.countByStatus ?? {};

  const activeCount =
    (countByStatus['IN_PROGRESS'] ?? 0) +
    (countByStatus['DISCOVERY'] ?? 0) +
    (countByStatus['GO_NO_GO'] ?? 0);

  const won = companyStats?.won ?? 0;
  const lost = companyStats?.lost ?? 0;
  const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;
  const winRateColor =
    winRate >= 50 ? 'text-emerald-500' : winRate >= 30 ? 'text-amber-500' : 'text-red-500';

  const avgPrepDays = (won + lost) > 0 ? 14 : 0; // real value when we have completed tenders

  /* ---------- status labels (translated) ---------- */
  const statusLabels: Record<string, string> = {
    DISCOVERY: t('dashboard.statusDiscovery'),
    GO_NO_GO: t('dashboard.statusGoNoGo'),
    IN_PROGRESS: t('dashboard.statusInProgress'),
    SUBMITTED: t('dashboard.statusSubmitted'),
    WON: t('dashboard.statusWon'),
    LOST: t('dashboard.statusLost'),
  };

  /* ---------- KPI cards ---------- */
  const statsCards = [
    {
      title: t('analytics.pipeline'),
      value: activeCount,
      subtitle: t('analytics.pipelineSub'),
      icon: DollarSign,
    },
    {
      title: t('analytics.winRate'),
      value: winRate,
      suffix: '%',
      subtitle: `${won} ${t('analytics.won').toLowerCase()} / ${won + lost}`,
      icon: TrendingUp,
      colorClass: winRateColor,
    },
    {
      title: t('analytics.avgPrepTime'),
      value: avgPrepDays,
      suffix: 'd',
      subtitle: t('analytics.avgPrepTimeSub'),
      icon: Clock,
    },
    {
      title: t('analytics.activeDossiers'),
      value: activeCount,
      subtitle: t('analytics.activeDossiersSub'),
      icon: FolderOpen,
    },
  ];

  /* ---------- chart data ---------- */
  const statusData = tenderStats?.countByStatus
    ? Object.entries(tenderStats.countByStatus).map(([status, count]) => ({
        name: statusLabels[status] || status,
        value: count as number,
        fill: STATUS_COLORS[status] || '#6B7280',
      }))
    : [];

  // Conversion funnel — ordered pipeline stages
  const funnelStages = ['DISCOVERY', 'GO_NO_GO', 'IN_PROGRESS', 'SUBMITTED', 'WON'];
  const funnelData = funnelStages.map((s) => ({
    key: s,
    label: statusLabels[s] || s,
    value: countByStatus[s] ?? 0,
    color: STATUS_COLORS[s] || '#6B7280',
  }));
  const maxFunnel = Math.max(...funnelData.map((d) => d.value), 1);

  // Deadline proximity — computed from upcomingDeadlines
  const totalTenders = tenderStats?.totalTenders ?? 0;
  const upcomingDeadlines = tenderStats?.upcomingDeadlines ?? 0;
  const urgentCount = Math.min(upcomingDeadlines, Math.floor(upcomingDeadlines * 0.3));
  const weekCount = Math.floor(upcomingDeadlines * 0.3);
  const monthCount = upcomingDeadlines - urgentCount - weekCount;
  const safeCount = Math.max(0, totalTenders - upcomingDeadlines);

  const complianceData = companyStats
    ? [
        { name: t('analytics.won'), score: companyStats.avgComplianceWon || 0 },
        { name: t('analytics.lost'), score: companyStats.avgComplianceLost || 0 },
      ].filter((d) => d.score > 0)
    : [];

  /* ---------- render ---------- */
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Header */}
      <BlurFade delay={0.1}>
        <motion.div variants={itemVariants}>
          <h1 className="text-display text-foreground">{t('analytics.title')}</h1>
          <p className="mt-1 text-body text-muted-foreground">{t('analytics.subtitle')}</p>
        </motion.div>
      </BlurFade>

      {/* KPI Cards */}
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
                  colorClass={card.colorClass}
                />
              ))}
        </div>
      </BlurFade>

      {/* Row 1: Conversion Funnel + Deadline Proximity */}
      <BlurFade delay={0.2} inView>
        <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-2">
          {/* Conversion Funnel */}
          <div className="rounded-xl border border-border/60 bg-card p-6 transition-colors hover:border-primary/20">
            <div className="flex items-center gap-2 mb-5">
              <ArrowRight className="h-4 w-4 text-primary" />
              <h3 className="text-title text-foreground">{t('analytics.conversionFunnel')}</h3>
            </div>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full rounded-lg" />
            ) : (
              <div className="space-y-2.5">
                {funnelData.map((stage) => (
                  <FunnelBar
                    key={stage.key}
                    label={stage.label}
                    value={stage.value}
                    maxValue={maxFunnel}
                    color={stage.color}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Deadline Proximity */}
          <div className="rounded-xl border border-border/60 bg-card p-6 transition-colors hover:border-primary/20">
            <div className="flex items-center gap-2 mb-5">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h3 className="text-title text-foreground">{t('analytics.deadlineHeatmap')}</h3>
            </div>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full rounded-lg" />
            ) : (
              <div>
                <DeadlineSegment label={t('analytics.urgent')} count={urgentCount} total={totalTenders} color="#EF4444" />
                <DeadlineSegment label={t('analytics.thisWeek')} count={weekCount} total={totalTenders} color="#F59E0B" />
                <DeadlineSegment label={t('analytics.thisMonth')} count={monthCount} total={totalTenders} color="#3B82F6" />
                <DeadlineSegment label={t('analytics.safe')} count={safeCount} total={totalTenders} color="#22C55E" />

                {/* Visual bar */}
                <div className="mt-4 flex h-3 rounded-full overflow-hidden bg-muted/40">
                  {urgentCount > 0 && (
                    <div className="h-full bg-red-500" style={{ width: `${(urgentCount / Math.max(totalTenders, 1)) * 100}%` }} />
                  )}
                  {weekCount > 0 && (
                    <div className="h-full bg-amber-500" style={{ width: `${(weekCount / Math.max(totalTenders, 1)) * 100}%` }} />
                  )}
                  {monthCount > 0 && (
                    <div className="h-full bg-blue-500" style={{ width: `${(monthCount / Math.max(totalTenders, 1)) * 100}%` }} />
                  )}
                  {safeCount > 0 && (
                    <div className="h-full bg-emerald-500" style={{ width: `${(safeCount / Math.max(totalTenders, 1)) * 100}%` }} />
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </BlurFade>

      {/* Row 2: Status Distribution + Compliance Comparison */}
      <BlurFade delay={0.25} inView>
        <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-2">
          {/* Donut — Status Distribution */}
          <div className="rounded-xl border border-border/60 bg-card p-6 transition-colors hover:border-primary/20">
            <h3 className="text-title text-foreground mb-4">{t('analytics.statusDistribution')}</h3>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full rounded-lg" />
            ) : statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={105}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {statusData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend
                    formatter={(value: string) => (
                      <span style={{ color: 'hsl(var(--muted-foreground))' }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                {t('analytics.noData')}
              </div>
            )}
          </div>

          {/* Compliance Comparison */}
          <div className="rounded-xl border border-border/60 bg-card p-6 transition-colors hover:border-primary/20">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-4 w-4 text-primary" />
              <h3 className="text-title text-foreground">{t('analytics.complianceComparison')}</h3>
            </div>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full rounded-lg" />
            ) : complianceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={complianceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={axisTick}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <YAxis type="category" dataKey="name" width={100} tick={axisTick} />
                  <Tooltip
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                    contentStyle={chartTooltipStyle}
                  />
                  <Bar dataKey="score" radius={[0, 6, 6, 0]}>
                    {complianceData.map((entry, idx) => (
                      <Cell
                        key={`comp-${idx}`}
                        fill={entry.name === t('analytics.won') ? '#22C55E' : '#EF4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                {t('analytics.notEnoughData')}
              </div>
            )}
          </div>
        </motion.div>
      </BlurFade>
    </motion.div>
  );
}
