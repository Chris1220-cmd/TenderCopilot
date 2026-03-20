# Financial Tab — Full Value on Mount — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single `getFinancialSummary` tRPC query that returns scenarios + eligibility + flags in one call, and refactor `financial-tab.tsx` to load all computed data on mount without any user interaction.

**Architecture:** A new `getFinancialSummary` router procedure aggregates scenarios, eligibility (computed from DB — no AI), and two boolean flags (`hasFinancialProfile`, `hasExtractedRequirements`) in a single parallel DB query. The component replaces two separate queries with this one, removes all local `data` state, and reads display data directly from the query result. The risk score section is removed and replaced by a derived summary line inside the eligibility card.

**Tech Stack:** Next.js 14, tRPC v11, Prisma, Vitest (unit tests), React

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/server/routers/ai-roles.ts` | Modify | Add `getFinancialSummary` procedure |
| `src/server/routers/__tests__/financial-summary.test.ts` | Create | Unit tests for the new procedure's eligibility-gating logic |
| `src/components/tender/financial-tab.tsx` | Modify | Replace queries, remove `data` state and risk section, add UI states |

---

## Task 1: Unit tests for `getFinancialSummary` eligibility logic

**Files:**
- Create: `src/server/routers/__tests__/financial-summary.test.ts`

These tests verify the three eligibility-gating cases before the router code is written.

- [ ] **Step 1: Create the test file**

```ts
// src/server/routers/__tests__/financial-summary.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db
vi.mock('@/lib/db', () => ({
  db: {
    pricingScenario: { findMany: vi.fn() },
    tenderRequirement: { count: vi.fn() },
    financialProfile: { count: vi.fn() },
    tender: { findUnique: vi.fn() },
  },
}));

// Mock aiFinancial
vi.mock('@/server/services/ai-financial', () => ({
  aiFinancial: {
    checkEligibility: vi.fn(),
  },
}));

import { db } from '@/lib/db';
import { aiFinancial } from '@/server/services/ai-financial';

// Extract the eligibility-gating logic for isolated testing
async function computeEligibility(
  tenderId: string,
  tenantId: string
): Promise<{ eligibility: any; hasFinancialProfile: boolean; hasExtractedRequirements: boolean }> {
  const [reqCount, profileCount] = await Promise.all([
    (db.tenderRequirement as any).count({
      where: { tenderId, category: 'FINANCIAL_REQUIREMENTS' },
    }),
    (db.financialProfile as any).count({
      where: { tenantId },
    }),
  ]);

  const hasExtractedRequirements = reqCount > 0;
  const hasFinancialProfile = profileCount > 0;

  let eligibility = null;
  if (hasExtractedRequirements && hasFinancialProfile) {
    try {
      eligibility = await aiFinancial.checkEligibility(tenderId, tenantId);
    } catch {
      eligibility = null;
    }
  }

  return { eligibility, hasFinancialProfile, hasExtractedRequirements };
}

describe('getFinancialSummary — eligibility gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns eligibility: null when no requirements extracted', async () => {
    vi.mocked(db.tenderRequirement.count as any).mockResolvedValue(0);
    vi.mocked(db.financialProfile.count as any).mockResolvedValue(2);

    const result = await computeEligibility('t1', 'tenant1');

    expect(result.eligibility).toBeNull();
    expect(result.hasExtractedRequirements).toBe(false);
    expect(result.hasFinancialProfile).toBe(true);
    expect(aiFinancial.checkEligibility).not.toHaveBeenCalled();
  });

  it('returns eligibility: null when no financial profile', async () => {
    vi.mocked(db.tenderRequirement.count as any).mockResolvedValue(3);
    vi.mocked(db.financialProfile.count as any).mockResolvedValue(0);

    const result = await computeEligibility('t1', 'tenant1');

    expect(result.eligibility).toBeNull();
    expect(result.hasExtractedRequirements).toBe(true);
    expect(result.hasFinancialProfile).toBe(false);
    expect(aiFinancial.checkEligibility).not.toHaveBeenCalled();
  });

  it('calls checkEligibility and returns result when both exist', async () => {
    vi.mocked(db.tenderRequirement.count as any).mockResolvedValue(3);
    vi.mocked(db.financialProfile.count as any).mockResolvedValue(1);
    const mockResult = { status: 'ELIGIBLE', checks: [{ criterion: 'Κύκλος εργασιών', required: '100K', actual: '200K', passed: true }] };
    vi.mocked(aiFinancial.checkEligibility).mockResolvedValue(mockResult as any);

    const result = await computeEligibility('t1', 'tenant1');

    expect(aiFinancial.checkEligibility).toHaveBeenCalledWith('t1', 'tenant1');
    expect(result.eligibility).toEqual(mockResult);
    expect(result.hasExtractedRequirements).toBe(true);
    expect(result.hasFinancialProfile).toBe(true);
  });

  it('returns eligibility: null (not throwing) when checkEligibility throws', async () => {
    vi.mocked(db.tenderRequirement.count as any).mockResolvedValue(2);
    vi.mocked(db.financialProfile.count as any).mockResolvedValue(1);
    vi.mocked(aiFinancial.checkEligibility).mockRejectedValue(new Error('DB error'));

    const result = await computeEligibility('t1', 'tenant1');

    expect(result.eligibility).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests — all 4 should pass immediately**

The test file is self-contained: it defines a local `computeEligibility` helper and tests it directly. No router code is needed.

```bash
cd "c:/Users/athan/Desktop/TenderCopilot" && npx vitest run src/server/routers/__tests__/financial-summary.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 3: Commit the test file**

```bash
git add src/server/routers/__tests__/financial-summary.test.ts
git commit -m "test: add unit tests for getFinancialSummary eligibility gating"
```

---

## Task 2: Add `getFinancialSummary` to the router

**Files:**
- Modify: `src/server/routers/ai-roles.ts` (around line 237, after `getFinancialData`)

- [ ] **Step 1: Add the procedure**

In `src/server/routers/ai-roles.ts`, after the `getFinancialData` procedure (around line 246), add:

```ts
  getFinancialSummary: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { tenantId } = await ensureTenderAccess(input.tenderId, ctx.tenantId);
      // tenantId is destructured from ensureTenderAccess return — same as ctx.tenantId
      // but validated. This pattern is used by goNoGo, generateProposal, etc.

      const [scenarios, reqCount, profileCount] = await Promise.all([
        db.pricingScenario.findMany({
          where: { tenderId: input.tenderId },
          orderBy: { createdAt: 'asc' },
        }),
        db.tenderRequirement.count({
          where: { tenderId: input.tenderId, category: 'FINANCIAL_REQUIREMENTS' },
        }),
        db.financialProfile.count({
          where: { tenantId },
        }),
      ]);

      const hasExtractedRequirements = reqCount > 0;
      const hasFinancialProfile = profileCount > 0;

      let eligibility = null;
      if (hasExtractedRequirements && hasFinancialProfile) {
        try {
          eligibility = await aiFinancial.checkEligibility(input.tenderId, tenantId);
        } catch (err) {
          console.warn('[getFinancialSummary] checkEligibility failed:', err);
        }
      }

      return {
        scenarios,
        eligibility,
        hasFinancialProfile,
        hasExtractedRequirements,
      };
    }),
```

**Note:** `aiFinancial` is already imported at the top of the file (line 7).

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "c:/Users/athan/Desktop/TenderCopilot" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run the unit tests**

```bash
npx vitest run src/server/routers/__tests__/financial-summary.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/ai-roles.ts
git commit -m "feat: add getFinancialSummary tRPC query — scenarios + eligibility + flags in one call"
```

---

## Task 3: Refactor `financial-tab.tsx` — replace queries and remove local `data` state

**Files:**
- Modify: `src/components/tender/financial-tab.tsx`

This is the largest task. Work through the component top-to-bottom.

### Step 3a — Remove dead types and helpers

- [ ] **Step 1: Remove unused interfaces and helpers**

Delete these from the top of the file (lines ~62–73, ~124–140):
- `interface FinancialRiskFactor` (entire interface)
- `interface FinancialData` (entire interface)
- `function getScoreColor` (entire function)
- `function getBarColor` (entire function)
- `function getBarBg` (entire function)

Remove these from the lucide-react import line (~line 20):
- `BarChart3`
- `AlertTriangle`
- `TrendingDown` (unused)

- [ ] **Step 2: Verify TypeScript compiles (will fail — expected)**

```bash
cd "c:/Users/athan/Desktop/TenderCopilot" && npx tsc --noEmit
```

Expected: errors about `data`, `riskScore`, etc. — that's fine, we fix them next.

### Step 3b — Replace the query wiring

- [ ] **Step 3: Replace `financialDataQuery` and `eligibilityQuery` with `summaryQuery`**

Remove these two declarations from the component body (around lines 178–236):
```ts
// REMOVE:
const financialDataQuery = trpc.aiRoles.getFinancialData.useQuery(...)

// REMOVE the entire inline if block (lines 184-196):
if (financialDataQuery.data?.scenarios && ...) { ... }

// REMOVE:
const eligibilityQuery = trpc.aiRoles.checkFinancialEligibility.useQuery(...)
```

Add in their place (after the `useState` declarations):
```ts
// Single query — loads scenarios + eligibility + flags on mount
const summaryQuery = trpc.aiRoles.getFinancialSummary.useQuery(
  { tenderId },
  { retry: false, refetchOnWindowFocus: false }
);

// Derive display data from query result
const summaryData = summaryQuery.data;
const dbScenarios = (summaryData?.scenarios ?? []).map((s: any) => ({
  id: s.id,
  name: s.name,
  type: nameToType(s.name),
  totalPrice: s.totalPrice,
  margin: s.margin,
  winProbability: s.winProbability ?? 0,
}));
const eligibility = summaryData?.eligibility
  ? normalizeEligibility(summaryData.eligibility)
  : null;
const hasFinancialProfile = summaryData?.hasFinancialProfile ?? false;
const hasExtractedRequirements = summaryData?.hasExtractedRequirements ?? false;

// NOTE: selectedScenario initialization MUST go in useEffect, not inline render.
// Calling setState in the render body causes React 18 warnings and potential infinite loops.
// Add this useEffect after the summaryQuery declaration:
useEffect(() => {
  if (summaryQuery.isSuccess && selectedScenario === null && summaryData?.scenarios) {
    const selected = summaryData.scenarios.find((s: any) => s.isSelected);
    if (selected) setSelectedScenario(nameToType(selected.name));
  }
}, [summaryQuery.isSuccess, summaryData?.scenarios]);
// Import useEffect from 'react' — add it to the existing React import at line 3.
```

- [ ] **Step 4: Remove `data` state declaration and `useState` import from `FinancialData`**

Remove:
```ts
const [data, setData] = useState<FinancialData | null>(null);
```

- [ ] **Step 5: Update `extractMutation.onSuccess`**

Replace the entire `onSuccess` callback of `extractMutation` with:
```ts
onSuccess: () => {
  summaryQuery.refetch();
  setLoadingAction(null);
  setError(null);
},
```

- [ ] **Step 6: Update `pricingMutation.onSuccess`**

Replace the entire `onSuccess` callback of `pricingMutation` with:
```ts
onSuccess: () => {
  summaryQuery.refetch();
  setLoadingAction(null);
  setError(null);
},
```

- [ ] **Step 7: Update `handleEligibility`**

The spec says the manual button should call `checkFinancialEligibility` then `summaryQuery.refetch()`. In practice, `summaryQuery` already calls `checkEligibility` internally — so calling both is redundant. **Intentional deviation from spec:** call only `summaryQuery.refetch()`, which re-runs the eligibility computation as part of the summary. This is simpler and produces identical results.

Replace the entire `handleEligibility` function with:
```ts
const handleEligibility = async () => {
  setLoadingAction('eligibility');
  setError(null);
  try {
    await summaryQuery.refetch();
  } catch (err: any) {
    setError(err?.message || 'Σφάλμα ελέγχου επιλεξιμότητας');
  }
  setLoadingAction(null);
};
```

- [ ] **Step 8: Update `eligCfg` and `EligIcon` derivation**

Replace (around line 299):
```ts
const eligCfg = data?.eligibility?.status ? eligibilityConfig[data.eligibility.status] : null;
const EligIcon = eligCfg?.icon ?? null;
```

With:
```ts
const eligCfg = eligibility?.status ? eligibilityConfig[eligibility.status] : null;
const EligIcon = eligCfg?.icon ?? null;
```

- [ ] **Step 9: Verify TypeScript compiles**

```bash
cd "c:/Users/athan/Desktop/TenderCopilot" && npx tsc --noEmit
```

Fix any remaining `data.` references — replace `data?.eligibility` → `eligibility`, `data?.scenarios` → `dbScenarios`.

- [ ] **Step 10: Commit**

```bash
git add src/components/tender/financial-tab.tsx
git commit -m "refactor: replace financialDataQuery+eligibilityQuery with summaryQuery, remove data state"
```

---

## Task 4: Update eligibility card UI — states + summary line

**Files:**
- Modify: `src/components/tender/financial-tab.tsx` (eligibility card section, ~lines 351–420)

- [ ] **Step 1: Replace the eligibility card content**

Find the `{/* Eligibility Card */}` section. Replace the `<GlassCardContent>` block with:

```tsx
<GlassCardContent className="px-0">
  {summaryQuery.isLoading ? (
    // Loading skeleton
    <div className="space-y-2 px-5 py-4">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-4/5" />
    </div>
  ) : !hasExtractedRequirements ? (
    // No financial requirements extracted yet
    <p className="text-xs text-muted-foreground text-center py-6 px-5">
      Εκτελέστε πρώτα <strong>AI Ανάλυση Οικονομικών</strong> για να φορτωθούν τα κριτήρια επιλεξιμότητας.
    </p>
  ) : !hasFinancialProfile ? (
    // Requirements exist but no company financial data — show BORDERLINE badge + CTA
    <div className="px-5 py-4 space-y-3">
      <div className="flex items-center gap-2">
        <MinusCircle className="h-5 w-5 text-amber-500 shrink-0" />
        <span className="text-sm font-bold text-amber-700 dark:text-amber-400">Οριακά</span>
        <span className="text-xs text-muted-foreground">— Λείπουν οικονομικά στοιχεία εταιρείας</span>
      </div>
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
        <strong>Συμπληρώστε τα οικονομικά στοιχεία εταιρείας</strong> για πλήρη ανάλυση επιλεξιμότητας.
        <br />
        <span className="text-xs opacity-80">Μεταβείτε στις Ρυθμίσεις → Οικονομικό Προφίλ.</span>
      </div>
    </div>
  ) : eligibility && eligibility.checks.length > 0 ? (
    // Full eligibility table
    <>
      {/* Summary line */}
      {(() => {
        const total = eligibility.checks.length;
        const passed = eligibility.checks.filter((c) => c.pass).length;
        const failed = total - passed;
        const color =
          failed === 0
            ? 'text-emerald-600 dark:text-emerald-400'
            : failed < total / 2
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-red-600 dark:text-red-400';
        return (
          <p className={`text-xs font-semibold px-5 pt-3 pb-1 ${color}`}>
            {passed} / {total} κριτήρια πληρούνται
          </p>
        );
      })()}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left px-5 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Κριτήριο</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Απαίτηση</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Πραγματικό</th>
              <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-16">Αποτέλεσμα</th>
            </tr>
          </thead>
          <tbody>
            {eligibility.checks.map((check, i) => (
              <tr key={i} className="border-b border-border/30">
                <td className="px-5 py-2.5 text-xs font-medium text-foreground">{check.criterion}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">{check.required}</td>
                <td className="px-3 py-2.5 text-xs text-foreground font-mono font-semibold">{check.actual}</td>
                <td className="px-3 py-2.5 text-center">
                  {check.pass ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  ) : (
    <p className="text-xs text-muted-foreground text-center py-6 px-5">
      Δεν βρέθηκαν κριτήρια επιλεξιμότητας. Εκτελέστε εκ νέου ανάλυση.
    </p>
  )}
</GlassCardContent>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "c:/Users/athan/Desktop/TenderCopilot" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/tender/financial-tab.tsx
git commit -m "feat: add eligibility UI states — loading skeleton, no-data prompts, summary line"
```

---

## Task 5: Remove the Financial Risk Score section

**Files:**
- Modify: `src/components/tender/financial-tab.tsx` (risk score card, ~lines 530–592)

- [ ] **Step 1: Delete the risk score GlassCard**

Remove the entire `{/* Financial Risk Score */}` section from the JSX (from `<GlassCard>` to closing `</GlassCard>`, approximately lines 530–592).

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "c:/Users/athan/Desktop/TenderCopilot" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all unit tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Final commit**

```bash
git add src/components/tender/financial-tab.tsx
git commit -m "feat: remove dead financial risk score section — replaced by eligibility summary line"
```

---

## Verification Checklist

After all tasks:

- [ ] `npx tsc --noEmit` → no errors
- [ ] `npx vitest run` → all tests pass
- [ ] Open a tender with existing financial data in the browser — eligibility table loads without clicking anything
- [ ] Open a tender with no extracted requirements — see "Εκτελέστε πρώτα AI Ανάλυση Οικονομικών" prompt
- [ ] Confirm risk score section is gone
- [ ] Click "Έλεγχος Επιλεξιμότητας" — data refreshes correctly
- [ ] Click "Πρόταση Τιμολόγησης" — scenarios load correctly after mutation

---

## Notes for Implementer

- `isSelected` is a top-level column on `PricingScenario` (schema: `isSelected Boolean @default(false)`). `db.pricingScenario.findMany` returns it without a `select` clause — no explicit selection needed.

- `normalizeEligibility()` already handles `passed` → `pass` field mapping from the service — apply it to `summaryData.eligibility` before using `check.pass` in JSX.
- `getFinancialData` router procedure is **not removed** — leave it as-is.
- `checkFinancialEligibility` router procedure is **not removed** — the manual button now calls `summaryQuery.refetch()` instead of a separate eligibility query.
- The `selectedScenario` state initialization (inline `if`) must only set state when `summaryQuery.isSuccess && selectedScenario === null` to avoid re-setting on every render.
