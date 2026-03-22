import { auth } from '@/lib/auth';
import type { Session } from 'next-auth';

export interface AuthenticatedContext {
  userId: string;
  tenantId: string;
  session: Session;
}

/**
 * Extract authenticated user context. Reusable by Route Handlers.
 * Throws if not authenticated or no tenant.
 */
export async function getAuthenticatedContext(): Promise<AuthenticatedContext> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('UNAUTHORIZED');
  }
  const tenantId = session.user.tenantId;
  if (!tenantId) {
    throw new Error('NO_TENANT');
  }
  return { userId: session.user.id, tenantId, session };
}
