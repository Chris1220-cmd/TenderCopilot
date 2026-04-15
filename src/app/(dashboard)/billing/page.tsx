'use client';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { PLAN_FEATURES } from '@/lib/stripe';
import { CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';

export default function BillingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data } = trpc.subscription.current.useQuery();
  const [loading, setLoading] = useState<string | null>(null);

  const subscription = data?.subscription;
  const planName = data?.plan?.name ?? 'Trial';

  async function handleUpgrade(planKey: string) {
    setLoading(planKey);
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey }),
      });
      const { url, error } = await res.json() as { url?: string; error?: string };
      if (error) throw new Error(error);
      if (url) router.push(url);
    } catch (e: unknown) {
      toast({ title: 'Σφάλμα', description: e instanceof Error ? e.message : 'Σφάλμα', variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  }

  async function handleManage() {
    setLoading('portal');
    try {
      const res = await fetch('/api/stripe/create-portal', { method: 'POST' });
      const { url, error } = await res.json() as { url?: string; error?: string };
      if (error) throw new Error(error);
      if (url) router.push(url);
    } catch (e: unknown) {
      toast({ title: 'Σφάλμα', description: e instanceof Error ? e.message : 'Σφάλμα', variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Χρέωση &amp; Συνδρομή</h1>
        <p className="mt-1 text-sm text-muted-foreground">Διαχείριση πλάνου και πληρωμών</p>
      </div>

      {/* Current plan */}
      <div className="rounded-xl border border-border p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Τρέχον Πλάνο</p>
            <p className="mt-1 text-2xl font-bold">{planName}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Κατάσταση:{' '}
              <span className={subscription?.status === 'ACTIVE' ? 'text-green-500' : 'text-amber-500'}>
                {subscription?.status ?? 'TRIAL'}
              </span>
            </p>
          </div>
          {subscription?.status === 'ACTIVE' && (
            <Button variant="outline" size="sm" onClick={handleManage} disabled={loading === 'portal'}>
              {loading === 'portal' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <><CreditCard className="mr-2 h-4 w-4" />Διαχείριση</>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Available plans */}
      <div>
        <h2 className="mb-4 text-sm font-semibold">Αναβάθμιση Πλάνου</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {Object.entries(PLAN_FEATURES).map(([key, plan]) => (
            <div key={key} className="rounded-xl border border-border p-5">
              <p className="font-semibold">{plan.name}</p>
              <p className="mt-1 text-2xl font-bold">
                €{plan.price}
                <span className="text-sm font-normal text-muted-foreground">/μήνα</span>
              </p>
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                <li>{plan.countries} {plan.countries === 1 ? 'χώρα' : 'χώρες'}</li>
                <li>{plan.users === 999 ? 'Απεριόριστοι' : plan.users} χρήστες</li>
                <li>{plan.aiCredits} AI credits/μήνα</li>
              </ul>
              <Button
                className="mt-4 w-full"
                size="sm"
                variant={planName.toLowerCase() === plan.name.toLowerCase() ? 'outline' : 'default'}
                disabled={planName.toLowerCase() === plan.name.toLowerCase() || loading === key}
                onClick={() => handleUpgrade(key)}
              >
                {loading === key ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : planName.toLowerCase() === plan.name.toLowerCase() ? (
                  'Τρέχον πλάνο'
                ) : (
                  'Αναβάθμιση'
                )}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
