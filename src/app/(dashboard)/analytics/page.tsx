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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Αναλυτικά</h1>
        <p className="text-muted-foreground">
          Στατιστικά και επιδόσεις διαγωνισμών
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass glass-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Σύνολο Διαγωνισμών
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold">{tenderStats?.totalTenders || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card className="glass glass-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Μέσο Compliance
            </CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-3xl font-bold">
                  {(tenderStats?.avgComplianceScore || 0).toFixed(0)}%
                </div>
                <Progress
                  value={tenderStats?.avgComplianceScore || 0}
                  className="mt-2 h-2"
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="glass glass-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Κερδισμένοι
            </CardTitle>
            <Trophy className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold text-green-600">
                {companyStats?.won || 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass glass-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Προσεχείς Deadlines
            </CardTitle>
            <Calendar className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold text-orange-600">
                {tenderStats?.upcomingDeadlines || 0}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Κατανομή Κατάστασης</CardTitle>
          </CardHeader>
          <CardContent>
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
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                Δεν υπάρχουν δεδομένα
              </div>
            )}
          </CardContent>
        </Card>

        {/* Win/Loss */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Αποτελέσματα</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : winLossData.some((d) => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={winLossData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
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
          </CardContent>
        </Card>
      </div>

      {/* Compliance Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Μέσο Compliance Score: Κερδισμένοι vs Χαμένοι
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : complianceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={complianceData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis type="category" dataKey="name" width={100} />
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(1)}%`}
                />
                <Bar dataKey="score" radius={[0, 6, 6, 0]} fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[250px] items-center justify-center text-muted-foreground">
              Δεν υπάρχουν αρκετά δεδομένα για σύγκριση
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
