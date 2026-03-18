# TenderCopilot — Discovery & AI Reliability Redesign
**Date:** 2026-03-18
**Status:** Approved

---

## Overview

Five interconnected improvements to make TenderCopilot reliable and useful for both Greek public and private sector tenders:

1. Hard guards that block AI analysis when prerequisites are missing
2. KAD codes in company profile as basis for discovery relevance
3. New discovery sources: EU Portal, TED, and Greek private sector
4. Country and sector filters for discovery
5. Language selection (Greek/English) for AI analysis output

---

## Existing Code Notes (already implemented)

- `CompanyProfile.kadCodes String[]` — already in schema, no migration needed
- `TenderPlatform.TED` — already in enum
- `src/lib/kad-cpv-map.ts` — already exists as TypeScript module (not JSON), `kadToCpv()` already wired into discovery
- `TenderDiscoveryService.searchTenders()` — already accepts `showAll`, `platforms`, `kadCodes`, `keywords`
- `getRecommended` router — already delegates to `matchTendersForTenant()`

---

## 1. Hard Guards

### 1a. Document Guard (AI Analysis)
**Rule:** No attached documents with `parsingStatus = 'success'` → block ALL AI analysis.

Affected services: `summarizeTender`, `goNoGoAnalysis`, `extractClauses`, `extractFinancialRequirements`, `analyzeTechnicalRequirements`, `flagTechnicalRisks`.

Shared helper in `src/server/services/document-reader.ts`:
```ts
export async function requireDocuments(tenderId: string): Promise<void>
```
- Queries `AttachedDocument` where `tenderId` AND `parsingStatus = 'success'`
- If count === 0 → throws `TRPCError({ code: 'PRECONDITION_FAILED', message: 'Δεν βρέθηκαν αναλύσιμα έγγραφα. Κατεβάστε πρώτα τη διακήρυξη.' })`
- Called as first line of every AI service method

UI: `<NoDocumentsAlert tenderId={tenderId} sourceUrl={tender.sourceUrl} />` component shown in all AI tabs when this error is received. Includes "Προσπάθεια λήψης εγγράφων" button that calls `discovery.fetchDocumentsFromSource` mutation. Requires `tenderId` and `sourceUrl` passed into each tab component from the parent tender page. If `sourceUrl` is null (manually created tender), the retry button is hidden — only the message is shown.

### 1b. KAD Guard (Discovery)
**Rule:** Company profile has zero KAD codes → block discovery, show setup banner.

Implementation: Add check at top of `getRecommended` procedure in `src/server/routers/discovery.ts`:
```ts
const company = await ctx.db.companyProfile.findFirst({ where: { tenantId: ctx.tenantId } });
if (!company || company.kadCodes.length === 0) {
  return { tenders: [], missingKad: true };
}
```
UI: Banner "Προσθέστε ΚΑΔ στο προφίλ σας για να δείτε σχετικούς διαγωνισμούς" with link to company settings.

Note: `matchTendersForTenant()` currently returns unfiltered results (score=0) when no KAD codes exist — this guard prevents that silent fallback.

---

## 2. Company Profile — ΚΑΔ Codes

### Schema
`CompanyProfile.kadCodes String[]` already exists. No migration needed.

### UI
Update existing KAD section in `src/components/company/profile-form.tsx`:
- Add/remove KAD codes with format validation: regex `^\d{2}\.\d{2,4}$` (e.g., `62.01`, `43.22`)
- Note: format is numeric (`62.01`), NOT Greek-character prefixed
- On save → update company record

### CPV Mapping
`src/lib/kad-cpv-map.ts` already exists with `kadToCpv()`. No changes needed.

---

## 3. Discovery Sources

### 3a. Existing (no changes)
- **Diavgeia** — Greek public sector
- **ΚΗΜΔΗΣ (cerpp.eprocurement.gov.gr)** — Greek public procurement (note: spec previously said ΕΣΗΔΗΣ incorrectly)

### 3b. New: TED API
- Endpoint: `https://api.ted.europa.eu` (public, no auth)
- Search by CPV codes + country code `GR` or all EU
- Response includes document download links (PDF/DOCX)
- Platform label: `'TED'` (already in enum)
- `DiscoveredTender.country` = ISO code from TED response (e.g., `'GR'`, `'DE'`)

### 3c. New: EU Funding & Tenders Portal
- URL: `ec.europa.eu/info/funding-tenders/opportunities/portal`
- No auth required for browsing and document download
- Scraping via `fetch` + regex (same pattern as existing importer — cheerio already in deps)
- `DiscoveredTender.platform = 'OTHER'`, `DiscoveredTender.sourceLabel = 'EU Portal'`
- `DiscoveredTender.country = 'EU'`

### 3d. New: Private Sector — Built-in List
File: `src/data/private-sources.json`
```json
[
  { "name": "ΔΕΗ", "url": "https://...", "country": "GR", "sector": "energy" },
  { "name": "ΕΥΔΑΠ", "url": "https://...", "country": "GR", "sector": "utilities" },
  { "name": "OTE/Cosmote", "url": "https://...", "country": "GR", "sector": "telecom" },
  { "name": "Εθνική Τράπεζα", "url": "https://...", "country": "GR", "sector": "finance" },
  { "name": "Alpha Bank", "url": "https://...", "country": "GR", "sector": "finance" }
]
```
**Note:** Actual procurement portal URLs for each company require manual research before implementation.

### 3e. New: Private Sector — Custom URLs
New Prisma model:
```prisma
model PrivateTenderSource {
  id        String   @id @default(cuid())
  tenantId  String
  name      String
  url       String
  country   String   @default("GR")
  active    Boolean  @default(true)
  createdAt DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
}
```
Add back-relation to `Tenant` model: `privateTenderSources PrivateTenderSource[]`

UI: Settings page "Ιδιωτικές Πηγές" — add/remove/toggle custom URLs.

---

## 4. Discovery Filters

### DiscoveredTender — new fields
```ts
interface DiscoveredTender {
  // existing fields...
  country?: string        // ISO code: 'GR', 'DE', 'EU', etc.
  sourceLabel?: string    // e.g., 'EU Portal', 'ΔΕΗ'
  isPrivate?: boolean     // true for private sector sources
}
```
Update `platform` union to include `'OTHER'`:
```ts
platform: 'KIMDIS' | 'DIAVGEIA' | 'TED' | 'ESIDIS' | 'OTHER' | 'PRIVATE'
```

### TenderSearchParams — new fields
```ts
interface TenderSearchParams {
  // existing...
  country?: 'GR' | 'EU' | 'international' | 'all'
  entityType?: 'public' | 'private' | 'all'
  relevanceOnly?: boolean   // true = only KAD-matching results
}
```

### tRPC input schema update
`discovery.search` and `discovery.getRecommended` input schemas gain:
```ts
country: z.enum(['GR', 'EU', 'international', 'all']).optional(),
entityType: z.enum(['public', 'private', 'all']).optional(),
relevanceOnly: z.boolean().optional(),
```
Also extend the existing `platforms` enum in `discovery.search` from `['KIMDIS', 'DIAVGEIA', 'TED', 'ESIDIS']` to include `'OTHER'` and `'PRIVATE'`.

### UI Filter Bar
Filter bar on Discovery page with country, entity type, relevance toggles. Stored in URL params for shareability.

---

## 5. Language Selection for AI Analysis

### Storage
Add to `Tender` model (single field covers all 5 analysis types):
```prisma
analysisLanguage  String  @default("el")
```
**Rationale:** One field on `Tender` is cleaner than adding to each AI output model (`TenderBrief`, `GoNoGoDecision`, `LegalClause`, `PricingScenario`, `TechnicalProposalSection`).

### UX Flow
When user triggers any AI analysis:
1. Modal: "Γλώσσα αποτελεσμάτων" — **Ελληνικά** (default) / **English** (use Lucide `Globe` icon, not flag emojis)
2. Selection saved to `Tender.analysisLanguage`
3. Remembered for subsequent analyses on same tender

### Implementation
- `language: 'el' | 'en'` param added to all AI service methods
- Injected into every system prompt: `"Respond in ${language === 'en' ? 'English' : 'Greek (ελληνικά)'}."`

---

## Data Flow

```
User opens Discovery
  → Check: company.kadCodes.length > 0?
    → NO: Show KAD guard banner (link to company settings)
    → YES: Run discovery with CPV filter + country + entityType + relevanceOnly filters
      → Results shown with country/sector badges
        → User clicks tender → Import (URL importer)
          → Check: attachedDocuments with parsingStatus='success' > 0?
            → NO: Show <NoDocumentsAlert> with retry button
            → YES: Analysis tabs enabled
              → User clicks "Εκτέλεση Ανάλυσης"
                → Language modal (el/en)
                  → requireDocuments() guard
                    → AI runs on real documents only
                      → Result stored with Tender.analysisLanguage
```

---

## Files Affected

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `PrivateTenderSource` model, `Tenant` back-relation, `Tender.analysisLanguage` |
| `src/server/services/document-reader.ts` | Add `requireDocuments()` helper |
| `src/server/services/ai-bid-orchestrator.ts` | Call `requireDocuments()`, add `language` param |
| `src/server/services/ai-legal-analyzer.ts` | Call `requireDocuments()`, add `language` param |
| `src/server/services/ai-financial.ts` | Call `requireDocuments()`, add `language` param |
| `src/server/services/ai-technical.ts` | Call `requireDocuments()`, add `language` param |
| `src/server/services/tender-discovery.ts` | New sources (TED, EU Portal, private), new filter params, `country`/`sourceLabel`/`isPrivate` fields |
| `src/server/routers/discovery.ts` | KAD guard in `getRecommended`, new filter params in input schema |
| `src/server/routers/ai-roles.ts` | Pass `language` param to AI services |
| `src/components/tender/*-tab.tsx` | `<NoDocumentsAlert>` component, language modal |
| `src/components/discovery/` | Filter bar, KAD guard banner |
| `src/components/company/profile-form.tsx` | KAD validation regex `^\d{2}\.\d{2,4}$` |
| `src/data/private-sources.json` | Built-in private sector list (URLs need research) |

---

## Out of Scope
- Automated scraping scheduler (Phase 2)
- Email notifications for new matching tenders (Phase 2)
- Automatic KAD suggestion based on company description (Phase 2)
- Actual procurement portal URLs for built-in private sources (research needed separately)
