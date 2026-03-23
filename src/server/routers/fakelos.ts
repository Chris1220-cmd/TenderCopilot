import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';
import { fakelosChecker } from '@/server/services/fakelos-checker';
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

export const fakelosRouter = router({
  /** Run full dossier completeness check — triggers AI guidance generation */
  runCheck: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { tenantId } = await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return fakelosChecker.runCheck(input.tenderId, tenantId);
    }),

  /** Get cached report (no AI call, fast) */
  getReport: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ input, ctx }) => {
      const { tender } = await ensureTenderAccess(input.tenderId, ctx.tenantId);
      if (!tender.fakelosReport) return null;
      return tender.fakelosReport as any;
    }),

  /** Mark a requirement item as IN_PROGRESS or MANUAL_OVERRIDE */
  markItemStatus: protectedProcedure
    .input(
      z.object({
        requirementId: z.string(),
        status: z.enum(['IN_PROGRESS', 'MANUAL_OVERRIDE']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant.' });
      }
      await db.tenderRequirement.update({
        where: { id: input.requirementId },
        data: { coverageStatus: input.status },
      });
      return { success: true };
    }),

  /** War room: overview of all active tenders with readiness status */
  getWarRoom: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant.' });
    }
    return fakelosChecker.getWarRoomData(ctx.tenantId);
  }),
});
