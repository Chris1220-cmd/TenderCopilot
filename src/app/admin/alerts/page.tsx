'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Bell,
} from 'lucide-react';

const SEVERITY_BORDER: Record<string, string> = {
  error: 'border-l-4 border-l-red-500',
  warning: 'border-l-4 border-l-amber-500',
  info: 'border-l-4 border-l-blue-500',
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  trial_expiring: <Clock className="h-5 w-5 text-amber-500" />,
  expired: <XCircle className="h-5 w-5 text-red-500" />,
  churn_risk: <AlertTriangle className="h-5 w-5 text-red-500" />,
  upgrade_opportunity: <TrendingUp className="h-5 w-5 text-blue-500" />,
};

const TYPE_BADGE_VARIANT: Record<string, 'warning' | 'destructive' | 'secondary'> = {
  trial_expiring: 'warning',
  expired: 'destructive',
  churn_risk: 'destructive',
  upgrade_opportunity: 'secondary',
};

export default function AlertsPage() {
  const { data: alerts, isLoading } = trpc.admin.alerts.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
        {alerts && alerts.length > 0 && (
          <Badge variant="destructive" className="text-xs">
            {alerts.length}
          </Badge>
        )}
      </div>

      {/* Alert List */}
      {!alerts || alerts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No alerts at this time.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert, i) => (
            <Link
              key={`${alert.tenantId}-${alert.type}-${i}`}
              href={`/admin/tenants/${alert.tenantId}`}
              className="block"
            >
              <Card
                className={`transition-colors hover:bg-accent/50 ${SEVERITY_BORDER[alert.severity] ?? ''}`}
              >
                <CardContent className="flex items-start gap-4 py-4">
                  <div className="mt-0.5 shrink-0">
                    {TYPE_ICON[alert.type] ?? <Bell className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{alert.tenantName}</span>
                      <Badge variant={TYPE_BADGE_VARIANT[alert.type] ?? 'secondary'}>
                        {alert.type.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {alert.message}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
