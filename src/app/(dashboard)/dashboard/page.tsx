'use client';

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { motion } from 'motion/react';
import { cn, formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  Status map                                                         */
/* ------------------------------------------------------------------ */
const statusMap: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }
> = {
  DRAFT: { label: 'Draft', variant: 'secondary' },
  IN_PROGRESS: { label: 'In Progress', variant: 'warning' },
  SUBMITTED: { label: 'Submitted', variant: 'success' },
  WON: { label: 'Won', variant: 'success' },
  LOST: { label: 'Lost', variant: 'destructive' },
};

/* ------------------------------------------------------------------ */
/*  Main dashboard                                                     */
/* ------------------------------------------------------------------ */
export default function DashboardPage() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] || 'there';

  const tenderStats = trpc.analytics.getTenderStats.useQuery(undefined, { retry: false });
  const companyStats = trpc.analytics.getCompanyStats.useQuery(undefined, { retry: false });
  const tendersQuery = trpc.tender.list.useQuery(undefined, { retry: false });

  const isLoading = tenderStats.isLoading || companyStats.isLoading || tendersQuery.isLoading;

  const countByStatus = tenderStats.data?.countByStatus ?? {};
  const activeTenders =
    (countByStatus['IN_PROGRESS'] ?? 0) + (countByStatus['DISCOVERY'] ?? 0) + (countByStatus['GO_NO_GO'] ?? 0);
  const pendingTasks =
    tenderStats.data?.totalTenders != null
      ? tenderStats.data.totalTenders - (countByStatus['WON'] ?? 0) - (countByStatus['LOST'] ?? 0) - (countByStatus['SUBMITTED'] ?? 0)
      : 0;
  const complianceScore = Math.round(tenderStats.data?.avgComplianceScore ?? 0);
  const upcomingDeadlinesCount = tenderStats.data?.upcomingDeadlines ?? 0;

  const recentTenders = useMemo(() => {
    if (tendersQuery.data && Array.isArray(tendersQuery.data)) return tendersQuery.data.slice(0, 5);
    return [];
  }, [tendersQuery.data]);

  const upcomingDeadlines = useMemo(() => {
    return recentTenders
      .filter((t: any) => t.submissionDeadline)
      .map((t: any) => {
        const deadline = new Date(t.submissionDeadline);
        const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / 86400000));
        return { id: t.id, title: t.title, deadline: t.submissionDeadline, daysLeft };
      })
      .sort((a: any, b: any) => a.daysLeft - b.daysLeft)
      .slice(0, 5);
  }, [recentTenders]);

  const statsCards = [
    { title: 'Active Tenders', value: activeTenders, icon: FileText },
    { title: 'Pending Tasks', value: pendingTasks, icon: CheckSquare },
    { title: 'Compliance', value: complianceScore, suffix: '%', icon: Target },
    { title: 'Upcoming Deadlines', value: upcomingDeadlinesCount, icon: Calendar },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1
            className="text-[28px] font-semibold tracking-[-0.03em] text-[#1a1a2e]"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-[14px] text-[#1a1a2e]/45">
            Here&apos;s your tender overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="gap-2 bg-[#1a1a2e] text-white hover:bg-[#2a2a3e] rounded-full px-5 cursor-pointer">
            <Link href="/tenders/new">
              <Plus className="h-4 w-4" />
              New Tender
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2 border-[#E8E0F0] text-[#1a1a2e]/60 hover:text-[#1a1a2e] hover:bg-[#F8F6FF] rounded-full px-5 cursor-pointer">
            <Link href="/discovery">
              <Sparkles className="h-4 w-4" />
              Discovery
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06, duration: 0.6 }}
              >
                <div className="rounded-xl border border-[#E8E0F0] bg-white p-6 animate-pulse">
                  <div className="h-3 w-20 bg-[#E8E0F0] rounded mb-4" />
                  <div className="h-8 w-14 bg-[#E8E0F0] rounded mb-2" />
                  <div className="h-3 w-28 bg-[#E8E0F0] rounded" />
                </div>
              </motion.div>
            ))
          : statsCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.06, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                  className="group rounded-xl border border-[#E8E0F0] bg-white p-6 transition-all duration-200 hover:border-[#D0C4E8] hover:shadow-sm cursor-default"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#1a1a2e]/35">
                      {card.title}
                    </span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F8F6FF] text-[#6C5CE7]/60 transition-colors group-hover:bg-[#6C5CE7]/10 group-hover:text-[#6C5CE7]">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-0.5">
                    <span
                      className="text-[32px] font-semibold tracking-[-0.02em] text-[#1a1a2e]"
                      style={{ fontFamily: "'Georgia', serif" }}
                    >
                      {card.value}
                    </span>
                    {card.suffix && (
                      <span className="text-[20px] font-medium text-[#1a1a2e]/35">{card.suffix}</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
      </div>

      {/* Recent Tenders + Upcoming Deadlines */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recent Tenders */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
          className="lg:col-span-3"
        >
          <div className="rounded-xl border border-[#E8E0F0] bg-white">
            <div className="flex items-center justify-between px-6 py-4">
              <h2 className="text-[14px] font-semibold text-[#1a1a2e]">Recent Tenders</h2>
              <Link
                href="/tenders"
                className="flex items-center gap-1 text-[13px] text-[#1a1a2e]/35 hover:text-[#1a1a2e]/60 transition-colors cursor-pointer"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="border-t border-[#E8E0F0]/60">
              {isLoading ? (
                <div className="space-y-1 p-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : recentTenders.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#F8F6FF]">
                    <FileText className="h-5 w-5 text-[#6C5CE7]/40" />
                  </div>
                  <p className="text-[14px] text-[#1a1a2e]/40">No tenders yet</p>
                  <Button asChild variant="outline" size="sm" className="mt-4 rounded-full border-[#E8E0F0] cursor-pointer">
                    <Link href="/tenders/new">
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> New Tender
                    </Link>
                  </Button>
                </div>
              ) : (
                <div>
                  {recentTenders.map((tender: any, i: number) => {
                    const status = statusMap[tender.status] || statusMap.DRAFT;
                    return (
                      <Link
                        key={tender.id}
                        href={`/tenders/${tender.id}`}
                        className="flex items-center justify-between px-6 py-3.5 transition-colors hover:bg-[#F8F6FF]/60 cursor-pointer border-b border-[#E8E0F0]/40 last:border-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium text-[#1a1a2e]">
                            {tender.title}
                          </p>
                          <p className="text-[12px] text-[#1a1a2e]/35 mt-0.5">
                            {tender.referenceNumber}
                            {tender.submissionDeadline && <> &middot; {formatDate(tender.submissionDeadline)}</>}
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
        </motion.div>

        {/* Upcoming Deadlines */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
          className="lg:col-span-2"
        >
          <div className="rounded-xl border border-[#E8E0F0] bg-white">
            <div className="flex items-center justify-between px-6 py-4">
              <h2 className="text-[14px] font-semibold text-[#1a1a2e]">Upcoming Deadlines</h2>
              <Clock className="h-4 w-4 text-[#1a1a2e]/25" />
            </div>
            <div className="border-t border-[#E8E0F0]/60">
              {isLoading ? (
                <div className="space-y-1 p-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : upcomingDeadlines.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#F8F6FF]">
                    <Calendar className="h-5 w-5 text-[#6C5CE7]/40" />
                  </div>
                  <p className="text-[14px] text-[#1a1a2e]/40">No upcoming deadlines</p>
                </div>
              ) : (
                <div>
                  {upcomingDeadlines.map((dl: any) => (
                    <Link
                      key={dl.id}
                      href={`/tenders/${dl.id}`}
                      className="flex items-center justify-between px-6 py-3.5 transition-colors hover:bg-[#F8F6FF]/60 cursor-pointer border-b border-[#E8E0F0]/40 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-[#1a1a2e]">{dl.title}</p>
                        <p className="text-[12px] text-[#1a1a2e]/35 mt-0.5">{formatDate(dl.deadline)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 ml-3 shrink-0">
                        {dl.daysLeft <= 7 && <AlertTriangle className="h-3 w-3 text-red-500" />}
                        <span
                          className={cn(
                            'text-[12px] font-semibold tabular-nums',
                            dl.daysLeft <= 7
                              ? 'text-red-500'
                              : dl.daysLeft <= 30
                                ? 'text-amber-500'
                                : 'text-[#1a1a2e]/35'
                          )}
                        >
                          {dl.daysLeft}d
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
