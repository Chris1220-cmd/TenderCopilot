# SP2.2 — Statistics Engine Design

**Status:** Draft
**Date:** 2026-04-16
**Depends on:** SP2.1 (HistoricalAward table + backfill)
**Consumed by:** SP2.4 (Pricing Intelligence UI)

---

## Goal

Build the compute layer that transforms raw `HistoricalAward` records into actionable pricing statistics and AI-powered recommendations. Fix KIMDIS ingestion (currently returns 0 records) to ensure data quality. Expose results via tRPC queries that SP2.4 (UI) consumes.

No user-facing UI in this sub-project — only backend services and API endpoints.

---

## Non-goals

- No UI components (SP2.4)
- No ML model training (SP2.3)
- No TED data ingestion (future)

---

## Prerequisites: Fix KIMDIS Data Gap

The KIMDIS fetcher returns 0 records because `fetchKimdisByDateRange` sends `fromDate`/`toDate` as body params, but the KIMDIS OpenData API expects different field names. The original `fetchKimdisAwards` works because it doesn't filter by date.

**Fix:** Update `fetchKimdisByDateRange` to match the KIMDIS API's actual parameter format. Test with a manual curl request first to confirm the correct field names.

Additionally, the DIAVGEIA fetcher returns records without winners or CPV codes. The DIAVGEIA API does return this data in `extraFieldValues` — the extraction logic needs to be extended for the date-range variant.

---

## Architecture

```
HistoricalAward table (1,357+ records, growing daily)
        │
        ▼
┌─────────────────────────────┐
│ pricing-stats.ts            │
│  computeCpvStats()          │  Pure computation functions
│  computeAuthorityProfile()  │  No external I/O beyond DB reads
│  computeCompetitorRanking() │
│  computePricingAdvice()     │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│ ai-pricing-advisor.ts       │
│  generatePricingAdvice()    │  Calls Gemini/Claude with stats
│                             │  Returns natural language advice
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│ pricing-intelligence.ts     │
│  (tRPC router)              │  API layer consumed by UI
│  similarAwards              │
│  cpvStats                   │
│  authorityProfile           │
│  competitorRanking          │
│  pricingAdvice              │
└─────────────────────────────┘
```

---

## Components

### 1. `pricing-stats.ts` — Pure Statistics Functions

All functions take a `PrismaClient` + filter params and return typed results. No AI calls, no side effects beyond DB reads.

#### `computeCpvStats(db, cpvPrimary, yearsBack?)`

For a given CPV code, compute:
- `count`: number of matching awards
- `meanAmount`: average award amount
- `medianAmount`: median award amount
- `p25Amount` / `p75Amount`: 25th/75th percentile
- `meanRatio`: average award-to-budget ratio (when both available)
- `medianRatio`: median ratio
- `stdDevRatio`: standard deviation of ratio
- `minRatio` / `maxRatio`: range

Returns `null` if fewer than 5 matching records (too few for statistics).

#### `computeAuthorityProfile(db, authorityNormalized)`

For a given authority, compute:
- `totalAwards`: how many awards this authority has made
- `avgAmount`: average award size
- `topWinners`: top 5 winners by count (name + wins + avg amount)
- `avgRatio`: how aggressively they discount (when budget available)
- `sectors`: which CPV categories they mostly award in
- `recentTrend`: average amount last 6 months vs previous 6 months

#### `computeCompetitorRanking(db, cpvPrimary, budgetRange?)`

For a CPV category (optionally filtered by budget range), compute:
- Array of `{ name, wins, avgAmount, avgRatio, lastWinDate }` sorted by wins descending
- Top 10 competitors

#### `computePricingAdvice(db, tender)`

Given a tender (with CPV, budget, authority), combine the above to produce:
- `recommendedBidRange: { low, mid, high }` based on percentiles
- `winProbabilityAtBudget`: rough estimate if bidding at full budget
- `competitorCount`: how many competitors typically bid
- `authorityPreference`: "lowest price" vs "best value" signal
- `confidence`: 'high' | 'medium' | 'low' based on sample size

### 2. `ai-pricing-advisor.ts` — AI Explanation Layer

Takes the raw stats from `pricing-stats.ts` and generates a natural-language recommendation using Gemini/Claude.

#### `generatePricingAdvice(stats, tender, language)`

Input: the computed stats + tender context + language (el/en/nl)
Output: structured response:
```typescript
{
  summary: string;        // "Για αυτόν τον τύπο, η μέση τιμή κατακύρωσης είναι..."
  recommendation: string; // "Προτείνουμε τιμή €152.000 (76% του π/υ)"
  reasoning: string[];    // bullet points explaining why
  risks: string[];        // what could go wrong
  confidence: string;     // "Βασίζεται σε 34 παρόμοιες κατακυρώσεις..."
}
```

Uses existing AI infrastructure (`ai-provider.ts` pattern). The prompt includes raw numbers and asks for a structured Greek/English/Dutch explanation.

### 3. `pricing-intelligence.ts` — tRPC Router

New tRPC router added to the app router. All procedures are `protectedProcedure`.

```typescript
pricingIntelligence = router({
  // Get similar historical awards for a tender
  similarAwards: protectedProcedure
    .input(z.object({
      tenderId: z.string(),
      limit: z.number().default(20),
    }))
    .query(...)
    // Returns: HistoricalAward[] filtered by tender's CPV + budget range

  // Get CPV category statistics
  cpvStats: protectedProcedure
    .input(z.object({
      cpvPrimary: z.string(),
      yearsBack: z.number().default(2),
    }))
    .query(...)

  // Get authority spending profile
  authorityProfile: protectedProcedure
    .input(z.object({
      authority: z.string(),
    }))
    .query(...)

  // Get competitor ranking for a category
  competitorRanking: protectedProcedure
    .input(z.object({
      cpvPrimary: z.string(),
      budgetMin: z.number().optional(),
      budgetMax: z.number().optional(),
    }))
    .query(...)

  // Full pricing advice for a tender (stats + AI)
  pricingAdvice: protectedProcedure
    .input(z.object({
      tenderId: z.string(),
      language: z.enum(['el', 'en', 'nl']).default('el'),
    }))
    .query(...)
    // Returns: stats + AI-generated advice
    // Caches result in TenderIntelligence.similarAwards JSON field
})
```

---

## Data Flow for `pricingAdvice`

```
User requests pricing advice for tender X
        │
        ▼
1. Load tender (CPV codes, budget, authority)
        │
        ▼
2. computeCpvStats(db, tender.cpvPrimary)
   computeAuthorityProfile(db, tender.authority)
   computeCompetitorRanking(db, tender.cpvPrimary, budgetRange)
   computePricingAdvice(db, tender)
        │
        ▼
3. generatePricingAdvice(allStats, tender, language)
   → AI call with structured prompt
        │
        ▼
4. Cache result in TenderIntelligence record
        │
        ▼
5. Return to UI
```

---

## KIMDIS Fix Details

The `fetchKimdisByDateRange` function sends:
```json
{ "fromDate": "2025-01-01", "toDate": "2025-01-31" }
```

But the KIMDIS API likely expects different parameter names or format. The fix:

1. Curl-test the KIMDIS API manually to discover correct params
2. Update `fetchKimdisByDateRange` accordingly
3. Re-run KIMDIS backfill
4. Verify records now include `budgetAmount`, `winner`, `cpvCodes`

Also extend DIAVGEIA date-range fetcher to extract CPV codes from `extraFieldValues.cpvs` when available.

---

## Testing

- Unit tests for all `pricing-stats.ts` functions with mock data
- Unit test for `generatePricingAdvice` prompt construction
- Integration test for tRPC router endpoints
- Verify KIMDIS backfill produces records with budget + winner + CPV

---

## Success Criteria

- [ ] KIMDIS backfill produces 1,000+ records with budgetAmount > 0
- [ ] `computeCpvStats` returns valid statistics for top 5 CPV categories
- [ ] `computePricingAdvice` returns a recommendation with confidence level
- [ ] `generatePricingAdvice` produces Greek natural language advice
- [ ] All tRPC endpoints return data within 2 seconds
- [ ] Cached results prevent redundant AI calls for the same tender
