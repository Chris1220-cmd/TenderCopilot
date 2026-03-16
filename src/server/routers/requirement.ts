import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';

const requirementCategoryEnum = z.enum([
  'PARTICIPATION_CRITERIA',
  'EXCLUSION_CRITERIA',
  'TECHNICAL_REQUIREMENTS',
  'FINANCIAL_REQUIREMENTS',
  'DOCUMENTATION_REQUIREMENTS',
  'CONTRACT_TERMS',
]);

const requirementTypeEnum = z.enum([
  'DOCUMENT',
  'EXPERIENCE',
  'CERTIFICATE',
  'DECLARATION',
  'FINANCIAL',
  'TECHNICAL',
  'OTHER',
]);

const coverageStatusEnum = z.enum(['UNMAPPED', 'COVERED', 'GAP', 'MANUAL_OVERRIDE']);

export const requirementRouter = router({
  listByTender: protectedProcedure
    .input(
      z.object({
        tenderId: z.string().cuid(),
        category: requirementCategoryEnum.optional(),
        coverageStatus: coverageStatusEnum.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      // Verify tender belongs to tenant
      const tender = await ctx.db.tender.findUnique({ where: { id: input.tenderId } });
      if (!tender || tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
      }

      return ctx.db.tenderRequirement.findMany({
        where: {
          tenderId: input.tenderId,
          ...(input.category ? { category: input.category } : {}),
          ...(input.coverageStatus ? { coverageStatus: input.coverageStatus } : {}),
        },
        orderBy: { createdAt: 'asc' },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const requirement = await ctx.db.tenderRequirement.findUnique({
        where: { id: input.id },
        include: {
          mappings: {
            include: {
              certificate: true,
              legalDocument: true,
              project: true,
              contentLibraryItem: true,
            },
          },
          tender: { select: { tenantId: true } },
        },
      });

      if (!requirement || requirement.tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Requirement not found.' });
      }

      return requirement;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        text: z.string().min(1).optional(),
        category: requirementCategoryEnum.optional(),
        mandatory: z.boolean().optional(),
        type: requirementTypeEnum.optional(),
        coverageStatus: coverageStatusEnum.optional(),
        notes: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const { id, ...data } = input;

      const requirement = await ctx.db.tenderRequirement.findUnique({
        where: { id },
        include: { tender: { select: { tenantId: true } } },
      });

      if (!requirement || requirement.tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Requirement not found.' });
      }

      return ctx.db.tenderRequirement.update({ where: { id }, data });
    }),

  createMapping: protectedProcedure
    .input(
      z.object({
        requirementId: z.string().cuid(),
        certificateId: z.string().cuid().nullish(),
        legalDocumentId: z.string().cuid().nullish(),
        projectId: z.string().cuid().nullish(),
        contentLibraryItemId: z.string().cuid().nullish(),
        notes: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      // Verify requirement belongs to tenant
      const requirement = await ctx.db.tenderRequirement.findUnique({
        where: { id: input.requirementId },
        include: { tender: { select: { tenantId: true } } },
      });

      if (!requirement || requirement.tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Requirement not found.' });
      }

      return ctx.db.requirementMapping.create({
        data: {
          requirementId: input.requirementId,
          certificateId: input.certificateId ?? undefined,
          legalDocumentId: input.legalDocumentId ?? undefined,
          projectId: input.projectId ?? undefined,
          contentLibraryItemId: input.contentLibraryItemId ?? undefined,
          notes: input.notes,
        },
      });
    }),

  deleteMapping: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      // Verify mapping belongs to tenant via requirement -> tender
      const mapping = await ctx.db.requirementMapping.findUnique({
        where: { id: input.id },
        include: {
          requirement: {
            include: { tender: { select: { tenantId: true } } },
          },
        },
      });

      if (!mapping || mapping.requirement.tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Mapping not found.' });
      }

      return ctx.db.requirementMapping.delete({ where: { id: input.id } });
    }),

  bulkUpdateStatus: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.string().cuid()).min(1),
        coverageStatus: coverageStatusEnum,
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      // Verify all requirements belong to the tenant
      const requirements = await ctx.db.tenderRequirement.findMany({
        where: { id: { in: input.ids } },
        include: { tender: { select: { tenantId: true } } },
      });

      const allOwned = requirements.every((r) => r.tender.tenantId === ctx.tenantId);
      if (requirements.length !== input.ids.length || !allOwned) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Some requirements not found or not owned by your tenant.',
        });
      }

      return ctx.db.tenderRequirement.updateMany({
        where: { id: { in: input.ids } },
        data: { coverageStatus: input.coverageStatus },
      });
    }),
});
