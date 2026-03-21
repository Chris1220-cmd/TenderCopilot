/**
 * Learning Memory tRPC router — tender outcomes, chat feedback, memory.
 */

import { z } from 'zod';
import { router, protectedProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import { db } from '@/lib/db';
import {
  recordOutcome,
  recordChatFeedback,
  getOutcomeStats,
} from '@/server/services/learning-memory';

export const learningRouter = router({
  /**
   * Record a tender outcome (won/lost/withdrew/disqualified).
   */
  recordOutcome: protectedProcedure
    .input(
      z.object({
        tenderId: z.string(),
        outcome: z.enum(['won', 'lost', 'withdrew', 'disqualified']),
        reason: z.string().optional(),
        bidAmount: z.number().optional(),
        winAmount: z.number().optional(),
        feedback: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant' });
      }

      // Verify tender belongs to tenant
      const tender = await db.tender.findFirst({
        where: { id: input.tenderId, tenantId: ctx.tenantId },
      });
      if (!tender) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found' });
      }

      await recordOutcome({
        tenderId: input.tenderId,
        tenantId: ctx.tenantId,
        outcome: input.outcome,
        reason: input.reason,
        bidAmount: input.bidAmount,
        winAmount: input.winAmount,
        feedback: input.feedback,
      });

      return { success: true };
    }),

  /**
   * Rate a chat message (thumbs up/down).
   */
  rateChatMessage: protectedProcedure
    .input(
      z.object({
        messageId: z.string(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant' });
      }

      await recordChatFeedback({
        messageId: input.messageId,
        tenantId: ctx.tenantId,
        rating: input.rating,
        comment: input.comment,
      });

      return { success: true };
    }),

  /**
   * Get win/loss statistics for the tenant.
   */
  getOutcomeStats: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant' });
    }

    return getOutcomeStats(ctx.tenantId);
  }),

  /**
   * Get all tenant memories.
   */
  getMemories: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant' });
    }

    return db.tenantMemory.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: [{ confidence: 'desc' }, { updatedAt: 'desc' }],
    });
  }),
});
