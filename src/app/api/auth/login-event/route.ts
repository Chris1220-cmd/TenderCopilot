import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

function parseDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad/.test(ua)) {
    return /ipad|tablet/.test(ua) ? 'tablet' : 'mobile';
  }
  return 'desktop';
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    await db.loginEvent.create({
      data: {
        userId: session.user.id,
        tenantId: session.user.tenantId ?? undefined,
        ipAddress: ip,
        userAgent,
        deviceType: parseDeviceType(userAgent),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[LoginEvent API] Error:', e);
    return NextResponse.json({ ok: true });
  }
}
