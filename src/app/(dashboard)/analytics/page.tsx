'use client';

import { trpc } from '@/lib/trpc';
import {
  DollarSign,
  TrendingUp,
  Clock,
  FolderOpen,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PremiumStatCardV2 } from '@/components/ui/premium-stat-card-v2';
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
/*  Status colors & labels                                             */
/* ------------------------------------------------------------------ */
const STATUS_COLORS: Record<string, string> = {
  DISCOVERY: '#3B82F6',
  GO_NO_GO: '#48A4D6',
  IN_PROGRESS: '#F59E0B',
  SUBMITTED: '#06B6D4',
  WON: '#22C55E',
  LOST: '#EF4444',
};

const STATUS_LABELS: Record<string, string> = {
  DISCOVERY: 'Ανακάλυψη',
  GO_NO_GO: 'Go/No-Go',
  IN_PROGRESS: 'Σε Εξέλιξη',
  SUBMITTED: 'Υποβληθέν',
  WON: 'Κερδισμένος',
  LOST: 'Χαμένος',
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
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function AnalyticsPage() {
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
    winRate >= 50
      ? 'text-green-500'
      : winRate >= 30
        ? 'text-amber-500'
        : 'text-red-500';

  const avgPrepDays = 14; // placeholder — replace when API supplies real value

  /* ---------- KPI cards ---------- */
  const statsCards = [
    {
      title: 'Pipeline',
      value: activeCount,
      suffix: undefined,
      subtitle: 'Ενεργοί φάκελοι σε εξέλιξη',
      icon: DollarSign,
    },
    {
      title: 'Win Rate',
      value: winRate,
      suffix: '%',
      subtitle: `${won} κερδισμένοι / ${won + lost} ολοκληρωμένοι`,
      icon: TrendingUp,
      colorClass: winRateColor,
    },
    {
      title: 'Μέσος Χρόνος Προετοιμασίας',
      value: avgPrepDays,
      suffix: 'd',
      subtitle: 'Από δημιουργία έως υποβολή',
      icon: Clock,
    },
    {
      title: 'Ενεργοί Φάκελοι',
      value: activeCount,
      suffix: undefined,
      subtitle: 'Discovery + Go/No-Go + In Progress',
      icon: FolderOpen,
    },
  ];

  /* ---------- chart data ---------- */
  const statusData = tenderStats?.countByStatus
    ? Object.entries(tenderStats.countByStatus).map(([status, count]) => ({
        name: STATUS_LABELS[status] || status,
        value: count as number,
        fill: STATUS_COLORS[status] || '#6B7280',
      }))
    : [];

  const winLossData = companyStats
    ? [
        { name: 'Κερδισμένοι', value: won, fill: '#22C55E' },
        { name: 'Χαμένοι', value: lost, fill: '#EF4444' },
        { name: 'Σε Εξέλιξη', value: activeCount, fill: '#F59E0B' },
      ]
    : [];

  const complianceData = companyStats
    ? [
        { name: 'Κερδισμένοι', score: companyStats.avgComplianceWon || 0 },
        { name: 'Χαμένοι', score: companyStats.avgComplianceLost || 0 },
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
      <motion.div variants={itemVariants}>
        <h1 className="text-display text-foreground">Αναλυτικά</h1>
        <p className="mt-1 text-body text-muted-foreground">
          Απόδοση και στατιστικά διαγωνισμών
        </p>
      </motion.div>

      {/* KPI Cards */}
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

      {/* Charts Row */}
      <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-2">
        {/* Donut — Status Distribution */}
        <div className="rounded-xl border border-border/60 bg-card p-6 transition-colors hover:border-primary/20">
          <h3 className="text-title text-foreground mb-4">
            Κατανομή Κατάστασης
          </h3>
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
                    <span style={{ color: 'hsl(var(--muted-foreground))' }}>
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              Δεν υπάρχουν δεδομένα
            </div>
          )}
        </div>

        {/* Bar — Win/Loss/Active */}
        <div className="rounded-xl border border-border/60 bg-card p-6 transition-colors hover:border-primary/20">
          <h3 className="text-title text-foreground mb-4">
            Εξέλιξη Φακέλων
          </h3>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full rounded-lg" />
          ) : winLossData.some((d) => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={winLossData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis dataKey="name" tick={axisTick} />
                <YAxis allowDecimals={false} tick={axisTick} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {winLossData.map((entry, idx) => (
                    <Cell key={`bar-${idx}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              Δεν υπάρχουν δεδομένα
            </div>
          )}
        </div>
      </motion.div>

      {/* Compliance Comparison */}
      <motion.div variants={itemVariants}>
        <div className="rounded-xl border border-border/60 bg-card p-6 transition-colors hover:border-primary/20">
          <h3 className="text-title text-foreground mb-4">
            Σύγκριση Compliance Score &mdash; Κερδισμένοι vs Χαμένοι
          </h3>
          {isLoading ? (
            <Skeleton className="h-[220px] w-full rounded-lg" />
          ) : complianceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={complianceData} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={axisTick}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={axisTick}
                />
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(1)}%`}
                  contentStyle={chartTooltipStyle}
                />
                <Bar dataKey="score" radius={[0, 6, 6, 0]}>
                  {complianceData.map((entry, idx) => (
                    <Cell
                      key={`comp-${idx}`}
                      fill={
                        entry.name === 'Κερδισμένοι' ? '#22C55E' : '#EF4444'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
              Δεν υπάρχουν αρκετά δεδομένα για σύγκριση
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
