'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const metricLabels: Record<string, string> = {
  activeTenders: 'active tenders',
  aiCreditsUsed: 'AI credits',
  documentsGenerated: 'documents',
  searchesPerformed: 'searches',
  storageUsedMB: 'storage',
};

interface LimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: string;
  current: number;
  limit: number;
}

export function LimitModal({
  open,
  onOpenChange,
  metric,
  current,
  limit,
}: LimitModalProps) {
  const label = metricLabels[metric] ?? metric;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <AlertTriangle className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle>Plan Limit Reached</DialogTitle>
          <DialogDescription>
            You&apos;ve used{' '}
            <span className="font-semibold text-foreground">
              {current}
            </span>{' '}
            of your{' '}
            <span className="font-semibold text-foreground">
              {limit}
            </span>{' '}
            {label}. Upgrade your plan to continue.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-row justify-center gap-2 sm:justify-center">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button asChild>
            <Link href="/settings/subscription">Upgrade Plan</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
