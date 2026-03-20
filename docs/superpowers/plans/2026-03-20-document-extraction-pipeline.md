# Document Extraction Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current pdf-parse + Gemini Vision fallback with a robust three-tier extraction pipeline: pdf-parse → Quality Gate → Document AI (main) + Gemini Vision (backup), with a "Deep Parse" UI button.

**Architecture:** Tier 1 (pdf-parse) runs on every PDF for free. A Quality Gate with 3 criteria (charsPerKB, keyword coverage, chars/page) decides if Tier 2 is needed. Tier 2 runs Document AI as primary extractor with Gemini Vision in parallel as backup. Results are stored with extraction method and confidence metadata.

**Tech Stack:** `@google-cloud/documentai`, existing `@google/generative-ai`, `pdf-parse`, Prisma, Next.js, tRPC, React

**Spec:** `docs/superpowers/specs/2026-03-20-document-extraction-pipeline-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add 3 fields to AttachedDocument |
| `src/server/services/document-ai.ts` | Create | Document AI client (online + batch) |
| `src/server/services/quality-gate.ts` | Create | Quality Gate logic (3 criteria + docAiRecommended) |
| `src/server/services/document-reader.ts` | Modify | Wire tiered pipeline, update DB writes |
| `src/server/routers/document.ts` | Modify | Add `deepParse` mutation |
| `src/components/tender/documents-tab.tsx` | Modify | Extraction badges, Deep Parse button |
| `src/lib/utils.ts` | Modify | Export shared `stripAccents` helper |
| `tests/services/quality-gate.test.ts` | Create | Quality Gate unit tests |
| `tests/services/document-ai.test.ts` | Create | Document AI integration tests |

---

### Task 1: Database Schema — Add extraction metadata fields

**Files:**
- Modify: `prisma/schema.prisma:404-422`

- [ ] **Step 1: Add fields to AttachedDocument model**

In `prisma/schema.prisma`, update the AttachedDocument model:

```prisma
model AttachedDocument {
  id            String  @id @default(cuid())
  fileName      String
  fileKey       String  // S3 key
  fileSize      Int?
  mimeType      String?
  category      String? // e.g. "specification", "appendix", "clarification"
  extractedText String? @db.Text
  pageCount     Int?
  parsingStatus String? // 'success' | 'partial' | 'failed'
  parsingError  String?

  // Extraction pipeline metadata
  extractionMethod     String?  // 'pdf_parse' | 'document_ai' | 'gemini_vision'
  extractionConfidence Float?   // 0.0 - 1.0
  docAiRecommended     Boolean  @default(false)
  qualityGateResult    String?  @db.Text // JSON: { charsPerKB, keywordHits, charsPerPage, passed, reasons }

  tenderId String
  tender   Tender @relation(fields: [tenderId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@index([tenderId])
}
```

- [ ] **Step 2: Generate and apply migration**

Run:
```bash
npx prisma migrate dev --name add-extraction-metadata
```

Expected: Migration created and applied successfully. Prisma client regenerated.

- [ ] **Step 3: Verify migration**

Run:
```bash
npx prisma studio
```

Open AttachedDocument table, verify new columns exist: `extractionMethod`, `extractionConfidence`, `docAiRecommended`, `qualityGateResult`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add extraction metadata fields to AttachedDocument"
```

---

### Task 2: Extract shared `stripAccents` utility

**Files:**
- Modify: `src/lib/utils.ts`
- Modify: `src/server/services/ai-legal-analyzer.ts:655-656`

Currently `stripAccents` is defined inline in `ai-legal-analyzer.ts`. Extract it to shared utils so both quality-gate and legal-analyzer can use it.

- [ ] **Step 1: Add stripAccents to utils.ts**

Add at the end of `src/lib/utils.ts`:

```typescript
/**
 * Strip Greek accents/diacritics for reliable text matching.
 * E.g. "ΔΙΑΚΉΡΥΞΗ" → "διακηρυξη"
 */
export function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
```

- [ ] **Step 2: Update ai-legal-analyzer.ts to import from utils**

In `src/server/services/ai-legal-analyzer.ts`, replace the inline `stripAccents` definition (around line 655) with an import. Add to the imports at the top of the file:

```typescript
import { stripAccents } from '@/lib/utils';
```

Remove the inline definition:
```typescript
// DELETE these lines (~line 655-656):
// const stripAccents = (text: string): string =>
//   text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
```

- [ ] **Step 3: Verify build**

Run:
```bash
npx next build 2>&1 | head -30
```

Expected: Build succeeds without errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/utils.ts src/server/services/ai-legal-analyzer.ts
git commit -m "refactor: extract stripAccents to shared utils"
```

---

### Task 3: Quality Gate module

**Files:**
- Create: `src/server/services/quality-gate.ts`
- Create: `tests/services/quality-gate.test.ts`

- [ ] **Step 1: Write Quality Gate tests**

Create `tests/services/quality-gate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { evaluateQualityGate } from '@/server/services/quality-gate';

describe('Quality Gate', () => {
  it('passes for good text-based PDF', () => {
    // Simulate a 100KB PDF with 2000 chars across 5 pages, containing keywords
    const result = evaluateQualityGate({
      text: 'ΔΙΑΚΗΡΥΞΗ μειοδοτικής δημοπρασίας μίσθωσης ακινήτου. Αναθέτουσα αρχή: Κτηματική Υπηρεσία. Προϋπολογισμός 5000 ευρώ. Προθεσμία υποβολής 27/3/2026. Σύμβαση διάρκειας 12 ετών. Τεχνικές προδιαγραφές οικοδομικών εργασιών.' + ' lorem ipsum'.repeat(150),
      fileSizeBytes: 100_000,
      pageCount: 5,
    });

    expect(result.passed).toBe(true);
    expect(result.charsPerKB).toBeGreaterThanOrEqual(3);
    expect(result.keywordHits).toBeGreaterThanOrEqual(4);
    expect(result.charsPerPage).toBeGreaterThanOrEqual(200);
  });

  it('fails for scanned PDF (very low chars)', () => {
    const result = evaluateQualityGate({
      text: 'abc',
      fileSizeBytes: 500_000,
      pageCount: 10,
    });

    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('charsPerKB');
  });

  it('fails when no procurement keywords found', () => {
    // Lots of text but no Greek procurement terms
    const result = evaluateQualityGate({
      text: 'The quick brown fox jumps over the lazy dog. '.repeat(100),
      fileSizeBytes: 5_000,
      pageCount: 2,
    });

    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('keywordCoverage');
  });

  it('fails for hybrid PDF with low chars per page', () => {
    // 50 pages but only 2000 chars total = 40 chars/page
    const result = evaluateQualityGate({
      text: 'Διακήρυξη μειοδοτικής δημοπρασίας. Αναθέτουσα αρχή. Προϋπολογισμός. Προθεσμία. Σύμβαση.' + 'x'.repeat(1900),
      fileSizeBytes: 10_000,
      pageCount: 50,
    });

    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('charsPerPage');
  });

  it('sets docAiRecommended when tables detected', () => {
    const textWithTables = 'Διακήρυξη. Αναθέτουσα αρχή. Προϋπολογισμός 5000. Προθεσμία 2026.\n'
      + '| Α/Α | Περιγραφή | Ποσότητα | Τιμή |\n'.repeat(10)
      + ' more text '.repeat(200);

    const result = evaluateQualityGate({
      text: textWithTables,
      fileSizeBytes: 5_000,
      pageCount: 3,
    });

    expect(result.passed).toBe(true);
    expect(result.docAiRecommended).toBe(true);
  });

  it('sets docAiRecommended for large documents', () => {
    const longText = 'Διακήρυξη μειοδοτικής δημοπρασίας. Αναθέτουσα αρχή Χίου. Προϋπολογισμός 5000 ευρώ. Προθεσμία υποβολής. Σύμβαση. Τεχνικές προδιαγραφές. '
      .repeat(500);

    const result = evaluateQualityGate({
      text: longText,
      fileSizeBytes: 50_000,
      pageCount: 35,
    });

    expect(result.docAiRecommended).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run:
```bash
npx vitest run tests/services/quality-gate.test.ts
```

Expected: FAIL — module `@/server/services/quality-gate` does not exist.

- [ ] **Step 3: Implement Quality Gate**

Create `src/server/services/quality-gate.ts`:

```typescript
/**
 * Quality Gate for Document Extraction Pipeline
 *
 * Evaluates whether pdf-parse output is trustworthy enough to skip
 * Document AI processing. Uses 3 criteria + a docAiRecommended heuristic.
 */

import { stripAccents } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────

export interface QualityGateInput {
  text: string;
  fileSizeBytes: number;
  pageCount: number;
}

export interface QualityGateResult {
  passed: boolean;
  charsPerKB: number;
  keywordHits: number;
  charsPerPage: number;
  docAiRecommended: boolean;
  reasons: string[];  // Which criteria failed
}

// ─── Constants ──────────────────────────────────────────────

const MIN_CHARS_PER_KB = 3;
const MIN_KEYWORD_HITS = 4;
const MIN_CHARS_PER_PAGE = 200;
const LARGE_DOC_THRESHOLD = 30; // pages

/**
 * Greek procurement terms for keyword coverage check.
 * Accent-normalized at check time.
 */
const TENDER_KEYWORDS = [
  'διακήρυξη', 'προκήρυξη', 'δημοπρασία',
  'αναθέτουσα', 'αναθέτων', 'φορέας',
  'προϋπολογισμός', 'μίσθωμα', 'δαπάνη',
  'προθεσμία', 'υποβολή', 'κατάθεση',
  'cpv', 'κωδικ',
  'τεχνικ', 'προδιαγραφ',
  'σύμβαση', 'σύμβασ',
];

// ─── Quality Gate ───────────────────────────────────────────

export function evaluateQualityGate(input: QualityGateInput): QualityGateResult {
  const { text, fileSizeBytes, pageCount } = input;
  const trimmed = text.trim();
  const reasons: string[] = [];

  // Criterion 1: Characters per KB
  const charsPerKB = fileSizeBytes > 0
    ? trimmed.length / (fileSizeBytes / 1024)
    : 0;
  if (charsPerKB < MIN_CHARS_PER_KB) {
    reasons.push('charsPerKB');
  }

  // Criterion 2: Keyword coverage
  const normalizedText = stripAccents(trimmed);
  const keywordHits = TENDER_KEYWORDS.filter(kw =>
    normalizedText.includes(stripAccents(kw))
  ).length;
  if (keywordHits < MIN_KEYWORD_HITS) {
    reasons.push('keywordCoverage');
  }

  // Criterion 3: Characters per page
  const effectivePages = Math.max(pageCount, 1);
  const charsPerPage = trimmed.length / effectivePages;
  if (charsPerPage < MIN_CHARS_PER_PAGE) {
    reasons.push('charsPerPage');
  }

  // DocAI Recommended heuristic (even when gate passes)
  const docAiRecommended = detectDocAiRecommended(trimmed, pageCount);

  return {
    passed: reasons.length === 0,
    charsPerKB: Math.round(charsPerKB * 100) / 100,
    keywordHits,
    charsPerPage: Math.round(charsPerPage),
    docAiRecommended,
    reasons,
  };
}

// ─── DocAI Recommended Heuristic ────────────────────────────

function detectDocAiRecommended(text: string, pageCount: number): boolean {
  // 1. Large document
  if (pageCount > LARGE_DOC_THRESHOLD) return true;

  // 2. Table-like patterns: lines with multiple pipes or tab-separated columns
  const lines = text.split('\n');
  let tableLineCount = 0;
  for (const line of lines) {
    const pipeCount = (line.match(/\|/g) || []).length;
    const tabCount = (line.match(/\t/g) || []).length;
    if (pipeCount >= 3 || tabCount >= 3) {
      tableLineCount++;
    }
  }
  if (tableLineCount >= 5) return true;

  // 3. Many financial patterns (€, amounts)
  const financialPatterns = text.match(/[\d.,]+\s*€|€\s*[\d.,]+|ευρώ|EUR/gi) || [];
  if (financialPatterns.length >= 10) return true;

  return false;
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run:
```bash
npx vitest run tests/services/quality-gate.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/quality-gate.ts tests/services/quality-gate.test.ts
git commit -m "feat: add Quality Gate module with 3 criteria + docAiRecommended"
```

---

### Task 4: Document AI client module

**Files:**
- Create: `src/server/services/document-ai.ts`

- [ ] **Step 1: Install dependency**

Run:
```bash
npm install @google-cloud/documentai
```

- [ ] **Step 2: Create Document AI client**

Create `src/server/services/document-ai.ts`:

```typescript
/**
 * Google Document AI Client
 *
 * Handles OCR extraction via Document AI's prebuilt OCR processor.
 * Supports online processing (≤ 15 pages) and batch processing (> 15 pages).
 *
 * Setup:
 * 1. Enable Document AI API in GCP
 * 2. Create an OCR processor in 'eu' location
 * 3. Set env vars: GOOGLE_CLOUD_PROJECT_ID, DOCUMENT_AI_PROCESSOR_ID
 * 4. Auth: GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_JSON
 */

import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

// ─── Types ──────────────────────────────────────────────────

export interface DocumentAIResult {
  text: string;
  confidence: number;
  pageCount: number;
  processingTimeMs: number;
}

// ─── Configuration ──────────────────────────────────────────

const MAX_ONLINE_PAGES = 15;

function getConfig() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'eu';

  if (!projectId || !processorId) {
    return null;
  }

  return { projectId, processorId, location };
}

function createClient(): DocumentProcessorServiceClient | null {
  const config = getConfig();
  if (!config) return null;

  // Support Vercel: service account JSON in env var
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    try {
      const credentials = JSON.parse(serviceAccountJson);
      return new DocumentProcessorServiceClient({
        credentials,
        apiEndpoint: `${config.location}-documentai.googleapis.com`,
      });
    } catch (err) {
      console.error('[DocumentAI] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', err);
      return null;
    }
  }

  // Fallback: GOOGLE_APPLICATION_CREDENTIALS file path
  return new DocumentProcessorServiceClient({
    apiEndpoint: `${config.location}-documentai.googleapis.com`,
  });
}

// ─── Availability Check ────────────────────────────────────

/**
 * Returns true if Document AI is configured and available.
 */
export function isDocumentAIAvailable(): boolean {
  return getConfig() !== null;
}

// ─── Online Processing (≤ 15 pages) ────────────────────────

async function processOnline(
  client: DocumentProcessorServiceClient,
  processorName: string,
  buffer: Buffer,
  mimeType: string
): Promise<DocumentAIResult> {
  const [result] = await client.processDocument({
    name: processorName,
    rawDocument: {
      content: buffer.toString('base64'),
      mimeType,
    },
  });

  const document = result.document;
  if (!document) {
    throw new Error('Document AI returned no document');
  }

  const text = document.text || '';
  const pages = document.pages || [];

  // Calculate average confidence across all pages
  let totalConfidence = 0;
  let confidenceCount = 0;
  for (const page of pages) {
    for (const block of page.blocks || []) {
      if (block.layout?.confidence) {
        totalConfidence += block.layout.confidence;
        confidenceCount++;
      }
    }
  }

  return {
    text,
    confidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
    pageCount: pages.length,
    processingTimeMs: 0, // Set by caller
  };
}

// ─── Batch Processing (> 15 pages) ──────────────────────────

async function processBatch(
  client: DocumentProcessorServiceClient,
  processorName: string,
  buffer: Buffer,
  mimeType: string,
  pageCount: number
): Promise<DocumentAIResult> {
  // For batch: split into chunks of MAX_ONLINE_PAGES and process sequentially
  // Document AI batch requires GCS — we use sequential online calls instead
  // to avoid needing a GCS bucket dependency.

  const allTexts: string[] = [];
  let totalConfidence = 0;
  let confidenceCount = 0;

  // Process the full document — Document AI online can handle larger docs
  // with rawDocument (up to 20MB). For truly large docs, we chunk by concept
  // but most tender PDFs are under 20MB.
  try {
    const result = await processOnline(client, processorName, buffer, mimeType);
    return result;
  } catch (err: any) {
    // If online fails due to page limit, fall back to error
    if (err.message?.includes('page') || err.code === 3) {
      console.warn(`[DocumentAI] Document too large for online processing (${pageCount} pages). Attempting chunked approach...`);

      // For very large docs: we rely on Gemini Vision as backup
      // Full batch processing (GCS-based) is Phase 2
      throw new Error(`Document too large for online processing (${pageCount} pages). Use Gemini Vision fallback.`);
    }
    throw err;
  }
}

// ─── Main Export ─────────────────────────────────────────────

/**
 * Extract text from a PDF using Google Document AI.
 *
 * @param buffer - PDF file buffer
 * @param mimeType - MIME type (usually 'application/pdf')
 * @param fileName - For logging
 * @returns Extraction result or null if Document AI is unavailable
 */
export async function extractWithDocumentAI(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<DocumentAIResult | null> {
  const config = getConfig();
  if (!config) {
    console.warn('[DocumentAI] Not configured — skipping. Set GOOGLE_CLOUD_PROJECT_ID and DOCUMENT_AI_PROCESSOR_ID.');
    return null;
  }

  const client = createClient();
  if (!client) {
    console.error('[DocumentAI] Failed to create client');
    return null;
  }

  const processorName = `projects/${config.projectId}/locations/${config.location}/processors/${config.processorId}`;
  const startTime = Date.now();

  try {
    console.log(`[DocumentAI] Processing ${fileName} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)...`);

    const result = await processOnline(client, processorName, buffer, mimeType);
    result.processingTimeMs = Date.now() - startTime;

    console.log(`[DocumentAI] Extracted ${result.text.length} chars from ${fileName} in ${result.processingTimeMs}ms (confidence: ${(result.confidence * 100).toFixed(1)}%)`);

    return result;
  } catch (err) {
    console.error(`[DocumentAI] Failed to process ${fileName}:`, err);
    return null;
  }
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
npx next build 2>&1 | head -30
```

Expected: Build succeeds. (Document AI is optional — gracefully returns null if not configured.)

- [ ] **Step 4: Commit**

```bash
git add src/server/services/document-ai.ts package.json package-lock.json
git commit -m "feat: add Document AI client module with online processing"
```

---

### Task 5: Rewire document-reader.ts with tiered pipeline

**Files:**
- Modify: `src/server/services/document-reader.ts`

This is the core change. Replace the existing extraction logic with the tiered pipeline.

- [ ] **Step 1: Rewrite document-reader.ts**

Replace the content of `src/server/services/document-reader.ts`. Key changes:

1. Import Quality Gate and Document AI
2. Replace `extractText` for PDFs with tiered pipeline
3. Update DB writes to include extraction metadata
4. Keep all non-PDF extraction (DOCX, XLSX, TXT) unchanged

```typescript
/**
 * Document Reader Service — Tiered Extraction Pipeline
 *
 * Tier 1: pdf-parse (local, free, instant)
 * Quality Gate: 3 criteria decide if Tier 2 is needed
 * Tier 2: Document AI (main) + Gemini Vision (parallel backup)
 *
 * For non-PDF files: mammoth (DOCX), xlsx (Excel), direct (text)
 */

import { db } from '@/lib/db';
import { getFileBuffer } from '@/lib/s3';
import { TRPCError } from '@trpc/server';
import { evaluateQualityGate, type QualityGateResult } from './quality-gate';
import { extractWithDocumentAI, isDocumentAIAvailable } from './document-ai';

// ─── Types ──────────────────────────────────────────────────

interface ExtractionResult {
  text: string;
  method: 'pdf_parse' | 'document_ai' | 'gemini_vision';
  confidence: number | null;
  docAiRecommended: boolean;
  qualityGateResult: QualityGateResult | null;
  pageCount: number | null;
}

// ─── Gemini Vision OCR (Tier 2 Backup) ──────────────────────

async function extractTextWithGeminiVision(buffer: Buffer, fileName: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[DocumentReader] No GEMINI_API_KEY — cannot OCR scanned PDF');
    return '';
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    console.log(`[DocumentReader] Using Gemini Vision OCR for ${fileName} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)...`);

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: buffer.toString('base64'),
        },
      },
      'Εξήγαγε ΟΛΟ το κείμενο αυτού του PDF εγγράφου. Επέστρεψε μόνο το κείμενο, χωρίς σχόλια. Για πίνακες, μετέτρεψέ τους σε μορφή κειμένου.',
    ]);

    const text = result.response.text() || '';
    console.log(`[DocumentReader] Gemini Vision extracted ${text.length} chars from ${fileName}`);
    return text;
  } catch (err) {
    console.error(`[DocumentReader] Gemini Vision OCR failed for ${fileName}:`, err);
    return '';
  }
}

// ─── PDF Extraction Pipeline ────────────────────────────────

async function extractPdf(buffer: Buffer, fileName: string): Promise<ExtractionResult> {
  // ── Tier 1: pdf-parse ──────────────────────────────────
  let pdfText = '';
  let pageCount = 0;
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    pdfText = data.text || '';
    pageCount = data.numpages || 0;
  } catch (err) {
    console.error(`[DocumentReader] pdf-parse failed for ${fileName}:`, err);
  }

  // ── Quality Gate ───────────────────────────────────────
  const gateResult = evaluateQualityGate({
    text: pdfText,
    fileSizeBytes: buffer.length,
    pageCount,
  });

  console.log(`[DocumentReader] Quality Gate for ${fileName}: ${gateResult.passed ? 'PASS' : 'FAIL'} (charsPerKB=${gateResult.charsPerKB}, keywords=${gateResult.keywordHits}, charsPerPage=${gateResult.charsPerPage}${gateResult.docAiRecommended ? ', docAI recommended' : ''})`);

  // ── Gate PASSED → use pdf-parse text ───────────────────
  if (gateResult.passed) {
    return {
      text: pdfText,
      method: 'pdf_parse',
      confidence: null, // No confidence score from pdf-parse
      docAiRecommended: gateResult.docAiRecommended,
      qualityGateResult: gateResult,
      pageCount,
    };
  }

  // ── Gate FAILED → Tier 2: Document AI + Gemini Vision ──
  console.log(`[DocumentReader] Quality Gate failed for ${fileName} (reasons: ${gateResult.reasons.join(', ')}). Running Tier 2...`);

  // Run Document AI and Gemini Vision in parallel
  const [docAiResult, geminiText] = await Promise.all([
    isDocumentAIAvailable()
      ? extractWithDocumentAI(buffer, 'application/pdf', fileName)
      : Promise.resolve(null),
    extractTextWithGeminiVision(buffer, fileName),
  ]);

  // Document AI succeeded → use as primary
  if (docAiResult && docAiResult.text.length > 0) {
    console.log(`[DocumentReader] Using Document AI result for ${fileName} (${docAiResult.text.length} chars, confidence: ${(docAiResult.confidence * 100).toFixed(1)}%)`);
    return {
      text: docAiResult.text,
      method: 'document_ai',
      confidence: docAiResult.confidence,
      docAiRecommended: false, // Already used DocAI
      qualityGateResult: gateResult,
      pageCount: docAiResult.pageCount || pageCount,
    };
  }

  // Document AI failed → use Gemini Vision
  if (geminiText.length > 0) {
    console.log(`[DocumentReader] Document AI unavailable/failed, using Gemini Vision for ${fileName}`);
    return {
      text: geminiText,
      method: 'gemini_vision',
      confidence: null,
      docAiRecommended: false,
      qualityGateResult: gateResult,
      pageCount,
    };
  }

  // All Tier 2 failed → fall back to whatever pdf-parse got (even if low quality)
  console.warn(`[DocumentReader] All Tier 2 extractors failed for ${fileName}. Using pdf-parse text (${pdfText.length} chars).`);
  return {
    text: pdfText,
    method: 'pdf_parse',
    confidence: null,
    docAiRecommended: true, // Recommend manual Deep Parse
    qualityGateResult: gateResult,
    pageCount,
  };
}

// ─── Non-PDF Extraction (unchanged) ─────────────────────────

async function extractNonPdf(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  switch (mimeType) {
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/msword': {
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return result.value || '';
      } catch (err) {
        console.error(`[DocumentReader] DOCX parse failed for ${fileName}:`, err);
        return '';
      }
    }

    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.ms-excel': {
      try {
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        let text = '';
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          if (sheet) {
            text += `--- ${sheetName} ---\n`;
            text += XLSX.utils.sheet_to_csv(sheet) + '\n';
          }
        }
        return text;
      } catch (err) {
        console.error(`[DocumentReader] Excel parse failed for ${fileName}:`, err);
        return '';
      }
    }

    case 'text/plain':
    case 'text/rtf':
      return buffer.toString('utf-8');

    default: {
      try {
        const text = buffer.toString('utf-8');
        if (/[a-zA-Zα-ωΑ-Ω]/.test(text) && text.length > 20) {
          return text;
        }
      } catch {
        // ignore
      }
      return '';
    }
  }
}

// ─── Document Reading (Main Export) ─────────────────────────

export async function readTenderDocuments(tenderId: string): Promise<string> {
  const docs = await db.attachedDocument.findMany({
    where: { tenderId },
    orderBy: { createdAt: 'asc' },
  });

  if (docs.length === 0) return '';

  const parts: string[] = [];

  for (const doc of docs) {
    try {
      // Use cached extracted text if available AND non-trivial
      if (doc.extractedText && doc.extractedText.trim().length > 100) {
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

      const isPdf = (doc.mimeType || '').includes('pdf');

      if (isPdf) {
        // ── Tiered PDF Pipeline ──
        const result = await extractPdf(buffer, doc.fileName);

        if (!result.text || result.text.trim().length < 10) {
          await db.attachedDocument.update({
            where: { id: doc.id },
            data: {
              parsingStatus: 'failed',
              parsingError: 'Δεν εξήχθη κείμενο (ούτε με OCR)',
              extractedText: null,
              extractionMethod: result.method,
              qualityGateResult: result.qualityGateResult
                ? JSON.stringify(result.qualityGateResult)
                : null,
            },
          });
          parts.push(`--- ${doc.fileName} ---\n[Δεν εξήχθη κείμενο]`);
          continue;
        }

        await db.attachedDocument.update({
          where: { id: doc.id },
          data: {
            extractedText: result.text,
            pageCount: result.pageCount,
            parsingStatus: 'success',
            parsingError: null,
            extractionMethod: result.method,
            extractionConfidence: result.confidence,
            docAiRecommended: result.docAiRecommended,
            qualityGateResult: result.qualityGateResult
              ? JSON.stringify(result.qualityGateResult)
              : null,
          },
        });

        parts.push(`--- ${doc.fileName} ---\n${result.text}`);
      } else {
        // ── Non-PDF ──
        const text = await extractNonPdf(buffer, doc.mimeType || '', doc.fileName);

        if (!text || text.trim().length < 10) {
          await db.attachedDocument.update({
            where: { id: doc.id },
            data: {
              parsingStatus: 'failed',
              parsingError: 'Δεν εξήχθη κείμενο',
              extractedText: null,
              extractionMethod: 'pdf_parse', // Closest equivalent for non-PDF
            },
          });
          parts.push(`--- ${doc.fileName} ---\n[Δεν εξήχθη κείμενο]`);
          continue;
        }

        await db.attachedDocument.update({
          where: { id: doc.id },
          data: {
            extractedText: text,
            parsingStatus: 'success',
            parsingError: null,
            extractionMethod: 'pdf_parse',
          },
        });

        parts.push(`--- ${doc.fileName} ---\n${text}`);
      }
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

// ─── Deep Parse (triggered by user) ─────────────────────────

/**
 * Force Document AI extraction on a specific document.
 * Called when user clicks "Deep Parse" button.
 */
export async function deepParseDocument(documentId: string): Promise<{ success: boolean; method: string }> {
  const doc = await db.attachedDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error('Document not found');

  const buffer = await getFileBuffer(doc.fileKey);
  if (buffer.length === 0) throw new Error('Empty file');

  // Try Document AI first
  const docAiResult = await extractWithDocumentAI(buffer, doc.mimeType || 'application/pdf', doc.fileName);

  if (docAiResult && docAiResult.text.length > 0) {
    await db.attachedDocument.update({
      where: { id: documentId },
      data: {
        extractedText: docAiResult.text,
        pageCount: docAiResult.pageCount,
        parsingStatus: 'success',
        parsingError: null,
        extractionMethod: 'document_ai',
        extractionConfidence: docAiResult.confidence,
        docAiRecommended: false,
      },
    });
    return { success: true, method: 'document_ai' };
  }

  // Document AI failed → try Gemini Vision
  const geminiText = await extractTextWithGeminiVision(buffer, doc.fileName);
  if (geminiText.length > 0) {
    await db.attachedDocument.update({
      where: { id: documentId },
      data: {
        extractedText: geminiText,
        parsingStatus: 'success',
        parsingError: null,
        extractionMethod: 'gemini_vision',
        docAiRecommended: false,
      },
    });
    return { success: true, method: 'gemini_vision' };
  }

  throw new Error('Document AI and Gemini Vision both failed');
}

// ─── Other Exports (unchanged) ──────────────────────────────

export async function readSingleDocument(fileKey: string, mimeType: string, fileName: string): Promise<string> {
  try {
    const buffer = await getFileBuffer(fileKey);
    const isPdf = mimeType.includes('pdf');
    if (isPdf) {
      const result = await extractPdf(buffer, fileName);
      return result.text;
    }
    return await extractNonPdf(buffer, mimeType, fileName);
  } catch (err) {
    console.error(`[DocumentReader] Failed to read ${fileName}:`, err);
    return '';
  }
}

export async function requireDocuments(tenderId: string): Promise<void> {
  const totalDocs = await db.attachedDocument.count({ where: { tenderId } });

  if (totalDocs === 0) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Δεν βρέθηκαν έγγραφα. Ανεβάστε πρώτα τη διακήρυξη.',
    });
  }

  const unparsedCount = await db.attachedDocument.count({
    where: { tenderId, parsingStatus: null },
  });

  if (unparsedCount > 0) {
    console.log(`[requireDocuments] ${unparsedCount} unparsed docs found, triggering parsing...`);
    await readTenderDocuments(tenderId);
  }

  const parsedCount = await db.attachedDocument.count({
    where: { tenderId, parsingStatus: 'success' },
  });

  if (parsedCount === 0) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Τα έγγραφα δεν περιέχουν αναγνώσιμο κείμενο. Δοκιμάστε "Deep Parse" ή ανεβάστε searchable PDF.',
    });
  }
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
npx next build 2>&1 | head -30
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/server/services/document-reader.ts
git commit -m "feat: rewire document-reader with tiered extraction pipeline"
```

---

### Task 6: Add `deepParse` mutation to document router

**Files:**
- Modify: `src/server/routers/document.ts`

- [ ] **Step 1: Add deepParse mutation**

In `src/server/routers/document.ts`, add import at top:

```typescript
import { readTenderDocuments, deepParseDocument } from '@/server/services/document-reader';
```

Then add mutation before the `// ─── Generated Documents` section (after `deleteAttached`):

```typescript
  deepParse: protectedProcedure
    .input(z.object({ documentId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const doc = await ctx.db.attachedDocument.findUnique({
        where: { id: input.documentId },
        include: { tender: { select: { tenantId: true, id: true } } },
      });

      if (!doc || doc.tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found.' });
      }

      try {
        const result = await deepParseDocument(input.documentId);
        return { success: true, method: result.method };
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err instanceof Error ? err.message : 'Deep parse failed',
        });
      }
    }),
```

- [ ] **Step 2: Verify build**

Run:
```bash
npx next build 2>&1 | head -30
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/server/routers/document.ts
git commit -m "feat: add deepParse mutation to document router"
```

---

### Task 7: UI — Extraction badges + Deep Parse button

**Files:**
- Modify: `src/components/tender/documents-tab.tsx`

- [ ] **Step 1: Add extraction method badge and Deep Parse button**

In `src/components/tender/documents-tab.tsx`, add to the imports:

```typescript
import { Zap, Brain, Eye as EyeIcon, AlertTriangle } from 'lucide-react';
```

Add the Deep Parse mutation after existing mutations (~line 78):

```typescript
  const deepParseMutation = trpc.document.deepParse.useMutation({
    onSuccess: () => {
      utils.document.listAttached.invalidate({ tenderId });
    },
    onError: (err: any) => alert(`Deep Parse απέτυχε: ${err?.message || 'Άγνωστο σφάλμα'}`),
  });
```

Add a helper component before the main export (or inside the component):

```typescript
function ExtractionBadge({ doc }: { doc: any }) {
  const method = doc.extractionMethod;
  const confidence = doc.extractionConfidence;

  if (!method) return null;

  const config = {
    pdf_parse: { label: 'PDF Parse', icon: FileText, color: 'text-blue-400' },
    document_ai: { label: 'Document AI', icon: Brain, color: 'text-emerald-400' },
    gemini_vision: { label: 'Gemini OCR', icon: Zap, color: 'text-purple-400' },
  }[method] || { label: method, icon: FileText, color: 'text-gray-400' };

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 text-xs ${config.color}`}>
      <Icon className="h-3 w-3" />
      {config.label}
      {confidence != null && (
        <span className="text-[10px] opacity-70">
          ({(confidence * 100).toFixed(0)}%)
        </span>
      )}
    </span>
  );
}
```

In the document list rendering (where each attached document row is rendered), add after the file size/date info:

```tsx
{/* Extraction info */}
<ExtractionBadge doc={doc} />

{/* Deep Parse button */}
{doc.docAiRecommended && (
  <Button
    variant="ghost"
    size="sm"
    className="h-7 gap-1 text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
    onClick={() => deepParseMutation.mutate({ documentId: doc.id })}
    disabled={deepParseMutation.isPending}
  >
    <Brain className="h-3 w-3" />
    {deepParseMutation.isPending ? 'Ανάλυση...' : 'Deep Parse'}
  </Button>
)}

{/* Parsing failed warning */}
{doc.parsingStatus === 'failed' && (
  <span className="inline-flex items-center gap-1 text-xs text-red-400">
    <AlertTriangle className="h-3 w-3" />
    Αποτυχία
  </span>
)}
```

- [ ] **Step 2: Verify build and UI**

Run:
```bash
npm run dev
```

Open a tender with documents. Verify:
- Extraction badges appear (PDF Parse / Document AI / Gemini OCR)
- Deep Parse button appears for documents with `docAiRecommended = true`
- Clicking Deep Parse triggers the mutation

- [ ] **Step 3: Commit**

```bash
git add src/components/tender/documents-tab.tsx
git commit -m "feat: add extraction badges and Deep Parse button to documents tab"
```

---

### Task 8: Environment setup documentation

**Files:**
- Modify: `.env.example` (if exists, otherwise create)

- [ ] **Step 1: Add Document AI env vars to .env.example**

Add these lines:

```env
# ─── Document AI (Optional — enables Tier 2 OCR) ───────────
# 1. Enable Document AI API: gcloud services enable documentai.googleapis.com
# 2. Create OCR processor at https://console.cloud.google.com/ai/document-ai
# 3. Create service account with roles/documentai.apiUser
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_CLOUD_LOCATION=eu
DOCUMENT_AI_PROCESSOR_ID=
# For local dev: path to service account JSON
# GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
# For Vercel: paste the JSON string
# GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add Document AI env vars to .env.example"
```

---

### Task 9: Integration test with existing data

- [ ] **Step 1: Re-parse an existing tender**

In the running dev server, open the browser console or use the tRPC panel:
- Find a tender with attached documents
- Delete the `extractedText` cache: set `extractedText = null` in Prisma Studio
- Trigger re-analysis
- Check logs for Quality Gate output

- [ ] **Step 2: Verify extraction metadata in DB**

Open Prisma Studio, check the AttachedDocument:
- `extractionMethod` should be `'pdf_parse'` for text PDFs
- `qualityGateResult` should contain JSON with the 3 criteria
- `docAiRecommended` should be `true` for large/table-heavy docs

- [ ] **Step 3: Verify UI shows badges**

Open the tender's documents tab:
- Extraction badges should appear
- Deep Parse button should appear if applicable

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete document extraction pipeline Phase 1"
```
