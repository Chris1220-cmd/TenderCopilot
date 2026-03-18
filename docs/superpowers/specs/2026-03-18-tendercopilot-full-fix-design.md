# TenderCopilot — Full Fix & AI Pipeline Rebuild

**Date**: 2026-03-18
**Status**: Final
**Approach**: B — Rebuild AI Pipeline, fix frontend, upgrade discovery

## Context

TenderCopilot is a paid multi-tenant SaaS platform for Greek companies to manage public tender participation. It discovers tenders from Greek (Diavgeia, KIMDIS) and European (TED) sources, imports them, downloads their documents, and uses AI to analyze them across Brief, Legal, Financial, and Technical dimensions.

**Current state**: Build passes, dev server runs, but the end-to-end flow is broken. 83+ bugs identified across backend services and frontend components. AI analysis fails silently, documents don't get downloaded, and the frontend has broken upload buttons, edit-creates-duplicate bugs, and hardcoded data.

**Goal**: Make the entire flow work end-to-end with real data. AI must be reliable — no fabrication, no assumptions. When info is missing from documents, the system explicitly flags it. The tool should replace consulting offices that do this work manually.

## Architecture Overview

```
User → Company Profile (KAD codes via CompanyProfile, certs, projects)
     → Discovery (Diavgeia + KIMDIS + TED)
        → Filter by KAD / Show All toggle
        → Import Tender → Download Documents
     → Manual Import (URL paste or file upload)
     → AI Analysis Pipeline:
        → Document Parsing (PDF/Word → text, chunked)
        → Brief Analysis (summary, timeline, key points)
        → Legal Analysis (clauses, risks, requirements)
        → Financial Analysis (budget, guarantees, eligibility)
        → Go/No-Go Decision (weighted factors)
     → Frontend Display (tabs with real data, missing-info alerts)
```

## Naming Conventions (Important for Implementation)

- **Document model** in Prisma is called `AttachedDocument` (not `Document`). All references in this spec to "Document" mean the `AttachedDocument` model.
- **KAD codes** already exist on `CompanyProfile.kadCodes` (schema line 146). No new field needed.
- **Financial data** already exists in `FinancialProfile` model (turnover, equity, ebitda, debt by year). No new Tenant fields needed.
- **AI Model env var** is `AI_MODEL` (not `CLAUDE_MODEL`). Existing code already reads this.
- **AI Provider singleton** already exists in `provider.ts` via `ai()` function. Keep this pattern.

---

## Phase 1: Infrastructure Fixes

**Migration order**: Phase 1.3 (enum) runs first as a standalone migration. Phase 1.5 (indexes) runs second.

### 1.1 AI Model Configuration
**Problem**: `claude-provider.ts` uses `claude-sonnet-4-6`. Memory from March 17 confirms this model works.
**Fix**: Keep `claude-sonnet-4-6` as default. It's configurable via `AI_MODEL` env var. Verify it still responds on startup with a lightweight test call (optional, can be skipped for speed).
**Note**: When upgrading to Opus later, change env var to `claude-opus-4-6`.

### 1.2 Supabase Storage Verification
**Problem**: S3 client has in-memory fallback that loses files on restart. New Minio client created per operation.
**Fix**:
- Verify Supabase Storage bucket `tendercopilot` is accessible
- Remove in-memory fallback — hard fail with clear error if storage not configured
- Create singleton Minio/S3 client (module-level, lazy init)
- Add retry logic (3 attempts with exponential backoff)
- Add file size validation (max 50MB per file)

### 1.3 Platform Enum Fix (Migration 1)
**Problem**: Prisma `TenderPlatform` enum has `ESIDIS | COSMOONE | ISUPPLIES | OTHER | PRIVATE` but discovery returns `DIAVGEIA | TED | KIMDIS`.
**Fix**:
- Add `DIAVGEIA`, `TED`, `KIMDIS` to `TenderPlatform` enum
- Run Prisma migration
- Update discovery service to use correct enum values
- Update `platformMap` in `status-badge.tsx` to include labels for DIAVGEIA, TED, KIMDIS
- Keep `OTHER` for manual imports

### 1.4 Error Propagation
**Problem**: AI calls fail silently. Frontend mutations have no `onError` handlers.
**Fix**:
- Every AI service method: catch errors, log with context, re-throw with user-friendly Greek message
- Every tRPC mutation: return structured error with code + message
- Every frontend mutation: add `onError` handler that shows toast notification
- Add error banners on all analysis tabs when analysis fails

### 1.5 Database Indexes (Migration 2)
**Problem**: Missing indexes on frequently queried fields.
**Fix**: Add indexes on `Tender.tenantId`, `Tender.status`, `LegalClause.riskLevel`, `AttachedDocument.tenderId`.

### 1.6 AI Rate Limiting & Cost Controls
**Problem**: No protection against excessive AI API calls. Paid SaaS needs cost controls.
**Fix**:
- Add per-tenant daily token limit (configurable, default 500K tokens/day)
- Track token usage per AI call in `Activity` model
- Add concurrency guard on tender analysis: flag `Tender.analysisInProgress` (boolean). Only one analysis run per tender at a time. Second request returns "Analysis already running."
- Log token usage per call for cost monitoring
- Frontend: disable analysis button while `analysisInProgress` is true

---

## Phase 2: Discovery Upgrade

### 2.1 KAD-Based Smart Discovery
**Current**: ~30 KAD→CPV mappings. Search terms hardcoded to 2 Greek words.
**Fix**:
- Expand KAD→CPV mapping to cover all major KAD categories (at minimum top 200 codes used in Greek tenders)
- Company Profile already has `kadCodes` field on `CompanyProfile` model — use this
- Discovery primary search: filter by company's KAD → CPV codes
- "Show All" toggle: when enabled, show all tenders regardless of KAD match
- Badge on each result: "Σχετικός με KAD" (green) vs "Γενικός" (gray)

### 2.2 Multi-Source Discovery
Each source returns standardized format:
```typescript
interface DiscoveredTender {
  title: string;
  description?: string;
  budget?: number;
  submissionDeadline?: Date;
  publishDate?: Date;
  platform: TenderPlatform;
  cpvCodes: string[];
  sourceUrl: string;
  documentUrls: string[];
  contractingAuthority?: string;
  referenceNumber?: string;
}
```

**Diavgeia**: Fix search — use multiple subject types (DIAKIRIXI, PROKIRIKSI, PERILIFSI_DIAKIRIXI). Increase timeout to 30s.
**KIMDIS**: promitheia.gov.gr — parse search results. Handle pagination. Note: HTML structure may change; implement with clear selector constants for easy maintenance.
**TED**: Verify current TED API version and auth requirements before implementing. Search by CPV + country. Handle timeout (30s).

**ESIDIS**: Moved to Non-Goals. ESIDIS (esidis.gr) does not have a public API, and scraping a government procurement portal carries legal and reliability risks. Can be added in a future phase if a legitimate integration path is found.

### 2.3 Relevance Scoring
Scoring formula (0-100):
- CPV exact match: 40 points
- CPV category match: 20 points
- Budget within company's typical range: 15 points
- Deadline >= 15 days: 15 points (scales linearly, 0 if < 5 days)
- Geographic match: 10 points

### 2.4 Tender Import
Three import paths, all ending with document download:

1. **From Discovery**: Click "Import" → create Tender record → download all documents from `documentUrls` → store in S3 → create `AttachedDocument` records
2. **From URL**: Paste URL → auto-detect platform → scrape metadata + document links → same as above
3. **From Upload**: Upload PDF/Word files → create Tender + `AttachedDocument` records → AI extracts metadata from content

---

## Phase 3: Document Pipeline & AI Analysis

### 3.1 Document Download & Parsing
**Download**:
- Fetch documents from source URLs
- Validate content-type (PDF, DOCX, DOC, ZIP)
- Store in Supabase Storage with key: `tenants/{tenantId}/tenders/{tenderId}/docs/{filename}`
- Create `AttachedDocument` record linking to S3 key

**Parsing**:
- PDF: `pdf-parse` library → extract text per page
- DOCX: `mammoth` library → extract text
- ZIP: Extract files using `adm-zip`, parse each individually
- Scanned PDFs (no text): Store warning "Σκαναρισμένο PDF — δεν εξήχθη κείμενο" in `parsingError`

**No more 30KB truncation**: Instead of truncating, store full extracted text. For AI calls, use intelligent chunking:
- If total text across all docs < 150K chars (~100K tokens): send full text
- If > 150K chars: split into chunks by section headings, process each chunk, merge results
- Hard cap: never send more than 180K tokens per AI call (leave room for system prompt + response)

**Storage**: Extracted text stored in `AttachedDocument.extractedText` field (new column, type `Text`).

### 3.2 AI Analysis Rules (CRITICAL)

Every AI prompt MUST include these instructions:

```
ΚΑΝΟΝΕΣ ΑΝΑΛΥΣΗΣ:
1. Απάντησε ΑΠΟΚΛΕΙΣΤΙΚΑ βάσει του κειμένου που σου δίνεται.
   ΜΗΝ υποθέσεις, ΜΗΝ συμπληρώσεις, ΜΗΝ επινοήσεις πληροφορίες.
2. Αν μια πληροφορία ΔΕΝ υπάρχει στο κείμενο, γράψε: "ΔΕΝ ΑΝΑΦΕΡΕΤΑΙ ΣΤΟ ΕΓΓΡΑΦΟ"
3. Για κάθε πληροφορία που εξάγεις, βαθμολόγησε confidence (0.0-1.0)
4. Απάντησε σε ελληνικά
5. Χρησιμοποίησε ορολογία σύμφωνη με τον Ν.4412/2016
```

**Response validation**: Every AI response is validated before storage:
- Must be valid JSON
- Required fields must exist (even if value is "ΔΕΝ ΑΝΑΦΕΡΕΤΑΙ")
- Confidence scores must be 0.0-1.0
- If validation fails → retry once → if still fails → store error, show to user

### 3.3 AI Brief Analysis
**Input**: Full document text (or chunked)
**Output**:
```typescript
interface TenderBrief {
  title: string;                    // Τίτλος διαγωνισμού
  summary: string;                  // Σύνοψη 200-300 λέξεις
  contractingAuthority: string;     // Αναθέτουσα αρχή
  referenceNumber: string;          // Αριθμός διακήρυξης
  budget: { value: number | null; confidence: number; };
  submissionDeadline: { value: string | null; confidence: number; };
  cpvCodes: string[];
  keyPoints: string[];              // 5-10 βασικά σημεία
  timeline: { event: string; date: string; }[];
  missingInfo: string[];            // ["Δεν βρέθηκε: ημερομηνία υποβολής", ...]
}
```

### 3.4 AI Legal Analysis
**Input**: Full document text
**Output**:
```typescript
interface LegalAnalysis {
  clauses: {
    title: string;
    content: string;
    riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    explanation: string;
    confidence: number;
  }[];
  requiredDocuments: {
    name: string;
    description: string;
    isMandatory: boolean;
    confidence: number;
  }[];
  exclusionCriteria: string[];
  clarificationQuestions: {
    question: string;
    reason: string;
    relatedClause?: string;
  }[];
  missingInfo: string[];
}
```

**Fix**: If no clauses found, return empty array (not error). This is valid for simple tenders.

### 3.5 AI Financial Analysis
**Input**: Full document text + company financial data from `FinancialProfile` model (if available)
**Output**:
```typescript
interface FinancialAnalysis {
  budget: { value: number | null; confidence: number; };
  guaranteeBid: { value: number | null; percentage: number | null; confidence: number; };
  guaranteePerformance: { value: number | null; percentage: number | null; confidence: number; };
  evaluationCriteria: {
    type: 'LOWEST_PRICE' | 'BEST_VALUE' | 'COST_EFFECTIVENESS';
    weights?: { technical: number; financial: number; };
    confidence: number;
  };
  fundingSource: { value: string | null; confidence: number; };
  eligibilityRequirements: {
    requirement: string;
    threshold?: string;
    confidence: number;
  }[];
  missingInfo: string[];
}
```

**Fixes**:
- No budget default to `budget * 2` — if not found, return null
- No current ratio approximation — use `FinancialProfile` data if available, otherwise skip eligibility check and flag it as "Λείπουν τα οικονομικά στοιχεία εταιρείας"
- Pricing scenarios only generated when budget is confirmed from documents

### 3.6 AI Go/No-Go Decision
**Input**: Brief + Legal + Financial analysis results + company profile
**Output**:
```typescript
interface GoNoGoDecision {
  decision: 'GO' | 'NO_GO' | 'BORDERLINE';
  overallScore: number;           // 0-100
  factors: {
    name: string;
    score: number;                // 0-100
    weight: number;               // 0.0-1.0
    explanation: string;
  }[];
  recommendation: string;         // Detailed recommendation in Greek
  risks: string[];
  missingInfo: string[];          // Info needed for better decision
}
```

**Fix**: Upsert — one Go/No-Go per tender (update existing, don't create duplicate).

### 3.7 Missing Info Aggregation
After all analyses complete, aggregate all `missingInfo` arrays into a unified "Missing Information" panel shown prominently on the tender detail page. Each item categorized by source (Brief/Legal/Financial).

---

## Phase 4: Frontend Fixes

### 4.1 Company Profile
- Fix upload buttons (certificates, legal docs, projects) — real file upload to S3
- Fix edit vs create bug — use update mutation when editing existing record
- KAD codes already available via `CompanyProfile.kadCodes` — ensure the UI input works
- Financial data already available via `FinancialProfile` model — ensure the UI form works

### 4.2 Tender List & Dashboard
- Add missing statuses to `statusConfig`: `DISCOVERY`, `GO_NO_GO` already in Prisma enum but missing from frontend `statusConfig` map
- Add `platformMap` entries for `DIAVGEIA`, `TED`, `KIMDIS` in `status-badge.tsx`
- Replace hardcoded sparkline data with real DB queries
- Persist filter state in URL search params

### 4.3 Tender Detail Tabs
- All mutations get `onError` handler → toast notification
- Disable buttons during loading (prevent double-click)
- Legal tab: persist clarification questions and approvals to DB via tRPC mutations
- Financial tab: persist selected pricing scenario to DB
- Technical tab: load existing data from DB on mount
- Documents tab: real upload → S3, no placeholder content

### 4.4 Centralized AI Analysis Flow
- Single "Ανάλυση Διαγωνισμού" button on tender detail page header
- This SUPPLEMENTS per-tab individual analysis buttons (user can re-run just Legal, for example)
- Progress steps: "Ανάγνωση εγγράφων..." → "Σύνοψη..." → "Νομική ανάλυση..." → "Οικονομική ανάλυση..." → "Αξιολόγηση Go/No-Go..."
- Each step updates DB as it completes
- If a step fails, show error but continue with remaining steps
- "Missing Information" panel aggregates all gaps across analyses
- Button disabled when `Tender.analysisInProgress` is true

### 4.5 Error States
- Every tab shows error banner when analysis failed
- Retry button per analysis type
- Loading skeletons during initial data fetch
- Empty states with clear CTAs ("Ανεβάστε έγγραφα για να ξεκινήσει η ανάλυση")

---

## Prisma Schema Changes

### Migration 1 (Phase 1.3): Platform enum + indexes
```prisma
// Add to TenderPlatform enum
enum TenderPlatform {
  ESIDIS
  COSMOONE
  ISUPPLIES
  DIAVGEIA    // NEW
  TED         // NEW
  KIMDIS      // NEW
  OTHER
  PRIVATE
}

// Add to Tender model
model Tender {
  // ... existing fields ...
  analysisInProgress Boolean @default(false)  // NEW: concurrency guard

  @@index([tenantId])  // NEW
  @@index([status])    // NEW
}

// Add indexes to existing models
// AttachedDocument: @@index([tenderId])
// LegalClause: @@index([riskLevel])
```

### Migration 2 (Phase 3.1): Document parsing fields
```prisma
// Add to AttachedDocument model (NOTE: model is called AttachedDocument, not Document)
model AttachedDocument {
  // ... existing fields ...
  extractedText  String?  @db.Text  // NEW: Full extracted text from parsing
  pageCount      Int?               // NEW: Number of pages in document
  parsingStatus  String?            // NEW: 'success' | 'partial' | 'failed'
  parsingError   String?            // NEW: Error message if parsing failed
}
```

---

## Non-Goals (Explicitly Out of Scope)

- Billing/subscription management
- User onboarding wizard
- Email notifications
- PDF generation (technical/financial proposals)
- Mobile responsive design
- Multi-language (only Greek for now)
- OCR for scanned PDFs (future enhancement)
- Redis job queue (keep inline execution for now)
- ESIDIS integration (no public API, legal risks with scraping)

---

## Operational Notes

- **Dev environment**: Must use `eval "$(fnm env)" && fnm use 22 --arch x64` before running dev server (ARM64 Windows + Prisma constraint)
- **Database backups**: Take Supabase backup before running migrations
- **Package dependencies**: May need `adm-zip` for ZIP extraction. `pdf-parse` and `mammoth` already in project.

---

## Success Criteria

1. User can discover tenders from Diavgeia + TED filtered by KAD codes
2. User can toggle "Show All" to see all tenders regardless of KAD
3. User can import a tender and documents are downloaded automatically
4. AI Brief shows accurate summary with missing info flagged
5. AI Legal identifies clauses and required documents without fabricating
6. AI Financial extracts real numbers from documents, doesn't make up defaults
7. Go/No-Go provides justified recommendation based on actual data
8. All frontend CRUD operations work (no broken buttons, no duplicates)
9. Dashboard shows real metrics
10. Errors are visible to the user with clear messages
11. AI costs are tracked and rate-limited per tenant
