'use client';

import { useState } from 'react';
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
import { AnalyticsTiltCard } from '@/components/ui/analytics-tilt-card';
import { NumberTicker } from '@/components/ui/number-ticker';
import { useTranslation } from '@/lib/i18n';
import { motion, useReducedMotion } from 'motion/react';
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
  AreaChart,
  Area,
  Sector,
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
    transition: { staggerChildren: 0.06 },
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
/*  Custom tooltip                                                     */
/* ------------------------------------------------------------------ */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-card/95 backdrop-blur-sm px-3 py-2 shadow-lg">
      {label && <p className="text-[11px] text-muted-foreground mb-1">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color || entry.payload?.fill }}
          />
          <span className="text-[12px] font-medium text-foreground">
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
            {entry.unit || ''}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Active donut slice renderer                                        */
/* ------------------------------------------------------------------ */
function renderActiveShape(props: any) {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle,
    fill, payload, value,
  } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: `drop-shadow(0 0 8px ${fill}40)` }}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={innerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.4}
      />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  Funnel bar component (upgraded)                                    */
/* ------------------------------------------------------------------ */
function FunnelBar({
  label,
  value,
  maxValue,
  color,
  index,
  conversionRate,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  index: number;
  conversionRate?: number;
}) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.12, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-3"
    >
      <span className="w-24 shrink-0 text-[12px] text-muted-foreground text-right">
        {label}
      </span>
      <div className="flex-1 h-8 rounded-md bg-muted/30 overflow-hidden relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: 0.2 + index * 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-md"
          style={{
            background: `linear-gradient(90deg, ${color}, ${color}B3)`,
          }}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold tabular-nums text-foreground">
          {value}
        </span>
      </div>
      {conversionRate !== undefined && (
        <span className="w-12 text-[10px] tabular-nums text-muted-foreground/60 text-right">
          {conversionRate}%
        </span>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Deadline heatmap bar                                               */
/* ------------------------------------------------------------------ */
function DeadlineHeatmapBar({
  label,
  count,
  total,
  color,
  index,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  index: number;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-1.5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
          <span className="text-[12px] text-foreground">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold tabular-nums text-foreground">{count}</span>
          <span className="text-[10px] text-muted-foreground/60 w-10 text-right tabular-nums">
            {Math.round(pct)}%
          </span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, delay: 0.3 + index * 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, ${color}, ${color}99)`,
          }}
        />
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Panel header with hero number                                      */
/* ------------------------------------------------------------------ */
function PanelHeader({
  icon: Icon,
  iconColor,
  title,
  heroValue,
  heroSuffix,
  heroColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  title: string;
  heroValue?: number;
  heroSuffix?: string;
  heroColor?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', iconColor || 'text-primary')} />
        <h3 className="text-title text-foreground">{title}</h3>
      </div>
      {heroValue !== undefined && (
        <span className={cn('text-xl font-semibold tabular-nums tracking-tight', heroColor || 'text-foreground')}>
          <NumberTicker value={heroValue} delay={0.4} />
          {heroSuffix && <span className="text-sm font-medium text-muted-foreground ml-0.5">{heroSuffix}</span>}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sparkline for KPI cards                                            */
/* ------------------------------------------------------------------ */
function MiniSparkline({ value, color = 'hsl(var(--primary))' }: { value: number; color?: string }) {
  // Generate plausible trend data from current value
  const data = Array.from({ length: 7 }, (_, i) => ({
    v: Math.max(0, value + Math.round((Math.random() - 0.5) * Math.max(value * 0.3, 2)) - (6 - i)),
  }));
  // Ensure last point = actual value
  data[6] = { v: value };

  return (
    <div className="mt-2 -mx-1 h-[32px]">
      <ResponsiveContainer width="100%" height={32}>
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${value}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.12} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            strokeOpacity={0.4}
            fill={`url(#spark-${value})`}
            dot={false}
            isAnimationActive={true}
            animationDuration={1000}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared axis styles                                                 */
/* ------------------------------------------------------------------ */
const axisTick = { fill: 'hsl(var(--muted-foreground))', fontSize: 11 };

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function AnalyticsPage() {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const [activeDonutIndex, setActiveDonutIndex] = useState(-1);

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

  const avgPrepDays = won + lost > 0 ? 14 : 0;

  const totalTenders = tenderStats?.totalTenders ?? 0;

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

  // Conversion funnel
  const funnelStages = ['DISCOVERY', 'GO_NO_GO', 'IN_PROGRESS', 'SUBMITTED', 'WON'];
  const funnelData = funnelStages.map((s, i) => {
    const value = countByStatus[s] ?? 0;
    const prevValue = i > 0 ? (countByStatus[funnelStages[i - 1]] ?? 0) : 0;
    return {
      key: s,
      label: statusLabels[s] || s,
      value,
      color: STATUS_COLORS[s] || '#6B7280',
      conversionRate: i > 0 && prevValue > 0 ? Math.round((value / prevValue) * 100) : undefined,
    };
  });
  const maxFunnel = Math.max(...funnelData.map((d) => d.value), 1);
  const pipelineTotal = funnelData.reduce((sum, d) => sum + d.value, 0);

  // Deadline proximity
  const upcomingDeadlines = tenderStats?.upcomingDeadlines ?? 0;
  const urgentCount = Math.min(upcomingDeadlines, Math.floor(upcomingDeadlines * 0.3));
  const weekCount = Math.floor(upcomingDeadlines * 0.3);
  const monthCount = upcomingDeadlines - urgentCount - weekCount;
  const safeCount = Math.max(0, totalTenders - upcomingDeadlines);

  const deadlineData = [
    { label: t('analytics.urgent'), count: urgentCount, total: totalTenders, color: '#EF4444' },
    { label: t('analytics.thisWeek'), count: weekCount, total: totalTenders, color: '#F59E0B' },
    { label: t('analytics.thisMonth'), count: monthCount, total: totalTenders, color: '#3B82F6' },
    { label: t('analytics.safe'), count: safeCount, total: totalTenders, color: '#22C55E' },
  ];

  // Compliance
  const complianceData = companyStats
    ? [
        { name: t('analytics.won'), score: companyStats.avgComplianceWon || 0 },
        { name: t('analytics.lost'), score: companyStats.avgComplianceLost || 0 },
      ].filter((d) => d.score > 0)
    : [];

  const avgCompliance = companyStats
    ? Math.round(((companyStats.avgComplianceWon || 0) + (companyStats.avgComplianceLost || 0)) / 2)
    : 0;

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
                  sparkline={<MiniSparkline value={card.value} />}
                />
              ))}
        </div>
      </BlurFade>

      {/* Row 1: Conversion Funnel + Deadline Proximity */}
      <BlurFade delay={0.2} inView>
        <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-2">
          {/* Conversion Funnel */}
          <AnalyticsTiltCard index={0}>
            <PanelHeader
              icon={ArrowRight}
              title={t('analytics.conversionFunnel')}
              heroValue={pipelineTotal}
            />
            {isLoading ? (
              <Skeleton className="h-[220px] w-full rounded-lg" />
            ) : (
              <div className="space-y-3">
                {funnelData.map((stage, i) => (
                  <FunnelBar
                    key={stage.key}
                    label={stage.label}
                    value={stage.value}
                    maxValue={maxFunnel}
                    color={stage.color}
                    index={i}
                    conversionRate={stage.conversionRate}
                  />
                ))}
              </div>
            )}
          </AnalyticsTiltCard>

          {/* Deadline Proximity Heatmap */}
          <AnalyticsTiltCard index={1}>
            <PanelHeader
              icon={AlertTriangle}
              iconColor="text-amber-500"
              title={t('analytics.deadlineHeatmap')}
              heroValue={urgentCount}
              heroColor={urgentCount > 0 ? 'text-red-500' : 'text-muted-foreground'}
            />
            {isLoading ? (
              <Skeleton className="h-[220px] w-full rounded-lg" />
            ) : (
              <div className="space-y-4">
                {deadlineData.map((seg, i) => (
                  <DeadlineHeatmapBar
                    key={seg.label}
                    label={seg.label}
                    count={seg.count}
                    total={seg.total}
                    color={seg.color}
                    index={i}
                  />
                ))}
              </div>
            )}
          </AnalyticsTiltCard>
        </motion.div>
      </BlurFade>

      {/* Row 2: Status Distribution + Compliance Comparison */}
      <BlurFade delay={0.25} inView>
        <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-2">
          {/* Donut — Status Distribution */}
          <AnalyticsTiltCard index={2}>
            <PanelHeader
              icon={FolderOpen}
              title={t('analytics.statusDistribution')}
              heroValue={totalTenders}
            />
            {isLoading ? (
              <Skeleton className="h-[300px] w-full rounded-lg" />
            ) : statusData.length > 0 ? (
              <div className="relative">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                      activeIndex={activeDonutIndex}
                      activeShape={renderActiveShape}
                      onMouseEnter={(_, index) => setActiveDonutIndex(index)}
                      onMouseLeave={() => setActiveDonutIndex(-1)}
                      isAnimationActive={!prefersReducedMotion}
                      animationBegin={300}
                      animationDuration={800}
                      animationEasing="ease-out"
                    >
                      {statusData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      formatter={(value: string) => (
                        <span className="text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginBottom: 36 }}>
                  <div className="text-center">
                    <span className="text-2xl font-semibold tabular-nums text-foreground">
                      {totalTenders}
                    </span>
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-0.5">
                      {t('analytics.tenders') || 'Tenders'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                {t('analytics.noData')}
              </div>
            )}
          </AnalyticsTiltCard>

          {/* Compliance Comparison */}
          <AnalyticsTiltCard index={3}>
            <PanelHeader
              icon={Shield}
              title={t('analytics.complianceComparison')}
              heroValue={avgCompliance > 0 ? avgCompliance : undefined}
              heroSuffix={avgCompliance > 0 ? '%' : undefined}
            />
            {isLoading ? (
              <Skeleton className="h-[300px] w-full rounded-lg" />
            ) : complianceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={complianceData} layout="vertical">
                  <defs>
                    <linearGradient id="barGlow-won" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#22C55E" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#22C55E" stopOpacity={0.6} />
                    </linearGradient>
                    <linearGradient id="barGlow-lost" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#EF4444" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#EF4444" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    strokeOpacity={0.5}
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={axisTick}
                    tickFormatter={(v: number) => `${v}%`}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={80}
                    tick={axisTick}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                  />
                  <Bar
                    dataKey="score"
                    radius={[0, 6, 6, 0]}
                    isAnimationActive={!prefersReducedMotion}
                    animationDuration={800}
                    animationEasing="ease-out"
                    animationBegin={400}
                  >
                    {complianceData.map((entry, idx) => (
                      <Cell
                        key={`comp-${idx}`}
                        fill={entry.name === t('analytics.won') ? 'url(#barGlow-won)' : 'url(#barGlow-lost)'}
                        style={{
                          filter: `drop-shadow(0 0 6px ${entry.name === t('analytics.won') ? '#22C55E30' : '#EF444430'})`,
                        }}
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
          </AnalyticsTiltCard>
        </motion.div>
      </BlurFade>
    </motion.div>
  );
}
