import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { stripe, STRIPE_PRICES } from '@/lib/stripe';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });

  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { planKey } = await req.json() as { planKey: string };
  const priceId = STRIPE_PRICES[planKey];
  if (!priceId) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

  const tenantUser = await db.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: { include: { subscription: true } } },
  });
  if (!tenantUser) return NextResponse.json({ error: 'No tenant' }, { status: 400 });

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXTAUTH_URL}/billing?success=true`,
    cancel_url: `${process.env.NEXTAUTH_URL}/billing?cancelled=true`,
    customer_email: session.user.email ?? undefined,
    metadata: { tenantId: tenantUser.tenantId, userId: session.user.id!, planKey },
    subscription_data: {
      metadata: { tenantId: tenantUser.tenantId },
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
