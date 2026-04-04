import { db } from '@/lib/db';

function parseDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad/.test(ua)) {
    return /ipad|tablet/.test(ua) ? 'tablet' : 'mobile';
  }
  return 'desktop';
}

export async function recordLoginEvent(params: {
  userId: string;
  tenantId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const { userId, tenantId, ipAddress, userAgent } = params;

  try {
    await db.loginEvent.create({
      data: {
        userId,
        tenantId: tenantId ?? undefined,
        ipAddress: ipAddress ?? undefined,
        userAgent: userAgent ?? undefined,
        deviceType: userAgent ? parseDeviceType(userAgent) : undefined,
      },
    });
  } catch (e) {
    console.error('[LoginEvent] Failed to record:', e);
  }
}

export async function checkSuperAdmin(userId: string, email: string) {
  const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (superAdminEmails.includes(email.toLowerCase())) {
    await db.user.update({
      where: { id: userId },
      data: { isSuperAdmin: true },
    }).catch(() => {});
  }
}
