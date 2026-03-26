import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';
import { packagingService } from '@/server/services/packaging';
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

export const packageRouter = router({
  /** Run final validation before package assembly */
  validate: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { tenantId } = await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return packagingService.runFinalValidation(input.tenderId, tenantId);
    }),

  /** Build and return the ZIP package */
  assemble: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { tenantId } = await ensureTenderAccess(input.tenderId, ctx.tenantId);

      // Run validation first to get envelope data
      const validation = await packagingService.runFinalValidation(input.tenderId, tenantId);

      if (!validation.canProceed) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Υπάρχουν ${validation.blockers.length} κρίσιμα ζητήματα. Διορθώστε τα πριν τη συναρμολόγηση.`,
        });
      }

      const result = await packagingService.buildPackage(input.tenderId, tenantId, validation);

      // Return base64-encoded ZIP (for client-side download)
      return {
        zipBase64: result.buffer.toString('base64'),
        fileSize: result.fileSize,
        documentCount: result.documentCount,
        envelopeCount: result.envelopeCount,
      };
    }),

  /** Get assembly history for a tender */
  getHistory: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ input, ctx }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return db.packageSubmission.findMany({
        where: { tenderId: input.tenderId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    }),
});
