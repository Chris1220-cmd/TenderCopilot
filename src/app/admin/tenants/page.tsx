'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search } from 'lucide-react';

const STATUS_OPTIONS = ['ALL', 'TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELLED'] as const;

const statusBadgeVariant: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  TRIAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  EXPIRED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

function daysSince(dateStr: string | Date | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export default function AdminTenantsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('ALL');

  const { data: tenants, isLoading } = trpc.admin.tenants.useQuery({
    status: (status === 'ALL' ? undefined : status) as
      | 'TRIAL'
      | 'ACTIVE'
      | 'EXPIRED'
      | 'CANCELLED'
      | undefined,
    search: search || undefined,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tenants</h1>
        <p className="text-muted-foreground">
          Manage and monitor all tenant accounts.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === 'ALL' ? 'All Statuses' : s.charAt(0) + s.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TenantTableSkeleton />
          ) : !tenants || tenants.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No tenants found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Users</TableHead>
                  <TableHead className="text-center">Tenders</TableHead>
                  <TableHead className="text-center">AI Credits</TableHead>
                  <TableHead>Last Login</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((t) => {
                  const lastDays = daysSince(t.lastLogin);
                  const tenderRatio =
                    t.usage && t.usage.maxTenders != null && t.usage.maxTenders > 0
                      ? t.usage.activeTenders / t.usage.maxTenders
                      : 0;

                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/tenants/${t.id}`}
                          className="text-primary hover:underline"
                        >
                          {t.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {t.slug}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{t.plan}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                            statusBadgeVariant[t.status] ?? 'bg-muted text-muted-foreground'
                          )}
                        >
                          {t.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">{t.userCount}</TableCell>
                      <TableCell className="text-center">
                        {t.usage ? (
                          <span
                            className={cn(
                              tenderRatio >= 0.9
                                ? 'text-red-600'
                                : tenderRatio >= 0.7
                                  ? 'text-amber-600'
                                  : ''
                            )}
                          >
                            {t.usage.activeTenders}/{t.usage.maxTenders}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {t.usage ? (
                          <span>
                            {t.usage.aiCreditsUsed}/{t.usage.maxAiCredits}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {t.lastLogin ? (
                          <span
                            className={cn(
                              'text-sm',
                              lastDays !== null && lastDays > 5
                                ? 'text-red-600'
                                : 'text-muted-foreground'
                            )}
                          >
                            {lastDays === 0
                              ? 'Today'
                              : lastDays === 1
                                ? '1 day ago'
                                : `${lastDays} days ago`}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Never
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TenantTableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-5 flex-[2]" />
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  );
}
