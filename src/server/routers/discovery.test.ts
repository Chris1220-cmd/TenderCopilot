import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock heavy dependencies that pull in Next.js internals
vi.mock('@/lib/db', () => ({
  db: {
    companyProfile: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/server/trpc', () => ({
  router: vi.fn(() => ({})),
  protectedProcedure: {
    input: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@/server/services/tender-discovery', () => ({
  tenderDiscovery: {},
}));

vi.mock('@/server/services/url-importer', () => ({
  urlImporter: {},
}));

vi.mock('@/server/services/smart-intake', () => ({
  smartIntake: {},
}));

vi.mock('@/lib/s3', () => ({
  uploadFile: vi.fn(),
}));

import { checkKadGuard } from './discovery';
import { db } from '@/lib/db';

describe('checkKadGuard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns missingKad:true when company has no KAD codes', async () => {
    vi.mocked(db.companyProfile.findFirst).mockResolvedValue({ kadCodes: [] } as any);
    const result = await checkKadGuard('tenant-1');
    expect(result.missingKad).toBe(true);
  });

  it('returns missingKad:true when no company profile exists', async () => {
    vi.mocked(db.companyProfile.findFirst).mockResolvedValue(null);
    const result = await checkKadGuard('tenant-1');
    expect(result.missingKad).toBe(true);
  });

  it('returns missingKad:false when KAD codes exist', async () => {
    vi.mocked(db.companyProfile.findFirst).mockResolvedValue({ kadCodes: ['62.01'] } as any);
    const result = await checkKadGuard('tenant-1');
    expect(result.missingKad).toBe(false);
  });
});
