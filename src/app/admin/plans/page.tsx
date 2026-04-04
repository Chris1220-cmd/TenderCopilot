'use client';

import { trpc } from '@/lib/trpc';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package } from 'lucide-react';

const LIMIT_LABELS: Record<string, string> = {
  maxActiveTenders: 'Tenders',
  maxAiCreditsPerMonth: 'AI Credits',
  maxDocumentsPerMonth: 'Documents',
  maxSearchesPerMonth: 'Searches',
  maxStorageMB: 'Storage (MB)',
};

const LIMIT_KEYS = [
  'maxActiveTenders',
  'maxAiCreditsPerMonth',
  'maxDocumentsPerMonth',
  'maxSearchesPerMonth',
  'maxStorageMB',
] as const;

export default function PlansPage() {
  const utils = trpc.useUtils();
  const { data: plans, isLoading } = trpc.admin.plans.useQuery();

  const updatePlan = trpc.admin.updatePlan.useMutation({
    onSuccess: () => {
      utils.admin.plans.invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Plans</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage subscription plans and their limits.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {plans?.map((plan) => (
          <Card key={plan.id} className="relative">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="h-4 w-4" />
                    {plan.name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground font-mono">
                    {plan.slug}
                  </p>
                </div>
                <Badge variant={plan.isActive ? 'success' : 'secondary'}>
                  {plan.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Prices */}
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Monthly</span>
                  <p className="font-semibold">{plan.price}&#8364;</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Annual</span>
                  <p className="font-semibold">{plan.priceAnnual}&#8364;</p>
                </div>
              </div>

              {/* Limits Grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {LIMIT_KEYS.map((key) => {
                  const value = (plan as Record<string, unknown>)[key];
                  return (
                    <div key={key} className="flex justify-between">
                      <span className="text-muted-foreground">
                        {LIMIT_LABELS[key]}
                      </span>
                      <span className="font-medium">
                        {value == null ? '\u221E' : String(value)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Toggle active */}
              <Button
                variant={plan.isActive ? 'outline' : 'default'}
                size="sm"
                className="w-full"
                disabled={updatePlan.isPending}
                onClick={() =>
                  updatePlan.mutate({
                    id: plan.id,
                    isActive: !plan.isActive,
                  })
                }
              >
                {plan.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </CardContent>
          </Card>
        ))}

        {plans?.length === 0 && (
          <p className="text-muted-foreground col-span-full text-center py-8">
            No plans found.
          </p>
        )}
      </div>
    </div>
  );
}
