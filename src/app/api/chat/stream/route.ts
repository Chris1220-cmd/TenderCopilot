/**
 * Streaming chat Route Handler — SSE endpoint for real-time AI responses.
 * Mirrors the askSmart flow from chat.ts but streams tokens via SSE.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { ai, checkTokenBudget, logTokenUsage } from '@/server/ai/provider';
import { buildContext } from '@/server/services/context-builder';
import { validateResponse } from '@/server/services/trust-shield';
import { getAuthenticatedContext } from '@/server/auth-helpers';
import { encodeSSEBytes } from '@/server/ai/streaming';
import type { SSEEvent } from '@/server/ai/streaming';

export const runtime = 'nodejs';
export const maxDuration = 60;

const inputSchema = z.object({
  tenderId: z.string(),
  question: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Auth
    let authCtx: Awaited<ReturnType<typeof getAuthenticatedContext>>;
    try {
      authCtx = await getAuthenticatedContext();
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg === 'UNAUTHORIZED') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (msg === 'NO_TENANT') {
        return Response.json({ error: 'No tenant' }, { status: 400 });
      }
      return Response.json({ error: 'Auth failed' }, { status: 401 });
    }

    const { tenantId } = authCtx;

    // 2. Validate input
    const body = await req.json();
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { tenderId, question } = parsed.data;

    // 3. Verify tender belongs to tenant
    const tender = await db.tender.findFirst({
      where: { id: tenderId, tenantId },
    });
    if (!tender) {
      return Response.json({ error: 'Tender not found' }, { status: 404 });
    }

    // 4. Token budget check
    const budget = await checkTokenBudget(tenantId);
    if (!budget.allowed) {
      return Response.json(
        {
          answer: 'Έχεις εξαντλήσει το ημερήσιο όριο AI ερωτήσεων. Δοκίμασε αύριο.',
          confidence: 'general',
          sources: [],
          highlights: [],
          caveats: [`Χρήση tokens: ${budget.used}/${budget.limit}`],
        },
        { status: 429 },
      );
    }

    // 5. Save user message
    await db.chatMessage.create({
      data: { tenderId, tenantId, role: 'user', content: question },
    });

    // 6. Build context
    const context = await buildContext(tenderId, tenantId, question);

    // 7. Get recent history (last 6 messages, same as chat.ts)
    const recentHistory = await db.chatMessage.findMany({
      where: { tenderId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });
    let historyMessages = recentHistory
      .reverse()
      .slice(0, -1) // Exclude the message we just saved
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content:
          m.role === 'assistant' && m.metadata
            ? (m.metadata as any).answer || m.content
            : m.content,
      }));
    // Gemini requires first message to be 'user' — drop leading assistant messages
    while (historyMessages.length > 0 && historyMessages[0].role === 'assistant') {
      historyMessages.shift();
    }

    const messages = [
      { role: 'system' as const, content: context.systemPrompt },
      ...historyMessages,
      {
        role: 'user' as const,
        content: `CONTEXT:\n${context.contextText}\n\nΕΡΩΤΗΣΗ: ${question}`,
      },
    ];

    const completionOptions = {
      messages,
      responseFormat: 'json' as const,
      temperature: 0.3,
      maxTokens: 3000,
    };

    const provider = ai();

    // 8. If provider supports streaming → stream SSE tokens
    if (provider.completeStream) {
      const { stream: aiStream, getResult } = await provider.completeStream(completionOptions);

      const providedChunks = context.sources
        .filter((s) => s.type === 'document')
        .map((s) => s.content);

      const responseStream = new ReadableStream({
        async start(controller) {
          const reader = aiStream.getReader();
          const decoder = new TextDecoder();
          let fullText = '';

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              fullText += chunk;

              // Send token event
              const tokenEvent: SSEEvent = { type: 'token', text: chunk };
              controller.enqueue(encodeSSEBytes(tokenEvent));
            }

            // Stream complete — validate, save, send done
            const result = await getResult();

            // Log token usage
            await logTokenUsage(tenderId, 'smart_chat', {
              input: result.inputTokens ?? 0,
              output: result.outputTokens ?? 0,
              total: result.totalTokens ?? 0,
            });

            // Trust Shield validation
            const trustedResponse = validateResponse(fullText, providedChunks);

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

            // Send done event with metadata
            const doneEvent: SSEEvent = {
              type: 'done',
              metadata: {
                confidence: trustedResponse.confidence,
                sources: trustedResponse.sources,
                highlights: trustedResponse.highlights,
                caveats: trustedResponse.caveats,
                tokensUsed: result.totalTokens ?? 0,
              },
            };
            controller.enqueue(encodeSSEBytes(doneEvent));
          } catch (err: any) {
            console.error('[Chat Stream] Error during streaming:', err);
            const errorEvent: SSEEvent = {
              type: 'error',
              message: err?.message || 'Streaming failed',
            };
            controller.enqueue(encodeSSEBytes(errorEvent));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(responseStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // 9. No streaming support → fallback to complete(), return JSON
    const result = await provider.complete(completionOptions);

    await logTokenUsage(tenderId, 'smart_chat', {
      input: result.inputTokens ?? 0,
      output: result.outputTokens ?? 0,
      total: result.totalTokens ?? 0,
    });

    const providedChunks = context.sources
      .filter((s) => s.type === 'document')
      .map((s) => s.content);
    const trustedResponse = validateResponse(result.content, providedChunks);

    await db.chatMessage.create({
      data: {
        tenderId,
        tenantId,
        role: 'assistant',
        content: trustedResponse.answer,
        metadata: trustedResponse as any,
      },
    });

    return Response.json(trustedResponse);
  } catch (err: any) {
    console.error('[Chat Stream] Unhandled error:', err);
    return Response.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
