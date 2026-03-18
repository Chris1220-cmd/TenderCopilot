import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';

const tenderStatusEnum = z.enum([
  'DISCOVERY',
  'GO_NO_GO',
  'IN_PROGRESS',
  'SUBMITTED',
  'WON',
  'LOST',
]);

const tenderPlatformEnum = z.enum(['ESIDIS', 'COSMOONE', 'ISUPPLIES', 'DIAVGEIA', 'TED', 'KIMDIS', 'OTHER', 'PRIVATE']);

export const tenderRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          status: tenderStatusEnum.optional(),
          platform: tenderPlatformEnum.optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      return ctx.db.tender.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(input?.status ? { status: input.status } : {}),
          ...(input?.platform ? { platform: input.platform } : {}),
          ...(input?.search
            ? {
                OR: [
                  { title: { contains: input.search, mode: 'insensitive' } },
                  { referenceNumber: { contains: input.search, mode: 'insensitive' } },
                  { contractingAuthority: { contains: input.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        include: {
          _count: {
            select: {
              requirements: true,
              tasks: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const tender = await ctx.db.tender.findUnique({
        where: { id: input.id },
        include: {
          requirements: {
            orderBy: { createdAt: 'asc' },
          },
          _count: {
            select: {
              tasks: true,
              attachedDocuments: true,
              generatedDocuments: true,
            },
          },
        },
      });

      if (!tender || tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
      }

      return tender;
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        referenceNumber: z.string().nullish(),
        contractingAuthority: z.string().nullish(),
        platform: tenderPlatformEnum.optional(),
        cpvCodes: z.array(z.string()).optional(),
        budget: z.number().nullish(),
        awardCriteria: z.string().nullish(),
        submissionDeadline: z.coerce.date().nullish(),
        notes: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const tender = await ctx.db.tender.create({
        data: {
          tenantId: ctx.tenantId,
          ...input,
          cpvCodes: input.cpvCodes ?? [],
        },
      });

      return { id: tender.id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        title: z.string().min(1).optional(),
        referenceNumber: z.string().nullish(),
        contractingAuthority: z.string().nullish(),
        platform: tenderPlatformEnum.optional(),
        cpvCodes: z.array(z.string()).optional(),
        budget: z.number().nullish(),
        awardCriteria: z.string().nullish(),
        submissionDeadline: z.coerce.date().nullish(),
        complianceScore: z.number().min(0).max(100).nullish(),
        notes: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const { id, ...data } = input;

      const tender = await ctx.db.tender.findUnique({ where: { id } });
      if (!tender || tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
      }

      return ctx.db.tender.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const tender = await ctx.db.tender.findUnique({ where: { id: input.id } });
      if (!tender || tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
      }

      return ctx.db.tender.delete({ where: { id: input.id } });
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        status: tenderStatusEnum,
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const tender = await ctx.db.tender.findUnique({ where: { id: input.id } });
      if (!tender || tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
      }

      return ctx.db.tender.update({
        where: { id: input.id },
        data: { status: input.status },
      });
    }),
});
