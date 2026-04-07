/**
 * Streaming Analyze Route — SSE endpoint for tender analysis.
 *
 * Bypasses tRPC to avoid Vercel Hobby 60s timeout on long AI calls.
 * Streams progress events so the client stays informed and the
 * connection remains alive even if the AI call takes a while.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getAuthenticatedContext } from '@/server/auth-helpers';
import { encodeSSEBytes } from '@/server/ai/streaming';
import type { SSEEvent } from '@/server/ai/streaming';

export const runtime = 'nodejs';
export const maxDuration = 60;

const inputSchema = z.object({
  tenderId: z.string(),
  language: z.enum(['el', 'en', 'nl']).default('el'),
});

export async function POST(req: NextRequest) {
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
  const { tenderId, language } = parsed.data;

  // 3. Verify tender belongs to tenant
  const tender = await db.tender.findFirst({
    where: { id: tenderId, tenantId },
  });
  if (!tender) {
    return Response.json({ error: 'Tender not found' }, { status: 404 });
  }

  // 4. Stream progress updates via SSE
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SSEEvent) => {
        controller.enqueue(encodeSSEBytes(event));
      };

      try {
        // Step 1: Check documents
        send({ type: 'token', text: 'Έλεγχος εγγράφων...' });

        const totalDocs = await db.attachedDocument.count({ where: { tenderId } });
        if (totalDocs === 0) {
          send({
            type: 'error',
            message: 'Δεν βρέθηκαν έγγραφα. Ανεβάστε πρώτα τη διακήρυξη.',
          });
          controller.close();
          return;
        }

        // Auto-parse unparsed documents
        const unparsedCount = await db.attachedDocument.count({
          where: { tenderId, parsingStatus: null },
        });
        if (unparsedCount > 0) {
          send({ type: 'token', text: `\nΑνάλυση ${unparsedCount} εγγράφων...` });
          const { readTenderDocuments } = await import(
            '@/server/services/document-reader'
          );
          await readTenderDocuments(tenderId);
        }

        const parsedCount = await db.attachedDocument.count({
          where: { tenderId, parsingStatus: 'success' },
        });
        if (parsedCount === 0) {
          send({
            type: 'error',
            message:
              'Τα έγγραφα δεν περιέχουν αναγνώσιμο κείμενο. Δοκιμάστε να ανεβάσετε searchable PDF.',
          });
          controller.close();
          return;
        }

        // Step 2: Run summarizeTender
        send({ type: 'token', text: '\nAI ανάλυση σε εξέλιξη...' });

        const { aiBidOrchestrator } = await import(
          '@/server/services/ai-bid-orchestrator'
        );
        const result = await aiBidOrchestrator.summarizeTender(tenderId, language);

        send({ type: 'done', metadata: { result } });
      } catch (error: any) {
        console.error('[Analyze API] Error:', error);
        send({
          type: 'error',
          message: error.message || 'Σφάλμα ανάλυσης',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
