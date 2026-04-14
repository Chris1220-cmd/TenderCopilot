import { db } from '@/lib/db';

export interface ResolveCountryOptions {
  /** If set, short-circuits and returns this value. Use for operations tied to a specific tender. */
  tenderCountry?: string | null;
  /** Current user id. If set, checks user.activeCountry before falling through. */
  userId?: string;
  /** Tenant id is always required as the final fallback source. */
  tenantId: string;
}

/**
 * Resolves the country code to use for AI/legal/compliance context.
 *
 * Precedence (highest wins):
 *   1. tenderCountry — explicit per-tender country
 *   2. user.activeCountry — the user's currently selected working country
 *   3. tenant.countries[0] — the tenant's primary country
 *   4. 'GR' — hard fallback if tenant has no countries
 *
 * Operations scoped to a specific tender MUST pass tenderCountry so that
 * switching context does not retroactively re-interpret existing tenders.
 */
export async function resolveCountry(opts: ResolveCountryOptions): Promise<string> {
  if (opts.tenderCountry) return opts.tenderCountry;

  if (opts.userId) {
    const user = await db.user.findUnique({
      where: { id: opts.userId },
      select: { activeCountry: true },
    });
    if (user?.activeCountry) return user.activeCountry;
  }

  const tenant = await db.tenant.findUnique({
    where: { id: opts.tenantId },
    select: { countries: true },
  });
  return tenant?.countries?.[0] ?? 'GR';
}
