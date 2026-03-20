# Financial Tab — Full Value on Mount

**Date:** 2026-03-20
**Status:** Approved
**Context:** TenderCopilot SaaS — replaces external consulting firms that manage tender files for companies. The user should open the Financial tab and see all already-computed data without clicking anything.

---

## Problem

The Financial tab currently has two gaps on mount:

1. **Eligibility not loaded** — `checkFinancialEligibility` query has `enabled: false`. If scenarios exist in DB, the component hardcodes `status: 'BORDERLINE', checks: []` as a placeholder. The real eligibility breakdown (pass/fail per criterion) never shows on mount.
2. **Risk score section is dead** — `riskScore` and `riskFactors` are never populated (no DB storage, never computed). The UI section always shows 0 / empty.

**Root cause of value gap:** A user who opens the tab after a previous session loses the eligibility analysis and sees a misleading BORDERLINE badge with no detail.

---

## Design Principle

> The user opens the Financial tab and sees all already-computed data automatically. No button press required to see something that has already been calculated.

---

## Architecture

### 1. Backend — New `getFinancialSummary` query

Replace the existing `getFinancialData` query (returns only scenarios) with a new `getFinancialSummary` query that returns in a single call:

```ts
{
  scenarios: PricingScenario[]        // from DB
  eligibility: EligibilityResult      // computed from DB (no AI)
  hasFinancialProfile: boolean        // whether tenant has FinancialProfile records
  hasExtractedRequirements: boolean   // whether FINANCIAL_REQUIREMENTS TenderRequirements exist
}
```

**Key fact:** `checkEligibility` is a pure DB computation — it reads `FinancialProfile` and `TenderRequirement` records and compares them. No AI call. Safe to run on every mount.

**Router:** `src/server/routers/ai-roles.ts`
- Add `getFinancialSummary` procedure
- Keep `getFinancialData` for backward compatibility (or remove if no other consumers)

**Service:** `src/server/services/ai-financial.ts`
- `checkEligibility` already exists and returns the full result — reuse as-is

### 2. Frontend — Single query on mount

**File:** `src/components/tender/financial-tab.tsx`

Replace:
```ts
const financialDataQuery = trpc.aiRoles.getFinancialData.useQuery(...)
const eligibilityQuery = trpc.aiRoles.checkFinancialEligibility.useQuery({ tenderId }, { enabled: false })
```

With:
```ts
const summaryQuery = trpc.aiRoles.getFinancialSummary.useQuery({ tenderId }, { retry: false, refetchOnWindowFocus: false })
```

Populate all state from `summaryQuery.data` on mount. The separate `eligibilityQuery` is removed entirely.

After mutations that change financial data (`extractMutation`, `pricingMutation`), call `summaryQuery.refetch()` — one call updates everything.

### 3. UI States

| State | What the user sees |
|---|---|
| Loading on mount | Skeleton loaders in eligibility + scenarios sections |
| No financial requirements extracted yet | Eligibility section: prompt "Run AI Financial Analysis first" |
| Requirements extracted, no FinancialProfile | Eligibility: BORDERLINE + CTA banner "Add company financial data for full analysis" (links to settings) |
| Full data available | Eligibility checks table with pass/fail + scenarios cards — no click required |

### 4. Risk Score Section — Removed

The `riskScore` / `riskFactors` UI section is removed. Replaced by a **summary line** inside the eligibility card:

```
✓ 4 / 6 κριτήρια πληρούνται
```

Color-coded: green (all pass), amber (some fail), red (majority fail). This is derived from `eligibility.checks` — no storage needed.

### 5. Auto-chain after Extract

When `extractFinancials` mutation succeeds, call `summaryQuery.refetch()` instead of the current `eligibilityQuery.refetch()`. This refreshes scenarios + eligibility in one call.

---

## Files Changed

| File | Change |
|---|---|
| `src/server/routers/ai-roles.ts` | Add `getFinancialSummary` query |
| `src/server/services/ai-financial.ts` | No change (reuse `checkEligibility`) |
| `src/components/tender/financial-tab.tsx` | Replace `getFinancialData` + `eligibilityQuery` with `summaryQuery`; remove risk score section; add summary line in eligibility card; update all mutation `onSuccess` to call `summaryQuery.refetch()` |

---

## What Does NOT Change

- `checkFinancialEligibility` as a standalone router procedure stays (used for the manual "Έλεγχος Επιλεξιμότητας" button — kept for user-triggered re-check)
- `suggestPricing`, `extractFinancials`, `selectPricingScenario` mutations — unchanged logic, only `onSuccess` refetch call changes
- `normalizeEligibility()` helper — kept as-is

---

## Out of Scope

- Auto-triggering `extractFinancials` on tender upload (larger architectural change — separate feature)
- Storing eligibility results in DB (not needed — computation is fast and DB-only)
- Risk score via new AI service (not enough value to justify the complexity)
