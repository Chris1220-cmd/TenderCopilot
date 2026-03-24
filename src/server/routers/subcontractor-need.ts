import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';
import { db } from '@/lib/db';

async function ensureTenderAccess(tenderId: string, tenantId: string | null) {
  if (!tenantId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
  }
  const tender = await db.tender.findUnique({ where: { id: tenderId } });
  if (!tender || tender.tenantId !== tenantId) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
  }
  return { tender, tenantId };
}

export const subcontractorNeedRouter = router({
  /** List all subcontractor needs for a tender */
  list: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ input, ctx }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return db.subcontractorNeed.findMany({
        where: { tenderId: input.tenderId },
        orderBy: [{ isMandatory: 'desc' }, { createdAt: 'asc' }],
      });
    }),

  /** Manually add a subcontractor/supplier need */
  create: protectedProcedure
    .input(
      z.object({
        tenderId: z.string(),
        specialty: z.string().min(1).max(200),
        kind: z.enum(['SUBCONTRACTOR', 'SUPPLIER']),
        reason: z.string().max(1000).optional().default(''),
        isMandatory: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return db.subcontractorNeed.create({
        data: {
          tenderId: input.tenderId,
          specialty: input.specialty,
          kind: input.kind,
          reason: input.reason,
          isMandatory: input.isMandatory,
          isAiGenerated: false,
        },
      });
    }),

  /** Update status (mark as found, in progress, etc.) */
  markStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['PENDING', 'IN_PROGRESS', 'COVERED']),
        assignedName: z.string().max(200).optional(),
        notes: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const need = await db.subcontractorNeed.findUnique({
        where: { id: input.id },
        include: { tender: { select: { tenantId: true } } },
      });
      if (!need || need.tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Not found.' });
      }
      return db.subcontractorNeed.update({
        where: { id: input.id },
        data: {
          status: input.status,
          assignedName: input.assignedName ?? need.assignedName,
          notes: input.notes ?? need.notes,
        },
      });
    }),

  /** Update any field (for editing) */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        specialty: z.string().min(1).max(200).optional(),
        kind: z.enum(['SUBCONTRACTOR', 'SUPPLIER']).optional(),
        reason: z.string().max(1000).optional(),
        isMandatory: z.boolean().optional(),
        assignedName: z.string().max(200).nullable().optional(),
        notes: z.string().max(1000).nullable().optional(),
        status: z.enum(['PENDING', 'IN_PROGRESS', 'COVERED']).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const need = await db.subcontractorNeed.findUnique({
        where: { id },
        include: { tender: { select: { tenantId: true } } },
      });
      if (!need || need.tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Not found.' });
      }
      return db.subcontractorNeed.update({ where: { id }, data });
    }),

  /** Delete a manually-added need (block AI-generated during analysis) */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const need = await db.subcontractorNeed.findUnique({
        where: { id: input.id },
        include: { tender: { select: { tenantId: true, analysisInProgress: true } } },
      });
      if (!need || need.tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Not found.' });
      }
      if (need.isAiGenerated && need.tender.analysisInProgress) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cannot delete AI-generated items during active analysis.',
        });
      }
      await db.subcontractorNeed.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
