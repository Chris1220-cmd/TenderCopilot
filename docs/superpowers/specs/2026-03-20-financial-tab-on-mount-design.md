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

**Add** a new `getFinancialSummary` query alongside the existing `getFinancialData` (keep `getFinancialData` — do not remove it). The financial tab component switches to `getFinancialSummary`; `getFinancialData` stays for any other consumers.

Return shape:

```ts
{
  scenarios: PricingScenario[]        // from DB
  eligibility: EligibilityResult | null  // null if no requirements extracted yet
  hasFinancialProfile: boolean        // db.financialProfile.count({ where: { tenantId } }) > 0
  hasExtractedRequirements: boolean   // db.tenderRequirement.count({ where: { tenderId, category: 'FINANCIAL_REQUIREMENTS' } }) > 0
}
```

**`hasFinancialProfile`:** `db.financialProfile.count({ where: { tenantId } }) > 0` — any row for this tenant, regardless of year.

**`hasExtractedRequirements`:** `db.tenderRequirement.count({ where: { tenderId, category: 'FINANCIAL_REQUIREMENTS' } }) > 0`.

**Eligibility computation:**

- If `hasExtractedRequirements` is false → return `eligibility: null` (nothing to check against).
- If `hasFinancialProfile` is false → return `eligibility: null` (same as "no requirements" — the frontend uses `hasFinancialProfile` flag, not the eligibility shape, to decide which UI state to show). Do NOT call `checkEligibility`.
- Otherwise → call `aiFinancial.checkEligibility(tenderId, tenantId)` normally.

**Error handling:** Wrap the `checkEligibility` call in try/catch. If it throws, return `eligibility: null` and log a server-side warning. Scenarios and flags are still returned.

**Router:** `src/server/routers/ai-roles.ts`
- Add `getFinancialSummary` procedure; `getFinancialData` remains unchanged.

**Service:** `src/server/services/ai-financial.ts`
- `checkEligibility` reused as-is — no changes.

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

The component uses `summaryQuery.data.hasFinancialProfile` and `summaryQuery.data.hasExtractedRequirements` to disambiguate states that `EligibilityResult` alone cannot distinguish.

| State | Condition | What the user sees |
|---|---|---|
| Loading on mount | `summaryQuery.isLoading` | Skeleton loaders in eligibility + scenarios sections |
| No extraction yet | `hasExtractedRequirements === false` | Eligibility section: "Εκτελέστε πρώτα AI Ανάλυση Οικονομικών" |
| Extracted, no FinancialProfile | `hasExtractedRequirements && !hasFinancialProfile` | BORDERLINE badge + CTA banner: "Συμπληρώστε τα οικονομικά στοιχεία εταιρείας για πλήρη ανάλυση" (link to settings) |
| Full data | `hasExtractedRequirements && hasFinancialProfile` | Eligibility checks table + summary line + scenarios cards |
| Error loading | `summaryQuery.isError` | Error banner — retry button |

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

- `checkFinancialEligibility` standalone router procedure stays. The manual "Έλεγχος Επιλεξιμότητας" button calls it via refetch, then on success calls `summaryQuery.refetch()` so the display stays in sync with `summaryQuery` data.
- `suggestPricing`, `extractFinancials`, `selectPricingScenario` mutations — unchanged logic, only `onSuccess` refetch call changes (call `summaryQuery.refetch()`)
- `normalizeEligibility()` helper — kept and applied to `summaryQuery.data.eligibility` on the frontend (same normalization: `passed` → `pass` field mapping)
- `eligibilityQuery` (the old `useQuery` with `enabled: false`) — removed from the component

## Summary Line Color Thresholds

Derived from `eligibility.checks`:

- Green: all checks pass (`failedCount === 0`)
- Amber: 1 or more checks fail but fewer than half (`failedCount < checks.length / 2`)
- Red: half or more checks fail (`failedCount >= checks.length / 2`)

---

## Out of Scope

- Auto-triggering `extractFinancials` on tender upload (larger architectural change — separate feature)
- Storing eligibility results in DB (not needed — computation is fast and DB-only)
- Risk score via new AI service (not enough value to justify the complexity)
