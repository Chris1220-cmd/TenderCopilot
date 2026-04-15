import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/db';

export async function POST(_req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });

  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantUser = await db.tenantUser.findFirst({
    where: { userId: session.user.id },
    include: { tenant: { include: { subscription: true } } },
  });

  const stripeCustomerId = tenantUser?.tenant?.subscription?.stripeCustomerId;
  if (!stripeCustomerId) {
    return NextResponse.json({ error: 'No active subscription' }, { status: 400 });
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.NEXTAUTH_URL}/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
