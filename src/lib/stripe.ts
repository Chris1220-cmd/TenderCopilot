import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('[Stripe] STRIPE_SECRET_KEY not set — billing disabled');
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' })
  : null;

export const STRIPE_PRICES: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  professional: process.env.STRIPE_PRICE_PRO,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
};

export const PLAN_FEATURES = {
  starter: { name: 'Starter', price: 49, countries: 1, users: 3, aiCredits: 100 },
  professional: { name: 'Professional', price: 99, countries: 2, users: 10, aiCredits: 500 },
  enterprise: { name: 'Enterprise', price: 249, countries: 5, users: 999, aiCredits: 2000 },
} as const;
