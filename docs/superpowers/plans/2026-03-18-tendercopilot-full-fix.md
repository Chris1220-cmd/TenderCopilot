# TenderCopilot Full Fix & AI Pipeline Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 83+ bugs and make TenderCopilot work end-to-end with real data — discovery, import, document download, AI analysis, and frontend display — with zero AI fabrication.

**Architecture:** Existing Next.js 14 + tRPC + Prisma + Supabase stack stays. We rebuild the AI analysis pipeline with Greek-first prompts and strict validation, fix the storage layer, upgrade discovery sources, and fix all broken frontend interactions.

**Tech Stack:** Next.js 14, tRPC, Prisma (Supabase PostgreSQL), Supabase Storage (S3-compatible), Anthropic Claude API (claude-sonnet-4-6), React, Tailwind CSS, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-18-tendercopilot-full-fix-design.md`

**Dev Environment:** Must run `eval "$(fnm env)" && fnm use 22 --arch x64` before any dev/build/migration commands (ARM64 Windows + Prisma constraint).

---

## File Map

### Files to Modify
| File | Responsibility | Tasks |
|------|---------------|-------|
| `prisma/schema.prisma` | Database schema | 1, 2 |
| `src/lib/s3.ts` | File storage (Supabase S3) | 3 |
| `src/server/ai/claude-provider.ts` | Claude API client | 4 |
| `src/server/ai/types.ts` | AI type definitions | 4 |
| `src/server/services/document-reader.ts` | PDF/DOCX text extraction | 5 |
| `src/server/services/tender-discovery.ts` | Tender search from sources | 7 |
| `src/server/routers/discovery.ts` | Discovery tRPC endpoints | 7, 8 |
| `src/server/services/ai-bid-orchestrator.ts` | Brief + Go/No-Go AI | 9, 12 |
| `src/server/services/ai-legal-analyzer.ts` | Legal analysis AI | 10 |
| `src/server/services/ai-financial.ts` | Financial analysis AI | 11 |
| `src/server/routers/ai-roles.ts` | AI tRPC endpoints | 9-12 |
| `src/components/tender/status-badge.tsx` | Status/platform badges | 13 |
| `src/components/company/certificates-list.tsx` | Certificate CRUD | 14 |
| `src/components/company/projects-list.tsx` | Project CRUD | 14 |
| `src/components/company/legal-docs-list.tsx` | Legal doc CRUD | 14 |
| `src/components/tender/documents-tab.tsx` | Document upload/display | 15 |
| `src/components/tender/legal-tab.tsx` | Legal analysis display | 16 |
| `src/components/tender/financial-tab.tsx` | Financial analysis display | 17 |
| `src/components/tender/ai-brief-panel.tsx` | Brief display | 18 |
| `src/components/tender/go-no-go-panel.tsx` | Go/No-Go display | 18 |
| `src/components/tender/technical-tab-enhanced.tsx` | Technical analysis display | 18 |
| `src/components/tender/discovery-results.tsx` | Discovery UI | 19 |
| `src/app/(dashboard)/tenders/[id]/page.tsx` | Tender detail page | 20 |
| `src/app/(dashboard)/dashboard/page.tsx` | Dashboard | 21 |
| `src/app/(dashboard)/tenders/page.tsx` | Tender list | 21 |

### Files to Create
| File | Responsibility | Tasks |
|------|---------------|-------|
| `src/server/services/ai-prompts.ts` | Shared AI prompt templates + validation | 6 |
| `src/lib/kad-cpv-map.ts` | Full KAD→CPV mapping data | 7 |
| `src/components/tender/missing-info-panel.tsx` | Missing info aggregation UI | 20B |

---

## PHASE 1: Infrastructure Fixes

### Task 1: Prisma Schema — Platform Enum + Indexes + analysisInProgress

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add DIAVGEIA, TED, KIMDIS to TenderPlatform enum**

In `prisma/schema.prisma`, find the `TenderPlatform` enum (around line 290) and add:

```prisma
enum TenderPlatform {
  ESIDIS
  COSMOONE
  ISUPPLIES
  DIAVGEIA
  TED
  KIMDIS
  OTHER
  PRIVATE
}
```

- [ ] **Step 2: Add analysisInProgress to Tender model**

In the `Tender` model (around line 253), add field and indexes:

```prisma
model Tender {
  // ... existing fields after sourceUrl ...
  analysisInProgress Boolean @default(false)

  // ... existing relations ...

  @@index([tenantId])
  @@index([status])
}
```

- [ ] **Step 3: Add indexes to AttachedDocument and LegalClause**

In `AttachedDocument` model (around line 379), add:
```prisma
  @@index([tenderId])
```

In `LegalClause` model (around line 508), add:
```prisma
  @@index([riskLevel])
```

- [ ] **Step 3B: Make GoNoGoDecision.tenderId unique (required for upsert in Task 12)**

In `GoNoGoDecision` model (around line 483), add `@unique` to `tenderId`:
```prisma
model GoNoGoDecision {
  // ... existing fields ...
  tenderId String @unique   // Changed from just String to @unique
  // ... rest of model ...
}
```

Also update the `Tender` model relation from `goNoGoDecisions GoNoGoDecision[]` to `goNoGoDecision GoNoGoDecision?` (singular, optional).

- [ ] **Step 4: Run migration**

```bash
npx prisma migrate dev --name add_platforms_indexes_analysis_flag
```

Expected: Migration creates successfully, `prisma generate` runs.

- [ ] **Step 5: Verify migration**

```bash
npx prisma db push --dry-run
```

Expected: "All changes already applied" or similar success.

- [ ] **Step 6: Commit**

```bash
git add prisma/ && git commit -m "feat: add DIAVGEIA/TED/KIMDIS platforms, indexes, analysisInProgress flag"
```

---

### Task 2: Prisma Schema — AttachedDocument Parsing Fields

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add parsing fields to AttachedDocument**

In `AttachedDocument` model (around line 379), add after existing fields:

```prisma
model AttachedDocument {
  // ... existing fields ...
  extractedText  String?  @db.Text
  pageCount      Int?
  parsingStatus  String?  // 'success' | 'partial' | 'failed'
  parsingError   String?

  // ... existing relations and index ...
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_document_parsing_fields
```

- [ ] **Step 3: Commit**

```bash
git add prisma/ && git commit -m "feat: add extractedText, parsingStatus to AttachedDocument"
```

---

### Task 3: Fix S3 Storage — Remove In-Memory Fallback, Singleton Client

**Files:**
- Modify: `src/lib/s3.ts`

- [ ] **Step 1: Read current s3.ts**

Read `src/lib/s3.ts` fully to understand current structure.

- [ ] **Step 2: Rewrite s3.ts with singleton client, no memory fallback**

Replace the entire file. Key changes:
- Remove `memoryStore` Map and all in-memory fallback code
- Create a single lazy-initialized Minio client
- Add retry logic (3 attempts, exponential backoff)
- Add file size validation (50MB max)
- Hard fail if no storage configured

```typescript
import { Client as MinioClient } from 'minio';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY;
const S3_BUCKET = process.env.S3_BUCKET || 'tendercopilot';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Singleton client
let _minioClient: MinioClient | null = null;

function getStorageMode(): 'supabase' | 's3' {
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) return 'supabase';
  if (S3_ENDPOINT && S3_ACCESS_KEY && S3_SECRET_KEY) return 's3';
  throw new Error(
    'Storage not configured. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, ' +
    'or S3_ENDPOINT + S3_ACCESS_KEY + S3_SECRET_KEY in .env'
  );
}

function getMinioClient(): MinioClient {
  if (_minioClient) return _minioClient;
  const mode = getStorageMode();
  if (mode === 'supabase') {
    const url = new URL(SUPABASE_URL!);
    _minioClient = new MinioClient({
      endPoint: url.hostname,
      port: 443,
      useSSL: true,
      accessKey: SUPABASE_SERVICE_KEY!,
      secretKey: SUPABASE_SERVICE_KEY!,
    });
  } else {
    const url = new URL(S3_ENDPOINT!);
    _minioClient = new MinioClient({
      endPoint: url.hostname,
      port: url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 9000),
      useSSL: url.protocol === 'https:',
      accessKey: S3_ACCESS_KEY!,
      secretKey: S3_SECRET_KEY!,
    });
  }
  return _minioClient;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 500));
    }
  }
  throw new Error('Unreachable');
}

export async function uploadFile(key: string, buffer: Buffer, contentType?: string): Promise<string> {
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
  }
  const mode = getStorageMode();
  if (mode === 'supabase') {
    return withRetry(async () => {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${S3_BUCKET}/${key}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': contentType || 'application/octet-stream',
          'x-upsert': 'true',
        },
        body: buffer,
      });
      if (!res.ok) throw new Error(`Supabase upload failed: ${res.status} ${await res.text()}`);
      return key;
    });
  }
  // S3/MinIO
  const client = getMinioClient();
  return withRetry(async () => {
    await client.putObject(S3_BUCKET, key, buffer, buffer.length, {
      'Content-Type': contentType || 'application/octet-stream',
    });
    return key;
  });
}

export async function getFileUrl(key: string): Promise<string> {
  const mode = getStorageMode();
  if (mode === 'supabase') {
    return `${SUPABASE_URL}/storage/v1/object/public/${S3_BUCKET}/${key}`;
  }
  const client = getMinioClient();
  return client.presignedGetObject(S3_BUCKET, key, 3600);
}

export async function getFileBuffer(key: string): Promise<Buffer> {
  const mode = getStorageMode();
  if (mode === 'supabase') {
    return withRetry(async () => {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${S3_BUCKET}/${key}`, {
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
      });
      if (!res.ok) throw new Error(`Supabase download failed: ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    });
  }
  const client = getMinioClient();
  return withRetry(async () => {
    const stream = await client.getObject(S3_BUCKET, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  });
}

export async function deleteFile(key: string): Promise<void> {
  const mode = getStorageMode();
  if (mode === 'supabase') {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${S3_BUCKET}/${key}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    });
    return;
  }
  const client = getMinioClient();
  await client.removeObject(S3_BUCKET, key);
}
```

- [ ] **Step 3: Verify build**

```bash
npx next build
```

Expected: Build passes with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/s3.ts && git commit -m "fix: remove in-memory storage fallback, add singleton S3 client with retry"
```

---

### Task 4: Fix Claude Provider — Response Validation

**Files:**
- Modify: `src/server/ai/claude-provider.ts`
- Modify: `src/server/ai/types.ts`

- [ ] **Step 1: Add token tracking to AICompletionResult type**

In `src/server/ai/types.ts`, update `AICompletionResult`:

```typescript
export interface AICompletionResult {
  content: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  model?: string;
}
```

- [ ] **Step 2: Improve JSON extraction in claude-provider.ts**

In `src/server/ai/claude-provider.ts`, replace the markdown fence stripping logic (around lines 62-68) with more robust extraction:

```typescript
// After getting rawText from response...
// Strip markdown code fences if present
let cleaned = rawText;
const jsonMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
if (jsonMatch) {
  cleaned = jsonMatch[1].trim();
}

// Try to extract JSON object/array if wrapped in other text
if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
  const objStart = cleaned.indexOf('{');
  const arrStart = cleaned.indexOf('[');
  const start = objStart >= 0 && arrStart >= 0
    ? Math.min(objStart, arrStart)
    : Math.max(objStart, arrStart);
  if (start >= 0) {
    cleaned = cleaned.slice(start);
  }
}

return {
  content: cleaned,
  inputTokens: data.usage?.input_tokens,
  outputTokens: data.usage?.output_tokens,
  totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
  model: this.model,
};
```

- [ ] **Step 3: Verify build**

```bash
npx next build
```

- [ ] **Step 4: Commit**

```bash
git add src/server/ai/ && git commit -m "fix: improve Claude JSON extraction, add token tracking"
```

---

### Task 5: Fix Document Reader — Remove 30KB Truncation, Store Extracted Text

**Files:**
- Modify: `src/server/services/document-reader.ts`

- [ ] **Step 1: Read current document-reader.ts**

Read `src/server/services/document-reader.ts` fully.

- [ ] **Step 2: Update readTenderDocuments to remove truncation and store extractedText**

Replace `readTenderDocuments` function. Key changes:
- Remove `maxCharsPerDoc = 30000` parameter
- After extracting text, store it in `AttachedDocument.extractedText`
- Set `parsingStatus` and `parsingError`
- Return full text (no truncation)

```typescript
export async function readTenderDocuments(tenderId: string): Promise<string> {
  const docs = await db.attachedDocument.findMany({
    where: { tenderId },
    orderBy: { createdAt: 'asc' },
  });

  if (docs.length === 0) return '';

  const parts: string[] = [];

  for (const doc of docs) {
    try {
      // Use cached extracted text if available
      if (doc.extractedText) {
        parts.push(`--- ${doc.fileName} ---\n${doc.extractedText}`);
        continue;
      }

      const buffer = await getFileBuffer(doc.fileKey);
      if (buffer.length === 0) {
        await db.attachedDocument.update({
          where: { id: doc.id },
          data: { parsingStatus: 'failed', parsingError: 'Κενό αρχείο' },
        });
        continue;
      }

      const text = await extractText(buffer, doc.mimeType || 'application/pdf', doc.fileName);

      if (!text || text.trim().length < 10) {
        await db.attachedDocument.update({
          where: { id: doc.id },
          data: {
            parsingStatus: 'failed',
            parsingError: 'Σκαναρισμένο PDF — δεν εξήχθη κείμενο',
            extractedText: null,
          },
        });
        parts.push(`--- ${doc.fileName} ---\n[Σκαναρισμένο PDF — δεν εξήχθη κείμενο]`);
        continue;
      }

      // Count pages for PDFs
      let pageCount: number | null = null;
      if (doc.mimeType === 'application/pdf') {
        try {
          const pdfParse = (await import('pdf-parse')).default;
          const pdfData = await pdfParse(buffer);
          pageCount = pdfData.numpages;
        } catch { /* ignore page count errors */ }
      }

      // Store extracted text in DB for caching
      await db.attachedDocument.update({
        where: { id: doc.id },
        data: {
          extractedText: text,
          pageCount,
          parsingStatus: 'success',
          parsingError: null,
        },
      });

      parts.push(`--- ${doc.fileName} ---\n${text}`);
    } catch (err) {
      console.error(`[DocumentReader] Failed to process ${doc.fileName}:`, err);
      await db.attachedDocument.update({
        where: { id: doc.id },
        data: {
          parsingStatus: 'failed',
          parsingError: err instanceof Error ? err.message : 'Άγνωστο σφάλμα',
        },
      });
      parts.push(`--- ${doc.fileName} ---\n[Σφάλμα ανάγνωσης: ${err instanceof Error ? err.message : 'Άγνωστο'}]`);
    }
  }

  return parts.join('\n\n');
}
```

- [ ] **Step 3: Verify build**

```bash
npx next build
```

- [ ] **Step 4: Commit**

```bash
git add src/server/services/document-reader.ts && git commit -m "fix: remove 30KB truncation, cache extracted text in DB"
```

---

### Task 6: Create Shared AI Prompt Templates + Validation

**Files:**
- Create: `src/server/services/ai-prompts.ts`

- [ ] **Step 1: Create the shared prompts and validation module**

```typescript
/**
 * Shared AI prompt templates and response validation.
 * Every AI analysis call uses these rules to prevent fabrication.
 */

// ─── Analysis Rules (prepended to every AI prompt) ──────────

export const ANALYSIS_RULES = `
ΚΑΝΟΝΕΣ ΑΝΑΛΥΣΗΣ:
1. Απάντησε ΑΠΟΚΛΕΙΣΤΙΚΑ βάσει του κειμένου που σου δίνεται.
   ΜΗΝ υποθέσεις, ΜΗΝ συμπληρώσεις, ΜΗΝ επινοήσεις πληροφορίες.
2. Αν μια πληροφορία ΔΕΝ υπάρχει στο κείμενο, γράψε: "ΔΕΝ ΑΝΑΦΕΡΕΤΑΙ ΣΤΟ ΕΓΓΡΑΦΟ"
3. Για κάθε πληροφορία που εξάγεις, βαθμολόγησε confidence (0.0-1.0)
4. Απάντησε σε ελληνικά
5. Χρησιμοποίησε ορολογία σύμφωνη με τον Ν.4412/2016
`.trim();

export const NOT_FOUND = 'ΔΕΝ ΑΝΑΦΕΡΕΤΑΙ ΣΤΟ ΕΓΓΡΑΦΟ';

// ─── Token Limits ───────────────────────────────────────────

/** Max chars to send in a single AI call (~100K tokens for Greek text) */
export const MAX_CHARS_PER_CALL = 150_000;

/** If text exceeds this, we need to chunk */
export function shouldChunk(text: string): boolean {
  return text.length > MAX_CHARS_PER_CALL;
}

/** Split text into chunks by section breaks or paragraphs */
export function chunkText(text: string, maxChars = MAX_CHARS_PER_CALL): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  // Try to split by document boundaries first
  const docParts = text.split(/\n---\s+.*?\s+---\n/);

  let current = '';
  for (const part of docParts) {
    if ((current + part).length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = part;
    } else {
      current += '\n\n' + part;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  // If any chunk is still too large, split by paragraphs
  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= maxChars) {
      result.push(chunk);
    } else {
      const paras = chunk.split(/\n\n+/);
      let acc = '';
      for (const p of paras) {
        if ((acc + p).length > maxChars && acc.length > 0) {
          result.push(acc.trim());
          acc = p;
        } else {
          acc += '\n\n' + p;
        }
      }
      if (acc.trim()) result.push(acc.trim());
    }
  }

  return result;
}

// ─── Response Validation ────────────────────────────────────

/** Parse and validate JSON response from AI */
export function parseAIResponse<T>(
  raw: string,
  requiredFields: string[] = [],
  label: string = 'AI response'
): T {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Αποτυχία ανάλυσης AI απάντησης (${label}): μη έγκυρο JSON`);
  }

  // Validate required fields exist
  for (const field of requiredFields) {
    if (!(field in parsed)) {
      throw new Error(`Λείπει το πεδίο "${field}" από την AI απάντηση (${label})`);
    }
  }

  // Validate confidence scores are 0-1
  validateConfidenceScores(parsed);

  return parsed as T;
}

function validateConfidenceScores(obj: any, path = ''): void {
  if (obj === null || obj === undefined) return;
  if (typeof obj !== 'object') return;

  for (const [key, value] of Object.entries(obj)) {
    if (key === 'confidence' && typeof value === 'number') {
      if (value < 0 || value > 1) {
        console.warn(`[AI Validation] confidence at ${path}.${key} = ${value}, clamping to 0-1`);
        (obj as any)[key] = Math.max(0, Math.min(1, value));
      }
    }
    if (typeof value === 'object') {
      validateConfidenceScores(value, `${path}.${key}`);
    }
  }
}

// ─── Missing Info Helpers ───────────────────────────────────

export interface MissingInfoItem {
  field: string;
  source: 'brief' | 'legal' | 'financial' | 'technical';
  severity: 'critical' | 'important' | 'nice_to_have';
}

export const BRIEF_CRITICAL_FIELDS = [
  'Τίτλος διαγωνισμού',
  'Προϋπολογισμός',
  'Προθεσμία υποβολής',
  'Αναθέτουσα αρχή',
  'CPV κωδικοί',
];

export const LEGAL_CRITICAL_FIELDS = [
  'Εγγυητική συμμετοχής',
  'Δικαιολογητικά συμμετοχής',
  'Κριτήρια αποκλεισμού',
  'Κριτήρια ανάθεσης',
];

export const FINANCIAL_CRITICAL_FIELDS = [
  'Προϋπολογισμός',
  'Ποσοστό εγγυητικής',
  'Πηγή χρηματοδότησης',
  'Κριτήρια οικονομικής επάρκειας',
];
```

- [ ] **Step 2: Verify build**

```bash
npx next build
```

- [ ] **Step 3: Commit**

```bash
git add src/server/services/ai-prompts.ts && git commit -m "feat: add shared AI prompt templates, validation, and chunking"
```

---

### Task 6B: AI Rate Limiting & Cost Controls

**Files:**
- Modify: `src/server/ai/provider.ts`
- Modify: `src/server/ai/claude-provider.ts`

- [ ] **Step 1: Add token tracking to the AI provider**

In `src/server/ai/provider.ts`, wrap the `ai()` singleton to track tokens per tenant:

```typescript
import { db } from '@/lib/db';

const DAILY_TOKEN_LIMIT = parseInt(process.env.AI_DAILY_TOKEN_LIMIT || '500000');

/** Check if tenant has exceeded daily AI token limit */
export async function checkTokenBudget(tenantId: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const usage = await db.activity.aggregate({
    where: {
      tenantId,
      createdAt: { gte: today },
      type: 'AI_USAGE',
    },
    _sum: { metadata: true }, // We'll store tokens in a JSON field
  });

  // Sum tokens from activity metadata
  const activities = await db.activity.findMany({
    where: { tenantId, createdAt: { gte: today }, type: 'AI_USAGE' },
    select: { details: true },
  });

  const used = activities.reduce((sum, a) => {
    const details = a.details as any;
    return sum + (details?.totalTokens || 0);
  }, 0);

  return { allowed: used < DAILY_TOKEN_LIMIT, used, limit: DAILY_TOKEN_LIMIT };
}

/** Log AI token usage to Activity */
export async function logTokenUsage(
  tenantId: string,
  tenderId: string,
  operation: string,
  tokens: { input: number; output: number; total: number }
): Promise<void> {
  await db.activity.create({
    data: {
      type: 'AI_USAGE',
      description: `AI: ${operation}`,
      details: { ...tokens, operation },
      tenderId,
      tenantId,
    },
  });
}
```

- [ ] **Step 2: Integrate token checks into AI service calls**

In each AI service (bid-orchestrator, legal, financial), before making an AI call:
```typescript
const budget = await checkTokenBudget(tenantId);
if (!budget.allowed) {
  throw new Error(`Ξεπεράσατε το ημερήσιο όριο AI (${budget.used}/${budget.limit} tokens). Δοκιμάστε αύριο.`);
}
```

After each call, log usage:
```typescript
await logTokenUsage(tenantId, tenderId, 'brief_analysis', {
  input: result.inputTokens || 0,
  output: result.outputTokens || 0,
  total: result.totalTokens || 0,
});
```

- [ ] **Step 3: Verify build**

```bash
npx next build
```

- [ ] **Step 4: Commit**

```bash
git add src/server/ai/ && git commit -m "feat: add AI token tracking and daily rate limiting per tenant"
```

---

## PHASE 2: Discovery Upgrade

### Task 7: Expand KAD→CPV Mapping + Fix Discovery Sources

**Files:**
- Create: `src/lib/kad-cpv-map.ts`
- Modify: `src/server/services/tender-discovery.ts`

- [ ] **Step 1: Create comprehensive KAD→CPV mapping file**

Create `src/lib/kad-cpv-map.ts` with expanded mappings. This should contain at minimum the top 200 KAD codes used in Greek tenders mapped to their CPV equivalents. Extract the existing ~30 mappings from `tender-discovery.ts` lines 47-93 and expand.

Research the correct CPV codes for major KAD categories:
- 41 (Construction), 42 (Civil engineering), 43 (Specialized construction)
- 62 (IT services), 63 (IT hosting)
- 71 (Architecture/engineering), 72 (Scientific research)
- 46 (Wholesale trade), 47 (Retail trade)
- 86 (Healthcare), 85 (Education)

```typescript
/**
 * KAD (Greek NACE) to CPV (Common Procurement Vocabulary) mapping.
 * Used by discovery to match tenders to company capabilities.
 */
export const KAD_TO_CPV: Record<string, string[]> = {
  // IT & Software
  '62.01': ['72210000-0', '72211000-7', '72212000-4'], // Software development
  '62.02': ['72220000-3', '72221000-0', '72222000-7'], // IT consulting
  '62.03': ['72250000-2'],                              // IT management
  '62.09': ['72260000-5'],                              // Other IT services
  '63.11': ['72310000-1', '72317000-0', '72400000-4'], // Data hosting
  // ... (expand to 200+ mappings)
};

/** Get all CPV codes for a list of KAD codes */
export function kadToCpv(kadCodes: string[]): string[] {
  const cpvSet = new Set<string>();
  for (const kad of kadCodes) {
    // Exact match
    const exact = KAD_TO_CPV[kad];
    if (exact) exact.forEach(c => cpvSet.add(c));
    // Category match (first 2 digits)
    const category = kad.split('.')[0];
    for (const [k, v] of Object.entries(KAD_TO_CPV)) {
      if (k.startsWith(category + '.')) {
        v.forEach(c => cpvSet.add(c));
      }
    }
  }
  return Array.from(cpvSet);
}
```

- [ ] **Step 2: Update tender-discovery.ts — replace inline KAD map, fix Diavgeia search**

In `src/server/services/tender-discovery.ts`:
- Replace inline `KAD_TO_CPV_MAP` (lines 47-93) and `mapKadToCpv` (lines 95-115) with import from `src/lib/kad-cpv-map.ts`
- In `getLatestFromDiavgeia` (around line 128), expand search terms:

```typescript
const searchTerms = ['ΔΙΑΚΗΡΥΞΗ', 'ΠΡΟΚΗΡΥΞΗ', 'ΠΕΡΙΛΗΨΗ_ΔΙΑΚΗΡΥΞΗΣ', 'ΑΝΑΘΕΣΗ'];
```

- Increase Diavgeia timeout to 30000ms
- In `getLatestFromTED` (around line 241), increase timeout to 30000ms

- [ ] **Step 3: Add "Show All" toggle support to search**

In `TenderSearchParams` interface, add:
```typescript
showAll?: boolean; // If true, skip KAD/CPV filtering
```

In `searchTenders()`, if `params.showAll` is true, skip the CPV filtering step.

- [ ] **Step 3B: Implement relevance scoring (spec 2.3)**

In `tender-discovery.ts`, replace the existing `scoreTenderRelevance` function with the spec's formula:

```typescript
export function scoreTenderRelevance(
  tender: DiscoveredTender,
  companyCpvCodes: string[],
  companyBudgetRange?: { min: number; max: number },
): number {
  let score = 0;

  // CPV exact match: 40 points
  const exactMatch = tender.cpvCodes.some(c => companyCpvCodes.includes(c));
  if (exactMatch) score += 40;

  // CPV category match (first 2 digits): 20 points
  const companyCategories = companyCpvCodes.map(c => c.slice(0, 2));
  const categoryMatch = tender.cpvCodes.some(c => companyCategories.includes(c.slice(0, 2)));
  if (categoryMatch && !exactMatch) score += 20;

  // Budget within range: 15 points
  if (tender.budget && companyBudgetRange) {
    if (tender.budget >= companyBudgetRange.min && tender.budget <= companyBudgetRange.max) {
      score += 15;
    }
  }

  // Deadline >= 15 days: 15 points (linear scale, 0 if < 5 days)
  if (tender.submissionDeadline) {
    const daysLeft = Math.ceil((tender.submissionDeadline.getTime() - Date.now()) / 86400000);
    if (daysLeft >= 15) score += 15;
    else if (daysLeft >= 5) score += Math.round(15 * (daysLeft - 5) / 10);
  }

  // Geographic match: 10 points (placeholder — needs company location data)
  // TODO: Implement when company address is structured

  return Math.min(100, score);
}
```

Sort discovery results by relevance score descending.

- [ ] **Step 3C: Ensure KIMDIS source works**

Verify the existing `getLatestFromKIMDIS` function in `tender-discovery.ts`. If it exists:
- Increase timeout to 30s
- Use clear selector constants for HTML parsing (so they can be updated if site changes)
- Add pagination support

If it does NOT exist, implement it following the same pattern as Diavgeia:
- Target: `https://www.promitheus.gov.gr/webcenter/portal/TestPortal`
- Parse search results HTML for tender listings
- Extract: title, budget, deadline, CPV codes, document links

- [ ] **Step 4: Verify build**

```bash
npx next build
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/kad-cpv-map.ts src/server/services/tender-discovery.ts && git commit -m "feat: expand KAD→CPV mapping, fix Diavgeia search, add showAll toggle"
```

---

### Task 8: Fix Discovery Router — Document Download on Import

**Files:**
- Modify: `src/server/routers/discovery.ts`

- [ ] **Step 1: Read current discovery.ts**

Read `src/server/routers/discovery.ts` fully.

- [ ] **Step 2: Fix fetchDocumentsFromSource — validate content types, store properly**

In the `fetchDocumentsFromSource` procedure (around line 194), fix:
- Validate `Content-Type` header before storing (accept PDF, DOCX, DOC, ZIP only)
- Use proper S3 key format: `tenants/${tenantId}/tenders/${tenderId}/docs/${filename}`
- Create `AttachedDocument` records with correct fields
- Handle download failures gracefully (log error, continue with other docs)

- [ ] **Step 3: Fix importFromUrl — use correct platform enum**

In `importFromUrl` (around line 93), ensure the imported tender uses the correct `TenderPlatform` enum value based on the detected source URL.

- [ ] **Step 4: Add showAll parameter to search procedure**

In the `search` procedure (around line 15), add `showAll: z.boolean().optional()` to the input schema and pass it to `tenderDiscovery.searchTenders()`.

- [ ] **Step 5: Verify build**

```bash
npx next build
```

- [ ] **Step 6: Commit**

```bash
git add src/server/routers/discovery.ts && git commit -m "fix: document download validation, correct platform enums, showAll param"
```

---

## PHASE 3: AI Analysis Pipeline Rebuild

### Task 9: Rebuild AI Brief Analysis (Bid Orchestrator — summarizeTender)

**Files:**
- Modify: `src/server/services/ai-bid-orchestrator.ts`

- [ ] **Step 1: Read current ai-bid-orchestrator.ts**

Read `src/server/services/ai-bid-orchestrator.ts` fully. Note the `summarizeTender` function.

- [ ] **Step 2: Rewrite summarizeTender with Greek prompts + validation**

Replace the `summarizeTender` function. Key changes:
- Use `ANALYSIS_RULES` from `ai-prompts.ts`
- Greek-language prompt
- Handle chunked documents with `chunkText`
- Validate response with `parseAIResponse`
- Include `missingInfo` in output
- Check critical fields and populate missingInfo

The prompt should request this exact JSON structure:
```json
{
  "summaryText": "...",
  "keyPoints": { "sector": "...", "mandatoryCriteria": [...], "awardType": "...", "duration": "...", "deadlines": [...], "estimatedBudget": null, "cpvCodes": [...] },
  "sector": "...",
  "awardType": "...",
  "duration": "...",
  "missingInfo": ["Δεν βρέθηκε: ..."]
}
```

- [ ] **Step 3: Add concurrency guard**

At the start of `summarizeTender`, check and set `analysisInProgress`:

```typescript
const tender = await db.tender.findUnique({ where: { id: tenderId } });
if (tender?.analysisInProgress) {
  throw new Error('Η ανάλυση βρίσκεται ήδη σε εξέλιξη');
}
await db.tender.update({ where: { id: tenderId }, data: { analysisInProgress: true } });
try {
  // ... analysis code ...
} finally {
  await db.tender.update({ where: { id: tenderId }, data: { analysisInProgress: false } });
}
```

- [ ] **Step 4: Verify build**

```bash
npx next build
```

- [ ] **Step 5: Commit**

```bash
git add src/server/services/ai-bid-orchestrator.ts && git commit -m "feat: rebuild Brief analysis with Greek prompts, validation, missing info"
```

---

### Task 10: Rebuild AI Legal Analysis

**Files:**
- Modify: `src/server/services/ai-legal-analyzer.ts`

- [ ] **Step 1: Read current ai-legal-analyzer.ts**

Read `src/server/services/ai-legal-analyzer.ts` fully.

- [ ] **Step 2: Rewrite extractClauses with Greek prompts + empty result OK**

Key changes:
- Use `ANALYSIS_RULES` from `ai-prompts.ts`
- Greek-language prompt asking to extract clauses
- If no clauses found → return empty array (NOT an error)
- Validate response JSON
- Each clause gets `confidence` score

- [ ] **Step 3: Rewrite assessRisks — validate clauseIds exist**

Key changes:
- Before processing AI results, verify each `clauseId` exists in DB
- Skip invalid clauseIds (log warning, don't crash)
- Include risk explanation in Greek

- [ ] **Step 4: Fix proposeClarifications — link to existing clauses**

Key changes:
- Only create clarifications linked to clauses that exist
- If clauseId not found, create clarification without link but log it

- [ ] **Step 5: Add missingInfo detection to getLegalRiskSummary**

After calculating risk scores, check `LEGAL_CRITICAL_FIELDS` and add any missing to summary.

- [ ] **Step 6: Verify build**

```bash
npx next build
```

- [ ] **Step 7: Commit**

```bash
git add src/server/services/ai-legal-analyzer.ts && git commit -m "feat: rebuild Legal analysis — Greek prompts, empty results OK, missing info"
```

---

### Task 11: Rebuild AI Financial Analysis

**Files:**
- Modify: `src/server/services/ai-financial.ts`

- [ ] **Step 1: Read current ai-financial.ts**

Read `src/server/services/ai-financial.ts` fully.

- [ ] **Step 2: Rewrite extractFinancialRequirements — no defaults, no fabrication**

Key changes:
- Use `ANALYSIS_RULES` from `ai-prompts.ts`
- Greek prompt
- If budget not found in documents → return null (NOT `tender.budget * 2`)
- If guarantee percentage not found → return null
- Validate all numeric values are reasonable

- [ ] **Step 3: Fix checkEligibility — use FinancialProfile, no approximations**

Key changes:
- Load `FinancialProfile` for tenant + latest year
- If no `FinancialProfile` exists → return `{ status: 'BORDERLINE', missingInfo: ['Λείπουν τα οικονομικά στοιχεία εταιρείας'] }`
- Remove incorrect current ratio calculation (equity / debt is wrong)
- Use real formulas only if proper data available

- [ ] **Step 4: Fix suggestPricingScenarios — only with confirmed budget**

Key changes:
- If no confirmed budget from documents → return empty array + missingInfo
- Don't assume 70% cost ratio
- Validate all prices <= budget

- [ ] **Step 5: Verify build**

```bash
npx next build
```

- [ ] **Step 6: Commit**

```bash
git add src/server/services/ai-financial.ts && git commit -m "feat: rebuild Financial analysis — no defaults, use FinancialProfile, missing info"
```

---

### Task 12: Fix Go/No-Go — Upsert, Not Duplicate

**Files:**
- Modify: `src/server/services/ai-bid-orchestrator.ts`

- [ ] **Step 1: Find goNoGoAnalysis function in ai-bid-orchestrator.ts**

Read the Go/No-Go section (around line 700+).

- [ ] **Step 2: Change create to upsert**

Replace `db.goNoGoDecision.create()` with:

```typescript
await db.goNoGoDecision.upsert({
  where: { tenderId },
  create: {
    tenderId,
    tenantId,
    decision: result.decision,
    overallScore: result.overallScore,
    reasons: result.factors,
    recommendation: result.recommendation,
  },
  update: {
    decision: result.decision,
    overallScore: result.overallScore,
    reasons: result.factors,
    recommendation: result.recommendation,
    approvedAt: null,      // Reset approval on re-analysis
    approvedById: null,
  },
});
```

Note: This requires `tenderId` to have a `@unique` constraint. Check schema — `GoNoGoDecision` model (line 483). If `tenderId` is not unique, add a unique constraint in the schema.

- [ ] **Step 3: Verify build**

```bash
npx next build
```

- [ ] **Step 4: Commit**

```bash
git add src/server/services/ai-bid-orchestrator.ts && git commit -m "fix: Go/No-Go uses upsert — one decision per tender, no duplicates"
```

---

## PHASE 4: Frontend Fixes

### Task 13: Fix Status Badge — Add Missing Platforms and Statuses

**Files:**
- Modify: `src/components/tender/status-badge.tsx`

- [ ] **Step 1: Add DIAVGEIA, TED, KIMDIS to platformMap**

In `src/components/tender/status-badge.tsx`, find `platformMap` (around line 146) and add:

```typescript
const platformMap = {
  ESIDIS: { label: 'ΕΣΗΔΗΣ', ...existing },
  COSMOONE: { label: 'Cosmo One', ...existing },
  ISUPPLIES: { label: 'iSupplies', ...existing },
  DIAVGEIA: { label: 'Διαύγεια', color: 'bg-blue-100 text-blue-700' },
  TED: { label: 'TED Europa', color: 'bg-purple-100 text-purple-700' },
  KIMDIS: { label: 'ΚΗΜΔΗΣ', color: 'bg-green-100 text-green-700' },
  OTHER: { label: 'Άλλο', ...existing },
  PRIVATE: { label: 'Ιδιωτικός', ...existing },
};
```

- [ ] **Step 2: Verify DISCOVERY and GO_NO_GO are in tenderStatusMap**

Check `tenderStatusMap` (around line 7). If DISCOVERY or GO_NO_GO are missing, add them.

- [ ] **Step 3: Commit**

```bash
git add src/components/tender/status-badge.tsx && git commit -m "fix: add DIAVGEIA/TED/KIMDIS platform badges, verify status mappings"
```

---

### Task 14: Fix Company CRUD — Upload Buttons + Edit vs Create

**Files:**
- Modify: `src/components/company/certificates-list.tsx`
- Modify: `src/components/company/projects-list.tsx`
- Modify: `src/components/company/legal-docs-list.tsx`

- [ ] **Step 1: Fix certificates-list.tsx — add update mutation, fix upload**

In `src/components/company/certificates-list.tsx`:

1. Add an `updateMutation` alongside the existing `createMutation`:
```typescript
const updateMutation = trpc.company.updateCertificate.useMutation({
  onSuccess: () => { query.refetch(); setDialogOpen(false); },
  onError: (err) => { toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' }); },
});
```

2. In `onSubmit`, check `editingId`:
```typescript
const onSubmit = (data: FormData) => {
  if (editingId) {
    updateMutation.mutate({ id: editingId, ...data });
  } else {
    createMutation.mutate(data);
  }
};
```

3. Fix upload button (around line 289) — implement file input reference:
```typescript
<input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.jpg,.png"
  onChange={(e) => handleFileUpload(e.target.files)} />
<Button onClick={() => fileInputRef.current?.click()}>Upload</Button>
```

- [ ] **Step 2: Apply same fix to projects-list.tsx**

Same pattern: add `updateMutation`, fix `onSubmit` to check `editingId`.

- [ ] **Step 3: Apply same fix to legal-docs-list.tsx**

Same pattern: add `updateMutation`, fix `onSubmit`, fix upload button.

- [ ] **Step 4: Ensure tRPC router has update endpoints**

Check `src/server/routers/company.ts` for `updateCertificate`, `updateProject`, `updateLegalDoc`. If they don't exist, add them.

- [ ] **Step 5: Verify build**

```bash
npx next build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/company/ src/server/routers/company.ts && git commit -m "fix: company CRUD — edit updates (not creates), upload buttons work"
```

---

### Task 15: Fix Documents Tab — Real Upload, No Placeholders

**Files:**
- Modify: `src/components/tender/documents-tab.tsx`

- [ ] **Step 1: Read current documents-tab.tsx**

Read `src/components/tender/documents-tab.tsx`.

- [ ] **Step 2: Fix upload flow**

Ensure `handleFileUpload` (around line 86):
- Posts files to `/api/upload` with correct `tenderId`
- Creates `AttachedDocument` record via tRPC mutation
- Shows loading state during upload
- Shows error toast on failure

- [ ] **Step 3: Remove placeholder content from generated docs**

In the generate document section (around line 293), replace placeholder content:
```typescript
// Instead of hardcoded placeholder:
content: '[Αναμονή δημιουργίας — πατήστε επεξεργασία για AI δημιουργία]'
// Use the actual AI generation result, or show empty state:
content: result.content || ''
```

- [ ] **Step 4: Add loading/error states**

Add `isPending` checks to disable buttons during operations.

- [ ] **Step 5: Commit**

```bash
git add src/components/tender/documents-tab.tsx && git commit -m "fix: documents tab — real upload, no placeholder content, loading states"
```

---

### Task 16: Fix Legal Tab — Persist Clarifications to DB

**Files:**
- Modify: `src/components/tender/legal-tab.tsx`
- Modify: `src/server/routers/ai-roles.ts`

- [ ] **Step 1: Add tRPC endpoints for clarification management**

In `src/server/routers/ai-roles.ts`, add:

```typescript
updateClarification: protectedProcedure
  .input(z.object({ id: z.string(), text: z.string() }))
  .mutation(async ({ input }) => {
    return db.clarificationQuestion.update({
      where: { id: input.id },
      data: { questionText: input.text },
    });
  }),

approveClarification: protectedProcedure
  .input(z.object({ id: z.string(), approved: z.boolean() }))
  .mutation(async ({ input }) => {
    return db.clarificationQuestion.update({
      where: { id: input.id },
      data: { status: input.approved ? 'APPROVED' : 'DRAFT' },
    });
  }),
```

- [ ] **Step 2: Update legal-tab.tsx to use tRPC mutations**

Replace the TODO handlers (around lines 230-245) with actual tRPC mutation calls:

```typescript
const updateClarMutation = trpc.aiRoles.updateClarification.useMutation({
  onSuccess: () => { /* refetch clauses */ },
  onError: (err) => { toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' }); },
});

const approveClarMutation = trpc.aiRoles.approveClarification.useMutation({
  onSuccess: () => { /* refetch clauses */ },
  onError: (err) => { toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' }); },
});
```

- [ ] **Step 3: Add onError handlers to all existing mutations**

Every mutation in legal-tab.tsx should have:
```typescript
onError: (err) => {
  setError(err.message);
  toast({ title: 'Σφάλμα ανάλυσης', description: err.message, variant: 'destructive' });
},
```

- [ ] **Step 4: Commit**

```bash
git add src/components/tender/legal-tab.tsx src/server/routers/ai-roles.ts && git commit -m "fix: legal tab — persist clarifications to DB, add error handlers"
```

---

### Task 17: Fix Financial Tab — Persist Selected Scenario

**Files:**
- Modify: `src/components/tender/financial-tab.tsx`

- [ ] **Step 1: Add onError handlers to all mutations**

Every mutation in `financial-tab.tsx` gets:
```typescript
onError: (err) => {
  setError(err.message);
  toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });
},
```

- [ ] **Step 2: Persist selected scenario**

When user clicks "Select" on a pricing scenario, call a tRPC mutation to save the selection. If no endpoint exists yet, add one to `ai-roles.ts`:

```typescript
selectPricingScenario: protectedProcedure
  .input(z.object({ tenderId: z.string(), scenarioId: z.string() }))
  .mutation(async ({ input }) => {
    // Use transaction to ensure both operations complete
    await db.$transaction([
      db.pricingScenario.updateMany({
        where: { tenderId: input.tenderId, id: { not: input.scenarioId } },
        data: { selected: false },
      }),
      db.pricingScenario.update({
        where: { id: input.scenarioId },
        data: { selected: true },
      }),
    ]);
    return db.pricingScenario.findUnique({ where: { id: input.scenarioId } });
  }),
```

- [ ] **Step 3: Commit**

```bash
git add src/components/tender/financial-tab.tsx src/server/routers/ai-roles.ts && git commit -m "fix: financial tab — persist selected scenario, add error handlers"
```

---

### Task 18: Fix Remaining Tabs — Brief, Go/No-Go, Technical

**Files:**
- Modify: `src/components/tender/ai-brief-panel.tsx`
- Modify: `src/components/tender/go-no-go-panel.tsx`
- Modify: `src/components/tender/technical-tab-enhanced.tsx`

- [ ] **Step 1: Fix ai-brief-panel.tsx — add error handling**

Add `onError` to `summarizeMutation` (around line 78):
```typescript
onError: (err) => {
  setError(err.message);
  toast({ title: 'Σφάλμα σύνοψης', description: err.message, variant: 'destructive' });
},
```

Show error banner when `error` state is set.

- [ ] **Step 2: Fix go-no-go-panel.tsx — add error handling**

Add `onError` to `goNoGoMutation` and `approveMutation`.
Fix data transformation (around line 163) to correctly map `reasons` → `factors`.

- [ ] **Step 3: Fix technical-tab-enhanced.tsx — load data from DB on mount**

Currently, all arrays start empty (lines 125-128). Add tRPC queries to load:
- `sections` from `TechnicalProposalSection` model
- `risks` from AI analysis results
- `scoreCriteria` from tender evaluation criteria

If the data doesn't exist yet, show empty state with CTA: "Εκτελέστε τεχνική ανάλυση".

- [ ] **Step 4: Add onError to all mutations**

All mutations across all three components get `onError` handlers.

- [ ] **Step 5: Commit**

```bash
git add src/components/tender/ai-brief-panel.tsx src/components/tender/go-no-go-panel.tsx src/components/tender/technical-tab-enhanced.tsx && git commit -m "fix: Brief/GoNoGo/Technical tabs — error handling, data loading, transformations"
```

---

### Task 19: Fix Discovery Results UI — KAD Badge + Show All Toggle

**Files:**
- Modify: `src/components/tender/discovery-results.tsx`

- [ ] **Step 1: Read current discovery-results.tsx**

Read `src/components/tender/discovery-results.tsx`.

- [ ] **Step 2: Add "Show All" toggle**

Add a Switch/Toggle at the top of the discovery results:
```tsx
<div className="flex items-center gap-2">
  <Switch checked={showAll} onCheckedChange={setShowAll} />
  <Label>Εμφάνιση όλων (χωρίς φίλτρο KAD)</Label>
</div>
```

Pass `showAll` to the search query.

- [ ] **Step 3: Add KAD relevance badge**

On each discovery result card, show badge:
- If CPV matches company's KAD: green badge "Σχετικός με KAD"
- Otherwise: gray badge "Γενικός"

- [ ] **Step 4: Use correct platform badges**

Use the `StatusBadge` component with `kind="platform"` for displaying `DIAVGEIA`, `TED`, `KIMDIS`.

- [ ] **Step 5: Commit**

```bash
git add src/components/tender/discovery-results.tsx && git commit -m "feat: discovery UI — Show All toggle, KAD relevance badges, platform badges"
```

---

### Task 20: Fix Tender Detail Page — Centralized Analysis Button

**Files:**
- Modify: `src/app/(dashboard)/tenders/[id]/page.tsx`

- [ ] **Step 1: Read current tender detail page**

Read `src/app/(dashboard)/tenders/[id]/page.tsx`.

- [ ] **Step 2: Add centralized "Ανάλυση Διαγωνισμού" button**

Add a prominent button in the page header that runs all analysis steps:

```tsx
const [analysisStep, setAnalysisStep] = useState<string | null>(null);

async function runFullAnalysis() {
  try {
    setAnalysisStep('Ανάγνωση εγγράφων...');
    await summarizeMutation.mutateAsync({ tenderId });

    setAnalysisStep('Νομική ανάλυση...');
    await extractLegalMutation.mutateAsync({ tenderId });
    await assessLegalMutation.mutateAsync({ tenderId });

    setAnalysisStep('Οικονομική ανάλυση...');
    await extractFinancialMutation.mutateAsync({ tenderId });

    setAnalysisStep('Αξιολόγηση Go/No-Go...');
    await goNoGoMutation.mutateAsync({ tenderId });

    setAnalysisStep(null);
    toast({ title: 'Η ανάλυση ολοκληρώθηκε' });
  } catch (err) {
    setAnalysisStep(null);
    toast({ title: 'Σφάλμα ανάλυσης', description: err.message, variant: 'destructive' });
  }
}
```

- [ ] **Step 3: Add onError to all existing mutations**

Every mutation in the page should have `onError` → toast.

- [ ] **Step 4: Disable analysis button during progress**

Check `tender?.analysisInProgress` from the query and disable button.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/tenders/[id]/page.tsx && git commit -m "feat: centralized analysis button with progress steps, error handling"
```

---

### Task 20B: Missing Info Aggregation Panel

**Files:**
- Create: `src/components/tender/missing-info-panel.tsx`
- Modify: `src/app/(dashboard)/tenders/[id]/page.tsx`

- [ ] **Step 1: Create MissingInfoPanel component**

Create `src/components/tender/missing-info-panel.tsx` that:
- Accepts `tenderId` as prop
- Fetches Brief, Legal, Financial analysis results via tRPC queries
- Extracts `missingInfo` arrays from each
- Displays as categorized alert list:
  - "Σύνοψη" section → brief missingInfo items
  - "Νομική" section → legal missingInfo items
  - "Οικονομική" section → financial missingInfo items
- Uses warning icons and amber/yellow styling for visibility
- Shows "Δεν βρέθηκαν ελλείψεις" when all arrays are empty

```tsx
// Key structure:
interface MissingInfoPanelProps { tenderId: string; }

export function MissingInfoPanel({ tenderId }: MissingInfoPanelProps) {
  const brief = trpc.aiRoles.getBrief.useQuery({ tenderId });
  const legal = trpc.aiRoles.getLegalClauses.useQuery({ tenderId });
  // Extract missingInfo from each, display categorized
}
```

- [ ] **Step 2: Add panel to tender detail page**

In `src/app/(dashboard)/tenders/[id]/page.tsx`, render `<MissingInfoPanel tenderId={tenderId} />` prominently above the tabs section, so it's always visible.

- [ ] **Step 3: Commit**

```bash
git add src/components/tender/missing-info-panel.tsx src/app/(dashboard)/tenders/[id]/page.tsx && git commit -m "feat: missing info aggregation panel on tender detail"
```

---

### Task 21: Fix Dashboard + Tender List — Real Data

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`
- Modify: `src/app/(dashboard)/tenders/page.tsx`

- [ ] **Step 1: Replace hardcoded sparkline data in dashboard**

In `src/app/(dashboard)/dashboard/page.tsx`, replace `sparkActive`, `sparkTasks`, `sparkCompliance`, `sparkDeadlines` (lines 29-40) with data derived from DB queries.

If the analytics queries don't return time-series data, simplify the sparklines to just show the current count or remove them temporarily.

- [ ] **Step 2: Fix tender list statusConfig**

In `src/app/(dashboard)/tenders/page.tsx`, ensure `statusConfig` (around line 41) includes all statuses from the `TenderStatus` enum: `DISCOVERY`, `GO_NO_GO`, `IN_PROGRESS`, `SUBMITTED`, `WON`, `LOST`.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/dashboard/page.tsx src/app/(dashboard)/tenders/page.tsx && git commit -m "fix: dashboard uses real data, tender list has all statuses"
```

---

## Final Verification

### Task 22: Build + Manual Smoke Test

- [ ] **Step 1: Full build**

```bash
npx next build
```

Expected: 0 errors.

- [ ] **Step 2: Start dev server and verify**

```bash
npm run dev
```

Manually test:
1. Login
2. Go to Discovery → search tenders → verify results show from Diavgeia/TED
3. Import a tender → verify documents download
4. Click "Ανάλυση Διαγωνισμού" → verify Brief, Legal, Financial, Go/No-Go populate
5. Verify missing info alerts appear
6. Go to Company Profile → edit certificate → verify it updates (not duplicates)
7. Go to Dashboard → verify real numbers

- [ ] **Step 3: Final commit**

```bash
git add -A && git commit -m "chore: final verification — all phases complete"
```
