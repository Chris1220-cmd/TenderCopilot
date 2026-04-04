'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Monitor,
  Smartphone,
  Tablet,
  Calendar,
  Users,
  Activity,
  Settings,
  History,
} from 'lucide-react';

function statusBadgeVariant(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'success' as const;
    case 'TRIAL':
      return 'warning' as const;
    case 'EXPIRED':
    case 'CANCELLED':
      return 'destructive' as const;
    default:
      return 'secondary' as const;
  }
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(d: Date | string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleString('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DeviceIcon({ type }: { type: string | null }) {
  switch (type?.toLowerCase()) {
    case 'mobile':
      return <Smartphone className="h-4 w-4" />;
    case 'tablet':
      return <Tablet className="h-4 w-4" />;
    default:
      return <Monitor className="h-4 w-4" />;
  }
}

export default function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const utils = trpc.useUtils();

  const { data: tenant, isLoading } = trpc.admin.tenantDetail.useQuery({
    tenantId: id,
  });
  const { data: plans } = trpc.admin.plans.useQuery();

  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  const changePlan = trpc.admin.changePlan.useMutation({
    onSuccess: () => {
      utils.admin.tenantDetail.invalidate({ tenantId: id });
    },
  });

  const extendTrial = trpc.admin.extendTrial.useMutation({
    onSuccess: () => {
      utils.admin.tenantDetail.invalidate({ tenantId: id });
    },
  });

  const cancelSubscription = trpc.admin.cancelSubscription.useMutation({
    onSuccess: () => {
      utils.admin.tenantDetail.invalidate({ tenantId: id });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Tenant not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Back button */}
      <Link
        href="/admin/tenants"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Tenants
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {tenant.subscription?.plan && (
              <Badge variant="outline">{tenant.subscription.plan.name}</Badge>
            )}
            {tenant.subscription && (
              <Badge variant={statusBadgeVariant(tenant.subscription.status)}>
                {tenant.subscription.status}
              </Badge>
            )}
            {tenant.subscription?.trialEndsAt && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Trial ends: {formatDate(tenant.subscription.trialEndsAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Usage Bars */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Usage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tenant.usage.length === 0 && (
              <p className="text-sm text-muted-foreground">No usage data available.</p>
            )}
            {tenant.usage.map((metric) => {
              const pct = metric.max ? (metric.current / metric.max) * 100 : 0;
              const barColor =
                pct >= 100
                  ? 'bg-red-500'
                  : pct >= 80
                    ? 'bg-amber-500'
                    : 'bg-primary';
              return (
                <div key={metric.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{metric.label}</span>
                    <span className="text-muted-foreground">
                      {metric.current}
                      {metric.max != null ? ` / ${metric.max}` : ''}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                      style={{
                        width: metric.max
                          ? `${Math.min(pct, 100)}%`
                          : '0%',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4" />
              Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Change plan */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Change Plan</label>
              <div className="flex gap-2">
                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans?.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  disabled={!selectedPlanId || changePlan.isPending}
                  onClick={() =>
                    changePlan.mutate({ tenantId: id, planId: selectedPlanId })
                  }
                >
                  {changePlan.isPending ? 'Saving...' : 'Apply'}
                </Button>
              </div>
            </div>

            {/* Extend Trial */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Extend Trial</label>
              <Button
                variant="outline"
                size="sm"
                disabled={extendTrial.isPending}
                onClick={() => extendTrial.mutate({ tenantId: id, days: 7 })}
              >
                {extendTrial.isPending ? 'Extending...' : '+7 Days'}
              </Button>
            </div>

            {/* Cancel Subscription */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Cancel Subscription</label>
              <Button
                variant="destructive"
                size="sm"
                disabled={cancelSubscription.isPending}
                onClick={() => {
                  if (confirm('Are you sure you want to cancel this subscription?')) {
                    cancelSubscription.mutate({ tenantId: id });
                  }
                }}
              >
                {cancelSubscription.isPending ? 'Cancelling...' : 'Cancel Subscription'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Users ({tenant.users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Role</th>
                  <th className="pb-2 font-medium">Last Login</th>
                </tr>
              </thead>
              <tbody>
                {tenant.users.map((user) => (
                  <tr key={user.id} className="border-b last:border-0">
                    <td className="py-2.5 pr-4">{user.name ?? '—'}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {user.email}
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge variant="secondary">{user.role}</Badge>
                    </td>
                    <td className="py-2.5 text-muted-foreground">
                      {formatDateTime(user.lastLogin)}
                    </td>
                  </tr>
                ))}
                {tenant.users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-muted-foreground">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Login History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Login History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">User</th>
                  <th className="pb-2 pr-4 font-medium">Location</th>
                  <th className="pb-2 font-medium">Device</th>
                </tr>
              </thead>
              <tbody>
                {tenant.loginEvents.map((event) => (
                  <tr key={event.id} className="border-b last:border-0">
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {formatDateTime(event.createdAt)}
                    </td>
                    <td className="py-2.5 pr-4">{event.userName}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {event.geoCity && event.geoCountry
                        ? `${event.geoCity}, ${event.geoCountry}`
                        : event.ipAddress ?? '—'}
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-1.5">
                        <DeviceIcon type={event.deviceType} />
                        <span className="capitalize text-muted-foreground">
                          {event.deviceType ?? 'desktop'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {tenant.loginEvents.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-muted-foreground">
                      No login events recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
