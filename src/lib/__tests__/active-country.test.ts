import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: vi.fn() },
    tenant: { findUnique: vi.fn() },
  },
}));

import { db } from '@/lib/db';
import { resolveCountry } from '../active-country';

describe('resolveCountry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns tender.country when provided, ignoring user and tenant', async () => {
    const result = await resolveCountry({
      tenderCountry: 'NL',
      userId: 'user-1',
      tenantId: 'tenant-1',
    });
    expect(result).toBe('NL');
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('returns user.activeCountry when tender country is null', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ activeCountry: 'NL' } as any);
    const result = await resolveCountry({
      tenderCountry: null,
      userId: 'user-1',
      tenantId: 'tenant-1',
    });
    expect(result).toBe('NL');
    expect(db.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('falls through to tenant.countries[0] when user has no active country', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ activeCountry: null } as any);
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ countries: ['GR', 'NL'] } as any);
    const result = await resolveCountry({
      tenderCountry: null,
      userId: 'user-1',
      tenantId: 'tenant-1',
    });
    expect(result).toBe('GR');
  });

  it('falls through to tenant.countries[0] when userId is not provided', async () => {
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ countries: ['GR'] } as any);
    const result = await resolveCountry({ tenantId: 'tenant-1' });
    expect(result).toBe('GR');
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns "GR" as final fallback when tenant has empty countries', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ activeCountry: null } as any);
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ countries: [] } as any);
    const result = await resolveCountry({
      tenderCountry: null,
      userId: 'user-1',
      tenantId: 'tenant-1',
    });
    expect(result).toBe('GR');
  });

  it('handles user not found gracefully (treats as no active country)', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ countries: ['NL'] } as any);
    const result = await resolveCountry({
      userId: 'missing',
      tenantId: 'tenant-1',
    });
    expect(result).toBe('NL');
  });

  it('handles tender.country as empty string (treats as null)', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ activeCountry: 'NL' } as any);
    const result = await resolveCountry({
      tenderCountry: '',
      userId: 'user-1',
      tenantId: 'tenant-1',
    });
    expect(result).toBe('NL');
  });
});
