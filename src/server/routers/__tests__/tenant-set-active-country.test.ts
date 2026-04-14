import { describe, it, expect, vi, beforeEach } from 'vitest';

// next-auth pulls a broken ESM import chain when loaded under vitest; mock
// @/lib/auth to prevent it from loading altogether.
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    tenant: { findUniqueOrThrow: vi.fn() },
    user: { update: vi.fn() },
  },
}));

import { db } from '@/lib/db';
import { tenantRouter } from '../tenant';

function makeCtx(overrides: Partial<{ tenantId: string | null; userId: string }> = {}) {
  return {
    db,
    tenantId: 'tenant-1',
    userId: 'user-1',
    session: { user: { id: 'user-1', tenantId: 'tenant-1' } },
    user: { id: 'user-1', tenantId: 'tenant-1' },
    headers: new Headers(),
    ...overrides,
  } as any;
}

describe('tenant.setActiveCountry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates user.activeCountry when country is in tenant.countries', async () => {
    vi.mocked(db.tenant.findUniqueOrThrow).mockResolvedValue({ countries: ['GR', 'NL'] } as any);
    vi.mocked(db.user.update).mockResolvedValue({ id: 'user-1', activeCountry: 'NL' } as any);

    const caller = tenantRouter.createCaller(makeCtx());
    const result = await caller.setActiveCountry({ country: 'NL' });

    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { activeCountry: 'NL' },
    });
    expect(result).toEqual({ activeCountry: 'NL' });
  });

  it('throws FORBIDDEN when country is not in tenant.countries', async () => {
    vi.mocked(db.tenant.findUniqueOrThrow).mockResolvedValue({ countries: ['GR'] } as any);

    const caller = tenantRouter.createCaller(makeCtx());
    await expect(caller.setActiveCountry({ country: 'NL' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('throws BAD_REQUEST when tenantId is missing', async () => {
    // The isAuthed middleware reads tenantId from session.user.tenantId and
    // coerces it to null; we need to simulate a user with no tenant.
    const caller = tenantRouter.createCaller({
      db,
      session: { user: { id: 'user-1', tenantId: null } },
      user: { id: 'user-1', tenantId: null },
      userId: 'user-1',
      tenantId: null,
      headers: new Headers(),
    } as any);
    await expect(caller.setActiveCountry({ country: 'NL' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('accepts null to clear active country', async () => {
    vi.mocked(db.user.update).mockResolvedValue({ id: 'user-1', activeCountry: null } as any);

    const caller = tenantRouter.createCaller(makeCtx());
    const result = await caller.setActiveCountry({ country: null });

    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { activeCountry: null },
    });
    expect(result).toEqual({ activeCountry: null });
    // When clearing, no membership check needed
    expect(db.tenant.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
