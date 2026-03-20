# Document Extraction Pipeline — Phase 1 Design

**Date:** 2026-03-20
**Status:** Draft
**Author:** Christos Athanasopoulos + Claude

## Problem

The current document extraction pipeline uses pdf-parse with Gemini Vision as a fallback. This approach:
- Misses contracting authority and other fields in some tenders (false positive "missing info")
- Has no structured table extraction capability
- Uses a single threshold (charsPerKB < 1) that can be fooled by garbled OCR output
- Has no audit trail of which extractor produced each result
- Provides no way for users to request deeper parsing when needed

## Solution

A three-tier extraction pipeline with a smart Quality Gate:

```
Upload PDF
    │
    ▼
┌─────────────────────────────────────────────┐
│  TIER 1: pdf-parse (local, free, instant)   │
│  → Extract text + count pages               │
└──────────────┬──────────────────────────────┘
               │
       ┌───────▼────────┐
       │  Quality Gate  │
       │  (3 criteria)  │
       └───┬─────────┬──┘
           │         │
      PASS ▼    FAIL ▼
    ┌──────────┐  ┌──────────────────────────────────┐
    │ Text OK  │  │ TIER 2: Document AI (main)       │
    │ Use it   │  │ + Gemini Vision (parallel backup) │
    │          │  │                                    │
    │ Evaluate │  │ DocAI = primary result             │
    │ docAI_   │  │ Gemini = cross-check / fallback   │
    │ recomm.  │  │                                    │
    │ flag     │  │ If DocAI fails → Gemini becomes   │
    └──────────┘  │ primary                            │
                  └──────────────────────────────────┘
```

## Quality Gate — 3 Criteria

The Quality Gate determines whether pdf-parse output is trustworthy. **Any** criterion failing triggers Tier 2.

### Criterion 1: Characters Per KB (`charsPerKB`)

```typescript
const charsPerKB = text.trim().length / (buffer.length / 1024);
const PASS = charsPerKB >= 3;
```

- `>= 3`: Healthy text-based PDF
- `< 3`: Likely scanned or image-heavy
- Current threshold of 1 is too low — raises it to 3 to catch partial-scan PDFs

### Criterion 2: Keyword Coverage

Check for presence of common Greek procurement terms in the extracted text:

```typescript
const TENDER_KEYWORDS = [
  'διακήρυξη', 'προκήρυξη', 'δημοπρασία',
  'αναθέτουσα', 'αναθέτων', 'φορέας',
  'προϋπολογισμός', 'μίσθωμα', 'δαπάνη',
  'προθεσμία', 'υποβολή', 'κατάθεση',
  'cpv', 'κωδικ',
  'τεχνικ', 'προδιαγραφ',
  'σύμβαση', 'σύμβασ',
];

// Normalize: lowercase + strip accents for matching
const normalizedText = stripAccents(text.toLowerCase());
const matchedCount = TENDER_KEYWORDS.filter(kw =>
  normalizedText.includes(stripAccents(kw))
).length;

const PASS = matchedCount >= 4; // At least 4 out of ~16 keywords
```

- If pdf-parse produces text but misses most procurement terms → scanned/garbled
- Accent-normalized matching (already have this utility in the codebase)

### Criterion 3: Characters Per Page Ratio

```typescript
const charsPerPage = text.trim().length / (pageCount || 1);
const PASS = charsPerPage >= 200; // A typical page has 1500-3000 chars
```

- A page with < 200 characters is almost certainly an image/scan
- Catches hybrid PDFs where some pages are scanned within a text PDF
- For 100+ page documents with low chars/page → definitely needs OCR

### Quality Gate Result

```typescript
interface QualityGateResult {
  passed: boolean;           // All 3 criteria pass
  charsPerKB: number;
  keywordHits: number;
  charsPerPage: number;
  docAiRecommended: boolean; // Tables detected but gate passed
  reasons: string[];         // Why it failed (for logging)
}
```

## DocAI Recommended Flag

Even when the Quality Gate passes, set `docAiRecommended = true` if:

1. **Many tables detected**: regex heuristic finds table-like patterns (consecutive lines with multiple `|` or tab separators, or numbered columns)
2. **Large document**: `pageCount > 30` — more likely to have complex layouts
3. **Financial data patterns**: many currency amounts (€, ευρώ) or percentage patterns

This flag is stored in the DB and shown in the UI as a "Deep Parse" button.

## Tier 2: Document AI + Gemini Vision

When Quality Gate fails, run both extractors:

### Document AI (Primary)

- **Processor**: OCR processor (prebuilt `projects/{project}/locations/eu/processors/{id}`)
- **Processing mode**:
  - Online for PDFs ≤ 15 pages
  - Batch for PDFs > 15 pages (writes output to GCS, polls for completion)
- **Output used**: Full text extraction with layout preservation
- **Location**: `eu` (GDPR compliance for Greek government documents)

```typescript
interface DocumentAIResult {
  text: string;
  pages: number;
  confidence: number;        // Average confidence across all pages
  tableCount: number;         // Number of detected tables
  processingTimeMs: number;
}
```

### Gemini Vision (Parallel Backup)

- Runs in parallel with Document AI (not sequentially)
- Uses existing `extractTextWithGeminiVision()` function
- Result stored separately for cross-check

### Merge Strategy

```typescript
if (documentAIResult.success) {
  primary = documentAIResult.text;
  method = 'document_ai';
} else {
  primary = geminiVisionResult.text;
  method = 'gemini_vision';
}
```

No complex merging — Document AI wins when available, Gemini Vision is pure fallback.

## Database Schema Changes

Add fields to `AttachedDocument`:

```prisma
model AttachedDocument {
  // ... existing fields ...

  extractionMethod   String?  // 'pdf_parse' | 'document_ai' | 'gemini_vision'
  extractionConfidence Float? // 0.0 - 1.0, from Document AI or heuristic
  docAiRecommended   Boolean @default(false)

  // Quality Gate details (stored as JSON for debugging)
  qualityGateResult  String? @db.Text // JSON: { charsPerKB, keywordHits, charsPerPage, passed, reasons }
}
```

## File Changes

### Modified Files

1. **`src/server/services/document-reader.ts`** — Main changes:
   - Add `qualityGate()` function with 3 criteria
   - Add `extractWithDocumentAI()` function
   - Modify `extractText()` to use the tiered pipeline
   - Update DB writes to include new fields
   - Keep existing `extractTextWithGeminiVision()` as-is

2. **`prisma/schema.prisma`** — Add 3 fields to AttachedDocument

3. **`src/components/tender/documents-tab.tsx`** — Add:
   - Extraction method badge per document (pdf-parse / Document AI / Gemini)
   - "Deep Parse" button when `docAiRecommended = true`
   - Confidence indicator

4. **`src/server/routers/document.ts`** — Add:
   - `deepParse` mutation: triggers Document AI for a specific document
   - Return new fields in `listAttached`

### New Files

5. **`src/server/services/document-ai.ts`** — Document AI client:
   - `processDocument()` for online (≤ 15 pages)
   - `batchProcessDocument()` for batch (> 15 pages)
   - GCP authentication via service account JSON

### New Dependencies

```
@google-cloud/documentai  — Document AI client library
```

## Environment Variables

```env
# Document AI (Phase 1)
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_LOCATION=eu              # EU for GDPR
DOCUMENT_AI_PROCESSOR_ID=your-processor-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
# OR for Vercel: GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# Existing (unchanged)
GEMINI_API_KEY=...
```

## GCP Setup Instructions

1. Create/select a Google Cloud project
2. Enable the Document AI API: `gcloud services enable documentai.googleapis.com`
3. Create an OCR processor:
   - Go to Document AI console → Create Processor → "Document OCR"
   - Select location: `eu`
   - Note the processor ID
4. Create a service account with `roles/documentai.apiUser`
5. Download the JSON key
6. For Vercel: store the JSON as `GOOGLE_SERVICE_ACCOUNT_JSON` env var

## UI: "Deep Parse" Button

When `docAiRecommended = true` for a document, show in documents-tab:

- Amber badge: "Προτείνεται Deep Parse"
- Button: "Ανάλυση με Document AI"
- On click: calls `deepParse` mutation → re-extracts with Document AI → refreshes

## Error Handling

| Scenario | Behavior |
|---|---|
| Document AI quota exceeded | Log warning, use Gemini Vision result |
| Document AI API down | Log error, use Gemini Vision result |
| Gemini Vision fails | Use pdf-parse text (even if low quality) |
| All three fail | Set `parsingStatus = 'failed'`, show error to user |
| PDF too large for Document AI online | Automatically use batch processing |
| GCP credentials missing | Skip Document AI, log warning, use Gemini Vision |

## Testing

### Golden Tender Tests

Create test fixtures with known-good outputs:

1. **Text-based PDF** (from ΔΙΑΥΓΕΙΑ): verify pdf-parse extracts correctly, Quality Gate passes
2. **Scanned PDF**: verify Quality Gate fails, Document AI extracts correctly
3. **Hybrid PDF** (text + scanned pages): verify Quality Gate catches it
4. **PDF with tables** (κτιριολογικό πρόγραμμα): verify docAiRecommended flag
5. **Large PDF** (100+ pages): verify batch processing works

### Unit Tests

- Quality Gate: test each criterion independently with mock data
- Merge strategy: test Document AI success, failure, and partial results
- Fallback chain: verify Gemini Vision takes over when Document AI fails

## Cost Estimate

| Component | Cost | When Used |
|---|---|---|
| pdf-parse | Free | Every PDF (Tier 1) |
| Document AI OCR | ~$1.50/1000 pages | ~40% of PDFs (scanned/hybrid) |
| Gemini Vision | ~$0.01/page (free tier generous) | Backup only (~5% of PDFs) |
| **Estimated monthly** | **~$5-15** for 500 tenders/month | Assuming avg 10 pages/tender |

## Non-Goals (Phase 2)

- Message queues / separate workers
- Per-tenant cost controls
- Metrics dashboards
- Model versioning / rollback
- These are documented in memory: `project_document_pipeline_phase2.md`
