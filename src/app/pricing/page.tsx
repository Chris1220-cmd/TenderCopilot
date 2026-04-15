import Link from 'next/link';
import { Check } from 'lucide-react';
import { PLAN_FEATURES } from '@/lib/stripe';

const plans = [
  {
    key: 'starter',
    ...PLAN_FEATURES.starter,
    features: ['1 χώρα', '3 χρήστες', '100 AI credits/μήνα', 'Βασική ανάλυση εγγράφων', 'Email support'],
  },
  {
    key: 'professional',
    ...PLAN_FEATURES.professional,
    popular: true as const,
    features: ['2 χώρες (GR + NL)', '10 χρήστες', '500 AI credits/μήνα', 'Advanced ανάλυση', 'Compliance engine', 'Priority support'],
  },
  {
    key: 'enterprise',
    ...PLAN_FEATURES.enterprise,
    features: ['5 χώρες', 'Απεριόριστοι χρήστες', '2000 AI credits/μήνα', 'Όλα τα features', 'Dedicated support', 'Custom integrations'],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold">Απλή τιμολόγηση</h1>
          <p className="mt-3 text-lg text-muted-foreground">Ξεκίνα δωρεάν, αναβάθμισε όταν χρειαστείς</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map(plan => (
            <div
              key={plan.key}
              className={`relative rounded-xl border p-8 ${'popular' in plan && plan.popular ? 'border-primary shadow-lg shadow-primary/10' : 'border-border'}`}
            >
              {'popular' in plan && plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                  Δημοφιλές
                </div>
              )}
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold">€{plan.price}</span>
                <span className="text-muted-foreground">/μήνα</span>
              </div>
              <ul className="mt-6 space-y-3">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={`/register?plan=${plan.key}`}
                className={`mt-8 block w-full rounded-lg py-2.5 text-center text-sm font-medium transition-colors ${'popular' in plan && plan.popular
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'border border-border hover:bg-muted'
                }`}
              >
                Ξεκίνα τώρα
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          14 ημέρες δωρεάν δοκιμή — Δεν απαιτείται πιστωτική κάρτα
        </p>
      </div>
    </div>
  );
}
