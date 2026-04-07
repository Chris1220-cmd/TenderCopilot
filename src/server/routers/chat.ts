/**
 * Chat tRPC router — persistent chat + smart AI Q&A.
 */

import { z } from 'zod';
import { router, protectedProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import { db } from '@/lib/db';
import { ai, checkTokenBudget, logTokenUsage } from '@/server/ai/provider';
import { buildContext } from '@/server/services/context-builder';
import { validateResponse } from '@/server/services/trust-shield';
import { getSmartHistory, maybeUpdateSummary } from '@/server/services/chat-memory';
import { createUsageLimitCheck } from '@/server/middleware/usage-limit';

export const chatRouter = router({
  /**
   * Get chat history for a tender.
   */
  getHistory: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant' });
      const tenantId = ctx.tenantId;

      const tender = await db.tender.findFirst({
        where: { id: input.tenderId, tenantId },
      });
      if (!tender) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found' });

      return db.chatMessage.findMany({
        where: { tenderId: input.tenderId, tenantId },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });
    }),

  /**
   * Smart question — searches documents, builds context, validates response.
   */
  askSmart: protectedProcedure
    .input(z.object({
      tenderId: z.string(),
      question: z.string().min(1).max(2000),
      country: z.string().length(2).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant' });
      const { tenderId, question, country = 'GR' } = input;
      const tenantId = ctx.tenantId;

      const tender = await db.tender.findFirst({
        where: { id: tenderId, tenantId },
      });
      if (!tender) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found' });

      await createUsageLimitCheck('aiCreditsUsed')(ctx.tenantId);

      // Token budget check
      const budget = await checkTokenBudget(tenantId);
      if (!budget.allowed) {
        return {
          answer: 'Έχεις εξαντλήσει το ημερήσιο όριο AI ερωτήσεων. Δοκίμασε αύριο.',
          confidence: 'general' as const,
          sources: [],
          highlights: [],
          caveats: [`Χρήση tokens: ${budget.used}/${budget.limit}`],
        };
      }

      // Save user message
      await db.chatMessage.create({
        data: { tenderId, tenantId, role: 'user', content: question },
      });

      // Build smart context + history in parallel (default locale 'el' for tRPC)
      const locale: 'el' | 'en' | 'nl' = 'el';
      const [context, { summary, recentMessages }] = await Promise.all([
        buildContext(tenderId, tenantId, question, locale, country),
        getSmartHistory(tenderId, tenantId),
      ]);

      // Call AI with optional summary context
      const questionLabel = (locale as string) === 'en' ? 'QUESTION' : 'ΕΡΩΤΗΣΗ';
      const result = await ai().complete({
        messages: [
          { role: 'system', content: context.systemPrompt },
          ...(summary ? [
            { role: 'user' as const, content: `PREVIOUS CONVERSATION SUMMARY:\n${summary}` },
            { role: 'assistant' as const, content: 'Understood, I have the context from our previous conversation.' },
          ] : []),
          ...recentMessages,
          {
            role: 'user',
            content: `CONTEXT:\n${context.contextText}\n\n${questionLabel}: ${question}`,
          },
        ],
        responseFormat: 'json',
        temperature: 0.3,
        maxTokens: 3000,
      });

      // Log token usage
      await logTokenUsage(tenderId, 'smart_chat', {
        input: result.inputTokens ?? 0,
        output: result.outputTokens ?? 0,
        total: result.totalTokens ?? 0,
      });

      // Validate response through trust shield
      const providedChunks = context.sources
        .filter((s) => s.type === 'document')
        .map((s) => s.content);
      console.log('[Chat] AI raw response type:', typeof result.content, 'length:', result.content?.length, 'first 200:', String(result.content).slice(0, 200));
      const trustedResponse = validateResponse(result.content, providedChunks);
      console.log('[Chat] Trust shield result — confidence:', trustedResponse.confidence, 'sources:', trustedResponse.sources.length, 'answer length:', trustedResponse.answer.length);

      // Save assistant message with metadata
      await db.chatMessage.create({
        data: {
          tenderId,
          tenantId,
          role: 'assistant',
          content: trustedResponse.answer,
          metadata: trustedResponse as any,
        },
      });

      // Fire-and-forget summary update
      maybeUpdateSummary(tenderId, tenantId).catch(console.error);

      return trustedResponse;
    }),

  /**
   * Get active alerts for a tender.
   */
  getAlerts: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant' });
      return db.tenderAlert.findMany({
        where: {
          tenderId: input.tenderId,
          tenantId: ctx.tenantId,
          dismissed: false,
        },
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
      });
    }),

  /**
   * Dismiss an alert.
   */
  dismissAlert: protectedProcedure
    .input(z.object({ alertId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant' });
      await db.tenderAlert.updateMany({
        where: { id: input.alertId, tenantId: ctx.tenantId },
        data: { dismissed: true },
      });
    }),
});
