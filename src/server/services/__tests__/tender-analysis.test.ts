import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    tender: { update: vi.fn() },
    tenderRequirement: { createMany: vi.fn() },
    activity: { create: vi.fn() },
  },
}));

vi.mock('@/server/ai', () => ({
  ai: () => ({
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        title: 'Test Tender',
        referenceNumber: 'REF-001',
        contractingAuthority: 'Test Authority',
        budget: 100000,
        submissionDeadline: '2024-12-31T14:00:00Z',
        cpvCodes: ['30200000-1'],
        summary: 'Test summary',
        requirements: [
          {
            text: 'Φορολογική ενημερότητα',
            category: 'PARTICIPATION_CRITERIA',
            articleReference: 'Άρθρο 73',
            mandatory: true,
            type: 'DOCUMENT',
            confidence: 0.95,
          },
          {
            text: 'Τεχνική προσφορά',
            category: 'TECHNICAL_REQUIREMENTS',
            articleReference: 'Άρθρο 94',
            mandatory: true,
            type: 'TECHNICAL',
            confidence: 0.88,
          },
        ],
      }),
      usage: { inputTokens: 1000, outputTokens: 500 },
    }),
  }),
}));

import { db } from '@/lib/db';
import { TenderAnalysisService } from '../tender-analysis';

const service = new TenderAnalysisService();

describe('TenderAnalysisService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeTender', () => {
    it('should extract requirements from document text', async () => {
      const result = await service.analyzeTender('tender-1', [
        'Διακήρυξη δημόσιου διαγωνισμού...',
      ]);

      expect(result.requirements).toHaveLength(2);
      expect(result.requirements[0].category).toBe('PARTICIPATION_CRITERIA');
      expect(result.requirements[1].category).toBe('TECHNICAL_REQUIREMENTS');
      expect(result.title).toBe('Test Tender');
      expect(result.budget).toBe(100000);
    });
  });

  describe('saveRequirements', () => {
    it('should update tender metadata and create requirements', async () => {
      vi.mocked(db.tender.update).mockResolvedValue({} as any);
      vi.mocked(db.tenderRequirement.createMany).mockResolvedValue({ count: 2 } as any);
      vi.mocked(db.activity.create).mockResolvedValue({} as any);

      const analysis = {
        title: 'Test',
        referenceNumber: 'REF-001',
        contractingAuthority: 'Authority',
        budget: 50000,
        submissionDeadline: '2024-12-31',
        cpvCodes: ['30200000-1'],
        requirements: [
          {
            text: 'Requirement 1',
            category: 'PARTICIPATION_CRITERIA' as const,
            mandatory: true,
            type: 'DOCUMENT' as const,
            confidence: 0.9,
          },
        ],
      };

      await service.saveRequirements('tender-1', analysis);

      expect(db.tender.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tender-1' },
        })
      );

      expect(db.tenderRequirement.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              tenderId: 'tender-1',
              text: 'Requirement 1',
              coverageStatus: 'UNMAPPED',
            }),
          ]),
        })
      );

      expect(db.activity.create).toHaveBeenCalled();
    });

    it('should handle empty requirements array', async () => {
      vi.mocked(db.tender.update).mockResolvedValue({} as any);
      vi.mocked(db.activity.create).mockResolvedValue({} as any);

      await service.saveRequirements('tender-1', {
        title: 'Test',
        requirements: [],
      });

      expect(db.tenderRequirement.createMany).not.toHaveBeenCalled();
      expect(db.activity.create).toHaveBeenCalled();
    });
  });
});
