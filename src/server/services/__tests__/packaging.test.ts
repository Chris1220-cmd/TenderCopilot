import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    tender: {
      findUniqueOrThrow: vi.fn(),
    },
    activity: { create: vi.fn() },
    packageSubmission: { create: vi.fn() },
  },
}));

vi.mock('@/lib/s3', () => ({
  getFileBuffer: vi.fn().mockResolvedValue(Buffer.from('mock file content')),
}));

import { db } from '@/lib/db';
import { PackagingService } from '../packaging';

const service = new PackagingService();

describe('PackagingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPlatformStructure', () => {
    it('should return ESIDIS folder structure', () => {
      const structure = service.getPlatformStructure('ESIDIS');
      expect(structure.folders).toHaveLength(4);
      expect(structure.folders[0]).toContain('Δικαιολογητικών');
      expect(structure.folders[1]).toContain('Τεχνικής');
      expect(structure.folders[2]).toContain('Οικονομικής');
    });

    it('should return cosmoONE folder structure', () => {
      const structure = service.getPlatformStructure('COSMOONE');
      expect(structure.folders).toHaveLength(4);
      expect(structure.folders[0]).toBe('Participation Documents');
    });

    it('should return default structure for OTHER platform', () => {
      const structure = service.getPlatformStructure('OTHER');
      expect(structure.folders).toHaveLength(4);
    });
  });

  describe('validatePackage', () => {
    it('should detect missing documents from GAP requirements', async () => {
      vi.mocked(db.tender.findUniqueOrThrow).mockResolvedValue({
        id: 'tender-1',
        platform: 'ESIDIS',
        title: 'Test Tender',
        requirements: [
          {
            id: 'req-1',
            text: 'Missing document requirement',
            category: 'PARTICIPATION_CRITERIA',
            mandatory: true,
            coverageStatus: 'GAP',
            mappings: [],
          },
          {
            id: 'req-2',
            text: 'Covered requirement',
            category: 'PARTICIPATION_CRITERIA',
            mandatory: true,
            coverageStatus: 'COVERED',
            mappings: [
              {
                certificate: {
                  id: 'cert-1',
                  fileKey: 'uploads/cert.pdf',
                  fileName: 'ISO9001.pdf',
                },
              },
            ],
          },
        ],
        attachedDocuments: [],
        generatedDocuments: [
          {
            type: 'SOLEMN_DECLARATION',
            title: 'Υπεύθυνη Δήλωση',
            content: '# Test',
            status: 'FINAL',
            fileKey: null,
            fileName: null,
          },
        ],
      } as any);

      const result = await service.validatePackage('tender-1');

      expect(result.valid).toBe(false);
      expect(result.missingDocuments).toHaveLength(1);
      expect(result.missingDocuments[0]).toContain('Missing document');
      expect(result.documents.length).toBeGreaterThan(0);
    });

    it('should warn about DRAFT generated documents', async () => {
      vi.mocked(db.tender.findUniqueOrThrow).mockResolvedValue({
        id: 'tender-1',
        platform: 'ESIDIS',
        title: 'Test',
        requirements: [],
        attachedDocuments: [],
        generatedDocuments: [
          {
            type: 'TECHNICAL_PROPOSAL',
            title: 'Draft Proposal',
            content: '# Draft',
            status: 'DRAFT',
            fileKey: null,
            fileName: null,
          },
        ],
      } as any);

      const result = await service.validatePackage('tender-1');

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('FINAL');
    });
  });

  describe('buildPackage', () => {
    it('should build a ZIP buffer with correct structure', async () => {
      vi.mocked(db.tender.findUniqueOrThrow).mockResolvedValue({
        id: 'tender-1',
        platform: 'ESIDIS',
        title: 'Test Tender',
        referenceNumber: 'REF-001',
      } as any);
      vi.mocked(db.activity.create).mockResolvedValue({} as any);
      vi.mocked((db as any).packageSubmission.create).mockResolvedValue({} as any);

      const validation = {
        canProceed: true,
        blockers: [],
        warnings: [],
        infos: [],
        readinessScore: 100,
        deadline: null,
        envelopes: [
          {
            id: 'A' as const,
            title: 'Φάκελος Α — Δικαιολογητικά Συμμετοχής',
            documentCount: 2,
            documents: [
              {
                name: 'test.pdf',
                folder: 'Φάκελος Δικαιολογητικών Συμμετοχής',
                fileKey: 'uploads/test.pdf',
                source: 'company' as const,
              },
              {
                name: 'proposal.md',
                folder: 'Φάκελος Τεχνικής Προσφοράς',
                content: '# Technical Proposal',
                source: 'generated' as const,
              },
            ],
          },
        ],
      };

      const result = await service.buildPackage('tender-1', 'tenant-1', validation);

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.fileSize).toBeGreaterThan(0);
      expect(result.documentCount).toBeGreaterThan(0);

      // Verify it's a valid ZIP (starts with PK signature)
      expect(result.buffer[0]).toBe(0x50); // P
      expect(result.buffer[1]).toBe(0x4b); // K
    });
  });
});
