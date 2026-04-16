# SP2.1 — Pricing Intelligence Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the persistent data layer for Pricing Intelligence — ingest 2 years of historical public-sector award decisions from ΔΙΑΥΓΕΙΑ + ΚΗΜΔΗΣ into a globally-shared `HistoricalAward` table and keep it fresh with a daily Vercel Cron job.

**Architecture:** New Prisma model with 5 indices, a normalizer service for Greek company names, a dedup-and-insert ingester, a paginated date-range fetcher extension, a one-time local backfill CLI script, and a Vercel Cron endpoint for daily incrementals.

**Tech Stack:** Prisma 6 (Supabase PostgreSQL), Next.js 14 API routes, `npx tsx` for CLI scripts, Vitest for tests.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `prisma/schema.prisma` | Add `HistoricalAward` model + `AwardSource` enum |
| `src/server/services/award-normalizer.ts` | Pure functions: normalize company names, authority names, compute award ratio |
| `src/server/services/award-ingester.ts` | Dedup-and-insert logic: URL dedup, fuzzy cross-source dedup, batch insert |
| `src/server/services/award-fetcher.ts` | Extend: add `fetchAwardsByDateRange()` for paginated date-bound fetching |
| `src/app/api/cron/ingest-awards/route.ts` | Vercel Cron handler: daily incremental ingestion |
| `scripts/backfill-awards.ts` | CLI tool: one-time 2-year backfill with resume support |
| `vercel.json` | Add cron schedule |
| `tests/services/award-normalizer.test.ts` | Unit tests for normalizer |
| `tests/services/award-ingester.test.ts` | Unit tests for ingester |

---

### Task 1: Prisma Schema — HistoricalAward Model

**Files:**
- Modify: `prisma/schema.prisma` (append after line ~1306)

- [ ] **Step 1: Add AwardSource enum and HistoricalAward model**

Open `prisma/schema.prisma` and append at the end of the file:

```prisma
// ─── Pricing Intelligence: Historical Awards ────────────────

enum AwardSource {
  DIAVGEIA
  KIMDIS
  TED
}

model HistoricalAward {
  id                  String      @id @default(cuid())

  // Source tracking
  source              AwardSource
  sourceUrl           String      @unique
  sourceRefId         String?

  // Core award data
  title               String
  winner              String
  winnerNormalized    String
  awardAmount         Decimal?    @db.Decimal(15, 2)
  budgetAmount        Decimal?    @db.Decimal(15, 2)
  awardRatio          Float?

  // Authority & geography
  authority           String
  authorityNormalized String
  region              String?

  // Categorization
  cpvCodes            String[]
  cpvPrimary          String?
  tenderType          String?
  procedureType       String?

  // Dates
  awardDate           DateTime
  publishedDate       DateTime?

  // Bid details
  numberOfBids        Int?

  // Raw data
  rawJson             Json?

  // Audit
  ingestedAt          DateTime    @default(now())

  @@index([cpvPrimary, awardDate])
  @@index([authorityNormalized])
  @@index([winnerNormalized])
  @@index([source, awardDate])
  @@index([tenderType, cpvPrimary])
}
```

- [ ] **Step 2: Push schema to database**

Run: `npx prisma db push`
Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Generate Prisma client**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add HistoricalAward model for pricing intelligence"
```

---

### Task 2: Award Normalizer Service

**Files:**
- Create: `src/server/services/award-normalizer.ts`
- Create: `tests/services/award-normalizer.test.ts`

- [ ] **Step 1: Write failing tests for normalizeCompanyName**

Create `tests/services/award-normalizer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  normalizeCompanyName,
  normalizeAuthority,
  computeAwardRatio,
} from '@/server/services/award-normalizer';

describe('normalizeCompanyName', () => {
  it('lowercases and strips legal suffixes', () => {
    expect(normalizeCompanyName('ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ Α.Ε.')).toBe('κατασκευαστικη');
  });

  it('handles ΙΚΕ suffix', () => {
    expect(normalizeCompanyName('Ηλεκτρολογική Παπαδόπουλος ΙΚΕ')).toBe('ηλεκτρολογικη παπαδοπουλος');
  });

  it('handles ΕΠΕ with dots', () => {
    expect(normalizeCompanyName('ΤΕΧΝΙΚΗ Ε.Π.Ε.')).toBe('τεχνικη');
  });

  it('handles OE suffix', () => {
    expect(normalizeCompanyName('ΑΔΕΛΦΟΙ ΓΕΩΡΓΙΟΥ Ο.Ε.')).toBe('αδελφοι γεωργιου');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeCompanyName('  MEGA   CONSTRUCTION   AE  ')).toBe('mega construction');
  });

  it('strips diacritics', () => {
    expect(normalizeCompanyName('Ένωση Εταιρειών')).toBe('ενωση εταιρειων');
  });

  it('handles empty string', () => {
    expect(normalizeCompanyName('')).toBe('');
  });

  it('handles SA and LTD English suffixes', () => {
    expect(normalizeCompanyName('TERNA SA')).toBe('terna');
  });

  it('strips standalone ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ', () => {
    expect(normalizeCompanyName('ΕΛΛΑΚΤΩΡ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ')).toBe('ελλακτωρ');
  });

  it('strips ΕΤΑΙΡΕΙΑ ΠΕΡΙΟΡΙΣΜΕΝΗΣ ΕΥΘΥΝΗΣ', () => {
    expect(normalizeCompanyName('ΔΟΜΗ ΕΤΑΙΡΕΙΑ ΠΕΡΙΟΡΙΣΜΕΝΗΣ ΕΥΘΥΝΗΣ')).toBe('δομη');
  });
});

describe('normalizeAuthority', () => {
  it('lowercases and strips diacritics but keeps entity type', () => {
    expect(normalizeAuthority('ΔΗΜΟΣ ΑΘΗΝΑΙΩΝ')).toBe('δημος αθηναιων');
  });

  it('handles ΥΠΟΥΡΓΕΙΟ prefix', () => {
    expect(normalizeAuthority('ΥΠΟΥΡΓΕΙΟ ΠΑΙΔΕΙΑΣ')).toBe('υπουργειο παιδειας');
  });

  it('collapses whitespace', () => {
    expect(normalizeAuthority('  ΔΗΜΟΣ   ΘΕΣΣΑΛΟΝΙΚΗΣ  ')).toBe('δημος θεσσαλονικης');
  });

  it('handles empty string', () => {
    expect(normalizeAuthority('')).toBe('');
  });
});

describe('computeAwardRatio', () => {
  it('returns ratio when both values present', () => {
    expect(computeAwardRatio(80000, 100000)).toBe(0.8);
  });

  it('returns null when award is null', () => {
    expect(computeAwardRatio(null, 100000)).toBeNull();
  });

  it('returns null when budget is null', () => {
    expect(computeAwardRatio(80000, null)).toBeNull();
  });

  it('returns null when budget is 0', () => {
    expect(computeAwardRatio(80000, 0)).toBeNull();
  });

  it('clamps ratio above 2.0 to null (bad data)', () => {
    expect(computeAwardRatio(300000, 100000)).toBeNull();
  });

  it('handles both null', () => {
    expect(computeAwardRatio(null, null)).toBeNull();
  });

  it('rounds to 4 decimal places', () => {
    expect(computeAwardRatio(75321, 100000)).toBe(0.7532);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/services/award-normalizer.test.ts`
Expected: FAIL — module `@/server/services/award-normalizer` not found

- [ ] **Step 3: Implement the normalizer**

Create `src/server/services/award-normalizer.ts`:

```typescript
/**
 * Award Normalizer — pure functions for normalizing Greek company/authority
 * names and computing derived fields for HistoricalAward records.
 */

// Greek legal suffixes to strip (order matters — longer first)
const LEGAL_SUFFIXES = [
  'ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ',
  'ΑΝΩΝΥΜΟΣ ΕΤΑΙΡΕΙΑ',
  'ΕΤΑΙΡΕΙΑ ΠΕΡΙΟΡΙΣΜΕΝΗΣ ΕΥΘΥΝΗΣ',
  'ΙΔΙΩΤΙΚΗ ΚΕΦΑΛΑΙΟΥΧΙΚΗ ΕΤΑΙΡΕΙΑ',
  'ΟΜΟΡΡΥΘΜΗ ΕΤΑΙΡΕΙΑ',
  'ΕΤΕΡΟΡΡΥΘΜΗ ΕΤΑΙΡΕΙΑ',
  'ΚΟΙΝΟΠΡΑΞΙΑ',
  'Α\\.?Ε\\.?',
  'Ε\\.?Π\\.?Ε\\.?',
  'Ι\\.?Κ\\.?Ε\\.?',
  'Ο\\.?Ε\\.?',
  'Ε\\.?Ε\\.?',
  'S\\.?A\\.?',
  'LTD\\.?',
  'GMBH',
  'B\\.?V\\.?',
];

/**
 * Strip diacritics from Greek/Latin text.
 * "Ένωση" → "Ενωση"
 */
function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalize a company name for grouping/dedup.
 * "ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ Α.Ε." → "κατασκευαστικη"
 */
export function normalizeCompanyName(name: string): string {
  if (!name) return '';

  let result = name.trim();
  result = stripDiacritics(result);
  result = result.toUpperCase(); // Normalize to uppercase first for suffix matching

  // Strip legal suffixes (longest first)
  for (const suffix of LEGAL_SUFFIXES) {
    const pattern = new RegExp(`\\s*${suffix}\\s*$`, 'i');
    result = result.replace(pattern, '');
    // Also strip if it appears as a standalone word
    const standalonePattern = new RegExp(`\\b${suffix}\\b`, 'gi');
    result = result.replace(standalonePattern, '');
  }

  // Lowercase, collapse whitespace, trim
  result = result.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

  return result;
}

/**
 * Normalize an authority name for grouping/dedup.
 * Unlike company names, keeps entity prefixes (ΔΗΜΟΣ, ΥΠΟΥΡΓΕΙΟ, etc.)
 */
export function normalizeAuthority(name: string): string {
  if (!name) return '';

  let result = name.trim();
  result = stripDiacritics(result);
  result = result.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

  return result;
}

/**
 * Compute award-to-budget ratio.
 * Returns null if either value is missing/zero or ratio > 2.0 (data quality filter).
 */
export function computeAwardRatio(
  awardAmount: number | null,
  budgetAmount: number | null,
): number | null {
  if (awardAmount == null || budgetAmount == null) return null;
  if (budgetAmount <= 0) return null;

  const ratio = awardAmount / budgetAmount;

  // Ratios > 2.0 indicate bad data (award > 2x budget is nonsensical)
  if (ratio > 2.0) return null;

  // Round to 4 decimal places
  return Math.round(ratio * 10000) / 10000;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/services/award-normalizer.test.ts`
Expected: All 16 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/award-normalizer.ts tests/services/award-normalizer.test.ts
git commit -m "feat: add award-normalizer service with Greek company name normalization"
```

---

### Task 3: Award Ingester Service

**Files:**
- Create: `src/server/services/award-ingester.ts`
- Create: `tests/services/award-ingester.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/services/award-ingester.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapAwardToRecord, type AwardRecord } from '@/server/services/award-ingester';

// Note: We test mapAwardToRecord (pure function) directly.
// dedupAndInsert and ingestBatch require a real DB and are tested via integration.

describe('mapAwardToRecord', () => {
  it('maps AwardResult to AwardRecord with normalized fields', () => {
    const input = {
      title: 'Προμήθεια ηλεκτρολογικού υλικού',
      winner: 'ΗΛΕΚΤΡΟΛΟΓΙΚΗ Α.Ε.',
      amount: 85000,
      authority: 'ΔΗΜΟΣ ΑΘΗΝΑΙΩΝ',
      date: new Date('2025-06-15'),
      cpvCodes: ['31500000-1', '31600000-2'],
      source: 'DIAVGEIA' as const,
      sourceUrl: 'https://diavgeia.gov.gr/decision/view/ABC123',
      budgetAmount: 100000,
      numberOfBids: 4,
    };

    const result = mapAwardToRecord(input);

    expect(result.title).toBe('Προμήθεια ηλεκτρολογικού υλικού');
    expect(result.winner).toBe('ΗΛΕΚΤΡΟΛΟΓΙΚΗ Α.Ε.');
    expect(result.winnerNormalized).toBe('ηλεκτρολογικη');
    expect(result.authority).toBe('ΔΗΜΟΣ ΑΘΗΝΑΙΩΝ');
    expect(result.authorityNormalized).toBe('δημος αθηναιων');
    expect(result.awardAmount).toBe(85000);
    expect(result.budgetAmount).toBe(100000);
    expect(result.awardRatio).toBe(0.85);
    expect(result.cpvPrimary).toBe('31500000');
    expect(result.cpvCodes).toEqual(['31500000-1', '31600000-2']);
    expect(result.source).toBe('DIAVGEIA');
    expect(result.sourceUrl).toBe('https://diavgeia.gov.gr/decision/view/ABC123');
    expect(result.numberOfBids).toBe(4);
    expect(result.awardDate).toEqual(new Date('2025-06-15'));
  });

  it('handles null amount and budget gracefully', () => {
    const input = {
      title: 'Test',
      winner: 'Test Co',
      amount: null,
      authority: 'Test Authority',
      date: new Date('2025-01-01'),
      cpvCodes: [],
      source: 'KIMDIS' as const,
      sourceUrl: 'https://example.com/1',
      budgetAmount: null,
      numberOfBids: null,
    };

    const result = mapAwardToRecord(input);

    expect(result.awardAmount).toBeNull();
    expect(result.budgetAmount).toBeNull();
    expect(result.awardRatio).toBeNull();
    expect(result.cpvPrimary).toBeNull();
  });

  it('extracts cpvPrimary from first CPV code without check digit', () => {
    const input = {
      title: 'Test',
      winner: 'X',
      amount: null,
      authority: 'Y',
      date: new Date(),
      cpvCodes: ['45233120-6', '45233000-9'],
      source: 'DIAVGEIA' as const,
      sourceUrl: 'https://example.com/2',
      budgetAmount: null,
      numberOfBids: null,
    };

    const result = mapAwardToRecord(input);
    expect(result.cpvPrimary).toBe('45233120');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/services/award-ingester.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the ingester**

Create `src/server/services/award-ingester.ts`:

```typescript
/**
 * Award Ingester — dedup-and-insert logic for HistoricalAward records.
 * Used by both the backfill script and the daily cron job.
 */

import type { PrismaClient, AwardSource } from '@prisma/client';
import type { AwardResult } from './award-fetcher';
import {
  normalizeCompanyName,
  normalizeAuthority,
  computeAwardRatio,
} from './award-normalizer';

// ─── Types ──────────────────────────────────────────────

export interface AwardRecord {
  source: AwardSource;
  sourceUrl: string;
  sourceRefId: string | null;
  title: string;
  winner: string;
  winnerNormalized: string;
  awardAmount: number | null;
  budgetAmount: number | null;
  awardRatio: number | null;
  authority: string;
  authorityNormalized: string;
  region: string | null;
  cpvCodes: string[];
  cpvPrimary: string | null;
  tenderType: string | null;
  procedureType: string | null;
  awardDate: Date;
  publishedDate: Date | null;
  numberOfBids: number | null;
  rawJson: any;
}

export type IngestResult = 'inserted' | 'duplicate-url' | 'duplicate-fuzzy' | 'error';

// ─── Mapping ────────────────────────────────────────────

/**
 * Map an AwardResult (from award-fetcher) to an AwardRecord (for DB insert).
 * Pure function — no I/O.
 */
export function mapAwardToRecord(award: AwardResult): AwardRecord {
  const cpvPrimary = award.cpvCodes.length > 0
    ? award.cpvCodes[0].split('-')[0]
    : null;

  return {
    source: award.source as AwardSource,
    sourceUrl: award.sourceUrl,
    sourceRefId: null,
    title: award.title,
    winner: award.winner,
    winnerNormalized: normalizeCompanyName(award.winner),
    awardAmount: award.amount ?? null,
    budgetAmount: award.budgetAmount ?? null,
    awardRatio: computeAwardRatio(award.amount ?? null, award.budgetAmount ?? null),
    authority: award.authority,
    authorityNormalized: normalizeAuthority(award.authority),
    region: null,
    cpvCodes: award.cpvCodes,
    cpvPrimary,
    tenderType: null,
    procedureType: null,
    awardDate: award.date,
    publishedDate: null,
    numberOfBids: award.numberOfBids ?? null,
    rawJson: null,
  };
}

// ─── Dedup & Insert ─────────────────────────────────────

/**
 * Check for duplicates and insert a single award record.
 */
export async function dedupAndInsert(
  award: AwardResult,
  db: PrismaClient,
): Promise<IngestResult> {
  try {
    const record = mapAwardToRecord(award);

    // 1. URL-based dedup (exact match via @unique)
    const existingByUrl = await db.historicalAward.findUnique({
      where: { sourceUrl: record.sourceUrl },
      select: { id: true },
    });
    if (existingByUrl) return 'duplicate-url';

    // 2. Fuzzy cross-source dedup
    if (record.awardAmount != null && record.winnerNormalized && record.authorityNormalized) {
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      const fuzzyMatch = await db.historicalAward.findFirst({
        where: {
          authorityNormalized: record.authorityNormalized,
          winnerNormalized: record.winnerNormalized,
          awardAmount: record.awardAmount,
          awardDate: {
            gte: new Date(record.awardDate.getTime() - threeDaysMs),
            lte: new Date(record.awardDate.getTime() + threeDaysMs),
          },
        },
        select: { id: true },
      });
      if (fuzzyMatch) return 'duplicate-fuzzy';
    }

    // 3. Insert
    await db.historicalAward.create({ data: record });
    return 'inserted';
  } catch (err) {
    // Handle unique constraint violations gracefully (race condition)
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      return 'duplicate-url';
    }
    console.error('[AwardIngester] Insert error:', (err as Error).message);
    return 'error';
  }
}

/**
 * Ingest a batch of awards with dedup.
 */
export async function ingestBatch(
  awards: AwardResult[],
  db: PrismaClient,
): Promise<{ inserted: number; duplicates: number; errors: number }> {
  let inserted = 0;
  let duplicates = 0;
  let errors = 0;

  for (const award of awards) {
    const result = await dedupAndInsert(award, db);
    switch (result) {
      case 'inserted': inserted++; break;
      case 'duplicate-url':
      case 'duplicate-fuzzy': duplicates++; break;
      case 'error': errors++; break;
    }
  }

  return { inserted, duplicates, errors };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/services/award-ingester.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/award-ingester.ts tests/services/award-ingester.test.ts
git commit -m "feat: add award-ingester service with dedup-and-insert logic"
```

---

### Task 4: Extend Award Fetcher with Date-Range Pagination

**Files:**
- Modify: `src/server/services/award-fetcher.ts`

- [ ] **Step 1: Add fetchAwardsByDateRange function**

Open `src/server/services/award-fetcher.ts` and add this function **after** the existing `fetchAllAwards` function (after line 189):

```typescript
// ─── Paginated date-range fetch (for backfill/cron) ────

export interface PaginatedAwardResponse {
  awards: AwardResult[];
  hasMorePages: boolean;
  totalFetched: number;
}

export async function fetchDiavgeiaByDateRange(
  fromDate: Date,
  toDate: Date,
  page: number = 0,
): Promise<PaginatedAwardResponse> {
  const results: AwardResult[] = [];
  const searchTerms = ['ΚΑΤΑΚΥΡΩΣΗ', 'ΑΝΑΘΕΣΗ'];
  let hasMore = false;

  for (const term of searchTerms) {
    try {
      const params = new URLSearchParams({
        subject: term,
        size: '100',
        page: String(page),
        from_issue_date: fromDate.toISOString().split('T')[0],
        to_issue_date: toDate.toISOString().split('T')[0],
      });

      const res = await fetch(
        `https://diavgeia.gov.gr/luminapi/opendata/search?${params.toString()}`,
        {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(15000),
        },
      );

      if (!res.ok) continue;
      const data = await res.json();
      if (!data.decisions) continue;

      // Check if there are more pages
      const totalPages = data.info?.totalPages ?? 1;
      if (page + 1 < totalPages) hasMore = true;

      for (const d of data.decisions) {
        if (!d.ada) continue;
        const subject = (d.subject || '').toLowerCase();
        if (subject.includes('εντολή πληρωμής') || subject.includes('χρηματικό ένταλμα')) continue;

        const winner = extractWinnerFromDecision(d);
        const amount = d.amount?.amount ?? d.extraFieldValues?.awardAmount?.amount ?? null;

        if (winner || amount) {
          results.push({
            title: d.subject || '',
            winner: winner || 'Δεν αναφέρεται',
            amount: amount ? Number(amount) : null,
            authority: d.organizationLabel || d.organization?.label || '',
            date: safeDate(d.submissionTimestamp || d.issueDate),
            cpvCodes: [],
            source: 'DIAVGEIA',
            sourceUrl: `https://diavgeia.gov.gr/decision/view/${d.ada}`,
            budgetAmount: d.extraFieldValues?.estimatedAmount?.amount ?? null,
            numberOfBids: null,
          });
        }
      }
    } catch {
      // Continue
    }
  }

  // Deduplicate within batch
  const seen = new Set<string>();
  const unique = results.filter((r) => {
    if (seen.has(r.sourceUrl)) return false;
    seen.add(r.sourceUrl);
    return true;
  });

  return { awards: unique, hasMorePages: hasMore, totalFetched: unique.length };
}

export async function fetchKimdisByDateRange(
  fromDate: Date,
  toDate: Date,
  page: number = 0,
): Promise<PaginatedAwardResponse> {
  try {
    const body: Record<string, any> = {
      fromDate: fromDate.toISOString().split('T')[0],
      toDate: toDate.toISOString().split('T')[0],
    };

    const res = await fetch(
      `https://cerpp.eprocurement.gov.gr/khmdhs-opendata/notice?page=${page}&size=100`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!res.ok) return { awards: [], hasMorePages: false, totalFetched: 0 };
    const data = await res.json();
    const notices = data.content || data.notices || data.data || [];
    const totalPages = data.totalPages ?? 1;

    const awards: AwardResult[] = notices
      .filter((n: any) => n.contractorName || n.totalCostWithoutVAT)
      .map((n: any): AwardResult => {
        const cpvs: string[] = [];
        if (Array.isArray(n.objectDetails)) {
          for (const obj of n.objectDetails) {
            if (Array.isArray(obj.cpvs)) {
              for (const cpv of obj.cpvs) {
                if (cpv.key && !cpvs.includes(cpv.key)) cpvs.push(cpv.key);
              }
            }
          }
        }
        return {
          title: n.title || n.subject || '',
          winner: n.contractorName || n.awardee?.name || 'Δεν αναφέρεται',
          amount: n.totalCostWithoutVAT ?? n.totalCostWithVAT ?? null,
          authority: n.organization?.value || '',
          date: safeDate(n.submissionDate || n.publicationDate),
          cpvCodes: cpvs,
          source: 'KIMDIS',
          sourceUrl: `https://cerpp.eprocurement.gov.gr/kimds2/unprotected/searchNotices.htm?noticeId=${n.referenceNumber || ''}`,
          budgetAmount: n.estimatedValue ?? null,
          numberOfBids: n.numberOfTenders ?? n.numberOfBids ?? null,
        };
      });

    return {
      awards,
      hasMorePages: page + 1 < totalPages,
      totalFetched: awards.length,
    };
  } catch {
    return { awards: [], hasMorePages: false, totalFetched: 0 };
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/server/services/award-fetcher.ts
git commit -m "feat: add paginated date-range fetchers for backfill and cron"
```

---

### Task 5: Daily Cron Endpoint

**Files:**
- Create: `src/app/api/cron/ingest-awards/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create the cron route handler**

Create `src/app/api/cron/ingest-awards/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchDiavgeiaByDateRange, fetchKimdisByDateRange } from '@/server/services/award-fetcher';
import { ingestBatch } from '@/server/services/award-ingester';
import type { AwardResult } from '@/server/services/award-fetcher';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Auth check: Vercel Cron sends Authorization header
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const MAX_RUNTIME_MS = 55_000; // Stop at 55s (Vercel limit is 60s)
  const MAX_RECORDS = 500;

  const results: Record<string, { inserted: number; duplicates: number; errors: number }> = {};

  try {
    // Get the latest award date per source
    const sources = ['DIAVGEIA', 'KIMDIS'] as const;

    for (const source of sources) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log(`[CronAwards] Timeout approaching, stopping at source ${source}`);
        break;
      }

      const latestAward = await db.historicalAward.findFirst({
        where: { source },
        orderBy: { awardDate: 'desc' },
        select: { awardDate: true },
      });

      // Default: fetch from 7 days ago if no existing data
      const fromDate = latestAward
        ? new Date(latestAward.awardDate.getTime() - 24 * 60 * 60 * 1000) // overlap by 1 day
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const toDate = new Date();

      let allAwards: AwardResult[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore && allAwards.length < MAX_RECORDS && Date.now() - startTime < MAX_RUNTIME_MS) {
        const fetcher = source === 'DIAVGEIA'
          ? fetchDiavgeiaByDateRange
          : fetchKimdisByDateRange;

        const response = await fetcher(fromDate, toDate, page);
        allAwards = allAwards.concat(response.awards);
        hasMore = response.hasMorePages;
        page++;
      }

      const batchResult = await ingestBatch(allAwards, db);
      results[source] = batchResult;

      console.log(`[CronAwards] ${source}: +${batchResult.inserted} inserted, ${batchResult.duplicates} dup, ${batchResult.errors} err`);
    }

    return NextResponse.json({
      success: true,
      results,
      runtime_ms: Date.now() - startTime,
    });
  } catch (err) {
    console.error('[CronAwards] Fatal error:', err);
    return NextResponse.json(
      { error: 'Internal error', message: (err as Error).message },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Add cron config to vercel.json**

Open `vercel.json` and add the `crons` key. The full file should look like:

```json
{
  "functions": {
    "src/app/api/upload/route.ts": {
      "maxDuration": 30
    },
    "src/app/api/trpc/[trpc]/route.ts": {
      "maxDuration": 300
    },
    "src/app/api/cron/ingest-awards/route.ts": {
      "maxDuration": 60
    }
  },
  "crons": [
    {
      "path": "/api/cron/ingest-awards",
      "schedule": "0 3 * * *"
    }
  ]
}
```

- [ ] **Step 3: Generate CRON_SECRET and add to Vercel**

Run:
```bash
openssl rand -hex 32
```

Copy the output, then:
```bash
echo "<the-generated-secret>" | vercel env add CRON_SECRET production --yes
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/ingest-awards/route.ts vercel.json
git commit -m "feat: add daily Vercel Cron job for incremental award ingestion"
```

---

### Task 6: Backfill Script

**Files:**
- Create: `scripts/backfill-awards.ts`
- Modify: `package.json` (add npm script)

- [ ] **Step 1: Create the backfill script**

Create `scripts/backfill-awards.ts`:

```typescript
/**
 * Backfill script: Ingest 2 years of historical awards from ΔΙΑΥΓΕΙΑ + ΚΗΜΔΗΣ.
 *
 * Run with: npm run backfill:awards
 * Options:  npm run backfill:awards -- --years=2 --resume --source=all
 */

import { PrismaClient } from '@prisma/client';
import { fetchDiavgeiaByDateRange, fetchKimdisByDateRange } from '../src/server/services/award-fetcher';
import { ingestBatch } from '../src/server/services/award-ingester';
import * as fs from 'fs';
import * as path from 'path';

const db = new PrismaClient();

// ─── CLI args ──────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name: string, defaultValue: string): string {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : defaultValue;
}
const hasFlag = (name: string) => args.includes(`--${name}`);

const YEARS = parseInt(getArg('years', '2'), 10);
const SOURCE_FILTER = getArg('source', 'all'); // 'all' | 'DIAVGEIA' | 'KIMDIS'
const RESUME = hasFlag('resume');
const DRY_RUN = hasFlag('dry-run');
const DELAY_MS = parseInt(getArg('delay', '1000'), 10);

// ─── State management ──────────────────────────────────

interface BackfillState {
  source: string;
  lastCompletedMonth: string; // YYYY-MM
  lastCompletedPage: number;
  totalInserted: number;
  totalDuplicates: number;
  totalErrors: number;
}

const STATE_FILE = path.join(process.cwd(), '.backfill-state.json');

function loadState(): BackfillState | null {
  if (!RESUME || !fs.existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    console.error('⚠️  Could not parse .backfill-state.json — starting fresh');
    return null;
  }
}

function saveState(state: BackfillState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── Month generation ──────────────────────────────────

function generateMonths(years: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < years * 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

function monthToDateRange(month: string): { from: Date; to: Date } {
  const [year, m] = month.split('-').map(Number);
  const from = new Date(year, m - 1, 1);
  const to = new Date(year, m, 0, 23, 59, 59); // Last day of month
  return { from, to };
}

// ─── Main ──────────────────────────────────────────────

async function backfill() {
  console.log(`\n🚀 Award Backfill — ${YEARS} year(s), source: ${SOURCE_FILTER}, resume: ${RESUME}, dry-run: ${DRY_RUN}\n`);

  const months = generateMonths(YEARS);
  const sources = SOURCE_FILTER === 'all'
    ? ['DIAVGEIA', 'KIMDIS'] as const
    : [SOURCE_FILTER as 'DIAVGEIA' | 'KIMDIS'];

  let state = loadState();
  let stats = {
    inserted: state?.totalInserted ?? 0,
    duplicates: state?.totalDuplicates ?? 0,
    errors: state?.totalErrors ?? 0,
  };

  // Find resume point
  let skipUntilMonth = state?.lastCompletedMonth;
  let skipUntilSource = state?.source;
  let resumeFromPage = state ? state.lastCompletedPage + 1 : 0;
  let pastResumePoint = !RESUME;

  for (const source of sources) {
    for (const month of months) {
      // Skip until we reach the resume point
      if (!pastResumePoint) {
        if (source === skipUntilSource && month === skipUntilMonth) {
          pastResumePoint = true;
          // Start from the next page
        } else {
          continue;
        }
      }

      const { from, to } = monthToDateRange(month);
      const fetcher = source === 'DIAVGEIA' ? fetchDiavgeiaByDateRange : fetchKimdisByDateRange;

      let page = pastResumePoint && month === skipUntilMonth ? resumeFromPage : 0;
      let hasMore = true;

      while (hasMore) {
        process.stdout.write(`\r[${month}] ${source} page ${page} — ${stats.inserted} inserted, ${stats.duplicates} dup, ${stats.errors} err`);

        try {
          const response = await fetcher(from, to, page);

          if (!DRY_RUN && response.awards.length > 0) {
            const batch = await ingestBatch(response.awards, db);
            stats.inserted += batch.inserted;
            stats.duplicates += batch.duplicates;
            stats.errors += batch.errors;
          } else if (DRY_RUN) {
            stats.inserted += response.awards.length;
          }

          hasMore = response.hasMorePages;

          // Save state after every page
          const currentState: BackfillState = {
            source,
            lastCompletedMonth: month,
            lastCompletedPage: page,
            totalInserted: stats.inserted,
            totalDuplicates: stats.duplicates,
            totalErrors: stats.errors,
          };
          saveState(currentState);

          page++;
        } catch (err) {
          const msg = `[${month}] ${source} page ${page}: ${(err as Error).message}`;
          console.error(`\n❌ ${msg}`);
          fs.appendFileSync('.backfill-errors.log', `${new Date().toISOString()} ${msg}\n`);
          stats.errors++;
          hasMore = false; // Move to next month on error
        }

        // Rate limiting
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }

      // Reset resume page for subsequent months
      resumeFromPage = 0;
    }
  }

  console.log(`\n\n✅ Backfill complete!`);
  console.log(`   Inserted:   ${stats.inserted}`);
  console.log(`   Duplicates: ${stats.duplicates}`);
  console.log(`   Errors:     ${stats.errors}`);

  // Clean up state file on completion
  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
    console.log('   State file cleaned up.');
  }

  await db.$disconnect();
}

backfill().catch((err) => {
  console.error('\n💀 Fatal error:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Add npm script to package.json**

Open `package.json` and add to the `"scripts"` section:

```json
"backfill:awards": "tsx scripts/backfill-awards.ts"
```

- [ ] **Step 3: Verify script compiles**

Run: `npx tsx --check scripts/backfill-awards.ts`
Expected: No output (no syntax errors)

- [ ] **Step 4: Test with dry-run (1 month)**

Run: `npm run backfill:awards -- --years=0.1 --dry-run`
Expected: Prints progress, shows count of awards found, no DB writes

- [ ] **Step 5: Commit**

```bash
git add scripts/backfill-awards.ts package.json
git commit -m "feat: add backfill-awards CLI script with resume support"
```

---

### Task 7: Type Check, Full Test Suite, Push & Deploy

**Files:**
- All files from Tasks 1-6

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (existing + new normalizer + ingester tests)

- [ ] **Step 3: Push to remote**

```bash
git push origin main
```

- [ ] **Step 4: Deploy to Vercel**

```bash
vercel --prod --yes
```

Expected: Build succeeds, cron job registered in Vercel dashboard

- [ ] **Step 5: Verify cron is registered**

Go to Vercel dashboard → Project → Settings → Crons
Expected: `/api/cron/ingest-awards` listed with schedule `0 3 * * *`

- [ ] **Step 6: Test cron endpoint manually**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://tender-copilot-kappa.vercel.app/api/cron/ingest-awards
```

Expected: JSON response with `{ success: true, results: { DIAVGEIA: {...}, KIMDIS: {...} } }`

---

### Task 8: Run Production Backfill

**Files:** None (operational task)

- [ ] **Step 1: Pull environment variables locally**

```bash
vercel env pull .env.local
```

- [ ] **Step 2: Run backfill with source=DIAVGEIA first**

```bash
npm run backfill:awards -- --years=2 --source=DIAVGEIA
```

Expected: Runs for several hours. Progress shown. Can Ctrl-C and resume.

- [ ] **Step 3: Run backfill with source=KIMDIS**

```bash
npm run backfill:awards -- --years=2 --source=KIMDIS
```

Expected: Similar to DIAVGEIA. Some fuzzy duplicates caught.

- [ ] **Step 4: Verify record count**

```bash
npx tsx -e "const { PrismaClient } = require('@prisma/client'); const db = new PrismaClient(); db.historicalAward.count().then(c => { console.log('Total awards:', c); db.\$disconnect(); })"
```

Expected: 15,000+ records

- [ ] **Step 5: Commit state cleanup**

```bash
# Ensure .backfill-state.json and .backfill-errors.log are in .gitignore
echo ".backfill-state.json" >> .gitignore
echo ".backfill-errors.log" >> .gitignore
git add .gitignore
git commit -m "chore: add backfill state files to gitignore"
```
