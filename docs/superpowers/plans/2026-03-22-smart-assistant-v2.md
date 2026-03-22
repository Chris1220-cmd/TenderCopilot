# Smart Assistant v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the AI assistant with streaming responses, smart chat memory (summarization), and full i18n (Greek + English).

**Architecture:** Three independent features layered on the existing chat system. Streaming replaces the tRPC mutation with a Next.js Route Handler + ReadableStream. Smart memory adds conversation summarization to avoid the 6-message window limit. i18n adds next-intl with locale-aware system prompts.

**Tech Stack:** Next.js 15 App Router, Anthropic Claude API (streaming), Google Gemini API (streaming), Prisma, next-intl, vitest

**Spec:** `docs/superpowers/specs/2026-03-22-smart-assistant-v2-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/server/auth-helpers.ts` | Shared auth context extraction (used by tRPC + Route Handlers) |
| `src/server/ai/streaming.ts` | Streaming types + SSE encoding utilities |
| `src/app/api/chat/stream/route.ts` | Streaming chat Route Handler |
| `src/server/services/chat-memory.ts` | Smart summarization logic |
| `src/server/services/__tests__/chat-memory.test.ts` | Tests for summarization |
| `src/server/services/__tests__/streaming.test.ts` | Tests for SSE encoding |
| `src/i18n/request.ts` | next-intl locale config |
| `src/i18n/routing.ts` | next-intl routing config |
| `src/middleware.ts` | next-intl middleware for locale detection |

### Modified Files
| File | Changes |
|------|---------|
| `src/server/ai/types.ts` | Add `AIStreamResult` interface, optional `completeStream` on `AIProvider` |
| `src/server/ai/claude-provider.ts` | Add `completeStream()` method |
| `src/server/ai/gemini-provider.ts` | Add `completeStream()` method |
| `next.config.mjs` (or `.js`) | Add next-intl plugin wrapper |
| `src/app/layout.tsx` | Dynamic `lang` attribute from locale |
| `src/server/services/context-builder.ts` | Add `locale` param, bilingual system prompts, English intent patterns |
| `src/components/tender/ai-assistant-panel.tsx` | Streaming reader, i18n strings |
| `prisma/schema.prisma` | Add `ChatSession` model |
| `messages/el.json` | Add chat namespace strings |
| `messages/en.json` | Add chat namespace strings |
| `package.json` | Add `next-intl` dependency |

---

## Task 1: Shared Auth Helper

**Files:**
- Create: `src/server/auth-helpers.ts`

Note: tRPC stays as-is. This helper is only for Route Handlers.

- [ ] **Step 1: Create auth helper**

```typescript
// src/server/auth-helpers.ts
import { auth } from '@/lib/auth';

export interface AuthenticatedContext {
  userId: string;
  tenantId: string;
  session: Awaited<ReturnType<typeof auth>>;
}

/**
 * Extract authenticated user context. Reusable by Route Handlers.
 * Throws if not authenticated or no tenant.
 */
export async function getAuthenticatedContext(): Promise<AuthenticatedContext> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('UNAUTHORIZED');
  }
  const tenantId = session.user.tenantId;
  if (!tenantId) {
    throw new Error('NO_TENANT');
  }
  return { userId: session.user.id, tenantId, session };
}
```

- [ ] **Step 2: Verify the app still works**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/auth-helpers.ts
git commit -m "feat: add shared auth helper for Route Handlers"
```

---

## Task 2: Streaming Types & SSE Utilities

**Files:**
- Modify: `src/server/ai/types.ts`
- Create: `src/server/ai/streaming.ts`
- Create: `src/server/services/__tests__/streaming.test.ts`

- [ ] **Step 1: Write test for SSE encoding**

```typescript
// src/server/services/__tests__/streaming.test.ts
import { describe, it, expect } from 'vitest';
import { encodeSSE } from '@/server/ai/streaming';

describe('encodeSSE', () => {
  it('encodes a token event', () => {
    const result = encodeSSE({ type: 'token', text: 'hello' });
    expect(result).toBe('data: {"type":"token","text":"hello"}\n\n');
  });

  it('encodes a done event with metadata', () => {
    const meta = { confidence: 'verified', sources: [], highlights: [], caveats: [] };
    const result = encodeSSE({ type: 'done', metadata: meta });
    expect(result).toContain('"type":"done"');
    expect(result).toContain('"confidence":"verified"');
    expect(result).endsWith('\n\n');
  });

  it('encodes an error event', () => {
    const result = encodeSSE({ type: 'error', message: 'timeout' });
    expect(result).toBe('data: {"type":"error","message":"timeout"}\n\n');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/services/__tests__/streaming.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Add streaming types to types.ts**

Add to `src/server/ai/types.ts`:

```typescript
export interface AIStreamResult {
  stream: ReadableStream<Uint8Array>;
  getResult: () => Promise<AICompletionResult>;
}
```

Add optional method to `AIProvider`:

```typescript
export interface AIProvider {
  name: string;
  complete(options: AICompletionOptions): Promise<AICompletionResult>;
  completeStream?(options: AICompletionOptions): Promise<AIStreamResult>;
}
```

- [ ] **Step 4: Create SSE utility**

```typescript
// src/server/ai/streaming.ts
export type SSEEvent =
  | { type: 'token'; text: string }
  | { type: 'done'; metadata: Record<string, unknown> }
  | { type: 'error'; message: string };

export function encodeSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

const encoder = new TextEncoder();

export function encodeSSEBytes(event: SSEEvent): Uint8Array {
  return encoder.encode(encodeSSE(event));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/server/services/__tests__/streaming.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/server/ai/types.ts src/server/ai/streaming.ts src/server/services/__tests__/streaming.test.ts
git commit -m "feat: add streaming types and SSE encoding utilities"
```

---

## Task 3: Claude Streaming Provider

**Files:**
- Modify: `src/server/ai/claude-provider.ts`

- [ ] **Step 1: Add `completeStream()` method to ClaudeProvider**

Add after the existing `complete()` method:

```typescript
async completeStream(options: AICompletionOptions): Promise<AIStreamResult> {
  const systemMessage = options.messages.find((m) => m.role === 'system');
  const nonSystemMessages = options.messages.filter((m) => m.role !== 'system');

  const body: Record<string, unknown> = {
    model: this.model,
    max_tokens: options.maxTokens || 4096,
    stream: true,
    messages: nonSystemMessages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  };

  if (systemMessage) {
    body.system = systemMessage.content;
  }
  if (options.temperature !== undefined) {
    body.temperature = options.temperature;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(55_000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} — ${errorText.slice(0, 200)}`);
  }

  let fullText = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let resultResolve: (value: AICompletionResult) => void;
  const resultPromise = new Promise<AICompletionResult>((resolve) => {
    resultResolve = resolve;
  });

  const anthropicStream = response.body!;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const modelName = this.model; // capture for use in closure

  // Line buffer for cross-chunk SSE parsing (chunks may split mid-line)
  let lineBuffer = '';

  const transformStream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      lineBuffer += decoder.decode(chunk, { stream: true });
      const lines = lineBuffer.split('\n');
      // Keep the last incomplete line in the buffer
      lineBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data) continue;

        try {
          const event = JSON.parse(data);

          if (event.type === 'content_block_delta' && event.delta?.text) {
            fullText += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }

          if (event.type === 'message_start' && event.message?.usage) {
            inputTokens = event.message.usage.input_tokens || 0;
          }

          if (event.type === 'message_delta' && event.usage) {
            outputTokens = event.usage.output_tokens || 0;
          }

          if (event.type === 'message_stop') {
            resultResolve!({
              content: fullText,
              inputTokens,
              outputTokens,
              totalTokens: inputTokens + outputTokens,
              model: modelName,
              usage: { inputTokens, outputTokens },
            });
          }
        } catch { /* skip malformed SSE lines */ }
      }
    },
  });

  const stream = anthropicStream.pipeThrough(transformStream);

  return {
    stream,
    getResult: () => resultPromise,
  };
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/ai/claude-provider.ts
git commit -m "feat: add streaming support to Claude provider"
```

---

## Task 4: Gemini Streaming Provider

**Files:**
- Modify: `src/server/ai/gemini-provider.ts`

- [ ] **Step 1: Add `completeStream()` method to GeminiProvider**

Add after the existing `complete()` method:

```typescript
async completeStream(options: AICompletionOptions): Promise<AIStreamResult> {
  const systemMessage = options.messages.find((m) => m.role === 'system');
  const nonSystemMessages = options.messages.filter((m) => m.role !== 'system');

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: options.maxTokens || 8192,
    temperature: options.temperature,
  };

  if (options.responseFormat === 'json') {
    generationConfig.responseMimeType = 'application/json';
  }

  const generativeModel = this.client.getGenerativeModel({
    model: this.model,
    systemInstruction: systemMessage?.content || undefined,
    generationConfig,
  });

  const history = nonSystemMessages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: [{ text: m.content }],
  }));

  const lastMessage = nonSystemMessages[nonSystemMessages.length - 1];
  if (!lastMessage) throw new Error('At least one user message is required');

  const chat = generativeModel.startChat({ history });
  const streamResult = await chat.sendMessageStream(lastMessage.content);

  let fullText = '';
  const encoder = new TextEncoder();
  let resultResolve: (value: AICompletionResult) => void;
  const resultPromise = new Promise<AICompletionResult>((resolve) => {
    resultResolve = resolve;
  });

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamResult.stream) {
          const text = chunk.text();
          if (text) {
            fullText += text;
            controller.enqueue(encoder.encode(text));
          }
        }

        const response = await streamResult.response;
        const usage = response.usageMetadata;
        const inputTokens = usage?.promptTokenCount || 0;
        const outputTokens = usage?.candidatesTokenCount || 0;

        resultResolve!({
          content: fullText,
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          model: this.model,
          usage: { inputTokens, outputTokens },
        });

        controller.close();
      } catch (err: any) {
        controller.error(err);
        resultResolve!({
          content: fullText,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          model: this.model,
          usage: { inputTokens: 0, outputTokens: 0 },
        });
      }
    },
  });

  return {
    stream: readable,
    getResult: () => resultPromise,
  };
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/ai/gemini-provider.ts
git commit -m "feat: add streaming support to Gemini provider"
```

---

## Task 5: Streaming Route Handler

**Files:**
- Create: `src/app/api/chat/stream/route.ts`

- [ ] **Step 1: Create the streaming endpoint**

```typescript
// src/app/api/chat/stream/route.ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedContext } from '@/server/auth-helpers';
import { db } from '@/lib/db';
import { ai, checkTokenBudget, logTokenUsage } from '@/server/ai/provider';
import { buildContext } from '@/server/services/context-builder';
import { validateResponse } from '@/server/services/trust-shield';
import { encodeSSEBytes } from '@/server/ai/streaming';
import type { SSEEvent } from '@/server/ai/streaming';

export const runtime = 'nodejs';
export const maxDuration = 60;

const inputSchema = z.object({
  tenderId: z.string(),
  question: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest) {
  // Auth
  let authCtx;
  try {
    authCtx = await getAuthenticatedContext();
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }
  const { userId, tenantId } = authCtx;

  // Parse input
  let input;
  try {
    input = inputSchema.parse(await req.json());
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  const { tenderId, question } = input;

  // Verify tender belongs to tenant
  const tender = await db.tender.findFirst({
    where: { id: tenderId, tenantId },
  });
  if (!tender) {
    return new Response('Tender not found', { status: 404 });
  }

  // Token budget
  const budget = await checkTokenBudget(tenantId);
  if (!budget.allowed) {
    return new Response(
      JSON.stringify({ type: 'error', message: 'Ημερήσιο όριο AI εξαντλήθηκε' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Save user message
  await db.chatMessage.create({
    data: { tenderId, tenantId, role: 'user', content: question },
  });

  // Build context
  const context = await buildContext(tenderId, tenantId, question);

  // Get smart history (Task 7 will replace this with getSmartHistory)
  const recentHistory = await db.chatMessage.findMany({
    where: { tenderId, tenantId },
    orderBy: { createdAt: 'desc' },
    take: 6,
  });
  let historyMessages = recentHistory
    .reverse()
    .slice(0, -1)
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.role === 'assistant' && m.metadata
        ? (m.metadata as any).answer || m.content
        : m.content,
    }));
  while (historyMessages.length > 0 && historyMessages[0].role === 'assistant') {
    historyMessages.shift();
  }

  const messages = [
    { role: 'system' as const, content: context.systemPrompt },
    ...historyMessages,
    { role: 'user' as const, content: `CONTEXT:\n${context.contextText}\n\nΕΡΩΤΗΣΗ: ${question}` },
  ];

  // Check if streaming is available
  const provider = ai();
  if (!provider.completeStream) {
    // Fallback to non-streaming
    const result = await provider.complete({ messages, temperature: 0.3, maxTokens: 3000 });
    const providedChunks = context.sources.filter((s) => s.type === 'document').map((s) => s.content);
    const trusted = validateResponse(result.content, providedChunks);
    await db.chatMessage.create({
      data: { tenderId, tenantId, role: 'assistant', content: trusted.answer, metadata: trusted as any },
    });
    await logTokenUsage(tenderId, 'smart_chat', {
      input: result.inputTokens ?? 0,
      output: result.outputTokens ?? 0,
      total: result.totalTokens ?? 0,
    });
    return new Response(JSON.stringify(trusted), { headers: { 'Content-Type': 'application/json' } });
  }

  // Streaming response
  const { stream: tokenStream, getResult } = await provider.completeStream({
    messages,
    temperature: 0.3,
    maxTokens: 3000,
  });

  const encoder = new TextEncoder();
  let fullText = '';

  const sseStream = new ReadableStream({
    async start(controller) {
      const reader = tokenStream.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          fullText += text;
          controller.enqueue(encodeSSEBytes({ type: 'token', text }));
        }

        // Stream complete — validate and save
        const result = await getResult();
        const providedChunks = context.sources.filter((s) => s.type === 'document').map((s) => s.content);
        const trusted = validateResponse(fullText, providedChunks);

        await db.chatMessage.create({
          data: { tenderId, tenantId, role: 'assistant', content: trusted.answer, metadata: trusted as any },
        });

        await logTokenUsage(tenderId, 'smart_chat', {
          input: result.inputTokens ?? 0,
          output: result.outputTokens ?? 0,
          total: result.totalTokens ?? 0,
        });

        controller.enqueue(encodeSSEBytes({ type: 'done', metadata: trusted as any }));
        controller.close();
      } catch (err: any) {
        controller.enqueue(encodeSSEBytes({ type: 'error', message: err?.message || 'Streaming error' }));
        controller.close();
      }
    },
  });

  return new Response(sseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/chat/stream/route.ts
git commit -m "feat: add streaming chat Route Handler with SSE"
```

---

## Task 6: Frontend Streaming

**Files:**
- Modify: `src/components/tender/ai-assistant-panel.tsx`

- [ ] **Step 1: Add streaming fetch logic**

Replace the `askMutation` usage with streaming. Add this helper inside the component or as a separate function:

```typescript
async function streamChat(
  tenderId: string,
  question: string,
  onToken: (text: string) => void,
  onDone: (metadata: any) => void,
  onError: (error: string) => void,
) {
  const res = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenderId, question }),
  });

  if (!res.ok) {
    const text = await res.text();
    onError(text || `Error ${res.status}`);
    return;
  }

  if (!res.body) { onError('Streaming not supported'); return; }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const event = JSON.parse(line.slice(6));
        if (event.type === 'token') onToken(event.text);
        else if (event.type === 'done') onDone(event.metadata);
        else if (event.type === 'error') onError(event.message);
      } catch { /* skip */ }
    }
  }
}
```

- [ ] **Step 2: Update handleSend to use streaming**

Replace the current `handleSend` function. Key changes:
- Add `streamingText` state: `const [streamingText, setStreamingText] = useState('');`
- On send: create optimistic user message, call `streamChat()`
- `onToken`: append to `streamingText`
- `onDone`: clear streaming text, refetch history (DB now has the persisted messages)
- `onError`: show error message
- Show `streamingText` in a temporary assistant message bubble while streaming
- Replace the shimmer loading indicator with the actual streaming text + blinking cursor

- [ ] **Step 3: Add blinking cursor CSS**

Add to the streaming message bubble:
```tsx
{isStreaming && (
  <span className="inline-block w-1.5 h-4 bg-blue-500/70 animate-pulse ml-0.5 rounded-sm" />
)}
```

- [ ] **Step 4: Test manually**

Run: `npm run dev`
- Open a tender, open AI assistant
- Ask a question
- Expected: text appears word-by-word with blinking cursor
- After completion: confidence badge, sources, caveats appear
- Verify DB has both messages persisted

- [ ] **Step 5: Commit**

```bash
git add src/components/tender/ai-assistant-panel.tsx
git commit -m "feat: streaming chat UI with real-time token display"
```

---

## Task 7: ChatSession Schema + Smart Memory

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/server/services/chat-memory.ts`
- Create: `src/server/services/__tests__/chat-memory.test.ts`

- [ ] **Step 1: Add ChatSession model to Prisma schema**

Add to `prisma/schema.prisma` after the ChatMessage model:

```prisma
model ChatSession {
  id                 String    @id @default(cuid())
  tenderId           String
  tender             Tender    @relation(fields: [tenderId], references: [id], onDelete: Cascade)
  tenantId           String
  tenant             Tenant    @relation(fields: [tenantId], references: [id])
  summary            String?   @db.Text
  lastSummarizedAt   DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  @@unique([tenderId, tenantId])
  @@index([tenantId])
}
```

Also add the reverse relation fields:
- In the `Tender` model (around line 303 in schema.prisma), add: `chatSessions ChatSession[]`
- In the `Tenant` model (around line 38 in schema.prisma), add: `chatSessions ChatSession[]`

Without these, `prisma migrate` will fail.

- [ ] **Step 2: Run migration**

Run: `npx prisma migrate dev --name add-chat-session`
Expected: Migration succeeds, `ChatSession` table created.

- [ ] **Step 3: Write test for chat memory**

```typescript
// src/server/services/__tests__/chat-memory.test.ts
import { describe, it, expect, vi } from 'vitest';
import { shouldSummarize, buildSummaryPrompt } from '@/server/services/chat-memory';

describe('chat-memory', () => {
  describe('shouldSummarize', () => {
    it('returns false when messageCount < threshold', () => {
      expect(shouldSummarize(5, null)).toBe(false);
      expect(shouldSummarize(9, null)).toBe(false);
    });

    it('returns true when messageCount >= threshold and no prior summary', () => {
      expect(shouldSummarize(10, null)).toBe(true);
      expect(shouldSummarize(15, null)).toBe(true);
    });

    it('returns true when 10+ new messages since last summary', () => {
      const lastSummarized = new Date('2026-03-22T10:00:00Z');
      expect(shouldSummarize(20, lastSummarized, 10)).toBe(true);
    });

    it('returns false when fewer than 10 new messages since last summary', () => {
      const lastSummarized = new Date('2026-03-22T10:00:00Z');
      expect(shouldSummarize(14, lastSummarized, 5)).toBe(false);
    });
  });

  describe('buildSummaryPrompt', () => {
    it('includes previous summary when provided', () => {
      const prompt = buildSummaryPrompt('Previous summary here', [
        { role: 'user', content: 'What is the budget?' },
        { role: 'assistant', content: 'The budget is €500,000.' },
      ]);
      expect(prompt).toContain('Previous summary here');
      expect(prompt).toContain('What is the budget?');
    });

    it('works without previous summary', () => {
      const prompt = buildSummaryPrompt(null, [
        { role: 'user', content: 'Hello' },
      ]);
      expect(prompt).not.toContain('PREVIOUS SUMMARY');
      expect(prompt).toContain('Hello');
    });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/server/services/__tests__/chat-memory.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement chat-memory.ts**

```typescript
// src/server/services/chat-memory.ts
import { db } from '@/lib/db';
import { ai } from '@/server/ai/provider';
import type { AIMessage } from '@/server/ai/types';

const SUMMARY_THRESHOLD = 10;
const RECENT_WINDOW = 6;

export function shouldSummarize(
  totalMessages: number,
  lastSummarizedAt: Date | null,
  newMessagesSinceSummary?: number,
): boolean {
  if (totalMessages < SUMMARY_THRESHOLD) return false;
  if (!lastSummarizedAt) return true;
  const newMsgs = newMessagesSinceSummary ?? totalMessages;
  return newMsgs >= SUMMARY_THRESHOLD;
}

export function buildSummaryPrompt(
  previousSummary: string | null,
  messages: Array<{ role: string; content: string }>,
): string {
  let prompt = 'Summarize this conversation in a concise paragraph (max 200 words).\n';
  prompt += 'Keep: key facts (budget, deadlines, requirements), decisions made, open questions.\n';
  prompt += 'Respond in the same language as the conversation.\n\n';

  if (previousSummary) {
    prompt += `PREVIOUS SUMMARY:\n${previousSummary}\n\n`;
    prompt += 'NEW MESSAGES SINCE LAST SUMMARY:\n';
  } else {
    prompt += 'CONVERSATION:\n';
  }

  for (const msg of messages) {
    prompt += `${msg.role.toUpperCase()}: ${msg.content}\n`;
  }

  return prompt;
}

export async function getSmartHistory(
  tenderId: string,
  tenantId: string,
): Promise<{ summary: string | null; recentMessages: AIMessage[] }> {
  // Get or create session
  const session = await db.chatSession.findUnique({
    where: { tenderId_tenantId: { tenderId, tenantId } },
  });

  // Get recent messages
  const recent = await db.chatMessage.findMany({
    where: { tenderId, tenantId },
    orderBy: { createdAt: 'desc' },
    take: RECENT_WINDOW,
  });

  let historyMessages = recent
    .reverse()
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.role === 'assistant' && m.metadata
        ? (m.metadata as any).answer || m.content
        : m.content,
    }));

  // Gemini requires first message to be 'user'
  while (historyMessages.length > 0 && historyMessages[0].role === 'assistant') {
    historyMessages.shift();
  }

  return {
    summary: session?.summary || null,
    recentMessages: historyMessages,
  };
}

export async function maybeUpdateSummary(
  tenderId: string,
  tenantId: string,
): Promise<void> {
  const totalMessages = await db.chatMessage.count({
    where: { tenderId, tenantId },
  });

  const session = await db.chatSession.findUnique({
    where: { tenderId_tenantId: { tenderId, tenantId } },
  });

  // Count messages since last summary
  let newMsgsSinceSummary = totalMessages;
  if (session?.lastSummarizedAt) {
    newMsgsSinceSummary = await db.chatMessage.count({
      where: {
        tenderId,
        tenantId,
        createdAt: { gt: session.lastSummarizedAt },
      },
    });
  }

  if (!shouldSummarize(totalMessages, session?.lastSummarizedAt || null, newMsgsSinceSummary)) {
    return;
  }

  // Get messages to summarize (all messages not in the recent window)
  const allMessages = await db.chatMessage.findMany({
    where: { tenderId, tenantId },
    orderBy: { createdAt: 'asc' },
    select: { role: true, content: true, metadata: true },
  });

  // Only summarize messages outside the recent window
  const toSummarize = allMessages.slice(0, -RECENT_WINDOW);
  if (toSummarize.length === 0) return;

  const msgs = toSummarize.map((m) => ({
    role: m.role,
    content: m.role === 'assistant' && m.metadata
      ? (m.metadata as any).answer || m.content
      : m.content,
  }));

  const summaryPrompt = buildSummaryPrompt(session?.summary || null, msgs);

  const result = await ai().complete({
    messages: [
      { role: 'system', content: 'You are a conversation summarizer. Be concise and factual.' },
      { role: 'user', content: summaryPrompt },
    ],
    maxTokens: 400,
    temperature: 0.2,
  });

  await db.chatSession.upsert({
    where: { tenderId_tenantId: { tenderId, tenantId } },
    create: {
      tenderId,
      tenantId,
      summary: result.content,
      lastSummarizedAt: new Date(),
    },
    update: {
      summary: result.content,
      lastSummarizedAt: new Date(),
    },
  });
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/server/services/__tests__/chat-memory.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma src/server/services/chat-memory.ts src/server/services/__tests__/chat-memory.test.ts
git commit -m "feat: add ChatSession model and smart memory with summarization"
```

---

## Task 8: Integrate Smart Memory into Streaming Route

**Files:**
- Modify: `src/app/api/chat/stream/route.ts`
- Modify: `src/server/routers/chat.ts`

- [ ] **Step 1: Update streaming route to use getSmartHistory**

In `src/app/api/chat/stream/route.ts`, replace the manual `recentHistory` block with:

```typescript
import { getSmartHistory, maybeUpdateSummary } from '@/server/services/chat-memory';

// Replace the recentHistory block with:
const { summary, recentMessages } = await getSmartHistory(tenderId, tenantId);

const messages = [
  { role: 'system' as const, content: context.systemPrompt },
  ...(summary ? [{ role: 'user' as const, content: `PREVIOUS CONVERSATION SUMMARY:\n${summary}` }, { role: 'assistant' as const, content: 'Understood, I have the context from our previous conversation.' }] : []),
  ...recentMessages,
  { role: 'user' as const, content: `CONTEXT:\n${context.contextText}\n\nΕΡΩΤΗΣΗ: ${question}` },
];
```

After saving the assistant message, add:

```typescript
maybeUpdateSummary(tenderId, tenantId).catch(console.error);
```

- [ ] **Step 2: Also update the old tRPC chat.askSmart**

In `src/server/routers/chat.ts`, apply the same changes so both paths use smart memory.

- [ ] **Step 3: Test manually**

Run: `npm run dev`
- Send 12+ messages to a tender chat
- Verify in DB: `ChatSession` record exists with a summary
- Verify: the assistant remembers context from early messages

- [ ] **Step 4: Commit**

```bash
git add src/app/api/chat/stream/route.ts src/server/routers/chat.ts
git commit -m "feat: integrate smart memory into chat routes"
```

---

## Task 9: Install next-intl

**Files:**
- Modify: `package.json`
- Create: `src/i18n/request.ts`
- Create: `src/i18n/routing.ts`
- Create: `src/middleware.ts`
- Modify: `src/app/(dashboard)/layout.tsx` (or root layout)

- [ ] **Step 1: Install next-intl**

Run: `npm install next-intl`

- [ ] **Step 2: Create i18n config files**

```typescript
// src/i18n/routing.ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['el', 'en'],
  defaultLocale: 'el',
  localePrefix: 'never', // IMPORTANT: keep existing URL structure (/tenders/123, NOT /el/tenders/123)
});
```

```typescript
// src/i18n/request.ts
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 3: Create middleware**

```typescript
// src/middleware.ts
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except API routes, static files, _next internals
  matcher: ['/((?!api|_next|images|favicon.ico).*)'],
};
```

**Important:** With `localePrefix: 'never'`, existing URLs stay unchanged (`/tenders/123`, NOT `/el/tenders/123`). Locale is detected from `Accept-Language` header or cookie. No URL restructuring needed.

- [ ] **Step 4: Add next-intl plugin to next.config**

Modify `next.config.mjs` (or `.js`/`.ts` — check which exists):

```javascript
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... existing config
};

export default withNextIntl(nextConfig);
```

Without this, `getMessages()` and `useTranslations()` will fail at runtime.

- [ ] **Step 5: Update root layout lang attribute**

In `src/app/layout.tsx`, make the `lang` attribute dynamic:

```typescript
import { getLocale } from 'next-intl/server';

export default async function RootLayout({ children }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      {/* ... existing content */}
    </html>
  );
}
```

- [ ] **Step 6: Wrap layout with NextIntlClientProvider**

Modify the root or dashboard layout to wrap with the provider. Check which layout is appropriate — likely `src/app/(dashboard)/layout.tsx`:

```typescript
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export default async function DashboardLayout({ children }) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={messages}>
      {/* existing layout content */}
      {children}
    </NextIntlClientProvider>
  );
}
```

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: Build succeeds. The app should work exactly as before (default locale: Greek).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/i18n/ src/middleware.ts src/app/ next.config.*
git commit -m "feat: install and configure next-intl with el/en locales"
```

---

## Task 10: i18n — Chat Strings + Locale-aware System Prompt

**Files:**
- Modify: `messages/el.json`
- Modify: `messages/en.json`
- Modify: `src/server/services/context-builder.ts`
- Modify: `src/components/tender/ai-assistant-panel.tsx`

- [ ] **Step 1: Add chat strings to message files**

Add to `messages/el.json`:
```json
{
  "chat": {
    "title": "AI Βοηθός",
    "subtitle": "Tender Copilot Assistant",
    "tab_chat": "Συνομιλία",
    "tab_actions": "Ενέργειες",
    "tab_reminders": "Υπενθυμίσεις",
    "placeholder": "Γράψτε μια ερώτηση...",
    "welcome": "Ρωτήστε οτιδήποτε για τον διαγωνισμό",
    "welcome_sub": "Χρησιμοποιήστε τα γρήγορα ερωτήματα ή γράψτε δικά σας",
    "quick_q_missing": "Τι λείπει;",
    "quick_q_ready": "Είμαστε έτοιμοι;",
    "quick_q_delayed": "Ποιες εργασίες καθυστερούν;",
    "quick_q_compliance": "Πόσο compliance έχουμε;",
    "quick_questions_label": "Γρήγορα Ερωτήματα",
    "confidence_verified": "Verified",
    "confidence_inferred": "Inferred",
    "confidence_general": "General",
    "sources_label": "Πηγές",
    "no_actions": "Δεν υπάρχουν εκκρεμείς ενέργειες",
    "no_reminders": "Δεν υπάρχουν υπενθυμίσεις",
    "actions_title": "Προτεινόμενες Ενέργειες",
    "reminders_title": "Υπενθυμίσεις & Προθεσμίες",
    "overdue": "Εκπρόθεσμο",
    "days_singular": "ημέρα",
    "days_plural": "ημέρες",
    "in_days": "σε {count} ημέρες",
    "error_generic": "Σφάλμα κατά την επεξεργασία. Δοκιμάστε ξανά.",
    "daily_limit": "Ημερήσιο όριο AI εξαντλήθηκε"
  }
}
```

Add equivalent English to `messages/en.json`:
```json
{
  "chat": {
    "title": "AI Assistant",
    "subtitle": "Tender Copilot Assistant",
    "tab_chat": "Chat",
    "tab_actions": "Actions",
    "tab_reminders": "Reminders",
    "placeholder": "Type a question...",
    "welcome": "Ask anything about this tender",
    "welcome_sub": "Use quick questions or write your own",
    "quick_q_missing": "What's missing?",
    "quick_q_ready": "Are we ready?",
    "quick_q_delayed": "Which tasks are delayed?",
    "quick_q_compliance": "What's our compliance status?",
    "quick_questions_label": "Quick Questions",
    "confidence_verified": "Verified",
    "confidence_inferred": "Inferred",
    "confidence_general": "General",
    "sources_label": "Sources",
    "no_actions": "No pending actions",
    "no_reminders": "No reminders",
    "actions_title": "Suggested Actions",
    "reminders_title": "Reminders & Deadlines",
    "overdue": "Overdue",
    "days_singular": "day",
    "days_plural": "days",
    "in_days": "in {count} days",
    "error_generic": "An error occurred. Please try again.",
    "daily_limit": "Daily AI limit reached"
  }
}
```

- [ ] **Step 2: Add locale param to buildContext and bilingual system prompt**

In `src/server/services/context-builder.ts`:

1. Add `locale` parameter to `buildContext()`:
```typescript
export async function buildContext(
  tenderId: string,
  tenantId: string,
  question: string,
  locale: 'el' | 'en' = 'el',
): Promise<AssembledContext> {
```

2. Pass locale to system prompt: `buildSmartSystemPrompt(intent, locale)`

3. Add English intent patterns alongside Greek:
```typescript
const INTENT_PATTERNS_EN: Record<Exclude<QuestionIntent, 'mixed'>, RegExp[]> = {
  document_lookup: [
    /guarantee/i, /certificate/i, /require/i, /need/i, /document/i,
    /deadline/i, /budget/i, /amount/i, /criteria/i, /score/i, /date/i,
  ],
  legal_question: [
    /law/i, /article/i, /regulation/i, /legal/i, /legislation/i, /exclusion/i,
  ],
  status_check: [
    /how many/i, /what.s left/i, /progress/i, /status/i, /ready/i,
    /complete/i, /missing/i, /percentage/i, /compliance/i,
  ],
  guidance: [
    /how/i, /what should/i, /steps/i, /help/i, /guide/i,
    /advice/i, /what do/i, /how to/i,
  ],
};
```

4. Update `classifyIntent` to check both pattern sets.

5. Create bilingual system prompt:
```typescript
function buildSmartSystemPrompt(_intent: QuestionIntent, locale: 'el' | 'en' = 'el'): string {
  if (locale === 'en') {
    return `You are the AI Bid Manager of TenderCopilot — an experienced public procurement consultant with 15 years of experience in Greek tenders (Law 4412/2016, ESIDIS).

ROLE:
- Find information within the tender documents
- Guide the user step-by-step for a correct bid
- Warn about risks and gaps
- NEVER fabricate information

ACCURACY RULES (NON-NEGOTIABLE):
1. NEVER invent numbers, dates, or amounts.
2. NEVER say "must" without a source (document or law).
3. IF information is from general knowledge → mark explicitly: "Based on Law 4412/2016..." + "verify in the tender documents".
4. IF two sources contradict → mention ALL, do NOT choose.
5. FOR legal/financial matters → "consult a lawyer/accountant".
6. IF you don't find something in the documents, say so and suggest next steps.

NOTE: Greek law references, article numbers, and legal terms remain in Greek (e.g., Ν.4412/2016, ΕΣΗΔΗΣ, ΚΗΜΔΗΣ, ΕΕΕΣ).

RESPONSE FORMAT (JSON):
{
  "answer": "your answer in natural language (English, concise)",
  "confidence": "verified | inferred | general",
  "sources": [...],
  "highlights": [...],
  "caveats": [...]
}

CONFIDENCE LEVELS:
- "verified": found verbatim in the document
- "inferred": conclusion from multiple data points — add "Verify in the tender documents"
- "general": from general knowledge/legislation — add "Check the tender documents, may differ"

Respond in English, concisely.`;
  }

  // Existing Greek prompt (unchanged)
  return `Είσαι ο AI Bid Manager ...`; // keep existing
}
```

- [ ] **Step 3: Update ai-assistant-panel.tsx to use translations**

```typescript
import { useTranslations } from 'next-intl';

// Inside the component:
const t = useTranslations('chat');

// Replace hardcoded strings, e.g.:
// 'Γράψτε μια ερώτηση...' → t('placeholder')
// 'AI Βοηθός' → t('title')
// quickQuestions texts → t('quick_q_missing'), etc.
```

- [ ] **Step 4: Pass locale to buildContext in both routes**

In the streaming route and tRPC chat router, detect locale from session/cookie/header and pass to `buildContext()`. For now, use a simple approach:

```typescript
const locale = (req.headers.get('accept-language')?.startsWith('en') ? 'en' : 'el') as 'el' | 'en';
```

Also update the message template in both routes to be locale-aware:
```typescript
// Replace hardcoded ΕΡΩΤΗΣΗ:
const questionLabel = locale === 'en' ? 'QUESTION' : 'ΕΡΩΤΗΣΗ';
{ role: 'user' as const, content: `CONTEXT:\n${context.contextText}\n\n${questionLabel}: ${question}` },
```

This will be refined later with proper user preference from profile.

- [ ] **Step 5: Test manually**

Run: `npm run dev`
- Default (Greek): everything works as before
- Set browser language to English: UI and AI responses should be in English
- Legal references should remain in Greek even in English mode

- [ ] **Step 6: Commit**

```bash
git add messages/ src/server/services/context-builder.ts src/components/tender/ai-assistant-panel.tsx src/app/api/chat/stream/route.ts src/server/routers/chat.ts
git commit -m "feat: full i18n support — bilingual chat UI and system prompts"
```

---

## Task 11: Final Integration Test & Cleanup

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Manual E2E test checklist**

- [ ] Streaming works — tokens appear word-by-word
- [ ] Trust Shield validates after stream — confidence badge appears
- [ ] Sources and caveats show in expanded section
- [ ] After 12+ messages, summary is generated in ChatSession
- [ ] Assistant references earlier conversation context correctly
- [ ] Greek locale works (default)
- [ ] English locale works (browser language)
- [ ] Fallback to non-streaming works if provider lacks `completeStream`
- [ ] Error handling: disconnect mid-stream → no crash
- [ ] Token budget enforcement still works

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Smart Assistant v2 — streaming, smart memory, i18n"
```
