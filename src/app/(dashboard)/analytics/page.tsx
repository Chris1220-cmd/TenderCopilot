'use client';

import { trpc } from '@/lib/trpc';
import {
  BarChart3,
  TrendingUp,
  Target,
  Calendar,
  Trophy,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { NumberTicker } from '@/components/ui/number-ticker';
import { motion, AnimatePresence } from 'motion/react';
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
  LineChart,
  Line,
} from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  DISCOVERY: '#3b82f6',
  GO_NO_GO: '#8b5cf6',
  IN_PROGRESS: '#f59e0b',
  SUBMITTED: '#06b6d4',
  WON: '#22c55e',
  LOST: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  DISCOVERY: 'Ανακάλυψη',
  GO_NO_GO: 'Go/No-Go',
  IN_PROGRESS: 'Σε Εξέλιξη',
  SUBMITTED: 'Υποβληθέν',
  WON: 'Κερδισμένος',
  LOST: 'Χαμένος',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const } },
};

const chartTooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

export default function AnalyticsPage() {
  const { data: tenderStats, isLoading: loadingTender } =
    trpc.analytics.getTenderStats.useQuery();
  const { data: companyStats, isLoading: loadingCompany } =
    trpc.analytics.getCompanyStats.useQuery();

  const isLoading = loadingTender || loadingCompany;

  // Prepare chart data
  const statusData = tenderStats?.countByStatus
    ? Object.entries(tenderStats.countByStatus).map(([status, count]) => ({
        name: STATUS_LABELS[status] || status,
        value: count as number,
        fill: STATUS_COLORS[status] || '#6b7280',
      }))
    : [];

  const inProgressCount = tenderStats?.countByStatus
    ? (tenderStats.countByStatus['IN_PROGRESS'] ?? 0) + (tenderStats.countByStatus['DISCOVERY'] ?? 0) + (tenderStats.countByStatus['GO_NO_GO'] ?? 0)
    : 0;

  const winLossData = companyStats
    ? [
        { name: 'Κερδισμένοι', value: companyStats.won || 0, fill: '#22c55e' },
        { name: 'Χαμένοι', value: companyStats.lost || 0, fill: '#ef4444' },
        { name: 'Σε Εξέλιξη', value: inProgressCount, fill: '#f59e0b' },
      ]
    : [];

  const complianceData = companyStats
    ? [
        {
          name: 'Κερδισμένοι',
          score: companyStats.avgComplianceWon || 0,
        },
        {
          name: 'Χαμένοι',
          score: companyStats.avgComplianceLost || 0,
        },
      ].filter((d) => d.score > 0)
    : [];

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-headline text-foreground">Αναλυτικά</h1>
        <p className="text-muted-foreground">
          Στατιστικά και επιδόσεις διαγωνισμών
        </p>
      </motion.div>

      {/* KPI Cards */}
      <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/20">
          <div className="flex flex-row items-center justify-between pb-2">
            <p className="text-sm font-medium text-muted-foreground">
              Σύνολο Διαγωνισμών
            </p>
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <div>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <NumberTicker value={tenderStats?.totalTenders || 0} className="text-3xl font-bold tabular-nums" />
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/20">
          <div className="flex flex-row items-center justify-between pb-2">
            <p className="text-sm font-medium text-muted-foreground">
              Μέσο Compliance
            </p>
            <Target className="h-4 w-4 text-primary" />
          </div>
          <div>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="flex items-baseline gap-0.5">
                  <NumberTicker value={Math.round(tenderStats?.avgComplianceScore || 0)} className="text-3xl font-bold tabular-nums" />
                  <span className="text-3xl font-bold">%</span>
                </div>
                <Progress
                  value={tenderStats?.avgComplianceScore || 0}
                  className="mt-2 h-2"
                />
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/20">
          <div className="flex flex-row items-center justify-between pb-2">
            <p className="text-sm font-medium text-muted-foreground">
              Κερδισμένοι
            </p>
            <Trophy className="h-4 w-4 text-green-500" />
          </div>
          <div>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <NumberTicker value={companyStats?.won || 0} className="text-3xl font-bold tabular-nums text-green-600" />
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/20">
          <div className="flex flex-row items-center justify-between pb-2">
            <p className="text-sm font-medium text-muted-foreground">
              Προσεχείς Deadlines
            </p>
            <Calendar className="h-4 w-4 text-orange-500" />
          </div>
          <div>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <NumberTicker value={tenderStats?.upcomingDeadlines || 0} className="text-3xl font-bold tabular-nums text-orange-600" />
            )}
          </div>
        </div>
      </motion.div>

      {/* Charts Row */}
      <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-2">
        {/* Status Distribution */}
        <div className="rounded-xl border border-border/60 bg-card p-6">
          <h3 className="text-title text-foreground mb-4">Κατανομή Κατάστασης</h3>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              Δεν υπάρχουν δεδομένα
            </div>
          )}
        </div>

        {/* Win/Loss */}
        <div className="rounded-xl border border-border/60 bg-card p-6">
          <h3 className="text-title text-foreground mb-4">Αποτελέσματα</h3>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : winLossData.some((d) => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={winLossData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {winLossData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              Δεν υπάρχουν δεδομένα
            </div>
          )}
        </div>
      </motion.div>

      {/* Compliance Comparison */}
      <motion.div variants={itemVariants}>
        <div className="rounded-xl border border-border/60 bg-card p-6">
          <h3 className="text-title text-foreground mb-4">
            Μέσο Compliance Score: Κερδισμένοι vs Χαμένοι
          </h3>
          {isLoading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : complianceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={complianceData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(1)}%`}
                  contentStyle={chartTooltipStyle}
                />
                <Bar dataKey="score" radius={[0, 6, 6, 0]} fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[250px] items-center justify-center text-muted-foreground">
              Δεν υπάρχουν αρκετά δεδομένα για σύγκριση
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
