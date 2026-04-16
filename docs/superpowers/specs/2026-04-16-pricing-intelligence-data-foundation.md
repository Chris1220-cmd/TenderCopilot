# SP2.1 — Pricing Intelligence Data Foundation

**Status:** Draft (awaiting user review)
**Date:** 2026-04-16
**Sub-project of:** SP2 — Pricing Intelligence (full)
**Depends on:** Existing `award-fetcher.ts` service, Supabase Postgres, Vercel deployment

---

## Goal

Build the persistent data layer for Pricing Intelligence. Ingest 2 years of historical public-sector award decisions from ΔΙΑΥΓΕΙΑ + ΚΗΜΔΗΣ into a globally-shared `HistoricalAward` table, then keep it fresh with a daily incremental cron job.

This sub-project produces no user-facing UI. It produces the data backbone that SP2.2 (Statistics Engine), SP2.3 (ML Prediction), and SP2.4 (UI) all read from.

---

## Why this matters

No competitor in the Greek/EU tender market mines public award histories systematically to give bidders data-driven pricing recommendations. The data is public but unstructured. By ingesting it once and updating daily, TenderCopilot builds a **data moat**: more users → more queries → better aggregates → harder to copy.

---

## Non-goals

- No statistical aggregations (that's SP2.2)
- No ML model (that's SP2.3)
- No UI (that's SP2.4)
- No per-tenant data isolation — historical awards are public, stored once globally
- No backfill of TED data (Greek-only for v1; EU comes later)
- No real-time push from authorities (we poll daily)

---

## Architecture

```
┌────────────────────────────────────────────────┐
│ One-time backfill (local script)               │
│   npm run backfill:awards -- --years=2         │
│   • Runs on developer machine                  │
│   • Writes direct to production Supabase       │
│   • Resumable via .backfill-state.json         │
│   • Duration: ~6-12 hours, 2-3 sessions OK     │
└────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────┐
│ Supabase Postgres                              │
│   model HistoricalAward (global pool)          │
└────────────────────────────────────────────────┘
            ▲
            │
┌────────────────────────────────────────────────┐
│ Vercel Cron — daily 03:00 UTC                  │
│   GET /api/cron/ingest-awards                  │
│   • Reads MAX(awardDate) from DB               │
│   • Fetches awards published since             │
│   • Runs deduplication                         │
│   • Inserts new records                        │
│   • Capped at 60s execution / 500 records      │
└────────────────────────────────────────────────┘
```

**Key architectural decisions:**

1. **Global pool, not per-tenant.** Historical awards are public data. One scrape feeds all tenants. New tenants get full history immediately. Personalization happens at the query layer (filter by tenant's CPV/budget/region), not at storage.

2. **Vercel Cron over BullMQ + Redis.** No new infrastructure, no Redis dependency, no separate worker process. Vercel Cron's 60s limit is enough for daily incrementals (~100-300 records). Backfill is one-off and runs locally.

3. **Local backfill script over chunked cron.** Backfilling 2 years of data in 7-day cron chunks would take 70+ days. Running once locally takes 6-12 hours over 2-3 sessions and is done.

4. **Cross-source deduplication in code, not schema.** The same award can appear in both ΔΙΑΥΓΕΙΑ and ΚΗΜΔΗΣ with different URLs. We handle this with a fuzzy-match check in the ingestion logic, not a schema-level constraint, because the matching tolerance (±3 days, normalized strings) is hard to express in SQL constraints.

---

## Data model

### `HistoricalAward`

```prisma
model HistoricalAward {
  id              String   @id @default(cuid())

  // Source tracking
  source          AwardSource
  sourceUrl       String       @unique
  sourceRefId     String?      // ADA / referenceNumber

  // Core award data
  title           String
  winner          String
  winnerNormalized String      // lowercased, stripped suffixes, for grouping
  awardAmount     Decimal?     @db.Decimal(15, 2)
  budgetAmount    Decimal?     @db.Decimal(15, 2)
  awardRatio      Float?       // awardAmount / budgetAmount, computed at insert

  // Authority & geography
  authority       String
  authorityNormalized String
  region          String?

  // Categorization
  cpvCodes        String[]
  cpvPrimary      String?      // first CPV, indexed for fast lookups

  // Reserved for SP2.2 fetcher extension
  tenderType      String?      // SUPPLY | SERVICE | WORKS
  procedureType   String?      // OPEN | NEGOTIATED | RESTRICTED

  // Dates
  awardDate       DateTime
  publishedDate   DateTime?

  // Bid details
  numberOfBids    Int?

  // Raw data (for future re-processing)
  rawJson         Json?

  // Audit
  ingestedAt      DateTime     @default(now())

  @@index([cpvPrimary, awardDate])
  @@index([authorityNormalized])
  @@index([winnerNormalized])
  @@index([source, awardDate])
  @@index([tenderType, cpvPrimary])
}

enum AwardSource {
  DIAVGEIA
  KIMDIS
  TED
}
```

**Field rationale:**

- `winnerNormalized` / `authorityNormalized`: Greek company names have many variants ("ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ ΑΕ" vs "Κατασκευαστική Α.Ε."). Normalized columns enable correct grouping in SP2.2.
- `awardRatio`: Stored at insert time (not computed at query time) so SP2.2 can index/aggregate on it.
- `cpvPrimary`: First CPV from `cpvCodes`, indexed for fast lookups. Most queries filter on a single CPV.
- `tenderType` / `procedureType`: Nullable now, populated when the fetcher is extended in a future iteration (probably SP2.2). Adding them now avoids a later migration.
- `rawJson`: Keeps the original API response so we can re-process if extraction logic changes, without re-fetching.

**Index rationale:**

- `(cpvPrimary, awardDate)`: Most common query — "find recent awards in this category".
- `(authorityNormalized)`: "What does this authority typically award for?"
- `(winnerNormalized)`: "Who wins in this space?" (competitor profiling for SP2.2).
- `(source, awardDate)`: Daily ingestion query — `MAX(awardDate) WHERE source = ?`.
- `(tenderType, cpvPrimary)`: Cross-cutting analytics in SP2.2.

---

## Components

### 1. `src/server/services/award-normalizer.ts` (new)

Pure functions, no I/O. Easy to unit-test.

```typescript
export function normalizeCompanyName(name: string): string;
// "ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ Α.Ε." → "κατασκευαστικη"
// Steps: NFD unicode normalize, strip diacritics, lowercase,
//   strip legal suffixes (ΑΕ, ΕΠΕ, ΟΕ, ΙΚΕ, Α.Ε., Ε.Π.Ε., ...),
//   strip punctuation, collapse whitespace.

export function normalizeAuthority(name: string): string;
// "ΔΗΜΟΣ ΑΘΗΝΑΙΩΝ" → "δημος αθηναιων"
// Same as company but keeps "ΔΗΜΟΣ", "ΥΠΟΥΡΓΕΙΟ", etc. (no suffix stripping).

export function computeAwardRatio(awardAmount: number | null, budgetAmount: number | null): number | null;
// Returns awardAmount/budgetAmount only when both > 0, else null.
// Clamped to [0, 2] to filter obviously-wrong data.
```

### 2. `src/server/services/award-ingester.ts` (new)

Handles the dedup-and-insert flow. Used by both the backfill script and the cron job.

```typescript
type IngestResult = 'inserted' | 'duplicate-url' | 'duplicate-fuzzy' | 'error';

export async function dedupAndInsert(
  award: AwardResult,
  db: PrismaClient,
): Promise<IngestResult>;

export async function ingestBatch(
  awards: AwardResult[],
  db: PrismaClient,
): Promise<{ inserted: number; duplicates: number; errors: number }>;
```

`dedupAndInsert` logic:

1. Map `AwardResult` → schema (compute `winnerNormalized`, `authorityNormalized`, `awardRatio`, `cpvPrimary`).
2. Try `findUnique({ sourceUrl })`. If found → `'duplicate-url'`.
3. Try fuzzy match: `findFirst({ authorityNormalized, winnerNormalized, awardAmount, awardDate within ±3 days })`. If found → `'duplicate-fuzzy'`.
4. Insert. Return `'inserted'`.
5. On any thrown error, log and return `'error'`.

### 3. `src/server/services/award-fetcher.ts` (extend)

The existing service already fetches from ΔΙΑΥΓΕΙΑ and ΚΗΜΔΗΣ. SP2.1 leaves it mostly alone but adds:

- A new function `fetchAwardsByDateRange(source, fromDate, toDate, page)` that supports paginated date-bound fetching for the backfill script.
- A return shape that includes `hasMorePages: boolean` so the caller knows when to stop.

The extraction of `tenderType` / `procedureType` is **deferred to SP2.2** to keep SP2.1 focused.

### 4. `scripts/backfill-awards.ts` (new)

CLI tool. Run via `npm run backfill:awards`.

**Flags:**

- `--years=N` (default 2)
- `--source=DIAVGEIA|KIMDIS|all` (default `all`)
- `--resume` (read `.backfill-state.json` and continue)
- `--dry-run` (fetch but don't insert)

**Behavior:**

1. Load `.backfill-state.json` if `--resume`. State shape: `{ source, lastCompletedMonth, lastCompletedPage }`.
2. Compute date range: from `now - years` to `now`.
3. Walk backwards month-by-month. For each month, walk pages until empty.
4. After every page, save state.
5. Between requests: `setTimeout(1000)`. On `429` response: `setTimeout(5000)` and retry once.
6. On other errors: log to `.backfill-errors.log`, skip to next page.
7. Print live progress to stdout: `[2024-08] DIAVGEIA page 12 — 1140 inserted, 87 dup, 3 err`.
8. Print final summary on completion or Ctrl-C.

The script writes directly to the production database using `DATABASE_URL` from `.env`. **It is the operator's responsibility to back up the database before running** — but since this script only INSERTs (never updates/deletes), the worst case is duplicate handling.

### 5. `src/app/api/cron/ingest-awards/route.ts` (new)

Vercel Cron handler. Runs daily at 03:00 UTC.

**Auth:** Compares `Authorization: Bearer ${process.env.CRON_SECRET}` header. Returns 401 otherwise.

**Logic:**

1. Read `MAX(awardDate)` from `HistoricalAward` for each source.
2. For each source, fetch awards from `(maxDate - 1 day)` onwards (overlap is fine because dedup handles it).
3. Run `ingestBatch`.
4. Cap total runtime at 55 seconds (Vercel limit is 60s for Pro). If exceeded, stop and log.
5. Cap inserts at 500 per run. If more available, log a warning — they'll be picked up tomorrow.
6. Return JSON: `{ source: { inserted, duplicates, errors, runtime_ms } }`.

### 6. `vercel.json` (extend)

Add the cron config:

```json
{
  "crons": [
    {
      "path": "/api/cron/ingest-awards",
      "schedule": "0 3 * * *"
    }
  ]
}
```

---

## Data flow

### Backfill (one-time)

```
Operator → npm run backfill:awards --years=2
          ↓
  scripts/backfill-awards.ts
          ↓
  award-fetcher.fetchAwardsByDateRange(...)  ← rate-limited, paginated
          ↓
  award-ingester.ingestBatch(...)
          ↓
  For each award:
    award-ingester.dedupAndInsert(...)
          ↓
    award-normalizer.normalizeCompanyName(...)
    award-normalizer.normalizeAuthority(...)
          ↓
    db.historicalAward.findUnique({ sourceUrl })
    db.historicalAward.findFirst({ fuzzy match })
          ↓
    db.historicalAward.create(...)
          ↓
  Save .backfill-state.json after each page
```

### Daily incremental

```
Vercel Cron (03:00 UTC) → GET /api/cron/ingest-awards
                          ↓
        api/cron/ingest-awards/route.ts
                          ↓
        SELECT MAX(awardDate) WHERE source = ?
                          ↓
        award-fetcher.fetchAwardsByDateRange(source, maxDate-1d, now)
                          ↓
        award-ingester.ingestBatch(...)
                          ↓
        Same dedup-and-insert path as backfill
                          ↓
        Return JSON summary, log to Vercel logs
```

---

## Error handling

| Failure mode | Handling |
|--------------|----------|
| ΔΙΑΥΓΕΙΑ/ΚΗΜΔΗΣ API returns 5xx | Log, skip page, continue. Backfill: write to `.backfill-errors.log`. Cron: log to Vercel. |
| API returns 429 (rate limit) | Wait 5s, retry once. Then skip if still failing. |
| API returns 200 with malformed JSON | Try-catch parse, log, skip page. |
| Single record fails to parse | Log, skip record, continue with batch. |
| Database connection drops mid-batch | Bubble error up. Backfill: state file lets us resume. Cron: Vercel retries on next schedule. |
| Cron runtime approaches 60s | Stop gracefully, log "incomplete - resuming tomorrow". |
| Backfill state file corrupted | `--resume` flag fails fast with clear error. Operator deletes file and starts fresh. |
| Schema migration fails on production | Standard Prisma migration safety — fails before deployment. |

---

## Testing

### Unit tests

- `tests/server/services/award-normalizer.test.ts`
  - `normalizeCompanyName` — 10+ Greek company name variants → expected outputs
  - `normalizeAuthority` — 5+ authority variants
  - `computeAwardRatio` — null handling, clamping, normal cases

- `tests/server/services/award-ingester.test.ts`
  - `dedupAndInsert` — three branches (url-dup, fuzzy-dup, insert), each with mocked Prisma
  - `ingestBatch` — counts inserted/duplicates/errors correctly

### Integration tests

- `tests/api/cron/ingest-awards.test.ts`
  - Mocks `award-fetcher` to return fixed awards
  - Hits the route handler
  - Verifies records inserted in test DB
  - Verifies auth (401 without secret)

### Manual tests

- Run backfill against a local Postgres with `--years=0.1` (~1 month) and verify counts
- Run backfill with `--dry-run` and verify no DB writes
- Kill backfill with Ctrl-C, restart with `--resume`, verify it picks up correctly
- Hit cron endpoint manually with `curl -H "Authorization: Bearer $CRON_SECRET"` and verify response

---

## Environment variables

New:

- `CRON_SECRET` — Random 32-byte hex string. Set in Vercel + locally for testing.

Existing (used unchanged):

- `DATABASE_URL` — Supabase pooled connection string
- `DIRECT_URL` — Supabase direct connection (used by Prisma migrations)

---

## Migration plan

1. Add the schema model + enum.
2. Run `npx prisma migrate dev --name add_historical_awards` locally.
3. Verify migration SQL looks clean.
4. Push migration to production via `prisma migrate deploy` (or `prisma db push` if that's the project pattern).
5. Set `CRON_SECRET` in Vercel.
6. Deploy cron route + `vercel.json` update.
7. Verify cron is registered in Vercel dashboard.
8. Run backfill locally.
9. Wait 24h, verify cron ran and inserted incremental records.

---

## Success criteria

- [ ] `HistoricalAward` table exists in production with proper indices.
- [ ] Backfill script ingests at least 15K records spanning 2 years (typical volume estimate).
- [ ] Cross-source deduplication catches at least 80% of cross-source duplicates (verified by spot-check).
- [ ] Daily cron runs successfully for 7 consecutive days without errors.
- [ ] `MAX(awardDate)` is never more than 48h behind `now()` after first week.
- [ ] All unit and integration tests pass.
- [ ] Operator can run `npm run backfill:awards --resume` after Ctrl-C and continue exactly where it stopped.

---

## Open questions

None at this stage. Ready for implementation plan.
