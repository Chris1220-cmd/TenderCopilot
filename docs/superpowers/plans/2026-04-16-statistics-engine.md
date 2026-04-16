# SP2.2 — Statistics Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the compute layer that transforms raw `HistoricalAward` records into pricing statistics and AI-powered recommendations, exposed via tRPC endpoints. Includes fixing KIMDIS ingestion to fill data gaps.

**Architecture:** Pure statistics functions (no I/O beyond DB reads) feed into an AI advisor that generates natural-language pricing recommendations in Greek/English/Dutch. A new tRPC router exposes 5 endpoints consumed by the upcoming SP2.4 UI.

**Tech Stack:** Prisma 6, tRPC v11, Gemini/Claude AI provider (existing), Vitest

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/server/services/award-fetcher.ts` | Fix KIMDIS date-range params + enhance DIAVGEIA CPV extraction |
| `src/server/services/pricing-stats.ts` | Pure statistics: CPV stats, authority profile, competitor ranking, pricing advice |
| `src/server/services/ai-pricing-advisor.ts` | AI layer: generate natural-language pricing recommendations |
| `src/server/routers/pricing-intelligence.ts` | tRPC router: 5 endpoints for UI consumption |
| `src/server/root.ts` | Register new router |
| `tests/services/pricing-stats.test.ts` | Unit tests for statistics functions |
| `tests/services/ai-pricing-advisor.test.ts` | Unit tests for prompt construction |

---

### Task 1: Fix KIMDIS Date-Range Fetcher

**Files:**
- Modify: `src/server/services/award-fetcher.ts`

- [ ] **Step 1: Test KIMDIS API manually to find correct date params**

Run this curl command to test what the KIMDIS API expects:

```bash
curl -s -X POST "https://cerpp.eprocurement.gov.gr/khmdhs-opendata/notice?page=0&size=5" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{}' | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const j=JSON.parse(d); console.log('Keys:', Object.keys(j)); console.log('Total:', j.totalElements || j.total || 'unknown'); console.log('First:', JSON.stringify(j.content?.[0] || j.notices?.[0] || j.data?.[0], null, 2).slice(0, 500));"
```

Inspect the response to find:
- The correct field names for date filtering
- Whether `contractorName`, `estimatedValue`, CPV data are present
- What pagination looks like (`totalPages`, `totalElements`)

- [ ] **Step 2: Update fetchKimdisByDateRange based on API response**

Open `src/server/services/award-fetcher.ts` and find the `fetchKimdisByDateRange` function. Update the request body to use the correct parameter names discovered in Step 1.

The body should NOT send `fromDate`/`toDate` as top-level keys (this is likely wrong). Instead, use the actual API parameter names. Common KIMDIS patterns:

```typescript
// Option A: If API uses submissionDate range
const body: Record<string, any> = {
  submissionDateFrom: fromDate.toISOString().split('T')[0],
  submissionDateTo: toDate.toISOString().split('T')[0],
};

// Option B: If API uses publicationDate
const body: Record<string, any> = {
  publicationDateFrom: fromDate.toISOString().split('T')[0],
  publicationDateTo: toDate.toISOString().split('T')[0],
};
```

Also update the `.filter()` to NOT require `contractorName || totalCostWithoutVAT` — some valid awards have these nested differently.

- [ ] **Step 3: Also enhance DIAVGEIA date-range fetcher to extract CPV codes**

In `fetchDiavgeiaByDateRange`, find the section where we build each `AwardResult` and update the `cpvCodes` field. Replace `cpvCodes: [],` with:

```typescript
cpvCodes: (() => {
  const cpvs: string[] = [];
  if (d.extraFieldValues?.cpvs) {
    for (const cpv of (Array.isArray(d.extraFieldValues.cpvs) ? d.extraFieldValues.cpvs : [d.extraFieldValues.cpvs])) {
      const code = typeof cpv === 'string' ? cpv : cpv?.cpvCode || cpv?.code || cpv?.key;
      if (code && !cpvs.includes(code)) cpvs.push(code);
    }
  }
  return cpvs;
})(),
```

- [ ] **Step 4: Re-run KIMDIS backfill and verify**

```bash
npm run backfill:awards -- --years=2 --source=KIMDIS
```

Expected: > 0 inserted records. Check data quality:

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
Promise.all([
  db.historicalAward.count({ where: { source: 'KIMDIS' } }),
  db.historicalAward.count({ where: { source: 'KIMDIS', budgetAmount: { not: null } } }),
  db.historicalAward.count({ where: { source: 'KIMDIS', winner: { not: 'Δεν αναφέρεται' } } }),
]).then(([total, withBudget, withWinner]) => {
  console.log('KIMDIS total:', total, 'withBudget:', withBudget, 'withWinner:', withWinner);
  db.\$disconnect();
});
"
```

- [ ] **Step 5: Commit**

```bash
git add src/server/services/award-fetcher.ts
git commit -m "fix: correct KIMDIS date-range params and enhance DIAVGEIA CPV extraction"
```

---

### Task 2: Pricing Statistics Service (TDD)

**Files:**
- Create: `src/server/services/pricing-stats.ts`
- Create: `tests/services/pricing-stats.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/services/pricing-stats.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  computePercentiles,
  computeStatsFromValues,
  type PricingStatsResult,
} from '@/server/services/pricing-stats';

describe('computePercentiles', () => {
  it('computes p25, p50, p75 for sorted array', () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const result = computePercentiles(values);
    expect(result.p25).toBe(30);
    expect(result.p50).toBe(55);
    expect(result.p75).toBe(80);
  });

  it('handles single value', () => {
    const result = computePercentiles([42]);
    expect(result.p25).toBe(42);
    expect(result.p50).toBe(42);
    expect(result.p75).toBe(42);
  });

  it('handles two values', () => {
    const result = computePercentiles([10, 20]);
    expect(result.p50).toBe(15);
  });

  it('returns null for empty array', () => {
    const result = computePercentiles([]);
    expect(result.p25).toBeNull();
    expect(result.p50).toBeNull();
    expect(result.p75).toBeNull();
  });
});

describe('computeStatsFromValues', () => {
  it('computes full stats from ratio values', () => {
    const ratios = [0.7, 0.72, 0.75, 0.78, 0.8, 0.82, 0.85, 0.88, 0.9, 0.95];
    const result = computeStatsFromValues(ratios);

    expect(result.count).toBe(10);
    expect(result.mean).toBeCloseTo(0.815, 2);
    expect(result.median).toBeCloseTo(0.81, 1);
    expect(result.p25).toBeCloseTo(0.75, 1);
    expect(result.p75).toBeCloseTo(0.88, 1);
    expect(result.stdDev).toBeGreaterThan(0);
    expect(result.min).toBe(0.7);
    expect(result.max).toBe(0.95);
  });

  it('returns null stats for fewer than 3 values', () => {
    const result = computeStatsFromValues([0.75, 0.8]);
    expect(result.count).toBe(2);
    expect(result.mean).toBeCloseTo(0.775, 2);
    expect(result.stdDev).toBeNull();
  });

  it('returns empty stats for no values', () => {
    const result = computeStatsFromValues([]);
    expect(result.count).toBe(0);
    expect(result.mean).toBeNull();
    expect(result.median).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/services/pricing-stats.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement pricing-stats.ts**

Create `src/server/services/pricing-stats.ts`:

```typescript
/**
 * Pricing Statistics — pure computation functions for pricing intelligence.
 * All functions take a PrismaClient + filter params and return typed results.
 */

import type { PrismaClient } from '@prisma/client';

// ─── Types ──────────────────────────────────────────────

export interface PercentilesResult {
  p25: number | null;
  p50: number | null;
  p75: number | null;
}

export interface PricingStatsResult {
  count: number;
  mean: number | null;
  median: number | null;
  p25: number | null;
  p75: number | null;
  stdDev: number | null;
  min: number | null;
  max: number | null;
}

export interface CpvStatsResult {
  cpv: string;
  awardCount: number;
  amountStats: PricingStatsResult;
  ratioStats: PricingStatsResult;
  samplePeriodMonths: number;
}

export interface AuthorityProfileResult {
  authority: string;
  totalAwards: number;
  avgAmount: number | null;
  topWinners: Array<{ name: string; wins: number; avgAmount: number | null }>;
  avgRatio: number | null;
  sectors: Array<{ cpv: string; count: number }>;
}

export interface CompetitorEntry {
  name: string;
  wins: number;
  avgAmount: number | null;
  avgRatio: number | null;
  lastWinDate: Date | null;
}

export interface PricingAdviceResult {
  recommendedRange: { low: number; mid: number; high: number } | null;
  ratioStats: PricingStatsResult;
  competitorCount: number;
  topCompetitors: CompetitorEntry[];
  authority: AuthorityProfileResult | null;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  sampleSize: number;
}

// ─── Pure Math Functions ────────────────────────────────

export function computePercentiles(sorted: number[]): PercentilesResult {
  if (sorted.length === 0) return { p25: null, p50: null, p75: null };

  const percentile = (arr: number[], p: number): number => {
    const index = (arr.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return arr[lower];
    return arr[lower] + (arr[upper] - arr[lower]) * (index - lower);
  };

  return {
    p25: percentile(sorted, 0.25),
    p50: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
  };
}

export function computeStatsFromValues(values: number[]): PricingStatsResult {
  if (values.length === 0) {
    return { count: 0, mean: null, median: null, p25: null, p75: null, stdDev: null, min: null, max: null };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;
  const { p25, p50, p75 } = computePercentiles(sorted);

  let stdDev: number | null = null;
  if (sorted.length >= 3) {
    const variance = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / sorted.length;
    stdDev = Math.round(Math.sqrt(variance) * 10000) / 10000;
  }

  return {
    count: sorted.length,
    mean: Math.round(mean * 10000) / 10000,
    median: p50,
    p25,
    p75,
    stdDev,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

// ─── DB-Backed Functions ────────────────────────────────

export async function computeCpvStats(
  db: PrismaClient,
  cpvPrimary: string,
  yearsBack: number = 2,
): Promise<CpvStatsResult> {
  const since = new Date();
  since.setFullYear(since.getFullYear() - yearsBack);

  const awards = await db.historicalAward.findMany({
    where: {
      cpvPrimary,
      awardDate: { gte: since },
    },
    select: {
      awardAmount: true,
      budgetAmount: true,
      awardRatio: true,
    },
  });

  const amounts = awards
    .map((a) => a.awardAmount ? Number(a.awardAmount) : null)
    .filter((v): v is number => v != null);

  const ratios = awards
    .map((a) => a.awardRatio)
    .filter((v): v is number => v != null);

  return {
    cpv: cpvPrimary,
    awardCount: awards.length,
    amountStats: computeStatsFromValues(amounts),
    ratioStats: computeStatsFromValues(ratios),
    samplePeriodMonths: yearsBack * 12,
  };
}

export async function computeAuthorityProfile(
  db: PrismaClient,
  authorityNormalized: string,
): Promise<AuthorityProfileResult> {
  const awards = await db.historicalAward.findMany({
    where: { authorityNormalized },
    select: {
      awardAmount: true,
      awardRatio: true,
      winnerNormalized: true,
      winner: true,
      cpvPrimary: true,
    },
  });

  const amounts = awards
    .map((a) => a.awardAmount ? Number(a.awardAmount) : null)
    .filter((v): v is number => v != null);
  const avgAmount = amounts.length > 0
    ? Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length)
    : null;

  const ratios = awards
    .map((a) => a.awardRatio)
    .filter((v): v is number => v != null);
  const avgRatio = ratios.length > 0
    ? Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 10000) / 10000
    : null;

  // Top winners
  const winnerMap = new Map<string, { displayName: string; count: number; amounts: number[] }>();
  for (const a of awards) {
    if (!a.winnerNormalized || a.winnerNormalized === 'δεν αναφερεται') continue;
    const existing = winnerMap.get(a.winnerNormalized) || { displayName: a.winner, count: 0, amounts: [] };
    existing.count++;
    if (a.awardAmount) existing.amounts.push(Number(a.awardAmount));
    winnerMap.set(a.winnerNormalized, existing);
  }
  const topWinners = Array.from(winnerMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((w) => ({
      name: w.displayName,
      wins: w.count,
      avgAmount: w.amounts.length > 0
        ? Math.round(w.amounts.reduce((a, b) => a + b, 0) / w.amounts.length)
        : null,
    }));

  // Sectors (top CPV categories)
  const cpvMap = new Map<string, number>();
  for (const a of awards) {
    if (!a.cpvPrimary) continue;
    cpvMap.set(a.cpvPrimary, (cpvMap.get(a.cpvPrimary) || 0) + 1);
  }
  const sectors = Array.from(cpvMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cpv, count]) => ({ cpv, count }));

  return {
    authority: authorityNormalized,
    totalAwards: awards.length,
    avgAmount,
    topWinners,
    avgRatio,
    sectors,
  };
}

export async function computeCompetitorRanking(
  db: PrismaClient,
  cpvPrimary: string,
  budgetMin?: number,
  budgetMax?: number,
): Promise<CompetitorEntry[]> {
  const where: any = { cpvPrimary };
  if (budgetMin != null || budgetMax != null) {
    where.awardAmount = {};
    if (budgetMin != null) where.awardAmount.gte = budgetMin;
    if (budgetMax != null) where.awardAmount.lte = budgetMax;
  }

  const awards = await db.historicalAward.findMany({
    where,
    select: {
      winner: true,
      winnerNormalized: true,
      awardAmount: true,
      awardRatio: true,
      awardDate: true,
    },
  });

  const competitorMap = new Map<string, {
    displayName: string;
    wins: number;
    amounts: number[];
    ratios: number[];
    lastDate: Date;
  }>();

  for (const a of awards) {
    if (!a.winnerNormalized || a.winnerNormalized === 'δεν αναφερεται') continue;
    const existing = competitorMap.get(a.winnerNormalized) || {
      displayName: a.winner,
      wins: 0,
      amounts: [],
      ratios: [],
      lastDate: a.awardDate,
    };
    existing.wins++;
    if (a.awardAmount) existing.amounts.push(Number(a.awardAmount));
    if (a.awardRatio) existing.ratios.push(a.awardRatio);
    if (a.awardDate > existing.lastDate) existing.lastDate = a.awardDate;
    competitorMap.set(a.winnerNormalized, existing);
  }

  return Array.from(competitorMap.values())
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 10)
    .map((c) => ({
      name: c.displayName,
      wins: c.wins,
      avgAmount: c.amounts.length > 0
        ? Math.round(c.amounts.reduce((a, b) => a + b, 0) / c.amounts.length)
        : null,
      avgRatio: c.ratios.length > 0
        ? Math.round((c.ratios.reduce((a, b) => a + b, 0) / c.ratios.length) * 10000) / 10000
        : null,
      lastWinDate: c.lastDate,
    }));
}

export async function computePricingAdvice(
  db: PrismaClient,
  tender: { cpvPrimary: string | null; budget: number | null; authorityNormalized: string | null },
): Promise<PricingAdviceResult> {
  const cpv = tender.cpvPrimary;

  if (!cpv) {
    return {
      recommendedRange: null,
      ratioStats: computeStatsFromValues([]),
      competitorCount: 0,
      topCompetitors: [],
      authority: null,
      confidence: 'insufficient',
      sampleSize: 0,
    };
  }

  const cpvStats = await computeCpvStats(db, cpv);
  const competitors = await computeCompetitorRanking(db, cpv);
  const authority = tender.authorityNormalized
    ? await computeAuthorityProfile(db, tender.authorityNormalized)
    : null;

  // Compute recommended range based on budget * ratio percentiles
  let recommendedRange: { low: number; mid: number; high: number } | null = null;
  if (tender.budget && cpvStats.ratioStats.p25 != null && cpvStats.ratioStats.p50 != null && cpvStats.ratioStats.p75 != null) {
    recommendedRange = {
      low: Math.round(tender.budget * cpvStats.ratioStats.p25),
      mid: Math.round(tender.budget * cpvStats.ratioStats.p50),
      high: Math.round(tender.budget * cpvStats.ratioStats.p75),
    };
  } else if (tender.budget && cpvStats.amountStats.p25 != null) {
    // Fallback: use amount percentiles directly
    recommendedRange = {
      low: Math.round(cpvStats.amountStats.p25!),
      mid: Math.round(cpvStats.amountStats.p50!),
      high: Math.round(cpvStats.amountStats.p75!),
    };
  }

  // Confidence based on sample size
  let confidence: 'high' | 'medium' | 'low' | 'insufficient';
  if (cpvStats.awardCount >= 20) confidence = 'high';
  else if (cpvStats.awardCount >= 10) confidence = 'medium';
  else if (cpvStats.awardCount >= 3) confidence = 'low';
  else confidence = 'insufficient';

  return {
    recommendedRange,
    ratioStats: cpvStats.ratioStats,
    competitorCount: competitors.length,
    topCompetitors: competitors,
    authority,
    confidence,
    sampleSize: cpvStats.awardCount,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/services/pricing-stats.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/pricing-stats.ts tests/services/pricing-stats.test.ts
git commit -m "feat: add pricing-stats service with CPV, authority, and competitor analysis"
```

---

### Task 3: AI Pricing Advisor

**Files:**
- Create: `src/server/services/ai-pricing-advisor.ts`

- [ ] **Step 1: Create the AI pricing advisor**

Create `src/server/services/ai-pricing-advisor.ts`:

```typescript
/**
 * AI Pricing Advisor — generates natural-language pricing recommendations
 * using computed statistics from pricing-stats.ts.
 */

import { ai, logTokenUsage } from '@/server/ai';
import { parseAIResponse } from './ai-prompts';
import type { PricingAdviceResult } from './pricing-stats';

export interface AIPricingAdvice {
  summary: string;
  recommendation: string;
  reasoning: string[];
  risks: string[];
  confidence: string;
}

export async function generatePricingAdvice(
  stats: PricingAdviceResult,
  tender: {
    title: string;
    budget: number | null;
    authority: string | null;
    cpvPrimary: string | null;
  },
  language: 'el' | 'en' | 'nl' = 'el',
  tenantId?: string,
): Promise<AIPricingAdvice> {
  const langNames = { el: 'Greek', en: 'English', nl: 'Dutch' };

  const prompt = `You are a pricing intelligence advisor for public procurement tenders.

Based on the following historical data analysis, provide a pricing recommendation.

## Tender Details
- Title: ${tender.title}
- Budget: ${tender.budget ? `€${tender.budget.toLocaleString()}` : 'Unknown'}
- Authority: ${tender.authority || 'Unknown'}
- CPV: ${tender.cpvPrimary || 'Unknown'}

## Historical Analysis (${stats.sampleSize} similar awards)
${stats.ratioStats.count > 0 ? `
- Average award-to-budget ratio: ${stats.ratioStats.mean ? (stats.ratioStats.mean * 100).toFixed(1) + '%' : 'N/A'}
- Median ratio: ${stats.ratioStats.median ? (stats.ratioStats.median * 100).toFixed(1) + '%' : 'N/A'}
- 25th percentile: ${stats.ratioStats.p25 ? (stats.ratioStats.p25 * 100).toFixed(1) + '%' : 'N/A'}
- 75th percentile: ${stats.ratioStats.p75 ? (stats.ratioStats.p75 * 100).toFixed(1) + '%' : 'N/A'}
` : 'No ratio data available.'}

${stats.recommendedRange ? `
## Recommended Price Range
- Conservative (p75): €${stats.recommendedRange.high.toLocaleString()}
- Median: €${stats.recommendedRange.mid.toLocaleString()}
- Aggressive (p25): €${stats.recommendedRange.low.toLocaleString()}
` : ''}

## Competition (${stats.competitorCount} known competitors)
${stats.topCompetitors.slice(0, 5).map((c) =>
  `- ${c.name}: ${c.wins} wins${c.avgRatio ? `, avg ratio ${(c.avgRatio * 100).toFixed(1)}%` : ''}`
).join('\n') || 'No competitor data available.'}

${stats.authority ? `
## Authority Profile: ${stats.authority.authority}
- Total awards: ${stats.authority.totalAwards}
- Average amount: ${stats.authority.avgAmount ? `€${stats.authority.avgAmount.toLocaleString()}` : 'N/A'}
- Average ratio: ${stats.authority.avgRatio ? (stats.authority.avgRatio * 100).toFixed(1) + '%' : 'N/A'}
` : ''}

## Confidence: ${stats.confidence}

Respond in ${langNames[language]}. Return a JSON object with these exact keys:
{
  "summary": "One sentence overview of the pricing situation",
  "recommendation": "Specific recommended bid price with reasoning",
  "reasoning": ["bullet point 1", "bullet point 2", ...],
  "risks": ["risk 1", "risk 2", ...],
  "confidence": "Explanation of data confidence level"
}`;

  try {
    const provider = ai();
    const result = await provider.complete({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 1000,
    });

    if (tenantId) {
      await logTokenUsage(tenantId, 'pricing-intelligence', result.usage);
    }

    const parsed = parseAIResponse<AIPricingAdvice>(result.content);
    return parsed ?? {
      summary: result.content.slice(0, 200),
      recommendation: 'Δεν ήταν δυνατή η ανάλυση.',
      reasoning: [],
      risks: [],
      confidence: stats.confidence,
    };
  } catch (err) {
    console.error('[AIPricingAdvisor] Error:', (err as Error).message);
    return {
      summary: 'Σφάλμα κατά τη δημιουργία σύστασης τιμής.',
      recommendation: 'Παρακαλούμε δοκιμάστε ξανά.',
      reasoning: [],
      risks: [],
      confidence: stats.confidence,
    };
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/server/services/ai-pricing-advisor.ts
git commit -m "feat: add AI pricing advisor with natural-language recommendations"
```

---

### Task 4: tRPC Router for Pricing Intelligence

**Files:**
- Create: `src/server/routers/pricing-intelligence.ts`
- Modify: `src/server/root.ts`

- [ ] **Step 1: Create the tRPC router**

Create `src/server/routers/pricing-intelligence.ts`:

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '@/server/trpc';
import { normalizeAuthority } from '@/server/services/award-normalizer';
import {
  computeCpvStats,
  computeAuthorityProfile,
  computeCompetitorRanking,
  computePricingAdvice,
} from '@/server/services/pricing-stats';
import { generatePricingAdvice } from '@/server/services/ai-pricing-advisor';

export const pricingIntelligenceRouter = router({
  similarAwards: protectedProcedure
    .input(z.object({
      cpvPrimary: z.string(),
      budgetMin: z.number().optional(),
      budgetMax: z.number().optional(),
      limit: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = { cpvPrimary: input.cpvPrimary };
      if (input.budgetMin != null || input.budgetMax != null) {
        where.awardAmount = {};
        if (input.budgetMin != null) where.awardAmount.gte = input.budgetMin;
        if (input.budgetMax != null) where.awardAmount.lte = input.budgetMax;
      }

      return ctx.db.historicalAward.findMany({
        where,
        orderBy: { awardDate: 'desc' },
        take: input.limit,
        select: {
          id: true,
          title: true,
          winner: true,
          awardAmount: true,
          budgetAmount: true,
          awardRatio: true,
          authority: true,
          awardDate: true,
          source: true,
          sourceUrl: true,
          cpvPrimary: true,
          numberOfBids: true,
        },
      });
    }),

  cpvStats: protectedProcedure
    .input(z.object({
      cpvPrimary: z.string(),
      yearsBack: z.number().default(2),
    }))
    .query(async ({ ctx, input }) => {
      return computeCpvStats(ctx.db, input.cpvPrimary, input.yearsBack);
    }),

  authorityProfile: protectedProcedure
    .input(z.object({
      authority: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const normalized = normalizeAuthority(input.authority);
      return computeAuthorityProfile(ctx.db, normalized);
    }),

  competitorRanking: protectedProcedure
    .input(z.object({
      cpvPrimary: z.string(),
      budgetMin: z.number().optional(),
      budgetMax: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return computeCompetitorRanking(ctx.db, input.cpvPrimary, input.budgetMin, input.budgetMax);
    }),

  pricingAdvice: protectedProcedure
    .input(z.object({
      tenderId: z.string(),
      language: z.enum(['el', 'en', 'nl']).default('el'),
    }))
    .query(async ({ ctx, input }) => {
      const tender = await ctx.db.tender.findUniqueOrThrow({
        where: { id: input.tenderId },
        select: {
          id: true,
          title: true,
          budget: true,
          contractingAuthority: true,
          cpvCodes: true,
        },
      });

      const cpvPrimary = tender.cpvCodes.length > 0
        ? tender.cpvCodes[0].split('-')[0]
        : null;
      const authorityNormalized = tender.contractingAuthority
        ? normalizeAuthority(tender.contractingAuthority)
        : null;

      // Compute stats
      const stats = await computePricingAdvice(ctx.db, {
        cpvPrimary,
        budget: tender.budget,
        authorityNormalized,
      });

      // Generate AI advice (skip if insufficient data)
      let aiAdvice = null;
      if (stats.confidence !== 'insufficient') {
        aiAdvice = await generatePricingAdvice(
          stats,
          {
            title: tender.title,
            budget: tender.budget,
            authority: tender.contractingAuthority,
            cpvPrimary,
          },
          input.language,
          ctx.tenantId ?? undefined,
        );
      }

      return { stats, aiAdvice };
    }),
});
```

- [ ] **Step 2: Register the router in root.ts**

Open `src/server/root.ts` and add the import and registration:

Add after line 27 (the last import):
```typescript
import { pricingIntelligenceRouter } from '@/server/routers/pricing-intelligence';
```

Add inside the `appRouter` object (after `notification: notificationRouter,`):
```typescript
  pricingIntelligence: pricingIntelligenceRouter,
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/pricing-intelligence.ts src/server/root.ts
git commit -m "feat: add pricing-intelligence tRPC router with 5 endpoints"
```

---

### Task 5: Type Check, Test, Push, Deploy

**Files:** All from Tasks 1-4

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (existing + new pricing-stats tests)

- [ ] **Step 3: Push to remote**

```bash
git push origin main
```

- [ ] **Step 4: Deploy to Vercel**

```bash
vercel --prod --yes
```

Expected: Build succeeds, all endpoints available

- [ ] **Step 5: Quick smoke test**

After deploy, verify the pricing-intelligence endpoint responds (requires auth):

```bash
# From browser console while logged in:
# trpc.pricingIntelligence.cpvStats.query({ cpvPrimary: "45000000" })
```
