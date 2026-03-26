import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';
import { db } from '@/lib/db';
import { parseEspdRequest } from '@/server/services/espd-request-parser';
import { generateEspdXml } from '@/server/services/espd-xml-generator';
import { EMPTY_ESPD_DATA } from '@/lib/espd-types';
import type { EspdData } from '@/lib/espd-types';
import { EXCLUSION_CRITERIA } from '@/server/knowledge/espd-criteria';

async function ensureTenderAccess(tenderId: string, tenantId: string | null) {
  if (!tenantId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant.' });
  const tender = await db.tender.findUnique({ where: { id: tenderId } });
  if (!tender || tender.tenantId !== tenantId) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
  return { tender, tenantId };
}

export const espdRouter = router({
  getEspdData: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { tender, tenantId } = await ensureTenderAccess(input.tenderId, ctx.tenantId);

      // Return persisted wizard state if exists
      if (tender.espdData) return tender.espdData as unknown as EspdData;

      // Build default from company profile + tender data
      const [profile, certs, legalDocs, requirements] = await Promise.all([
        db.companyProfile.findFirst({ where: { tenantId } }),
        db.certificate.findMany({ where: { tenantId } }),
        db.legalDocument.findMany({ where: { tenantId } }),
        db.tenderRequirement.findMany({ where: { tenderId: input.tenderId } }),
      ]);

      const data: EspdData = { ...EMPTY_ESPD_DATA };

      // Part I from tender
      data.partI = {
        contractingAuthority: tender.contractingAuthority || '',
        tenderTitle: tender.title,
        referenceNumber: tender.referenceNumber || '',
        platform: tender.platform || '',
        cpvCodes: tender.cpvCodes || [],
        submissionDeadline: tender.submissionDeadline?.toISOString().split('T')[0] || '',
      };

      // Part II from company profile
      if (profile) {
        data.partII = {
          legalName: profile.legalName || '',
          tradeName: profile.tradeName || '',
          taxId: profile.taxId || '',
          taxOffice: profile.taxOffice || '',
          registrationNumber: profile.registrationNumber || '',
          address: profile.address || '',
          city: profile.city || '',
          postalCode: profile.postalCode || '',
          country: profile.country || 'GR',
          phone: profile.phone || '',
          email: profile.email || '',
          website: profile.website || '',
          legalRepName: profile.legalRepName || '',
          legalRepTitle: profile.legalRepTitle || '',
          legalRepIdNumber: profile.legalRepIdNumber || '',
          companySize: '',
          kadCodes: profile.kadCodes || [],
        };
      }

      // Part III — link legal documents
      data.partIII.exclusionGrounds = EXCLUSION_CRITERIA.map((ec) => {
        const linkedDoc = ec.linkedDocType
          ? legalDocs.find((d: any) => d.type === ec.linkedDocType)
          : null;
        return {
          category: ec.category,
          answer: false,
          linkedDocumentId: linkedDoc?.id || undefined,
        };
      });

      // Part IV — from requirements
      const financialReqs = requirements.filter((r: any) => r.category === 'FINANCIAL_REQUIREMENTS');
      const technicalReqs = requirements.filter((r: any) => r.category === 'TECHNICAL_REQUIREMENTS');

      data.partIV.financial = financialReqs.map((r: any) => ({
        description: r.text || '',
        value: '',
        requirementId: r.id,
      }));
      data.partIV.technical = technicalReqs.map((r: any) => ({
        description: r.text || '',
        value: '',
        requirementId: r.id,
      }));
      data.partIV.quality = certs.map((c: any) => ({
        certificateType: c.type || '',
        certificateId: c.id,
        description: c.title || '',
      }));

      return data;
    }),

  saveEspdData: protectedProcedure
    .input(z.object({
      tenderId: z.string(),
      espdData: z.any(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      await db.tender.update({
        where: { id: input.tenderId },
        data: { espdData: input.espdData },
      });
      return { success: true };
    }),

  getEspdPrefill: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { tenantId } = await ensureTenderAccess(input.tenderId, ctx.tenantId);
      const [profile, certs, legalDocs] = await Promise.all([
        db.companyProfile.findFirst({ where: { tenantId } }),
        db.certificate.findMany({ where: { tenantId } }),
        db.legalDocument.findMany({ where: { tenantId } }),
      ]);
      return { profile, certs, legalDocs };
    }),

  importEspdRequest: protectedProcedure
    .input(z.object({
      tenderId: z.string(),
      xmlContent: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);

      const parsed = parseEspdRequest(input.xmlContent);

      // Merge with existing espdData or create new
      const tender = await db.tender.findUnique({ where: { id: input.tenderId } });
      const existing = (tender?.espdData as unknown as EspdData) || { ...EMPTY_ESPD_DATA };

      const merged: EspdData = {
        ...existing,
        currentStep: 1,
        partI: { ...existing.partI, ...parsed.partI },
        partIII: parsed.partIII || existing.partIII,
        partIV: {
          financial: [...(parsed.partIV?.financial || []), ...existing.partIV.financial],
          technical: [...(parsed.partIV?.technical || []), ...existing.partIV.technical],
          quality: existing.partIV.quality,
        },
      };

      await db.tender.update({
        where: { id: input.tenderId },
        data: { espdData: merged as any },
      });

      const criteriaCount = (parsed.partIII?.exclusionGrounds?.length || 0)
        + (parsed.partIV?.financial?.length || 0)
        + (parsed.partIV?.technical?.length || 0);

      return { espdData: merged, criteriaCount };
    }),

  generateEspdXml: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { tender, tenantId } = await ensureTenderAccess(input.tenderId, ctx.tenantId);

      const espdData = tender.espdData as unknown as EspdData;
      if (!espdData) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No ESPD data.' });

      // Generate XML
      const xml = generateEspdXml(espdData);

      // Create GeneratedDocument
      const doc = await db.generatedDocument.create({
        data: {
          tenderId: input.tenderId,
          type: 'ESPD',
          title: 'ΕΕΕΣ/ESPD',
          content: JSON.stringify(espdData),
          fileName: `ESPD_${tender.referenceNumber || tender.id}.xml`,
          status: 'FINAL',
        },
      });

      // Auto-mark EXCLUSION_CRITERIA requirements as COVERED
      await db.tenderRequirement.updateMany({
        where: {
          tenderId: input.tenderId,
          category: 'EXCLUSION_CRITERIA',
        },
        data: { coverageStatus: 'COVERED' },
      });

      // Log activity
      await db.activity.create({
        data: {
          tenderId: input.tenderId,
          action: 'espd_generated',
          details: 'ESPD XML generated and linked to fakelos',
        },
      });

      return { documentId: doc.id, xml };
    }),
});
