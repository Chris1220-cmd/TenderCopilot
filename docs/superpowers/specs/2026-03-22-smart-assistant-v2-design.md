# Smart Assistant v2 — Design Spec

**Date:** 2026-03-22
**Status:** Draft
**Author:** Claude + Christos

## Problem

The AI assistant has 5 limitations. After analysis, 3 are worth fixing now:

1. **6-message history** — loses context in long conversations
2. **Greek-only** — hardcoded, blocks EU expansion
3. **No streaming** — user waits 10-15s with no feedback

## Decisions Made

| Decision | Choice | Why |
|----------|--------|-----|
| History approach | Smart summarization | Infinite memory, low token cost |
| i18n approach | Full i18n — install next-intl + App Router middleware | EU expansion planned |
| Streaming approach | Next.js Route Handler + ReadableStream | Simple, Vercel-native, reliable |
| Deferred: ESIDIS API | No public API exists | KIMDIS already integrated |
| Deferred: Fine-tuning | Not supported on Claude | RAG + knowledge base works well |

---

## Feature 1: Streaming Responses

### Architecture

```
Frontend (fetch + ReadableStream)
  → POST /api/chat/stream
    → buildContext() (existing)
    → claude.completeStream() (new)
    → SSE chunks → frontend
    → on complete: Trust Shield validation + DB save
```

### Backend Changes

**New file: `src/app/api/chat/stream/route.ts`**
- `export const runtime = 'nodejs';` and `export const maxDuration = 60;`
- POST handler with explicit auth check:
  ```typescript
  // Auth: uses next-auth v5 — same pattern as tRPC context
  import { auth } from '@/lib/auth';
  const session = await auth();
  if (!session?.user) return new Response('Unauthorized', { status: 401 });
  const tenantId = session.user.tenantId;
  if (!tenantId) return new Response('No tenant', { status: 400 });
  ```
- Extract shared auth logic into `src/server/auth-helpers.ts` → `getAuthenticatedContext()` wrapping `auth()` from `@/lib/auth`, reusable by both tRPC and Route Handlers
- Validates input (tenderId, question) with zod
- Token budget check via `checkTokenBudget(tenantId)`
- Calls `buildContext()` for RAG context
- Calls `ai().completeStream()` — new method, returns `ReadableStream`
- Pipes stream through `TransformStream` that emits SSE events: `data: {"type":"token","text":"..."}\n\n`
- On stream end: runs `validateResponse()` (Trust Shield)
- Saves both user + assistant messages to DB
- Logs token usage
- Error events: `data: {"type":"error","message":"..."}\n\n`
- Final event: `data: {"type":"done","metadata":{...}}\n\n` (confidence, sources, highlights, caveats)

**Note on Vercel:** Hobby plan = 60s maxDuration, Pro = 300s. Streaming keeps the connection alive once first byte is sent. If AI takes >10s to emit first token under load, Vercel may time out on Hobby.

**Modified: `src/server/ai/types.ts`**
```typescript
interface AIStreamResult {
  stream: ReadableStream<Uint8Array>;  // Raw token stream — pipes directly to Response
  getResult: () => Promise<AICompletionResult>;  // Resolves after stream ends with full text + usage
}

interface AIProvider {
  name: string;
  complete(options: AICompletionOptions): Promise<AICompletionResult>;
  completeStream?(options: AICompletionOptions): Promise<AIStreamResult>;
}
```
This returns a `ReadableStream` directly, composing cleanly with `new Response(stream)` in the Route Handler. No callback bridging needed.

**Modified: `src/server/ai/claude-provider.ts`**
- New `completeStream()` method using Anthropic SDK streaming (`stream: true`)
- Uses `fetch` with streaming response body
- Parses SSE events from Anthropic API
- Collects full response for Trust Shield post-validation
- Raw token stream — no JSON stripping during streaming (the existing `complete()` JSON stripping in lines 72-88 only applies to non-streaming path)

**Modified: `src/server/ai/gemini-provider.ts`**
- New `completeStream()` method using Gemini streaming API
- Same interface, different transport

### Frontend Changes

**Modified: `src/components/tender/ai-assistant-panel.tsx`**
- New `useStreamingChat` hook (or inline logic)
- On send: `fetch('/api/chat/stream', { method: 'POST', body })`
- Read response body as `ReadableStream` with `TextDecoderStream`
- Parse SSE lines, accumulate tokens into message state
- Show tokens appearing word-by-word with cursor animation
- On `done` event: update message with full metadata (confidence badge, sources, caveats)
- On error: show error message, fallback to refetch history
- `isTyping` state replaced with `isStreaming` + partial text

### Fallback
- If `completeStream` is not available (provider doesn't support it), fall back to existing `complete()` via tRPC mutation
- Detected at runtime: `if (typeof ai().completeStream === 'function')`

---

## Feature 2: Smart Chat Memory (Summarization)

### Architecture

```
User sends message #11
  → check: messageCount > SUMMARY_THRESHOLD (10)?
  → yes: summarize messages 1-10 → save summary to DB
  → AI call receives: [summary] + [messages 7-11] + [new question]
  → User sends message #21
  → summarize messages 1-20 (using previous summary + messages 11-20)
  → AI call receives: [updated summary] + [messages 17-21] + [new question]
```

### Schema Change

**New Prisma model or field:**
```prisma
model ChatSession {
  id        String   @id @default(cuid())
  tenderId  String
  tenantId  String
  summary   String?  @db.Text  // AI-generated summary of older messages
  // No messageCount field — use `db.chatMessage.count({ where: { tenderId, tenantId } })` to avoid sync bugs
  lastSummarizedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tender    Tender   @relation(fields: [tenderId], references: [id])

  @@unique([tenderId, tenantId])
}
```

### Backend Changes

**New file: `src/server/services/chat-memory.ts`**
```typescript
const SUMMARY_THRESHOLD = 10;      // Summarize every 10 messages
const RECENT_WINDOW = 6;           // Keep last 6 messages verbatim

export async function getSmartHistory(tenderId: string, tenantId: string): Promise<{
  summary: string | null;
  recentMessages: AIMessage[];
}>;

export async function maybeUpdateSummary(tenderId: string, tenantId: string): Promise<void>;
```

- `getSmartHistory`: returns the summary + last N messages
- `maybeUpdateSummary`: if messageCount > threshold since last summary, generate new summary
- Summary prompt: "Summarize this conversation in 200 words, keeping key facts: budget, deadlines, requirements discussed, decisions made, open questions."
- Summary uses a fast/cheap model call (same provider, low maxTokens)
- Summary is **incremental**: new summary = old summary + new messages since last summary

**Modified: `src/server/routers/chat.ts` (or `/api/chat/stream/route.ts`)**
- Replace hardcoded `take: 6` with `getSmartHistory()`
- After saving assistant message, call `maybeUpdateSummary().catch(console.error)` (fire-and-forget with error logging, don't block response)

### Context Assembly

The AI now receives:
```
[system prompt]
[PREVIOUS CONVERSATION SUMMARY: ...]  ← new
[recent message 1]
[recent message 2]
...
[recent message 6]
[CONTEXT: documents + knowledge]
[QUESTION: user's new question]
```

---

## Feature 3: Full i18n (Greek + English)

### Prerequisites — next-intl Setup

**next-intl is NOT currently installed.** The `messages/el.json` and `messages/en.json` files exist but are unused. Required setup:

1. `npm install next-intl`
2. Create `src/i18n/request.ts` — locale detection config
3. Create `src/middleware.ts` — next-intl middleware for locale routing
4. Wrap root layout with `NextIntlClientProvider`
5. Configure `i18n.ts` with supported locales `['el', 'en']`, default `'el'`

### Architecture

```
User locale (from profile/cookie/URL/browser Accept-Language)
  → next-intl middleware detects locale
  → system prompt template selects language
  → AI responds in that language
  → Knowledge base: legal refs stay Greek, explanations follow locale
  → Frontend: next-intl handles all UI strings
```

### Backend Changes

**Modified: `src/server/services/context-builder.ts`**
- `buildContext()` receives `locale: 'el' | 'en'` parameter
- `buildSmartSystemPrompt(intent, locale)` — bilingual templates (this function is in context-builder.ts, line 230)
- English version of system prompt with same rules
- Key instruction: "Respond in {language}. Greek law article numbers and legal terms remain in Greek (e.g., Ν.4412/2016, ΕΣΗΔΗΣ, ΚΗΜΔΗΣ)."
- **Intent classification** (`INTENT_PATTERNS` at line 15-33): add English regex patterns alongside Greek ones, keyed by locale. English users currently always get `'mixed'` intent which degrades context quality.

**Modified: `src/server/services/trust-shield.ts`**
- Validation logic is language-agnostic (checks JSON structure, not text content)
- No changes needed

**Modified: `src/server/services/ai-prompts.ts`**
- `ANALYSIS_RULES` is used for document extraction, NOT chat. Document analysis can stay Greek-only since the tender documents are always Greek.
- No changes needed unless we want English document analysis (not needed now).

**Modified: `src/server/knowledge/*.ts`**
- Knowledge base content stays in Greek (it's Greek law)
- AI instruction handles translation: "The knowledge base is in Greek. Translate relevant information to the user's language, but keep legal references in their original Greek form."

### Frontend Changes

**Modified: `messages/el.json` + `messages/en.json`**
- Add all chat-related strings:
  - Quick questions (translated)
  - Confidence labels (Verified, Inferred, General)
  - Tab labels, placeholders, error messages
  - Source type labels

**Modified: `src/components/tender/ai-assistant-panel.tsx`**
- Use `useTranslations('chat')` from next-intl
- Replace hardcoded Greek strings with `t('key')`
- Quick questions array becomes locale-dependent

### User Language Preference
- Stored in user profile / tenant settings
- Passed to `buildContext()` on every AI call
- Falls back to browser `Accept-Language` header via next-intl middleware

---

## Non-Goals

- ESIDIS live API integration (no public API)
- Model fine-tuning (not supported, RAG works well)
- Multi-language knowledge base content (Greek law stays Greek)
- WebSocket-based streaming (SSE is simpler and sufficient)

## Dependencies

- Anthropic SDK streaming support (available in current API)
- Gemini streaming support (available in current API)
- **next-intl** — must be installed and configured (App Router middleware, provider, locale routing)
- Prisma migration for ChatSession model
- Shared auth helper extraction from tRPC context

## Risks

| Risk | Mitigation |
|------|-----------|
| Streaming fails on Vercel edge | Use Node.js runtime (`export const runtime = 'nodejs'`), not edge. Set `maxDuration = 60`. |
| Vercel timeout before first token | Hobby plan = 60s. If AI is slow under load, first byte may not arrive in time. Pro plan (300s) is safer. |
| Summary quality is poor | Use explicit prompt with required fields. Test with real conversations. |
| i18n strings incomplete | Ship with el/en, add languages incrementally |
| Token cost from summaries | Summary calls: ~2K input + 300 output tokens ≈ $0.01 per summary (claude-sonnet-4-6 pricing). Negligible at scale. |
| next-intl middleware conflicts with existing routing | Test incrementally — add middleware with passthrough first, then enable locale detection |
| Streaming route auth drift from tRPC | Extract shared `getAuthenticatedContext()` utility used by both |
