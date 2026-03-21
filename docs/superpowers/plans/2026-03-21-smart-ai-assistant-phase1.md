# Smart AI Assistant — Phase 1: Document RAG + Trust Shield

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the AI assistant from a status-only chatbot into a document-aware bid expert that searches tender documents via semantic search, cites sources, and never fabricates information.

**Architecture:** pgvector embeddings in Supabase for semantic document search. Smart chunking pipeline triggered after document extraction. Intelligent context builder assembles relevant chunks + structured data. Trust shield wraps every response with source attribution and confidence levels. Chat history persisted to DB.

**Tech Stack:** Prisma + pgvector, Gemini text-embedding-004, BullMQ, tRPC, React

**Spec:** `docs/superpowers/specs/2026-03-21-smart-ai-assistant-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/server/services/document-chunker.ts` | Split extracted text into overlapping chunks with metadata |
| `src/server/services/embedding-service.ts` | Gemini text-embedding-004 API + pgvector insert/search |
| `src/server/services/document-search.ts` | Semantic search + keyword reranking |
| `src/server/services/context-builder.ts` | Intent classification + context assembly from all sources |
| `src/server/services/trust-shield.ts` | Response validation, confidence labels, source attribution |
| `src/server/routers/chat.ts` | tRPC router for chat persistence + alerts |

### Modified Files

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add DocumentChunk, ChatMessage, TenderAlert models + relations |
| `src/server/services/ai-prompts.ts` | Add smart assistant system prompt with accuracy guardrails |
| `src/server/services/document-reader.ts` | Trigger embedding job after text extraction |
| `src/server/jobs/queues.ts` | Add `embeddingQueue` |
| `src/server/jobs/worker.ts` | Add embedding worker |
| `src/server/routers/ai-roles.ts` | Refactor `askQuestion` to use context builder |
| `src/components/tender/ai-assistant-panel.tsx` | Add source attribution UI, chat persistence |
| `src/server/root.ts` | Register new chat router in appRouter |

---

## Task 1: Database Schema — DocumentChunk, ChatMessage, TenderAlert

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add pgvector extension support to schema**

In `prisma/schema.prisma`, modify the existing `generator` and `datasource` blocks (do NOT replace — add to them):

- Add `previewFeatures = ["postgresqlExtensions"]` to the existing `generator client` block
- Add `extensions = [vector]` to the existing `datasource db` block

The result should look like:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  directUrl  = env("DIRECT_URL")
  extensions = [vector]
}
```

- [ ] **Step 2: Add DocumentChunk model**

Add after `AttachedDocument` model:

```prisma
model DocumentChunk {
  id          String   @id @default(cuid())
  documentId  String
  document    AttachedDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
  tenderId    String
  tender      Tender   @relation(fields: [tenderId], references: [id], onDelete: Cascade)
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])

  chunkIndex  Int
  content     String   @db.Text
  embedding   Unsupported("vector(768)")?
  metadata    Json?    // { page?: number, section?: string, headings?: string[] }
  tokenCount  Int

  createdAt   DateTime @default(now())

  @@index([tenderId, tenantId])
  @@index([documentId])
}
```

- [ ] **Step 3: Add ChatMessage model**

```prisma
model ChatMessage {
  id        String   @id @default(cuid())
  tenderId  String
  tender    Tender   @relation(fields: [tenderId], references: [id], onDelete: Cascade)
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])

  role      String   // 'user' | 'assistant'
  content   String   @db.Text
  metadata  Json?    // { sources, confidence, highlights } for assistant messages

  createdAt DateTime @default(now())

  @@index([tenderId, tenantId, createdAt])
}
```

- [ ] **Step 4: Add TenderAlert model (forward-declared for Phase 2, schema only)**

```prisma
model TenderAlert {
  id        String   @id @default(cuid())
  tenderId  String
  tender    Tender   @relation(fields: [tenderId], references: [id], onDelete: Cascade)
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])

  type      String   // 'missing_doc' | 'deadline' | 'incompatibility' | 'suggestion' | 'clarification_needed'
  severity  String   // 'critical' | 'warning' | 'info'
  title     String
  detail    String   @db.Text
  source    String?

  dismissed  Boolean  @default(false)
  resolvedAt DateTime?

  createdAt DateTime @default(now())

  @@index([tenderId, tenantId, dismissed])
}
```

- [ ] **Step 5: Add relations to Tender model**

In the `Tender` model, add these relation fields:

```prisma
  // Smart AI Assistant
  documentChunks   DocumentChunk[]
  chatMessages     ChatMessage[]
  alerts           TenderAlert[]
```

Also add reverse relations to the `Tenant` model:

```prisma
  // Smart AI Assistant
  documentChunks   DocumentChunk[]
  chatMessages     ChatMessage[]
  tenderAlerts     TenderAlert[]
```

- [ ] **Step 6: Add relation to AttachedDocument model**

In the `AttachedDocument` model, add:

```prisma
  chunks DocumentChunk[]
```

- [ ] **Step 7: Run migration**

Run: `npx prisma migrate dev --name add-smart-ai-assistant-models`

Expected: Migration creates 3 new tables. Prisma Client regenerated.

- [ ] **Step 8: Enable pgvector and create HNSW index**

Run this SQL in Supabase SQL editor (or via a migration SQL file):

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- HNSW index for fast cosine similarity search
-- Will be created after first data is inserted (index on empty table is fine)
CREATE INDEX IF NOT EXISTS idx_document_chunk_embedding
  ON "DocumentChunk"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add DocumentChunk, ChatMessage, TenderAlert schema for smart AI assistant"
```

---

## Task 2: Document Chunker Service

**Files:**
- Create: `src/server/services/document-chunker.ts`

- [ ] **Step 1: Create the chunker service**

```typescript
/**
 * Smart document chunking for RAG pipeline.
 * Splits extracted text into overlapping chunks preserving paragraph boundaries.
 */

export interface DocumentChunkData {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata: {
    page?: number;
    section?: string;
    headings?: string[];
  };
}

/** Rough token count for Greek text (~1 token per 3 chars) */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

/** Extract section headings from text (lines that look like headers) */
function extractHeadings(text: string): string[] {
  const headings: string[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Greek uppercase headers or numbered sections
    if (
      trimmed.length > 5 &&
      trimmed.length < 200 &&
      (
        trimmed === trimmed.toUpperCase() ||
        /^(ΑΡΘΡΟ|ΚΕΦΑΛΑΙΟ|ΠΑΡΑΡΤΗΜΑ|ΜΕΡΟΣ|§|Άρθρο)\s/i.test(trimmed) ||
        /^\d+(\.\d+)*\s+[Α-Ω]/.test(trimmed)
      )
    ) {
      headings.push(trimmed);
    }
  }
  return headings.slice(-3); // Keep last 3 headings for context
}

/**
 * Split text into chunks with overlap.
 * @param text - The full extracted text
 * @param targetTokens - Target tokens per chunk (default 600)
 * @param overlapTokens - Overlap between chunks (default 100)
 */
export function chunkDocument(
  text: string,
  targetTokens: number = 600,
  overlapTokens: number = 100
): DocumentChunkData[] {
  if (!text || text.trim().length === 0) return [];

  const targetChars = targetTokens * 3;
  const overlapChars = overlapTokens * 3;

  // Split into paragraphs
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);

  const chunks: DocumentChunkData[] = [];
  let currentContent = '';
  let chunkIndex = 0;

  for (const para of paragraphs) {
    const wouldExceed = (currentContent + '\n\n' + para).length > targetChars;

    if (wouldExceed && currentContent.length > 0) {
      // Save current chunk
      const content = currentContent.trim();
      chunks.push({
        chunkIndex,
        content,
        tokenCount: estimateTokens(content),
        metadata: {
          headings: extractHeadings(content),
        },
      });
      chunkIndex++;

      // Start new chunk with overlap from end of previous
      const overlapText = currentContent.slice(-overlapChars);
      currentContent = overlapText + '\n\n' + para;
    } else {
      currentContent += (currentContent ? '\n\n' : '') + para;
    }
  }

  // Don't forget the last chunk
  if (currentContent.trim().length > 0) {
    const content = currentContent.trim();
    chunks.push({
      chunkIndex,
      content,
      tokenCount: estimateTokens(content),
      metadata: {
        headings: extractHeadings(content),
      },
    });
  }

  return chunks;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/services/document-chunker.ts
git commit -m "feat: add document chunker with overlap and paragraph-aware splitting"
```

---

## Task 3: Embedding Service

**Files:**
- Create: `src/server/services/embedding-service.ts`

- [ ] **Step 1: Create the embedding service**

```typescript
/**
 * Gemini embedding service + pgvector operations.
 * Handles: text → embedding, batch insert to DB, semantic search.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '@/lib/db';
import { createId } from '@paralleldrive/cuid2';
import type { DocumentChunkData } from './document-chunker';

// ─── LRU Cache for query embeddings ──────────────────────────

const CACHE_MAX = 1000;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const queryCache = new Map<string, { embedding: number[]; ts: number }>();

function getCachedEmbedding(text: string): number[] | null {
  const entry = queryCache.get(text);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.embedding;
  if (entry) queryCache.delete(text);
  return null;
}

function setCachedEmbedding(text: string, embedding: number[]): void {
  if (queryCache.size >= CACHE_MAX) {
    // Delete oldest entry
    const firstKey = queryCache.keys().next().value;
    if (firstKey) queryCache.delete(firstKey);
  }
  queryCache.set(text, { embedding, ts: Date.now() });
}

// ─── Gemini Embedding ────────────────────────────────────────

function getEmbeddingModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY required for embeddings');
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'text-embedding-004' });
}

/**
 * Embed a single text string. Returns 768-dim vector.
 */
export async function embedText(text: string): Promise<number[]> {
  const cached = getCachedEmbedding(text);
  if (cached) return cached;

  const model = getEmbeddingModel();
  const result = await model.embedContent(text);
  const embedding = result.embedding.values;

  setCachedEmbedding(text, embedding);
  return embedding;
}

/**
 * Embed multiple texts in batch. Returns array of 768-dim vectors.
 * Uses Gemini's batchEmbedContents for efficiency (1 API call per 100 texts).
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const model = getEmbeddingModel();
  const results: number[][] = [];

  // Process in batches of 100 (Gemini batch limit)
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100);
    const batchResult = await model.batchEmbedContents({
      requests: batch.map((text) => ({
        content: { role: 'user', parts: [{ text }] },
      })),
    });
    results.push(...batchResult.embeddings.map((e) => e.values));
  }

  return results;
}

// ─── pgvector Operations ─────────────────────────────────────

/**
 * Store document chunks with embeddings in DB.
 * Uses raw SQL because Prisma doesn't support vector type natively.
 */
export async function storeChunksWithEmbeddings(
  documentId: string,
  tenderId: string,
  tenantId: string,
  chunks: DocumentChunkData[],
  embeddings: number[][]
): Promise<void> {
  // Delete existing chunks for this document (re-embedding case)
  await db.documentChunk.deleteMany({ where: { documentId } });

  // Insert chunks with embeddings via raw SQL
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];
    const embeddingStr = `[${embedding.join(',')}]`;

    await db.$executeRaw`
      INSERT INTO "DocumentChunk" (
        "id", "documentId", "tenderId", "tenantId",
        "chunkIndex", "content", "embedding", "metadata", "tokenCount", "createdAt"
      ) VALUES (
        ${createId()},
        ${documentId}, ${tenderId}, ${tenantId},
        ${chunk.chunkIndex}, ${chunk.content},
        ${embeddingStr}::vector,
        ${JSON.stringify(chunk.metadata)}::jsonb,
        ${chunk.tokenCount},
        NOW()
      )
    `;
  }
}

// ─── Semantic Search ─────────────────────────────────────────

export interface SearchResult {
  id: string;
  content: string;
  metadata: any;
  tokenCount: number;
  similarity: number;
  documentId: string;
}

/**
 * Search for relevant document chunks using cosine similarity.
 */
export async function searchDocumentChunks(
  tenderId: string,
  tenantId: string,
  query: string,
  limit: number = 5
): Promise<SearchResult[]> {
  const queryEmbedding = await embedText(query);
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  // Fetch 2x limit for reranking headroom
  const chunks = await db.$queryRaw<SearchResult[]>`
    SELECT
      id, content, metadata, "tokenCount", "documentId",
      1 - (embedding <=> ${embeddingStr}::vector) as similarity
    FROM "DocumentChunk"
    WHERE "tenderId" = ${tenderId} AND "tenantId" = ${tenantId}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${limit * 2}
  `;

  // Keyword reranking: boost chunks containing query terms
  const reranked = rerankByKeywords(chunks, query);
  return reranked.slice(0, limit);
}

/**
 * Hybrid reranking: 0.7 * cosine + 0.3 * keyword overlap.
 */
function rerankByKeywords(chunks: SearchResult[], query: string): SearchResult[] {
  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (queryTerms.length === 0) return chunks;

  return chunks
    .map((chunk) => {
      const contentLower = chunk.content.toLowerCase();
      const matchCount = queryTerms.filter((t) => contentLower.includes(t)).length;
      const keywordScore = matchCount / queryTerms.length;
      const hybridScore = 0.7 * chunk.similarity + 0.3 * keywordScore;
      return { ...chunk, similarity: hybridScore };
    })
    .sort((a, b) => b.similarity - a.similarity);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/services/embedding-service.ts
git commit -m "feat: add embedding service with Gemini text-embedding-004, cache, and pgvector search"
```

---

## Task 4: Embedding Queue + Worker

**Files:**
- Modify: `src/server/jobs/queues.ts`
- Modify: `src/server/jobs/worker.ts`
- Modify: `src/server/services/document-reader.ts`

- [ ] **Step 1: Add embedding queue**

In `src/server/jobs/queues.ts`, add after the existing queue definitions:

```typescript
export const embeddingQueue = createQueue('document-embedding');
```

- [ ] **Step 2: Add embedding worker**

In `src/server/jobs/worker.ts`, add the import and worker after the existing workers:

```typescript
import { chunkDocument } from '@/server/services/document-chunker';
import { embedBatch, storeChunksWithEmbeddings } from '@/server/services/embedding-service';
```

Add worker:

```typescript
const embeddingWorker = new Worker(
  'document-embedding',
  async (job) => {
    const { documentId, tenderId, tenantId, extractedText } = job.data as {
      documentId: string;
      tenderId: string;
      tenantId: string;
      extractedText: string;
    };

    console.log(`[Worker] Embedding document ${documentId} (${extractedText.length} chars)...`);

    // 1. Chunk the text
    const chunks = chunkDocument(extractedText);
    if (chunks.length === 0) {
      console.log(`[Worker] No chunks produced for document ${documentId}`);
      return;
    }

    console.log(`[Worker] Chunked into ${chunks.length} pieces, embedding...`);

    // 2. Embed all chunks
    const embeddings = await embedBatch(chunks.map((c) => c.content));

    // 3. Store in DB with vectors
    await storeChunksWithEmbeddings(documentId, tenderId, tenantId, chunks, embeddings);

    console.log(`[Worker] Document ${documentId} embedded: ${chunks.length} chunks stored`);
  },
  {
    connection,
    concurrency: 1, // Rate-limit embedding API calls
    limiter: { max: 10, duration: 60000 }, // Max 10 jobs per minute
  }
);
```

Add to error handling array:

```typescript
for (const worker of [analysisWorker, complianceWorker, docGenWorker, embeddingWorker]) {
```

- [ ] **Step 3: Trigger embedding after document extraction**

In `src/server/services/document-reader.ts`, find where `extractedText` is saved to the `AttachedDocument` record. After the successful extraction and DB update, add:

```typescript
import { embeddingQueue } from '@/server/jobs/queues';

// After extractedText is saved to AttachedDocument:
// Queue embedding job (non-blocking)
await embeddingQueue.add('embed', {
  documentId: doc.id,
  tenderId: doc.tenderId,
  tenantId: tender.tenantId,
  extractedText: extractedText,
});
```

Find the exact location: after the `db.attachedDocument.update()` call that sets `extractedText`.

- [ ] **Step 4: Commit**

```bash
git add src/server/jobs/queues.ts src/server/jobs/worker.ts src/server/services/document-reader.ts
git commit -m "feat: add embedding pipeline — queue + worker + trigger after extraction"
```

---

## Task 5: Context Builder — Intent Classification + Assembly

**Files:**
- Create: `src/server/services/context-builder.ts`

- [ ] **Step 1: Create context builder**

```typescript
/**
 * Intelligent context builder for the Smart AI Assistant.
 * Classifies question intent, gathers relevant context from multiple sources,
 * and assembles a focused context within token budget.
 */

import { db } from '@/lib/db';
import { searchDocumentChunks, type SearchResult } from './embedding-service';

// ─── Intent Classification ──────────────────────────────────

export type QuestionIntent = 'document_lookup' | 'legal_question' | 'status_check' | 'guidance' | 'mixed';

const INTENT_PATTERNS: Record<Exclude<QuestionIntent, 'mixed'>, RegExp[]> = {
  document_lookup: [
    /εγγυητικ/i, /πιστοποιητικ/i, /ζητ(ά|αν|ούν)/i, /χρειάζ/i,
    /απαιτ/i, /προθεσμ/i, /budget/i, /ποσό/i, /δικαιολογητικ/i,
    /προϋπολογισμ/i, /κριτήρι/i, /βαθμολ/i, /ημερομηνία/i,
  ],
  legal_question: [
    /νόμος/i, /άρθρο/i, /εσπδ/i, /ν\.?\s*4412/i, /κανονισμ/i,
    /νομικ/i, /νομοθεσ/i, /αποκλεισμ/i,
  ],
  status_check: [
    /πόσα/i, /τι μένει/i, /progress/i, /κατάσταση/i, /έτοιμ/i,
    /ολοκληρ/i, /λείπ/i, /ποσοστό/i, /compliance/i,
  ],
  guidance: [
    /πώς/i, /τι πρέπει/i, /βήματ/i, /βοήθ/i, /οδηγ/i,
    /συμβουλ/i, /τι κάν/i, /πώς φτιάχ/i, /τι χρειάζ/i,
  ],
};

export function classifyIntent(question: string): QuestionIntent {
  const scores: Record<string, number> = {};

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    scores[intent] = patterns.filter((p) => p.test(question)).length;
  }

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'mixed';

  // If multiple intents have similar scores, return 'mixed'
  const topIntents = Object.entries(scores).filter(([, s]) => s >= maxScore * 0.7);
  if (topIntents.length > 1) return 'mixed';

  return topIntents[0][0] as QuestionIntent;
}

// ─── Context Assembly ────────────────────────────────────────

export interface AssembledContext {
  systemPrompt: string;
  contextText: string;
  sources: ContextSource[];
  intent: QuestionIntent;
}

export interface ContextSource {
  type: 'document' | 'structured_data' | 'knowledge_base';
  reference: string;
  content: string;
}

/**
 * Build focused context for an AI question.
 */
export async function buildContext(
  tenderId: string,
  tenantId: string,
  question: string
): Promise<AssembledContext> {
  const intent = classifyIntent(question);
  const sources: ContextSource[] = [];
  const contextParts: string[] = [];

  // 1. Always include tender metadata
  const tender = await db.tender.findUnique({
    where: { id: tenderId },
    include: {
      brief: true,
    },
  });

  if (tender) {
    const metaText = [
      `ΤΙΤΛΟΣ: ${tender.title}`,
      tender.referenceNumber ? `ΑΡ. ΔΙΑΚΗΡΥΞΗΣ: ${tender.referenceNumber}` : null,
      tender.contractingAuthority ? `ΑΝΑΘΕΤΟΥΣΑ: ${tender.contractingAuthority}` : null,
      tender.budget ? `ΠΡΟΫΠΟΛΟΓΙΣΜΟΣ: €${tender.budget.toLocaleString('el-GR')}` : null,
      tender.submissionDeadline ? `ΠΡΟΘΕΣΜΙΑ: ${new Date(tender.submissionDeadline).toLocaleDateString('el-GR')}` : null,
      tender.cpvCodes?.length ? `CPV: ${tender.cpvCodes.join(', ')}` : null,
      tender.status ? `ΚΑΤΑΣΤΑΣΗ: ${tender.status}` : null,
      tender.brief?.summaryText ? `\nΠΕΡΙΛΗΨΗ:\n${tender.brief.summaryText}` : null,
    ].filter(Boolean).join('\n');

    contextParts.push(`=== ΣΤΟΙΧΕΙΑ ΔΙΑΓΩΝΙΣΜΟΥ ===\n${metaText}`);
  }

  // 2. Document search (for document_lookup, legal_question, guidance, mixed)
  if (intent !== 'status_check') {
    try {
      const chunks = await searchDocumentChunks(tenderId, tenantId, question, 5);
      if (chunks.length > 0) {
        // Get document names for source attribution
        const docIds = [...new Set(chunks.map((c) => c.documentId))];
        const docs = await db.attachedDocument.findMany({
          where: { id: { in: docIds } },
          select: { id: true, fileName: true },
        });
        const docNameMap = new Map(docs.map((d) => [d.id, d.fileName]));

        const docContext = chunks
          .map((chunk, i) => {
            const docName = docNameMap.get(chunk.documentId) || 'Άγνωστο';
            sources.push({
              type: 'document',
              reference: docName,
              content: chunk.content.slice(0, 200),
            });
            return `--- Απόσπασμα ${i + 1} (${docName}, similarity: ${chunk.similarity.toFixed(2)}) ---\n${chunk.content}`;
          })
          .join('\n\n');

        contextParts.push(`=== ΣΧΕΤΙΚΑ ΑΠΟΣΠΑΣΜΑΤΑ ΕΓΓΡΑΦΩΝ ===\n${docContext}`);
      }
    } catch (err) {
      // Fallback: no embeddings available yet, skip document search
      console.warn('[ContextBuilder] Document search failed, skipping:', err);
    }
  }

  // 3. Structured data (for status_check, mixed)
  if (intent === 'status_check' || intent === 'mixed') {
    const [tasks, requirements] = await Promise.all([
      db.task.findMany({
        where: { tenderId },
        select: { title: true, status: true, priority: true, dueDate: true },
      }),
      db.tenderRequirement.findMany({
        where: { tenderId },
        select: { text: true, category: true, coverageStatus: true, mandatory: true },
      }),
    ]);

    if (tasks.length > 0) {
      const todo = tasks.filter((t) => t.status === 'TODO').length;
      const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
      const done = tasks.filter((t) => t.status === 'DONE').length;
      const overdue = tasks.filter(
        (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE'
      ).length;

      contextParts.push(
        `=== ΚΑΤΑΣΤΑΣΗ ΕΡΓΑΣΙΩΝ ===\nΣύνολο: ${tasks.length} | Εκκρεμή: ${todo} | Σε εξέλιξη: ${inProgress} | Ολοκληρωμένα: ${done} | Εκπρόθεσμα: ${overdue}`
      );
      sources.push({ type: 'structured_data', reference: 'Tasks', content: `${tasks.length} tasks` });
    }

    if (requirements.length > 0) {
      const covered = requirements.filter((r) => r.coverageStatus === 'COVERED').length;
      const gaps = requirements.filter((r) => r.coverageStatus === 'GAP').length;
      const unmapped = requirements.filter((r) => r.coverageStatus === 'UNMAPPED').length;

      contextParts.push(
        `=== ΑΠΑΙΤΗΣΕΙΣ ===\nΣύνολο: ${requirements.length} | Καλυμμένες: ${covered} | Κενά: ${gaps} | Μη αντιστοιχισμένες: ${unmapped}`
      );
      sources.push({ type: 'structured_data', reference: 'Requirements', content: `${requirements.length} requirements` });
    }
  }

  // 4. Build system prompt with accuracy guardrails
  const systemPrompt = buildSmartSystemPrompt(intent);

  return {
    systemPrompt,
    contextText: contextParts.join('\n\n'),
    sources,
    intent,
  };
}

// ─── System Prompt ───────────────────────────────────────────

function buildSmartSystemPrompt(intent: QuestionIntent): string {
  return `Είσαι ο AI Bid Manager του TenderCopilot — ένας έμπειρος σύμβουλος δημοσίων διαγωνισμών με 15 χρόνια εμπειρία σε ελληνικούς διαγωνισμούς (Ν.4412/2016, ΕΣΗΔΗΣ).

ΡΟΛΟΣ:
- Βρίσκεις πληροφορίες μέσα στα έγγραφα του διαγωνισμού
- Καθοδηγείς τον χρήστη βήμα-βήμα για σωστή προσφορά
- Προειδοποιείς για κινδύνους και ελλείψεις
- ΠΟΤΕ δεν εφευρίσκεις πληροφορίες

ΚΑΝΟΝΕΣ ΑΚΡΙΒΕΙΑΣ (ΜΗ ΠΑΡΑΒΙΑΣΙΜΟΙ):
1. ΠΟΤΕ μην επινοείς αριθμούς, ημερομηνίες, ή ποσά.
2. ΠΟΤΕ μην λες "πρέπει" χωρίς πηγή (έγγραφο ή νόμο).
3. ΑΝ η πληροφορία είναι από γενική γνώση → ρητή σήμανση: "Βάσει Ν.4412/2016..." + "έλεγξε τη διακήρυξη".
4. ΑΝ δύο πηγές αντιφάσκουν → ανέφερε ΟΛΕΣ, ΜΗΝ επιλέξεις.
5. ΓΙΑ νομικά/οικονομικά θέματα → "συμβουλευτείτε νομικό/λογιστή".
6. ΑΝ δεν βρίσκεις κάτι στα έγγραφα, πες "Δεν βρήκα αυτή την πληροφορία στα έγγραφα που ανέβασες" + πρότεινε τι να κάνει.

ΜΟΡΦΗ ΑΠΑΝΤΗΣΗΣ (JSON):
{
  "answer": "η απάντησή σου σε φυσική γλώσσα (ελληνικά, σύντομα, σαν meeting)",
  "confidence": "verified | inferred | general",
  "sources": [
    {
      "type": "document | law | knowledge_base",
      "reference": "Διακήρυξη.pdf, §4.2" ή "Ν.4412/2016, Άρθρο 72",
      "quote": "ακριβές απόσπασμα αν υπάρχει"
    }
  ],
  "highlights": [
    { "label": "σύντομο label", "value": "τιμή", "status": "ok | warning | critical" }
  ],
  "caveats": ["προειδοποιήσεις ή περιορισμοί"]
}

CONFIDENCE LEVELS:
- "verified": βρέθηκε αυτολεξεί στο έγγραφο
- "inferred": συμπέρασμα από πολλά στοιχεία — πρόσθεσε "Επιβεβαίωσε στη διακήρυξη"
- "general": από γενική γνώση/νομοθεσία — πρόσθεσε "Έλεγξε τη διακήρυξη, μπορεί να διαφέρει"

Απάντησε σε ελληνικά, σύντομα και περιεκτικά.`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/services/context-builder.ts
git commit -m "feat: add context builder with intent classification and multi-source assembly"
```

---

## Task 6: Trust Shield — Response Validation

**Files:**
- Create: `src/server/services/trust-shield.ts`

- [ ] **Step 1: Create trust shield service**

```typescript
/**
 * Trust Shield — validates AI responses before showing to users.
 * Ensures source attribution, confidence labeling, and anti-hallucination checks.
 */

export interface TrustedResponse {
  answer: string;
  confidence: 'verified' | 'inferred' | 'general';
  sources: Array<{
    type: 'document' | 'law' | 'knowledge_base';
    reference: string;
    quote?: string;
  }>;
  highlights: Array<{
    label: string;
    value: string;
    status: 'ok' | 'warning' | 'critical';
  }>;
  caveats: string[];
}

/**
 * Parse and validate AI response, ensuring it meets trust requirements.
 */
export function validateResponse(
  rawContent: string,
  providedChunks: string[]
): TrustedResponse {
  let parsed: any;

  try {
    parsed = JSON.parse(rawContent);
  } catch {
    // Try to extract JSON from response
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        // Return raw text as unverified answer
        return {
          answer: rawContent,
          confidence: 'general',
          sources: [],
          highlights: [],
          caveats: ['Η απάντηση δεν περιέχει δομημένες πηγές.'],
        };
      }
    } else {
      return {
        answer: rawContent,
        confidence: 'general',
        sources: [],
        highlights: [],
        caveats: ['Η απάντηση δεν περιέχει δομημένες πηγές.'],
      };
    }
  }

  // Ensure required fields
  const response: TrustedResponse = {
    answer: parsed.answer || rawContent,
    confidence: validateConfidenceLevel(parsed.confidence),
    sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
    caveats: Array.isArray(parsed.caveats) ? parsed.caveats : [],
  };

  // Anti-hallucination: if confidence is 'verified' but no document sources, downgrade
  if (response.confidence === 'verified') {
    const hasDocSource = response.sources.some((s) => s.type === 'document');
    if (!hasDocSource) {
      response.confidence = 'inferred';
      response.caveats.push('Δεν βρέθηκε ακριβές απόσπασμα εγγράφου — η βεβαιότητα υποβαθμίστηκε.');
    }
  }

  // Check if quotes exist in the provided chunks
  for (const source of response.sources) {
    if (source.quote && source.type === 'document') {
      const quoteFound = providedChunks.some((chunk) =>
        chunk.toLowerCase().includes(source.quote!.toLowerCase().slice(0, 50))
      );
      if (!quoteFound) {
        // Quote not found in source material — flag it
        source.quote = undefined;
        if (response.confidence === 'verified') {
          response.confidence = 'inferred';
        }
      }
    }
  }

  return response;
}

function validateConfidenceLevel(level: string): 'verified' | 'inferred' | 'general' {
  if (level === 'verified' || level === 'inferred' || level === 'general') {
    return level;
  }
  return 'general';
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/services/trust-shield.ts
git commit -m "feat: add trust shield for AI response validation and source attribution"
```

---

## Task 7: Chat Router — Persistence + Smart Q&A

**Files:**
- Create: `src/server/routers/chat.ts`
- Modify: `src/server/root.ts` (register router in appRouter)

- [ ] **Step 1: Create chat tRPC router**

```typescript
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
        take: 100, // Last 100 messages
      });
    }),

  /**
   * Smart question — searches documents, builds context, validates response.
   */
  askSmart: protectedProcedure
    .input(z.object({
      tenderId: z.string(),
      question: z.string().min(1).max(2000),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant' });
      const { tenderId, question } = input;
      const tenantId = ctx.tenantId;

      // Verify access
      const tender = await db.tender.findFirst({
        where: { id: tenderId, tenantId },
      });
      if (!tender) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found' });

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

      // Build smart context
      const context = await buildContext(tenderId, tenantId, question);

      // Get recent chat history for conversation continuity (last 6 messages)
      const recentHistory = await db.chatMessage.findMany({
        where: { tenderId, tenantId },
        orderBy: { createdAt: 'desc' },
        take: 6,
      });
      const historyMessages = recentHistory
        .reverse()
        .slice(0, -1) // Exclude the message we just saved
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.role === 'assistant' && m.metadata
            ? (m.metadata as any).answer || m.content
            : m.content,
        }));

      // Call AI
      const result = await ai().complete({
        messages: [
          { role: 'system', content: context.systemPrompt },
          ...historyMessages,
          {
            role: 'user',
            content: `CONTEXT:\n${context.contextText}\n\nΕΡΩΤΗΣΗ: ${question}`,
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
      const trustedResponse = validateResponse(result.content, providedChunks);

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
```

- [ ] **Step 2: Register chat router in appRouter**

In `src/server/root.ts`, find the `appRouter` definition. Add:

```typescript
import { chatRouter } from './routers/chat';

// In the appRouter definition, add:
chat: chatRouter,
```

- [ ] **Step 3: Commit**

```bash
git add src/server/routers/chat.ts src/server/root.ts
git commit -m "feat: add chat router with smart Q&A, persistence, trust shield, and alerts"
```

---

## Task 8: Refactor askQuestion to Use Smart Pipeline

**Files:**
- Modify: `src/server/routers/ai-roles.ts`

- [ ] **Step 1: Update askQuestion to delegate to chat router's smart pipeline**

In `src/server/routers/ai-roles.ts`, find the `askQuestion` mutation. Replace its implementation to use the new context builder:

```typescript
import { buildContext } from '@/server/services/context-builder';
import { validateResponse } from '@/server/services/trust-shield';

// In the askQuestion mutation handler, replace the body with:
askQuestion: protectedProcedure
  .input(z.object({
    tenderId: z.string(),
    question: z.string(),
  }))
  .mutation(async ({ input, ctx }) => {
    const { tenderId, question } = input;
    const tenantId = ctx.tenantId;

    // Use new smart context builder
    const context = await buildContext(tenderId, tenantId, question);

    const result = await ai().complete({
      messages: [
        { role: 'system', content: context.systemPrompt },
        { role: 'user', content: `CONTEXT:\n${context.contextText}\n\nΕΡΩΤΗΣΗ: ${question}` },
      ],
      responseFormat: 'json',
      temperature: 0.3,
      maxTokens: 3000,
    });

    await logTokenUsage(tenderId, 'smart_chat', {
      input: result.inputTokens,
      output: result.outputTokens,
      total: result.totalTokens,
    });

    const providedChunks = context.sources
      .filter((s) => s.type === 'document')
      .map((s) => s.content);
    const trusted = validateResponse(result.content, providedChunks);

    return {
      answer: trusted.answer,
      highlights: trusted.highlights,
      confidence: trusted.confidence,
      sources: trusted.sources,
      caveats: trusted.caveats,
    };
  }),
```

- [ ] **Step 2: Commit**

```bash
git add src/server/routers/ai-roles.ts
git commit -m "refactor: askQuestion now uses smart context builder + trust shield"
```

---

## Task 9: Update Chat UI — Sources, Confidence, Persistence

**Files:**
- Modify: `src/components/tender/ai-assistant-panel.tsx`

- [ ] **Step 1: Add source attribution display**

Read the current `ai-assistant-panel.tsx` fully before modifying. The changes needed:

1. **Replace `askMutation`** — switch from `trpc.aiRoles.askQuestion` to `trpc.chat.askSmart`
2. **Load chat history on mount** — use `trpc.chat.getHistory` query
3. **Add confidence badge** to assistant messages
4. **Add expandable sources section** to assistant messages

Key UI additions for each assistant message:

```tsx
{/* Import at top: import { CheckCircle, AlertTriangle, BookOpen, FileText, Scale, Lightbulb } from 'lucide-react'; */}

{/* Confidence Badge */}
{msg.metadata?.confidence && (
  <span className={cn(
    "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium",
    msg.metadata.confidence === 'verified' && "bg-emerald-500/20 text-emerald-300",
    msg.metadata.confidence === 'inferred' && "bg-amber-500/20 text-amber-300",
    msg.metadata.confidence === 'general' && "bg-blue-500/20 text-blue-300",
  )}>
    {msg.metadata.confidence === 'verified' && <><CheckCircle className="w-3 h-3" /> Verified</>}
    {msg.metadata.confidence === 'inferred' && <><AlertTriangle className="w-3 h-3" /> Inferred</>}
    {msg.metadata.confidence === 'general' && <><BookOpen className="w-3 h-3" /> General</>}
  </span>
)}

{/* Expandable Sources */}
{msg.metadata?.sources?.length > 0 && (
  <details className="mt-2">
    <summary className="text-xs text-white/50 cursor-pointer hover:text-white/70">
      Πηγές ({msg.metadata.sources.length})
    </summary>
    <div className="mt-1 space-y-1">
      {msg.metadata.sources.map((source, i) => (
        <div key={i} className="text-xs text-white/40 pl-2 border-l border-white/10 flex items-start gap-1">
          {source.type === 'document' && <FileText className="w-3 h-3 mt-0.5 shrink-0" />}
          {source.type === 'law' && <Scale className="w-3 h-3 mt-0.5 shrink-0" />}
          {source.type === 'knowledge_base' && <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" />}
          <div>
            {source.reference}
            {source.quote && (
              <p className="italic mt-0.5">"{source.quote}"</p>
            )}
          </div>
        </div>
      ))}
    </div>
  </details>
)}

{/* Caveats */}
{msg.metadata?.caveats?.length > 0 && (
  <div className="mt-2 text-xs text-amber-300/60 italic">
    {msg.metadata.caveats.map((c, i) => (
      <p key={i} className="flex items-center gap-1">
        <AlertTriangle className="w-3 h-3 shrink-0" /> {c}
      </p>
    ))}
  </div>
)}
```

- [ ] **Step 2: Wire up chat history loading**

Replace the local `messages` useState with data from `trpc.chat.getHistory`:

```tsx
const historyQuery = trpc.chat.getHistory.useQuery(
  { tenderId },
  { enabled: !!tenderId }
);

// Initialize messages from history
const [localMessages, setLocalMessages] = useState<Message[]>([]);
const messages = [
  ...(historyQuery.data?.map(m => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
    metadata: m.metadata,
    timestamp: new Date(m.createdAt),
  })) || []),
  ...localMessages,
];
```

- [ ] **Step 3: Switch to smart mutation**

```tsx
const askMutation = trpc.chat.askSmart.useMutation({
  onSuccess: (data) => {
    // Remove optimistic message, history query will refetch
    setLocalMessages([]);
    historyQuery.refetch();
  },
});
```

- [ ] **Step 4: Commit**

```bash
git add src/components/tender/ai-assistant-panel.tsx
git commit -m "feat: upgrade chat UI with source attribution, confidence badges, and persistence"
```

---

## Task 10: Integration Test + Build Verification

- [ ] **Step 1: Run Prisma generate to verify schema**

Run: `npx prisma generate`
Expected: Success, no errors

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No type errors in new files

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Test embedding service locally (manual)**

Verify that the Gemini embedding API works:

```typescript
// Quick test in a script or API debug endpoint:
import { embedText } from '@/server/services/embedding-service';
const embedding = await embedText('Τι εγγυητική χρειάζεται;');
console.log('Embedding dimension:', embedding.length); // Should be 768
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: Smart AI Assistant Phase 1 — Document RAG + Trust Shield complete"
```

---

## Summary

Phase 1 delivers:
- **Semantic document search** via pgvector (Gemini embeddings)
- **Smart context building** with intent classification
- **Trust shield** with source attribution and confidence levels
- **Chat persistence** (messages survive page reload)
- **Alert infrastructure** (ready for Phase 2 proactive features)
- **Upgraded UI** with sources, confidence badges, and caveats

After Phase 1, the assistant can:
- Search inside tender documents to answer questions
- Show exactly WHERE it found each answer
- Say "I don't know" instead of fabricating
- Remember conversation history
