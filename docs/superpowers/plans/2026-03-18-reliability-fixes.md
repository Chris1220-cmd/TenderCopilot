# AI Reliability Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block all AI analysis when no documents exist and block discovery when no KAD codes are set, so the app never produces ungrounded output.

**Architecture:** Add a `requireDocuments()` helper in `document-reader.ts` that throws before any AI service runs. Add a KAD guard at the top of the `getRecommended` tRPC procedure. Add `<NoDocumentsAlert>` UI component wired into the actual AI panel/tab files.

**Tech Stack:** Next.js 14, tRPC (`trpc` import from `@/lib/trpc`), Prisma, Vitest (tests in `src/**/*.test.ts`), TypeScript

**Spec:** `docs/superpowers/specs/2026-03-18-discovery-reliability-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/server/services/document-reader.ts` | Modify | Add `requireDocuments()` export |
| `src/server/services/document-reader.test.ts` | Create | Unit tests for `requireDocuments()` |
| `src/server/services/ai-bid-orchestrator.ts` | Modify | Call `requireDocuments()` in `summarizeTender`, `goNoGoAnalysis` |
| `src/server/services/ai-legal-analyzer.ts` | Modify | Call `requireDocuments()` in `extractClauses`, `assessRisks`, `proposeClarifications` |
| `src/server/services/ai-financial.ts` | Modify | Call `requireDocuments()` in `extractFinancialRequirements` |
| `src/server/services/ai-technical.ts` | Modify | Call `requireDocuments()` in `analyzeTechnicalRequirements`, `generateTechnicalProposal`, `flagTechnicalRisks` |
| `src/components/tender/no-documents-alert.tsx` | Create | Reusable alert with optional retry button |
| `src/components/tender/ai-brief-panel.tsx` | Modify | Show `<NoDocumentsAlert>` on PRECONDITION_FAILED |
| `src/components/tender/go-no-go-panel.tsx` | Modify | Show `<NoDocumentsAlert>` on PRECONDITION_FAILED |
| `src/components/tender/legal-tab.tsx` | Modify | Show `<NoDocumentsAlert>` on PRECONDITION_FAILED |
| `src/components/tender/financial-tab.tsx` | Modify | Show `<NoDocumentsAlert>` on PRECONDITION_FAILED |
| `src/components/tender/technical-tab-enhanced.tsx` | Modify | Show `<NoDocumentsAlert>` on PRECONDITION_FAILED |
| `src/server/routers/discovery.ts` | Modify | Export KAD guard helper + apply in `getRecommended` |
| `src/server/routers/discovery.test.ts` | Create | Unit tests for KAD guard helper |
| `src/components/company/profile-form.tsx` | Modify | KAD validation regex |

---

## Task 1: `requireDocuments()` helper

**Files:**
- Modify: `src/server/services/document-reader.ts`
- Create: `src/server/services/document-reader.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/server/services/document-reader.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    attachedDocument: {
      count: vi.fn(),
    },
  },
}));

import { requireDocuments } from './document-reader';
import { db } from '@/lib/db';

describe('requireDocuments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves when at least one parsed document exists', async () => {
    vi.mocked(db.attachedDocument.count).mockResolvedValue(2);
    await expect(requireDocuments('tender-1')).resolves.toBeUndefined();
  });

  it('throws PRECONDITION_FAILED when no parsed documents exist', async () => {
    vi.mocked(db.attachedDocument.count).mockResolvedValue(0);
    await expect(requireDocuments('tender-1')).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
  });

  it('queries with correct tenderId and parsingStatus filter', async () => {
    vi.mocked(db.attachedDocument.count).mockResolvedValue(1);
    await requireDocuments('tender-abc');
    expect(db.attachedDocument.count).toHaveBeenCalledWith({
      where: { tenderId: 'tender-abc', parsingStatus: 'success' },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd c:/Users/athan/Desktop/TenderCopilot && eval "$(fnm env)" && fnm use 22 --arch x64 && npx vitest run src/server/services/document-reader.test.ts
```
Expected: FAIL — `requireDocuments` not exported

- [ ] **Step 3: Add `requireDocuments()` to document-reader.ts**

Open `src/server/services/document-reader.ts`. Add at the top, after existing imports:
```ts
import { TRPCError } from '@trpc/server';
```

Add at the bottom of the file:
```ts
/**
 * Guard: throws PRECONDITION_FAILED if no successfully-parsed documents exist.
 * Call as first line of every AI service method to prevent ungrounded analysis.
 */
export async function requireDocuments(tenderId: string): Promise<void> {
  const count = await db.attachedDocument.count({
    where: { tenderId, parsingStatus: 'success' },
  });
  if (count === 0) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Δεν βρέθηκαν αναλύσιμα έγγραφα. Κατεβάστε πρώτα τη διακήρυξη.',
    });
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/server/services/document-reader.test.ts
```
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/document-reader.ts src/server/services/document-reader.test.ts
git commit -m "feat: add requireDocuments() guard to document-reader"
```

---

## Task 2: Wire guard into AI services

**Files:**
- Modify: `src/server/services/ai-bid-orchestrator.ts`
- Modify: `src/server/services/ai-legal-analyzer.ts`
- Modify: `src/server/services/ai-financial.ts`
- Modify: `src/server/services/ai-technical.ts`

- [ ] **Step 1: Add import and guard to ai-bid-orchestrator**

In `src/server/services/ai-bid-orchestrator.ts`, add to imports:
```ts
import { requireDocuments } from '@/server/services/document-reader';
```

Add `await requireDocuments(tenderId);` as the **first line** of:
- `summarizeTender(tenderId)` method body
- `goNoGoAnalysis(tenderId, tenantId)` method body

- [ ] **Step 2: Add guard to ai-legal-analyzer**

In `src/server/services/ai-legal-analyzer.ts`, add import and `await requireDocuments(tenderId);` as first line of:
- `extractClauses(tenderId)`
- `assessRisks(tenderId)`
- `proposeClarifications(tenderId)`

- [ ] **Step 3: Add guard to ai-financial**

In `src/server/services/ai-financial.ts`, add import and guard as first line of:
- `extractFinancialRequirements(tenderId)`

- [ ] **Step 4: Add guard to ai-technical**

In `src/server/services/ai-technical.ts`, add import and guard as first line of:
- `analyzeTechnicalRequirements(tenderId)`
- `generateTechnicalProposal(tenderId, tenantId)`
- `flagTechnicalRisks(tenderId)`

- [ ] **Step 5: Build check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/server/services/ai-bid-orchestrator.ts src/server/services/ai-legal-analyzer.ts src/server/services/ai-financial.ts src/server/services/ai-technical.ts
git commit -m "feat: wire requireDocuments() guard into all AI services"
```

---

## Task 3: `<NoDocumentsAlert>` component

**Files:**
- Create: `src/components/tender/no-documents-alert.tsx`

**Important:** This codebase uses `trpc` from `@/lib/trpc`, NOT `api` from `@/lib/api`. Also, `fetchDocumentsFromSource` requires `{ tenderId, sourceUrl, platform }` — all three fields.

- [ ] **Step 1: Create the component**

Create `src/components/tender/no-documents-alert.tsx`:
```tsx
'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';

interface NoDocumentsAlertProps {
  tenderId: string;
  sourceUrl?: string | null;
  platform?: string;
}

/**
 * Shown in AI panels when no parsed documents exist for a tender.
 * If sourceUrl is provided, shows a retry button to re-fetch documents.
 * If sourceUrl is null (manually created tender), only the message is shown.
 */
export function NoDocumentsAlert({ tenderId, sourceUrl, platform = 'OTHER' }: NoDocumentsAlertProps) {
  const fetchDocs = trpc.discovery.fetchDocumentsFromSource.useMutation();

  const handleRetry = () => {
    if (!sourceUrl) return;
    fetchDocs.mutate({ tenderId, sourceUrl, platform });
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-8 text-center">
      <AlertTriangle className="h-10 w-10 text-amber-500" />
      <div>
        <p className="font-semibold text-amber-700 dark:text-amber-400">
          Δεν βρέθηκαν έγγραφα για ανάλυση
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Η AI ανάλυση απαιτεί τουλάχιστον ένα αναλύσιμο αρχείο διακήρυξης.
          {!sourceUrl && ' Ανεβάστε το αρχείο χειροκίνητα από την καρτέλα Έγγραφα.'}
        </p>
      </div>
      {sourceUrl && (
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer gap-2"
          disabled={fetchDocs.isPending}
          onClick={handleRetry}
        >
          {fetchDocs.isPending ? 'Γίνεται λήψη…' : 'Προσπάθεια λήψης εγγράφων'}
        </Button>
      )}
      {fetchDocs.isSuccess && (
        <p className="text-sm text-green-600">
          Τα έγγραφα κατέβηκαν — ανανεώστε τη σελίδα για να εκτελέσετε ανάλυση.
        </p>
      )}
      {fetchDocs.isError && (
        <p className="text-sm text-red-500">
          Αποτυχία λήψης: {fetchDocs.error.message}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/tender/no-documents-alert.tsx
git commit -m "feat: add NoDocumentsAlert component"
```

---

## Task 4: Wire `<NoDocumentsAlert>` into AI panels

**Files:**
- Modify: `src/components/tender/ai-brief-panel.tsx`
- Modify: `src/components/tender/go-no-go-panel.tsx`
- Modify: `src/components/tender/legal-tab.tsx`
- Modify: `src/components/tender/financial-tab.tsx`
- Modify: `src/components/tender/technical-tab-enhanced.tsx`

**Important about sourceUrl:** The `Tender` Prisma model has no `sourceUrl` field. The import URL is stored in `tender.notes` as a string like `"Imported from: https://..."\nDocuments found: N`. Extract it with:
```ts
const sourceUrl = tender.notes?.match(/Imported from: (https?:\/\/\S+)/)?.[1] ?? null;
```

The tender object (including `notes`) must be passed from the parent page to each panel.

- [ ] **Step 1: Read each panel to understand its prop interface and error handling**

Read these five files in full to understand their current props, state, and mutation error handling:
```
src/components/tender/ai-brief-panel.tsx
src/components/tender/go-no-go-panel.tsx
src/components/tender/legal-tab.tsx
src/components/tender/financial-tab.tsx
src/components/tender/technical-tab-enhanced.tsx
```

- [ ] **Step 2: Update each panel — same pattern for all five**

For each panel, apply this pattern:

a) Add import:
```tsx
import { NoDocumentsAlert } from './no-documents-alert';
```

b) Add prop (if not already present): the panel needs access to `tender.notes` or `sourceUrl`. Either add `tenderNotes?: string | null` as a prop, or extract from an existing `tender` prop if the full tender object is already available.

c) Add state:
```tsx
const [noDocs, setNoDocs] = useState(false);
```

d) In the mutation `onError` handler, add special case:
```tsx
onError: (err) => {
  if ((err as any).data?.code === 'PRECONDITION_FAILED') {
    setNoDocs(true);
    return;
  }
  // existing error handling...
},
```

e) Render at top of JSX, before action buttons:
```tsx
{noDocs && (
  <NoDocumentsAlert
    tenderId={tenderId}
    sourceUrl={sourceUrl}  // extracted from tender.notes
    platform={tender?.platform ?? 'OTHER'}
  />
)}
```

- [ ] **Step 3: Verify parent page passes required props**

Find the parent page (likely `src/app/(dashboard)/tenders/[id]/page.tsx`). Ensure it fetches `tender.notes` and `tender.platform` and passes them to each panel component. Add the props if missing.

- [ ] **Step 4: Build check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/components/tender/
git commit -m "feat: show NoDocumentsAlert in AI panels when no documents"
```

---

## Task 5: KAD guard in `getRecommended`

**Files:**
- Modify: `src/server/routers/discovery.ts`
- Create: `src/server/routers/discovery.test.ts`

The guard logic must be extracted as an **exported function** so it can be tested without running the full tRPC stack.

- [ ] **Step 1: Write failing test**

Create `src/server/routers/discovery.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    companyProfile: {
      findFirst: vi.fn(),
    },
  },
}));

import { checkKadGuard } from './discovery';
import { db } from '@/lib/db';

describe('checkKadGuard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns missingKad:true when company has no KAD codes', async () => {
    vi.mocked(db.companyProfile.findFirst).mockResolvedValue({ kadCodes: [] } as any);
    const result = await checkKadGuard('tenant-1');
    expect(result.missingKad).toBe(true);
  });

  it('returns missingKad:true when no company profile exists', async () => {
    vi.mocked(db.companyProfile.findFirst).mockResolvedValue(null);
    const result = await checkKadGuard('tenant-1');
    expect(result.missingKad).toBe(true);
  });

  it('returns missingKad:false when KAD codes exist', async () => {
    vi.mocked(db.companyProfile.findFirst).mockResolvedValue({ kadCodes: ['62.01'] } as any);
    const result = await checkKadGuard('tenant-1');
    expect(result.missingKad).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
eval "$(fnm env)" && fnm use 22 --arch x64 && npx vitest run src/server/routers/discovery.test.ts
```
Expected: FAIL — `checkKadGuard` not exported

- [ ] **Step 3: Add exported `checkKadGuard` to discovery.ts**

In `src/server/routers/discovery.ts`, add after the imports (before the router):
```ts
/**
 * Exported for testing. Returns { missingKad: true } if the tenant has
 * no company profile or no KAD codes set.
 */
export async function checkKadGuard(tenantId: string): Promise<{ missingKad: boolean }> {
  const company = await db.companyProfile.findFirst({
    where: { tenantId },
    select: { kadCodes: true },
  });
  if (!company || company.kadCodes.length === 0) {
    return { missingKad: true };
  }
  return { missingKad: false };
}
```

- [ ] **Step 4: Apply guard in `getRecommended` procedure**

Replace the `getRecommended` procedure body:
```ts
getRecommended: protectedProcedure.query(async ({ ctx }) => {
  if (!ctx.tenantId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
  }

  const guard = await checkKadGuard(ctx.tenantId);
  if (guard.missingKad) {
    return { tenders: [], missingKad: true };
  }

  const results = await tenderDiscovery.matchTendersForTenant(ctx.tenantId);
  return {
    tenders: results.slice(0, 10).map((t) => ({
      ...t,
      publishedAt: t.publishedAt.toISOString(),
      submissionDeadline: t.submissionDeadline?.toISOString() ?? null,
    })),
    missingKad: false,
  };
}),
```

- [ ] **Step 5: Update discovery UI to handle `missingKad`**

Find the discovery page component. When `data?.missingKad === true`, render:
```tsx
<div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-sm">
  <strong>Προσθέστε ΚΑΔ στο προφίλ σας</strong> για να δείτε σχετικούς διαγωνισμούς.{' '}
  <a href="/settings/company" className="underline cursor-pointer">
    Ρυθμίσεις εταιρείας
  </a>
</div>
```

Note: The existing UI that calls `getRecommended` may expect a flat array, not `{ tenders, missingKad }`. Update any `.map()` calls on the result to use `data?.tenders ?? []`.

- [ ] **Step 6: Run tests**

```bash
npx vitest run src/server/routers/discovery.test.ts
```
Expected: 3 tests PASS

- [ ] **Step 7: Build check**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add src/server/routers/discovery.ts src/server/routers/discovery.test.ts
git commit -m "feat: add KAD guard to discovery getRecommended"
```

---

## Task 6: KAD validation in company profile form

**Files:**
- Modify: `src/components/company/profile-form.tsx`

- [ ] **Step 1: Read profile-form.tsx**

Read `src/components/company/profile-form.tsx` to understand how `kadCodes` are stored and displayed (look for the KAD section and current validation if any).

- [ ] **Step 2: Add validation**

Add the regex constant:
```ts
// Greek KAD format: two digits, dot, two to four digits (e.g., 62.01, 43.2200)
const KAD_REGEX = /^\d{2}\.\d{2,4}$/;
```

Find the zod schema (likely `z.array(z.string())`) and update:
```ts
kadCodes: z.array(
  z.string().regex(KAD_REGEX, 'Μη έγκυρος ΚΑΔ — απαιτείται μορφή ΧΧ.ΧΧ (π.χ. 62.01)')
).optional(),
```

- [ ] **Step 3: Build check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/company/profile-form.tsx
git commit -m "feat: add KAD format validation in company profile form"
```

---

## Smoke Test (manual)

1. Open a tender with **no attached documents**
2. Click any AI analysis button
3. Expected: `<NoDocumentsAlert>` appears — no AI output generated

4. Open Discovery with company profile that has **no KAD codes**
5. Expected: Blue banner "Προσθέστε ΚΑΔ" — no tender list

6. Add KAD `62.01` to profile → Discovery loads tenders

7. Try adding invalid KAD `ABC123` → profile form shows validation error
