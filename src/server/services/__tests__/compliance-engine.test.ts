import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma
vi.mock('@/lib/db', () => ({
  db: {
    tenant: {
      findUnique: vi.fn(),
    },
    tenderRequirement: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    certificate: { findMany: vi.fn() },
    legalDocument: { findMany: vi.fn() },
    project: { findMany: vi.fn() },
    contentLibraryItem: { findMany: vi.fn() },
    tender: { update: vi.fn() },
    activity: { create: vi.fn() },
    requirementMapping: { create: vi.fn() },
  },
}));

import { db } from '@/lib/db';
import { ComplianceEngine } from '../compliance-engine';

const engine = new ComplianceEngine();

describe('ComplianceEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: tenant resolves to GR country so getPromptContext returns valid keywords
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ countries: ['GR'] } as any);
  });

  describe('compliance score calculation', () => {
    it('should return 100% when all mandatory requirements are covered', async () => {
      // Setup: 3 mandatory requirements, all with matching certificates
      const requirements = [
        {
          id: 'req-1',
          text: 'Πιστοποιητικό ISO 9001:2015',
          category: 'PARTICIPATION_CRITERIA',
          type: 'CERTIFICATE',
          mandatory: true,
          coverageStatus: 'UNMAPPED',
          mappings: [],
        },
        {
          id: 'req-2',
          text: 'Φορολογική ενημερότητα σε ισχύ',
          category: 'PARTICIPATION_CRITERIA',
          type: 'DOCUMENT',
          mandatory: true,
          coverageStatus: 'UNMAPPED',
          mappings: [],
        },
        {
          id: 'req-3',
          text: 'Ασφαλιστική ενημερότητα',
          category: 'PARTICIPATION_CRITERIA',
          type: 'DOCUMENT',
          mandatory: true,
          coverageStatus: 'UNMAPPED',
          mappings: [],
        },
      ];

      const certificates = [
        { id: 'cert-1', type: 'ISO 9001', title: 'ISO 9001:2015 Quality Management', tenantId: 't1' },
      ];

      const legalDocs = [
        { id: 'ld-1', type: 'TAX_CLEARANCE', title: 'Φορολογική Ενημερότητα', tenantId: 't1', expiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000) },
        { id: 'ld-2', type: 'SOCIAL_SECURITY_CLEARANCE', title: 'Ασφαλιστική Ενημερότητα', tenantId: 't1', expiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000) },
      ];

      vi.mocked(db.tenderRequirement.findMany).mockResolvedValue(requirements as any);
      vi.mocked(db.certificate.findMany).mockResolvedValue(certificates as any);
      vi.mocked(db.legalDocument.findMany).mockResolvedValue(legalDocs as any);
      vi.mocked(db.project.findMany).mockResolvedValue([]);
      vi.mocked(db.contentLibraryItem.findMany).mockResolvedValue([]);
      vi.mocked(db.tenderRequirement.update).mockResolvedValue({} as any);
      vi.mocked(db.tender.update).mockResolvedValue({} as any);
      vi.mocked(db.activity.create).mockResolvedValue({} as any);
      vi.mocked(db.requirementMapping.create).mockResolvedValue({} as any);

      const result = await engine.runComplianceCheck('tender-1', 'tenant-1');

      expect(result.score).toBe(100);
      expect(result.results.every((r) => r.status === 'COVERED')).toBe(true);
    });

    it('should return 0% when no requirements are covered', async () => {
      const requirements = [
        {
          id: 'req-1',
          text: 'ISO 45001 πιστοποίηση',
          category: 'PARTICIPATION_CRITERIA',
          type: 'CERTIFICATE',
          mandatory: true,
          coverageStatus: 'UNMAPPED',
          mappings: [],
        },
      ];

      vi.mocked(db.tenderRequirement.findMany).mockResolvedValue(requirements as any);
      vi.mocked(db.certificate.findMany).mockResolvedValue([]);
      vi.mocked(db.legalDocument.findMany).mockResolvedValue([]);
      vi.mocked(db.project.findMany).mockResolvedValue([]);
      vi.mocked(db.contentLibraryItem.findMany).mockResolvedValue([]);
      vi.mocked(db.tenderRequirement.update).mockResolvedValue({} as any);
      vi.mocked(db.tender.update).mockResolvedValue({} as any);
      vi.mocked(db.activity.create).mockResolvedValue({} as any);

      const result = await engine.runComplianceCheck('tender-1', 'tenant-1');

      expect(result.score).toBe(0);
      expect(result.results[0].status).toBe('GAP');
    });

    it('should return 100% when there are no mandatory requirements', async () => {
      const requirements = [
        {
          id: 'req-1',
          text: 'Optional requirement',
          category: 'TECHNICAL_REQUIREMENTS',
          type: 'OTHER',
          mandatory: false,
          coverageStatus: 'UNMAPPED',
          mappings: [],
        },
      ];

      vi.mocked(db.tenderRequirement.findMany).mockResolvedValue(requirements as any);
      vi.mocked(db.certificate.findMany).mockResolvedValue([]);
      vi.mocked(db.legalDocument.findMany).mockResolvedValue([]);
      vi.mocked(db.project.findMany).mockResolvedValue([]);
      vi.mocked(db.contentLibraryItem.findMany).mockResolvedValue([]);
      vi.mocked(db.tenderRequirement.update).mockResolvedValue({} as any);
      vi.mocked(db.tender.update).mockResolvedValue({} as any);
      vi.mocked(db.activity.create).mockResolvedValue({} as any);

      const result = await engine.runComplianceCheck('tender-1', 'tenant-1');

      expect(result.score).toBe(100);
    });

    it('should preserve MANUAL_OVERRIDE status', async () => {
      const requirements = [
        {
          id: 'req-1',
          text: 'Manually overridden requirement',
          category: 'PARTICIPATION_CRITERIA',
          type: 'CERTIFICATE',
          mandatory: true,
          coverageStatus: 'MANUAL_OVERRIDE',
          mappings: [],
        },
      ];

      vi.mocked(db.tenderRequirement.findMany).mockResolvedValue(requirements as any);
      vi.mocked(db.certificate.findMany).mockResolvedValue([]);
      vi.mocked(db.legalDocument.findMany).mockResolvedValue([]);
      vi.mocked(db.project.findMany).mockResolvedValue([]);
      vi.mocked(db.contentLibraryItem.findMany).mockResolvedValue([]);
      vi.mocked(db.tender.update).mockResolvedValue({} as any);
      vi.mocked(db.activity.create).mockResolvedValue({} as any);

      const result = await engine.runComplianceCheck('tender-1', 'tenant-1');

      expect(result.score).toBe(100);
      expect(result.results[0].status).toBe('MANUAL_OVERRIDE');
    });
  });

  describe('certificate matching', () => {
    it('should match ISO certificate by type keyword', async () => {
      const requirements = [
        {
          id: 'req-1',
          text: 'Πιστοποιητικό ποιότητας ISO 9001',
          category: 'PARTICIPATION_CRITERIA',
          type: 'CERTIFICATE',
          mandatory: true,
          coverageStatus: 'UNMAPPED',
          mappings: [],
        },
      ];

      const certificates = [
        { id: 'cert-1', type: 'ISO 9001', title: 'ISO 9001:2015', tenantId: 't1' },
      ];

      vi.mocked(db.tenderRequirement.findMany).mockResolvedValue(requirements as any);
      vi.mocked(db.certificate.findMany).mockResolvedValue(certificates as any);
      vi.mocked(db.legalDocument.findMany).mockResolvedValue([]);
      vi.mocked(db.project.findMany).mockResolvedValue([]);
      vi.mocked(db.contentLibraryItem.findMany).mockResolvedValue([]);
      vi.mocked(db.tenderRequirement.update).mockResolvedValue({} as any);
      vi.mocked(db.tender.update).mockResolvedValue({} as any);
      vi.mocked(db.activity.create).mockResolvedValue({} as any);
      vi.mocked(db.requirementMapping.create).mockResolvedValue({} as any);

      const result = await engine.runComplianceCheck('tender-1', 'tenant-1');

      expect(result.results[0].status).toBe('COVERED');
      expect(result.results[0].mappings.length).toBeGreaterThan(0);
      expect(result.results[0].mappings[0].type).toBe('certificate');
    });
  });

  describe('experience matching', () => {
    it('should match projects by experience requirements', async () => {
      const requirements = [
        {
          id: 'req-1',
          text: 'Τουλάχιστον 3 αντίστοιχα έργα εμπειρίας τα τελευταία 3 έτη',
          category: 'TECHNICAL_REQUIREMENTS',
          type: 'EXPERIENCE',
          mandatory: true,
          coverageStatus: 'UNMAPPED',
          mappings: [],
        },
      ];

      const projects = [
        { id: 'p1', title: 'Project A', contractAmount: 100000, tenantId: 't1' },
        { id: 'p2', title: 'Project B', contractAmount: 80000, tenantId: 't1' },
        { id: 'p3', title: 'Project C', contractAmount: 120000, tenantId: 't1' },
      ];

      vi.mocked(db.tenderRequirement.findMany).mockResolvedValue(requirements as any);
      vi.mocked(db.certificate.findMany).mockResolvedValue([]);
      vi.mocked(db.legalDocument.findMany).mockResolvedValue([]);
      vi.mocked(db.project.findMany).mockResolvedValue(projects as any);
      vi.mocked(db.contentLibraryItem.findMany).mockResolvedValue([]);
      vi.mocked(db.tenderRequirement.update).mockResolvedValue({} as any);
      vi.mocked(db.tender.update).mockResolvedValue({} as any);
      vi.mocked(db.activity.create).mockResolvedValue({} as any);
      vi.mocked(db.requirementMapping.create).mockResolvedValue({} as any);

      const result = await engine.runComplianceCheck('tender-1', 'tenant-1');

      expect(result.results[0].status).toBe('COVERED');
    });
  });

  describe('legal document matching', () => {
    it('should not match expired legal documents', async () => {
      const requirements = [
        {
          id: 'req-1',
          text: 'Φορολογική ενημερότητα σε ισχύ',
          category: 'PARTICIPATION_CRITERIA',
          type: 'DOCUMENT',
          mandatory: true,
          coverageStatus: 'UNMAPPED',
          mappings: [],
        },
      ];

      const legalDocs = [
        {
          id: 'ld-1',
          type: 'TAX_CLEARANCE',
          title: 'Φορολογική Ενημερότητα',
          tenantId: 't1',
          expiryDate: new Date('2020-01-01'), // expired
        },
      ];

      vi.mocked(db.tenderRequirement.findMany).mockResolvedValue(requirements as any);
      vi.mocked(db.certificate.findMany).mockResolvedValue([]);
      vi.mocked(db.legalDocument.findMany).mockResolvedValue(legalDocs as any);
      vi.mocked(db.project.findMany).mockResolvedValue([]);
      vi.mocked(db.contentLibraryItem.findMany).mockResolvedValue([]);
      vi.mocked(db.tenderRequirement.update).mockResolvedValue({} as any);
      vi.mocked(db.tender.update).mockResolvedValue({} as any);
      vi.mocked(db.activity.create).mockResolvedValue({} as any);

      const result = await engine.runComplianceCheck('tender-1', 'tenant-1');

      expect(result.results[0].status).toBe('GAP');
    });
  });
});
