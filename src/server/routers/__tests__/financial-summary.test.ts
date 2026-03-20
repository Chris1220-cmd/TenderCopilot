import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db
vi.mock('@/lib/db', () => ({
  db: {
    pricingScenario: { findMany: vi.fn() },
    tenderRequirement: { count: vi.fn() },
    financialProfile: { count: vi.fn() },
    tender: { findUnique: vi.fn() },
  },
}));

// Mock aiFinancial
vi.mock('@/server/services/ai-financial', () => ({
  aiFinancial: {
    checkEligibility: vi.fn(),
  },
}));

import { db } from '@/lib/db';
import { aiFinancial } from '@/server/services/ai-financial';

// Extract the eligibility-gating logic for isolated testing
async function computeEligibility(
  tenderId: string,
  tenantId: string
): Promise<{ eligibility: any; hasFinancialProfile: boolean; hasExtractedRequirements: boolean }> {
  const [reqCount, profileCount] = await Promise.all([
    (db.tenderRequirement as any).count({
      where: { tenderId, category: 'FINANCIAL_REQUIREMENTS' },
    }),
    (db.financialProfile as any).count({
      where: { tenantId },
    }),
  ]);

  const hasExtractedRequirements = reqCount > 0;
  const hasFinancialProfile = profileCount > 0;

  let eligibility = null;
  if (hasExtractedRequirements && hasFinancialProfile) {
    try {
      eligibility = await aiFinancial.checkEligibility(tenderId, tenantId);
    } catch {
      eligibility = null;
    }
  }

  return { eligibility, hasFinancialProfile, hasExtractedRequirements };
}

describe('getFinancialSummary — eligibility gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns eligibility: null when no requirements extracted', async () => {
    vi.mocked(db.tenderRequirement.count as any).mockResolvedValue(0);
    vi.mocked(db.financialProfile.count as any).mockResolvedValue(2);

    const result = await computeEligibility('t1', 'tenant1');

    expect(result.eligibility).toBeNull();
    expect(result.hasExtractedRequirements).toBe(false);
    expect(result.hasFinancialProfile).toBe(true);
    expect(aiFinancial.checkEligibility).not.toHaveBeenCalled();
  });

  it('returns eligibility: null when no financial profile', async () => {
    vi.mocked(db.tenderRequirement.count as any).mockResolvedValue(3);
    vi.mocked(db.financialProfile.count as any).mockResolvedValue(0);

    const result = await computeEligibility('t1', 'tenant1');

    expect(result.eligibility).toBeNull();
    expect(result.hasExtractedRequirements).toBe(true);
    expect(result.hasFinancialProfile).toBe(false);
    expect(aiFinancial.checkEligibility).not.toHaveBeenCalled();
  });

  it('calls checkEligibility and returns result when both exist', async () => {
    vi.mocked(db.tenderRequirement.count as any).mockResolvedValue(3);
    vi.mocked(db.financialProfile.count as any).mockResolvedValue(1);
    const mockResult = { status: 'ELIGIBLE', checks: [{ criterion: 'Κύκλος εργασιών', required: '100K', actual: '200K', passed: true }] };
    vi.mocked(aiFinancial.checkEligibility).mockResolvedValue(mockResult as any);

    const result = await computeEligibility('t1', 'tenant1');

    expect(aiFinancial.checkEligibility).toHaveBeenCalledWith('t1', 'tenant1');
    expect(result.eligibility).toEqual(mockResult);
    expect(result.hasExtractedRequirements).toBe(true);
    expect(result.hasFinancialProfile).toBe(true);
  });

  it('returns eligibility: null (not throwing) when checkEligibility throws', async () => {
    vi.mocked(db.tenderRequirement.count as any).mockResolvedValue(2);
    vi.mocked(db.financialProfile.count as any).mockResolvedValue(1);
    vi.mocked(aiFinancial.checkEligibility).mockRejectedValue(new Error('DB error'));

    const result = await computeEligibility('t1', 'tenant1');

    expect(result.eligibility).toBeNull();
  });
});
