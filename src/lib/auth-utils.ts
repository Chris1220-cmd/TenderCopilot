import { auth } from '@/lib/auth';

export async function getCurrentUser() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  return session.user;
}

export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('You must be logged in to perform this action.');
  }

  return user;
}

export async function requireTenant() {
  const user = await requireAuth();

  if (!user.tenantId) {
    throw new Error('You must belong to a tenant to perform this action.');
  }

  return user as typeof user & { tenantId: string };
}
