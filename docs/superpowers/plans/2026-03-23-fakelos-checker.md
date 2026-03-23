# Fakelos Checker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI-powered tender dossier completeness checker that replaces the external consultant — extracting requirements, cross-checking company vault, and providing actionable guidance in plain Greek.

**Architecture:** New `FakelosCheckerService` orchestrates existing AI extraction + ComplianceEngine, adds plain-Greek guidance generation via Gemini, and returns structured `FakelosReport`. Frontend renders as premium Superhuman-styled tab (Φάκελος Α/Β/Γ checklist) inside tender detail + war room overview page.

**Tech Stack:** Next.js 14, tRPC, Prisma, Gemini AI, Framer Motion, Tailwind CSS, Radix UI

**Spec:** `docs/superpowers/specs/2026-03-23-fakelos-checker-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/server/services/fakelos-checker.ts` | Core service: classify requirements into envelopes, cross-check vault, generate guidance, calculate readiness |
| `src/server/routers/fakelos.ts` | tRPC router: runCheck, getReport, markItemStatus, getWarRoom |
| `src/components/tender/fakelos-tab.tsx` | Tender detail tab: readiness score + Φάκελος Α/Β/Γ checklist |
| `src/app/(dashboard)/fakeloi/page.tsx` | War room page: all tenders with readiness overview |

### Modified Files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `fakelosReport Json?` and `fakelosCheckedAt DateTime?` to Tender model |
| `src/server/root.ts` | Register `fakelos: fakelosRouter` |
| `src/app/(dashboard)/tenders/[id]/page.tsx` | Add Φάκελος tab |
| `src/components/layout/top-nav.tsx` | Discovery → Φάκελοι |

### Deleted Files
| File | Reason |
|------|--------|
| `src/app/(dashboard)/discovery/page.tsx` | Replaced by `/fakeloi` |

---

## Task 1: Database — Add Fakelos Fields to Tender Model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add fields to Tender model**

In `prisma/schema.prisma`, find the Tender model and add these two fields after `analysisLanguage`:

```prisma
  // Fakelos Checker
  fakelosReport     Json?       // Cached FakelosReport
  fakelosCheckedAt  DateTime?   // Last check timestamp
```

Also add `IN_PROGRESS` to the `CoverageStatus` enum (needed for user-marked items):

```prisma
enum CoverageStatus {
  UNMAPPED
  COVERED
  GAP
  IN_PROGRESS        // NEW — user marked as "working on it"
  MANUAL_OVERRIDE
}
```

- [ ] **Step 2: Generate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 3: Create migration (if connected to DB)**

```bash
npx prisma db push
```

Note: On Windows ARM64 without local Prisma engine, this may fail locally. The migration will run on Vercel deployment via `prisma generate` in postinstall.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "schema: add fakelosReport and fakelosCheckedAt to Tender model"
```

---

## Task 2: Backend — FakelosCheckerService

**Files:**
- Create: `src/server/services/fakelos-checker.ts`

- [ ] **Step 1: Create the service file with types**

Create `src/server/services/fakelos-checker.ts` with these type definitions and the main class:

```typescript
import { db } from '@/lib/db';
import { ai } from '@/server/ai';
import type {
  TenderRequirement,
  Certificate,
  LegalDocument,
  Project,
  ContentLibraryItem,
  RequirementCategory,
} from '@prisma/client';

// ─── Types ──────────────────────────────────────────────────

export interface FakelosItem {
  requirementId: string;
  title: string;
  description: string;
  articleReference: string;
  status: 'COVERED' | 'GAP' | 'EXPIRING' | 'IN_PROGRESS' | 'MANUAL_OVERRIDE'; // Note: EXPIRING is computed at runtime (not persisted), derived from expiry date vs deadline
  urgency: 'CRITICAL' | 'WARNING' | 'OK';
  mandatory: boolean;
  matchedAsset?: {
    type: 'certificate' | 'legalDocument' | 'project' | 'contentLibrary' | 'generatedDocument';
    id: string;
    name: string;
    expiryDate?: string;
  };
  guidance?: string;
  actionLabel?: string;
  estimatedCost?: string;
  estimatedTime?: string;
  expiryDate?: string;
  daysUntilExpiry?: number;
  aiConfidence?: number;
  sourceText?: string;            // Original text from διακήρυξη (truncated ~100 chars) for trust/verification
}

export interface FakelosEnvelope {
  id: 'A' | 'B' | 'C';
  title: string;
  totalItems: number;
  coveredItems: number;
  score: number;
  items: FakelosItem[];
}

export interface FakelosReport {
  readinessScore: number;
  status: 'READY' | 'AT_RISK' | 'NOT_READY';
  statusMessage: string;
  lastCheckedAt: string;
  deadline: string | null;
  daysUntilDeadline: number | null;
  envelopes: FakelosEnvelope[];
  criticalGaps: FakelosItem[];
  expiringItems: FakelosItem[];
  vaultEmpty: boolean;
}
```

- [ ] **Step 2: Implement the core `runCheck` method**

Add the `FakelosChecker` class with the main orchestration method. This method:
1. Loads tender + requirements + company assets
2. Classifies requirements into envelopes Α/Β/Γ
3. Cross-checks each requirement against company vault
4. Validates expiry dates against tender deadline
5. Generates plain-Greek guidance for GAP items via Gemini
6. Calculates weighted readiness score
7. Caches result in tender.fakelosReport

Key implementation details:
- Envelope classification: `PARTICIPATION_CRITERIA` + `EXCLUSION_CRITERIA` + `DOCUMENTATION_REQUIREMENTS` + `CONTRACT_TERMS` → Α, `TECHNICAL_REQUIREMENTS` → Β, `FINANCIAL_REQUIREMENTS` → Γ
- Readiness score: mandatory items weight 3x, optional 1x
- Status thresholds: ≥95% READY, ≥80% AT_RISK, <80% NOT_READY
- Use existing `RequirementMapping` data for coverage status
- For guidance generation, batch GAP items and call Gemini once with all of them (efficient token usage)

Guidance prompt per GAP item:
```
Είσαι σύμβουλος δημοσίων συμβάσεων. Ο πελάτης σου (ΔΕΝ ξέρει από διαγωνισμούς) ετοιμάζει φάκελο.
Του λείπει: "{requirement.text}"
Άρθρο: {requirement.articleReference}
Υποχρεωτικό: {mandatory ? 'ΝΑΙ — θα αποκλειστεί' : 'ΟΧΙ — βαθμολογείται'}

Απάντησε σε JSON: { "title": "σύντομος τίτλος 5-8 λέξεις", "guidance": "2-3 προτάσεις: τι είναι, πώς αποκτάται, κόστος/χρόνος", "actionLabel": "τι πατάει ο χρήστης", "estimatedCost": "~€X", "estimatedTime": "X ημέρες/μήνες" }
Απάντησε ΜΟΝΟ JSON, χωρίς markdown.
```

- [ ] **Step 3: Implement helper methods**

Add helper methods:
- `classifyEnvelope(category: RequirementCategory): 'A' | 'B' | 'C'`
- `checkExpiry(asset: { expiryDate?: Date }, deadline: Date | null): { expiring: boolean, daysLeft: number | null }`
- `calculateScore(envelopes: FakelosEnvelope[]): number`
- `generateStatusMessage(score: number, criticalCount: number, expiringCount: number): string`

- [ ] **Step 4: Add `getWarRoomData` method**

Method that loads all active tenders for a tenant and returns summary data:
```typescript
async getWarRoomData(tenantId: string): Promise<Array<{
  tenderId: string;
  title: string;
  referenceNumber: string | null;
  deadline: string | null;
  daysUntilDeadline: number | null;
  readinessScore: number;
  status: 'READY' | 'AT_RISK' | 'NOT_READY' | 'UNCHECKED';
  criticalGaps: number;
  lastCheckedAt: string | null;
}>>
```

Query: `db.tender.findMany({ where: { tenantId, status: { notIn: ['WON', 'LOST', 'SUBMITTED'] } } })` and map `fakelosReport` JSON.

- [ ] **Step 5: Export singleton**

```typescript
export const fakelosChecker = new FakelosChecker();
```

- [ ] **Step 6: Commit**

```bash
git add src/server/services/fakelos-checker.ts
git commit -m "feat: FakelosCheckerService — core dossier completeness engine"
```

---

## Task 3: Backend — Fakelos tRPC Router

**Files:**
- Create: `src/server/routers/fakelos.ts`
- Modify: `src/server/root.ts`

- [ ] **Step 1: Create the router**

Create `src/server/routers/fakelos.ts` with 4 procedures:

```typescript
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';
import { fakelosChecker } from '@/server/services/fakelos-checker';
import { db } from '@/lib/db';

async function ensureTenderAccess(tenderId: string, tenantId: string | null) {
  if (!tenantId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant.' });
  const tender = await db.tender.findUnique({ where: { id: tenderId } });
  if (!tender || tender.tenantId !== tenantId)
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
  return { tender, tenantId };
}

export const fakelosRouter = router({
  // Run full check — mutation (triggers AI)
  runCheck: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { tenantId } = await ensureTenderAccess(input.tenderId, ctx.session.user.tenantId);
      return fakelosChecker.runCheck(input.tenderId, tenantId);
    }),

  // Get cached report — query (no AI, fast)
  getReport: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ input, ctx }) => {
      const { tender } = await ensureTenderAccess(input.tenderId, ctx.session.user.tenantId);
      if (!tender.fakelosReport) return null;
      return tender.fakelosReport as any; // FakelosReport JSON
    }),

  // Mark item status — mutation
  markItemStatus: protectedProcedure
    .input(z.object({
      requirementId: z.string(),
      status: z.enum(['IN_PROGRESS', 'MANUAL_OVERRIDE']),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.session.user.tenantId) throw new TRPCError({ code: 'BAD_REQUEST' });
      await db.tenderRequirement.update({
        where: { id: input.requirementId },
        data: { coverageStatus: input.status },
      });
      return { success: true };
    }),

  // War room — query
  getWarRoom: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.session.user.tenantId) throw new TRPCError({ code: 'BAD_REQUEST' });
      return fakelosChecker.getWarRoomData(ctx.session.user.tenantId);
    }),
});
```

- [ ] **Step 2: Register router in root.ts**

In `src/server/root.ts`, add:
```typescript
import { fakelosRouter } from '@/server/routers/fakelos';
```

And in the `appRouter` object:
```typescript
fakelos: fakelosRouter,
```

- [ ] **Step 3: Verify build**

```bash
npx next build
```

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/fakelos.ts src/server/root.ts
git commit -m "feat: fakelos tRPC router — runCheck, getReport, markItemStatus, warRoom"
```

---

## Task 4: Frontend — FakelosTab Component

**Files:**
- Create: `src/components/tender/fakelos-tab.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/tender/fakelos-tab.tsx` — premium Superhuman-styled component.

Structure:
1. **Top section**: Circular readiness score (animated SVG ring) + status badge + status message + deadline countdown + "Τρέξε Έλεγχο" ShimmerButton + "Δημιουργία Πακέτου" outline button (visible only when score ≥95%, disabled placeholder for Phase 2)
2. **Empty vault banner**: If `report.vaultEmpty`, show prominent CTA to `/company`
3. **Three collapsible GlassCard sections** for Φάκελος Α/Β/Γ:
   - Header: envelope letter in gradient circle + title + "7/10 τεκμηριωμένα" + section score
   - Collapsible body with BlurFade stagger per item
4. **Item rendering by urgency**:
   - CRITICAL: `bg-red-500/[0.04] border-red-500/15` — red ✕ icon, expanded guidance, action buttons
   - WARNING: `bg-amber-500/[0.04] border-amber-500/12` — amber ! icon, guidance visible
   - OK: `bg-card border-border/60` — green ✓, compact single line with expiry date
   - IN_PROGRESS: `bg-blue-500/[0.04] border-blue-500/12` — blue spinner
5. **Each GAP/EXPIRING item shows**: title, plain Greek guidance, article reference, action buttons ("Ανέβασε Αρχείο", "Σε Εξέλιξη")
6. **Low confidence warning**: If `aiConfidence < 0.7`, show "⚠ Ελέγξτε χειροκίνητα" badge

Data fetching pattern (matching Go-No-Go panel):
```typescript
const reportQuery = trpc.fakelos.getReport.useQuery({ tenderId });
const runCheckMutation = trpc.fakelos.runCheck.useMutation({
  onSuccess: () => reportQuery.refetch(),
});
```

Styling: motion stagger entrance, GlassCard wrappers, hover:scale(1.005), BlurFade per item, animated circular score with SVG stroke-dashoffset on mount.

- [ ] **Step 2: Create FakelosTabSkeleton**

Loading state skeleton matching the layout: circular skeleton + 3 section skeletons with item placeholders.

- [ ] **Step 3: Commit**

```bash
git add src/components/tender/fakelos-tab.tsx
git commit -m "feat: FakelosTab — premium dossier completeness checklist UI"
```

---

## Task 5: Frontend — War Room Page

**Files:**
- Create: `src/app/(dashboard)/fakeloi/page.tsx`
- Delete: `src/app/(dashboard)/discovery/page.tsx`

- [ ] **Step 1: Create war room page**

Create `src/app/(dashboard)/fakeloi/page.tsx` — "Οι Φάκελοί Μου" overview.

Structure:
1. **Header**: "Οι Φάκελοί Μου" + subtitle + stats row (X active, Y ready, Z critical)
2. **Grid of tender cards** — each card shows:
   - Tender title + reference number
   - Circular readiness score (NumberTicker animated)
   - Deadline countdown with color coding
   - Critical gaps count
   - Status badge (ΕΤΟΙΜΟΣ / ΣΕ ΕΞΕΛΙΞΗ / ΚΙΝΔΥΝΟΣ / ΜΗ ΕΤΟΙΜΟΣ / ΑΝΑΛΥΣΗ ΕΚΚΡΕΜΕΙ)
   - Click → `router.push(\`/tenders/\${id}?tab=fakelos\`)`
3. **Sort**: by urgency (deadline ascending × inverse readiness)
4. **Empty state**: Nano Banana illustration + "Δημιουργήστε τον πρώτο σας διαγωνισμό"

Data fetching:
```typescript
const { data: tenders, isLoading } = trpc.fakelos.getWarRoom.useQuery();
```

Styling: motion stagger container/items, MagicCard or GlassCard per tender, gradient accent on status badges, BlurFade entrance, NumberTicker for scores.

- [ ] **Step 2: Delete discovery page**

```bash
rm src/app/(dashboard)/discovery/page.tsx
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/fakeloi/page.tsx
git rm src/app/(dashboard)/discovery/page.tsx
git commit -m "feat: war room page (/fakeloi) — replaces discovery"
```

---

## Task 6: Integration — Nav + Tender Detail Tab

**Files:**
- Modify: `src/components/layout/top-nav.tsx`
- Modify: `src/app/(dashboard)/tenders/[id]/page.tsx`

- [ ] **Step 1: Update navigation**

In `src/components/layout/top-nav.tsx`, change the navItems array:

```typescript
// Before:
{ label: 'Discovery', href: '/discovery', icon: Compass },
// After:
{ label: 'Φάκελοι', href: '/fakeloi', icon: FolderCheck },
```

Add `FolderCheck` to the lucide-react imports. Remove `Compass` if unused elsewhere.

- [ ] **Step 2: Add Φάκελος tab to tender detail**

In `src/app/(dashboard)/tenders/[id]/page.tsx`:

Add import:
```typescript
import { FakelosTab } from '@/components/tender/fakelos-tab';
import { FolderCheck } from 'lucide-react';
```

Add tab trigger after "Εγγραφα" (documents) tab:
```tsx
<AnimatedTabsTrigger value="fakelos" activeValue={activeTab}>
  <FolderCheck className="h-3.5 w-3.5" />Φάκελος
</AnimatedTabsTrigger>
```

Add tab content:
```tsx
<TabsContent value="fakelos" forceMount={activeTab === 'fakelos' ? true : undefined}>
  <FakelosTab tenderId={tenderId} />
</TabsContent>
```

- [ ] **Step 3: Handle `?tab=fakelos` query param**

Add URL query param reading so war room links open directly to the Φάκελος tab:
```typescript
import { useSearchParams } from 'next/navigation';
// ...
const searchParams = useSearchParams();
const initialTab = searchParams.get('tab') || 'overview';
const [activeTab, setActiveTab] = useState(initialTab);
```

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/top-nav.tsx "src/app/(dashboard)/tenders/[id]/page.tsx"
git commit -m "feat: integrate Φάκελος tab + nav update Discovery→Φάκελοι"
```

---

## Task 7: Build Verification + Visual QA

- [ ] **Step 1: Run build**

```bash
npx next build
```

Fix ALL errors. Ensure no TypeScript issues.

- [ ] **Step 2: Visual check (if dev server available)**

Pages to verify:
- `/fakeloi` — war room loads, shows tenders or empty state
- `/tenders/[id]` — Φάκελος tab visible, clicking shows loading state or "Τρέξε Έλεγχο"
- Top nav: "Φάκελοι" link works, Discovery is gone
- Dark mode: all elements render correctly
- Animations: stagger entrance, collapsible sections, circular score

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "verify: fakelos checker build passes, visual QA complete"
```

- [ ] **Step 4: Push to Vercel**

```bash
git push origin main
```
