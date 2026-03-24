# Subcontractor & Supplier Needs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-extracted subcontractor/supplier needs to the Fakelos dossier completeness checker, so users see everything they need (documents + external resources) in one place.

**Architecture:** New `SubcontractorNeed` Prisma model linked to Tender. New AI extraction method in `ai-bid-orchestrator.ts`. Fakelos checker builds Envelope Δ from these records. Existing Fakelos UI renders the new envelope alongside A/B/C. Context builder includes subcontractor needs for the AI assistant.

**Tech Stack:** Prisma (PostgreSQL), tRPC, Next.js, React, Tailwind, motion/react, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-24-subcontractor-needs-fakelos-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add SubcontractorNeed model + enums + Tender relation |
| `src/server/routers/subcontractor-need.ts` | Create | tRPC router: list, create, update, markStatus, delete |
| `src/server/root.ts` | Modify | Register subcontractorNeed router |
| `src/server/services/ai-bid-orchestrator.ts` | Modify | Add `analyzeSubcontractorNeeds()` method |
| `src/server/services/fakelos-checker.ts` | Modify | Load SubcontractorNeeds, build Envelope Δ, include in score |
| `src/components/tender/fakelos-tab.tsx` | Modify | Render Envelope Δ, subcontractor items, manual add form |
| `src/app/(dashboard)/tenders/[id]/page.tsx` | Modify | Add analyzeSubcontractorNeeds to Full Analysis pipeline |
| `src/server/services/context-builder.ts` | Modify | Include SubcontractorNeeds in assistant context |
| `messages/el.json` | Modify | Greek translations |
| `messages/en.json` | Modify | English translations |

---

### Task 1: Prisma Schema — SubcontractorNeed Model

**Files:**
- Modify: `prisma/schema.prisma:812` (after TeamRequirement model)
- Modify: `prisma/schema.prisma:300` (add relation to Tender model)

- [ ] **Step 1: Add enums and model to schema**

After line 812 (after TeamRequirement model), add:

```prisma
// ─── Subcontractor & Supplier Needs ─────────────────────────

enum SubcontractorKind {
  SUBCONTRACTOR
  SUPPLIER
}

enum SubcontractorStatus {
  PENDING
  IN_PROGRESS
  COVERED
}

model SubcontractorNeed {
  id             String              @id @default(cuid())
  specialty      String              // "Υδραυλικός", "Ηλεκτρολόγος"
  kind           SubcontractorKind   // SUBCONTRACTOR | SUPPLIER
  reason         String   @db.Text   // "Απαιτείται από Άρθρο 3.2 — εγκατάσταση υδραυλικών"
  isMandatory    Boolean  @default(false)
  requiredCerts  Json     @default("[]") // ["Άδεια ΥΔΕ", "ISO 14001"]
  guidance       String?  @db.Text   // AI-generated advice
  status         SubcontractorStatus @default(PENDING)
  assignedName   String?             // "Παπαδόπουλος Ηλεκτρικά"
  notes          String?  @db.Text
  isAiGenerated  Boolean  @default(true)

  tenderId String
  tender   Tender @relation(fields: [tenderId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenderId])
}
```

- [ ] **Step 2: Add relation to Tender model**

In the Tender model (around line 300, after `teamRequirements`), add:

```prisma
  subcontractorNeeds SubcontractorNeed[]
```

- [ ] **Step 3: Run migration**

Run: `npx prisma migrate dev --name add-subcontractor-needs`
Expected: Migration created and applied successfully.

- [ ] **Step 4: Verify generated client**

Run: `npx prisma generate`
Expected: Prisma Client generated successfully.

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat: add SubcontractorNeed model with enums and Tender relation"
```

---

### Task 2: tRPC Router — SubcontractorNeed CRUD

**Files:**
- Create: `src/server/routers/subcontractor-need.ts`
- Modify: `src/server/root.ts:17` (register router)

- [ ] **Step 1: Create the router file**

Create `src/server/routers/subcontractor-need.ts`:

```typescript
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';
import { db } from '@/lib/db';

async function ensureTenderAccess(tenderId: string, tenantId: string | null) {
  if (!tenantId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
  }
  const tender = await db.tender.findUnique({ where: { id: tenderId } });
  if (!tender || tender.tenantId !== tenantId) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
  }
  return { tender, tenantId };
}

export const subcontractorNeedRouter = router({
  /** List all subcontractor needs for a tender */
  list: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ input, ctx }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return db.subcontractorNeed.findMany({
        where: { tenderId: input.tenderId },
        orderBy: [{ isMandatory: 'desc' }, { createdAt: 'asc' }],
      });
    }),

  /** Manually add a subcontractor/supplier need */
  create: protectedProcedure
    .input(
      z.object({
        tenderId: z.string(),
        specialty: z.string().min(1).max(200),
        kind: z.enum(['SUBCONTRACTOR', 'SUPPLIER']),
        reason: z.string().max(1000).optional().default(''),
        isMandatory: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return db.subcontractorNeed.create({
        data: {
          tenderId: input.tenderId,
          specialty: input.specialty,
          kind: input.kind,
          reason: input.reason,
          isMandatory: input.isMandatory,
          isAiGenerated: false,
        },
      });
    }),

  /** Update status (mark as found, in progress, etc.) */
  markStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['PENDING', 'IN_PROGRESS', 'COVERED']),
        assignedName: z.string().max(200).optional(),
        notes: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const need = await db.subcontractorNeed.findUnique({
        where: { id: input.id },
        include: { tender: { select: { tenantId: true } } },
      });
      if (!need || need.tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Not found.' });
      }
      return db.subcontractorNeed.update({
        where: { id: input.id },
        data: {
          status: input.status,
          assignedName: input.assignedName ?? need.assignedName,
          notes: input.notes ?? need.notes,
        },
      });
    }),

  /** Update any field (for editing) */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        specialty: z.string().min(1).max(200).optional(),
        kind: z.enum(['SUBCONTRACTOR', 'SUPPLIER']).optional(),
        reason: z.string().max(1000).optional(),
        isMandatory: z.boolean().optional(),
        assignedName: z.string().max(200).nullable().optional(),
        notes: z.string().max(1000).nullable().optional(),
        status: z.enum(['PENDING', 'IN_PROGRESS', 'COVERED']).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const need = await db.subcontractorNeed.findUnique({
        where: { id },
        include: { tender: { select: { tenantId: true } } },
      });
      if (!need || need.tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Not found.' });
      }
      return db.subcontractorNeed.update({ where: { id }, data });
    }),

  /** Delete a manually-added need (block AI-generated during analysis) */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const need = await db.subcontractorNeed.findUnique({
        where: { id: input.id },
        include: { tender: { select: { tenantId: true, analysisInProgress: true } } },
      });
      if (!need || need.tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Not found.' });
      }
      if (need.isAiGenerated && need.tender.analysisInProgress) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cannot delete AI-generated items during active analysis.',
        });
      }
      await db.subcontractorNeed.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
```

- [ ] **Step 2: Register router in root.ts**

In `src/server/root.ts`, add import and register:

```typescript
import { subcontractorNeedRouter } from '@/server/routers/subcontractor-need';
```

Add to the router object (after `fakelos: fakelosRouter,`):

```typescript
  subcontractorNeed: subcontractorNeedRouter,
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/subcontractor-need.ts src/server/root.ts
git commit -m "feat: add subcontractorNeed tRPC router with CRUD + tenant auth"
```

---

### Task 3: AI Extraction — `analyzeSubcontractorNeeds()`

**Files:**
- Modify: `src/server/services/ai-bid-orchestrator.ts:460` (after TEAM_REQUIREMENTS_SYSTEM_PROMPT)
- Modify: `src/server/routers/ai-roles.ts:151` (expose via tRPC)

- [ ] **Step 1: Add the system prompt constant**

After the `TEAM_REQUIREMENTS_SYSTEM_PROMPT` constant (line 460 in `ai-bid-orchestrator.ts`), add:

```typescript
const SUBCONTRACTOR_NEEDS_SYSTEM_PROMPT = `Είσαι ειδικός σύμβουλος δημοσίων συμβάσεων στην Ελλάδα (Ν.4412/2016).
Αναλύεις τεύχη διαγωνισμών και εντοπίζεις ΕΞΩΤΕΡΙΚΟΥΣ ΠΟΡΟΥΣ που θα χρειαστεί ο ανάδοχος:

1. ΥΠΕΡΓΟΛΑΒΟΙ (SUBCONTRACTOR): Εξωτερικά συνεργεία/τεχνίτες για εκτέλεση εργασιών
   - Υδραυλικοί, ηλεκτρολόγοι, ψυκτικοί, ελαιοχρωματιστές, κλπ.
   - Εξειδικευμένοι τεχνικοί (πυροσβεστικά, ανελκυστήρες, κλιματισμός, κλπ.)

2. ΠΡΟΜΗΘΕΥΤΕΣ (SUPPLIER): Προμηθευτές υλικών/εξοπλισμού
   - Υλικά κατασκευής, ανταλλακτικά, εξοπλισμός
   - Ειδικά υλικά που απαιτεί η σύμβαση

ΔΕΝ περιλαμβάνεις:
- Εσωτερικό προσωπικό/στελέχη (αυτά καλύπτονται από TeamRequirements)
- Πιστοποιητικά/έγγραφα εταιρείας (αυτά καλύπτονται από TenderRequirements)
- Εγγυητικές επιστολές
- Χρηματοοικονομικά (budget, τιμολόγηση)

Απάντησε ΜΟΝΟ σε JSON:
{
  "needs": [
    {
      "specialty": "Αδειούχος ηλεκτρολόγος εγκαταστάτης",
      "kind": "SUBCONTRACTOR",
      "reason": "Άρθρο 4.3 — Ηλεκτρολογικές εγκαταστάσεις νέου πίνακα",
      "isMandatory": true,
      "requiredCerts": ["Άδεια ηλεκτρολόγου Γ' ειδικότητας"]
    }
  ]
}

Αν δεν υπάρχουν εξωτερικοί πόροι, επέστρεψε {"needs": []}.`;
```

- [ ] **Step 2: Add the extraction method**

Add a new method `analyzeSubcontractorNeeds` to the `BidOrchestrator` class (after `analyzeTeamRequirements` at line 1368):

```typescript
  /**
   * Analyze tender documents to identify external subcontractor and supplier needs.
   * Uses AI to extract specialties, reasons, and required certifications.
   * Graceful failure — returns empty array on AI error.
   */
  async analyzeSubcontractorNeeds(tenderId: string, language: string = 'el') {
    const tender = await db.tender.findUniqueOrThrow({
      where: { id: tenderId },
      include: {
        requirements: true,
        brief: true,
      },
    });

    // Build context (same pattern as analyzeTeamRequirements — requirements + brief only)
    const contextParts: string[] = [];
    contextParts.push(`Τίτλος Διαγωνισμού: ${tender.title}`);
    if (tender.brief) {
      contextParts.push(`Σύνοψη: ${tender.brief.summaryText}`);
    }

    if (tender.requirements.length > 0) {
      contextParts.push('\n--- Απαιτήσεις Διαγωνισμού ---');
      for (const req of tender.requirements) {
        contextParts.push(`[${req.category}${req.mandatory ? ', ΥΠΟΧΡΕΩΤΙΚΟ' : ''}] ${req.text}`);
      }
    }

    const contextText = contextParts.join('\n');

    let extractedNeeds: Array<{
      specialty: string;
      kind: 'SUBCONTRACTOR' | 'SUPPLIER';
      reason: string;
      isMandatory: boolean;
      requiredCerts: string[];
    }> = [];

    try {
      const aiResult = await ai().complete({
        messages: [
          { role: 'system', content: SUBCONTRACTOR_NEEDS_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Εξάγαγε τους εξωτερικούς πόρους (υπεργολάβους & προμηθευτές) από τον διαγωνισμό:\n\n${contextText}`,
          },
        ],
        maxTokens: 2000,
        temperature: 0.2,
        responseFormat: 'json',
      });

      const parsed = JSON.parse(aiResult.content);
      extractedNeeds = parsed.needs || parsed;
      if (!Array.isArray(extractedNeeds)) {
        extractedNeeds = [];
      }
      // Log token usage
      logTokenUsage('analyzeSubcontractorNeeds', aiResult);
    } catch (err) {
      console.error('[BidOrchestrator] SubcontractorNeeds AI extraction failed:', err);
      // Graceful failure — return empty, don't block pipeline
      return [];
    }

    // Delete existing AI-generated needs (preserve manually added)
    await db.subcontractorNeed.deleteMany({
      where: {
        tenderId,
        isAiGenerated: true,
      },
    });

    // Create SubcontractorNeed records
    const createdNeeds = [];
    for (const need of extractedNeeds) {
      const validKind = need.kind === 'SUPPLIER' ? 'SUPPLIER' : 'SUBCONTRACTOR';
      const record = await db.subcontractorNeed.create({
        data: {
          tenderId,
          specialty: need.specialty || 'Άγνωστη ειδικότητα',
          kind: validKind,
          reason: need.reason || '',
          isMandatory: need.isMandatory ?? false,
          requiredCerts: Array.isArray(need.requiredCerts) ? need.requiredCerts : [],
          isAiGenerated: true,
        },
      });
      createdNeeds.push(record);
    }

    // Log activity
    await db.activity.create({
      data: {
        tenderId,
        action: 'subcontractor_needs_analyzed',
        details: `Εντοπίστηκαν ${createdNeeds.length} εξωτερικοί πόροι (${createdNeeds.filter(n => n.isMandatory).length} υποχρεωτικοί)`,
      },
    });

    return createdNeeds;
  }
```

- [ ] **Step 3: Expose via ai-roles router**

In `src/server/routers/ai-roles.ts`, after the `analyzeTeam` procedure (line 151), add:

```typescript
  analyzeSubcontractorNeeds: protectedProcedure
    .input(z.object({ tenderId: z.string(), language: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return aiBidOrchestrator.analyzeSubcontractorNeeds(input.tenderId, input.language);
    }),
```

- [ ] **Step 4: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/ai-bid-orchestrator.ts src/server/routers/ai-roles.ts
git commit -m "feat: add AI extraction of subcontractor/supplier needs from tender docs"
```

---

### Task 4: Fakelos Checker — Envelope Δ Integration

**Files:**
- Modify: `src/server/services/fakelos-checker.ts`

- [ ] **Step 1: Widen types to support Envelope Δ**

Update the `FakelosItem` interface (line 9) — add `itemType` discriminator:

```typescript
export interface FakelosItem {
  itemType: 'requirement' | 'subcontractor'; // NEW — discriminator
  requirementId: string;
  // ... rest unchanged
}
```

Update `FakelosEnvelope.id` type (line 34):

```typescript
export interface FakelosEnvelope {
  id: 'A' | 'B' | 'C' | 'D';
  // ... rest unchanged
}
```

- [ ] **Step 2: Add Envelope Δ title**

Update `ENVELOPE_TITLES` (line 73):

```typescript
const ENVELOPE_TITLES: Record<'A' | 'B' | 'C' | 'D', string> = {
  A: 'Φάκελος Α — Δικαιολογητικά Συμμετοχής',
  B: 'Φάκελος Β — Τεχνική Προσφορά',
  C: 'Φάκελος Γ — Οικονομική Προσφορά',
  D: 'Φάκελος Δ — Υπεργολάβοι & Προμηθευτές',
};
```

- [ ] **Step 3: Load SubcontractorNeeds in `runCheck()`**

In the `runCheck()` method, after loading company assets (line 113, after the `Promise.all`), add:

```typescript
    // 2b. Load subcontractor needs
    const subcontractorNeeds = await db.subcontractorNeed.findMany({
      where: { tenderId },
    });
```

- [ ] **Step 4: Build Envelope Δ items**

After line 222 (`envelopeMap[envelope].push(item);`), and before step 5 (AI guidance), widen the envelopeMap initialization and build Envelope Δ:

Change the envelopeMap initialization (line 128) from:
```typescript
const envelopeMap: Record<'A' | 'B' | 'C', FakelosItem[]> = { A: [], B: [], C: [] };
```
to:
```typescript
const envelopeMap: Record<'A' | 'B' | 'C' | 'D', FakelosItem[]> = { A: [], B: [], C: [], D: [] };
```

Add `itemType: 'requirement'` to the existing item construction (line 206):
```typescript
      const item: FakelosItem = {
        itemType: 'requirement', // NEW
        requirementId: req.id,
        // ... rest unchanged
```

After the existing requirements loop ends (after line 222), add:

```typescript
    // 4b. Build Envelope Δ from subcontractor needs
    for (const need of subcontractorNeeds) {
      let status: FakelosItem['status'] = 'GAP';
      if (need.status === 'COVERED') status = 'COVERED';
      else if (need.status === 'IN_PROGRESS') status = 'IN_PROGRESS';

      let urgency: FakelosItem['urgency'] = 'OK';
      if (status === 'GAP' && need.isMandatory) urgency = 'CRITICAL';
      else if (status === 'GAP') urgency = 'WARNING';
      else if (status === 'IN_PROGRESS') urgency = 'WARNING';

      const certsArray = Array.isArray(need.requiredCerts) ? need.requiredCerts as string[] : [];
      const kindLabel = need.kind === 'SUPPLIER' ? 'Προμηθευτής' : 'Υπεργολάβος';

      envelopeMap.D.push({
        itemType: 'subcontractor',
        requirementId: need.id,
        title: `${need.specialty} (${kindLabel})`,
        description: need.reason || need.specialty,
        articleReference: '',
        status,
        urgency,
        mandatory: need.isMandatory,
        matchedAsset: need.assignedName
          ? { type: 'subcontractor' as any, id: need.id, name: need.assignedName }
          : undefined,
        guidance: need.guidance || undefined,
        aiConfidence: undefined,
        sourceText: certsArray.length > 0
          ? `Απαιτούμενα: ${certsArray.join(', ')}`
          : undefined,
      });
    }
```

- [ ] **Step 5: Update envelope building to include D**

Change line 234 from:
```typescript
const envelopes: FakelosEnvelope[] = (['A', 'B', 'C'] as const).map((id) => {
```
to:
```typescript
const envelopes: FakelosEnvelope[] = (['A', 'B', 'C', 'D'] as const).map((id) => {
```

- [ ] **Step 6: Include Envelope D subcontractor items in gap guidance**

The existing gap guidance generation (line 229) filters all items. SubcontractorNeeds in Envelope D with status GAP will automatically be included since they're now part of `envelopeMap`. No additional code change needed — verify this is the case.

- [ ] **Step 7: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add src/server/services/fakelos-checker.ts
git commit -m "feat: add Envelope Δ (subcontractors/suppliers) to Fakelos checker"
```

---

### Task 5: i18n Translations (must come before UI tasks)

**Files:**
- Modify: `messages/el.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Add Greek translations**

In `messages/el.json`, inside the `"tender"` section, add:

```json
"subcontractorAnalysis": "Ανάλυση υπεργολάβων & προμηθευτών...",
"subcontractorError": "Σφάλμα ανάλυσης υπεργολάβων",
"subcontractorFound": "Βρέθηκε",
"subcontractorSearching": "Σε Αναζήτηση",
"subcontractorPending": "Εκκρεμεί",
"addSubcontractor": "Προσθήκη Υπεργολάβου/Προμηθευτή",
"subcontractorKindSub": "Υπεργολάβος",
"subcontractorKindSup": "Προμηθευτής"
```

- [ ] **Step 2: Add English translations**

In `messages/en.json`, inside the `"tender"` section, add:

```json
"subcontractorAnalysis": "Analyzing subcontractors & suppliers...",
"subcontractorError": "Subcontractor analysis error",
"subcontractorFound": "Found",
"subcontractorSearching": "Searching",
"subcontractorPending": "Pending",
"addSubcontractor": "Add Subcontractor/Supplier",
"subcontractorKindSub": "Subcontractor",
"subcontractorKindSup": "Supplier"
```

- [ ] **Step 3: Commit**

```bash
git add messages/el.json messages/en.json
git commit -m "feat: add i18n translations for subcontractor needs feature"
```

---

### Task 6: Fakelos Tab UI — Render Envelope Δ

**Files:**
- Modify: `src/components/tender/fakelos-tab.tsx`

- [ ] **Step 1: Add Envelope Δ to `envelopeConfig`**

Update `envelopeConfig` (line 123):

```typescript
const envelopeConfig: Record<string, { letter: string; gradient: string; ring: string }> = {
  A: { letter: 'Α', gradient: 'bg-primary', ring: 'ring-primary/30' },
  B: { letter: 'Β', gradient: 'from-blue-600 to-cyan-500', ring: 'ring-blue-500/30' },
  C: { letter: 'Γ', gradient: 'from-emerald-600 to-green-500', ring: 'ring-emerald-500/30' },
  D: { letter: 'Δ', gradient: 'from-orange-600 to-amber-500', ring: 'ring-orange-500/30' },
};
```

- [ ] **Step 2: Update default open envelopes**

Change line 438 from:
```typescript
const [openEnvelopes, setOpenEnvelopes] = useState<Set<string>>(new Set(['A', 'B', 'C']));
```
to:
```typescript
const [openEnvelopes, setOpenEnvelopes] = useState<Set<string>>(new Set(['A', 'B', 'C', 'D']));
```

- [ ] **Step 3: Update `FakelosItem` interface to include `itemType`**

Update the `FakelosItem` interface at the top of the file (line 35):

```typescript
interface FakelosItem {
  itemType?: 'requirement' | 'subcontractor'; // NEW
  requirementId: string;
  // ... rest unchanged
}
```

- [ ] **Step 4: Update `markItemStatus` to route correctly**

The `markStatusMutation` (line 444) currently calls `trpc.fakelos.markItemStatus`. For subcontractor items, it needs to call `trpc.subcontractorNeed.markStatus` instead.

Add the subcontractor mutation:

```typescript
const markSubcontractorStatusMutation = trpc.subcontractorNeed.markStatus.useMutation({
  onSuccess: () => { utils.fakelos.getReport.invalidate({ tenderId }); },
});
```

Update `handleMarkStatus` (line 457):

```typescript
const handleMarkStatus = (itemId: string, status: string, itemType?: string) => {
  if (itemType === 'subcontractor') {
    markSubcontractorStatusMutation.mutate({
      id: itemId,
      status: status as 'IN_PROGRESS' | 'COVERED',
    });
  } else {
    markStatusMutation.mutate({ requirementId: itemId, status: status as 'IN_PROGRESS' });
  }
};
```

Update all places where `onMarkStatus` is called in the `EnvelopeBlock` component to pass `itemType`:

In the `EnvelopeBlock` component, update the item rendering to pass `itemType` through to the handlers. Update the `onMarkStatus` prop type:

```typescript
onMarkStatus: (reqId: string, status: string, itemType?: string) => void;
```

In `CriticalItem`, `WarningItem` components, pass the `itemType` through:

```typescript
onClick={() => onMarkStatus(item.requirementId, 'IN_PROGRESS', item.itemType)}
```

- [ ] **Step 5: Add "Βρέθηκε" action for subcontractor items**

For items with `itemType === 'subcontractor'` and status GAP, add a "Βρέθηκε" button alongside "Σε Αναζήτηση". This opens an inline form for `assignedName`.

In `CriticalItem`, add a conditional button when `item.itemType === 'subcontractor'`:

```tsx
{item.itemType === 'subcontractor' && (
  <Button
    size="sm"
    className="cursor-pointer gap-1.5 h-8 text-xs bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg border-0"
    disabled={isPending}
    onClick={() => onMarkFound(item.requirementId)}
  >
    <CheckCircle2 className="h-3 w-3" />
    Βρέθηκε
  </Button>
)}
```

The `onMarkFound` callback opens an inline form (see Step 5b below). Apply the same pattern to `WarningItem`.

- [ ] **Step 5b: Add inline "Βρέθηκε" form for assignedName**

When the user clicks "Βρέθηκε", instead of immediately setting COVERED, show a small inline form to collect the name of the subcontractor/supplier found:

Add state to `FakelosTab`:

```typescript
const [foundFormId, setFoundFormId] = useState<string | null>(null);
const [foundName, setFoundName] = useState('');
```

Add `onMarkFound` handler:

```typescript
const handleMarkFound = (itemId: string) => {
  setFoundFormId(itemId);
  setFoundName('');
};

const handleConfirmFound = () => {
  if (foundFormId) {
    markSubcontractorStatusMutation.mutate({
      id: foundFormId,
      status: 'COVERED',
      assignedName: foundName.trim() || undefined,
    });
    setFoundFormId(null);
    setFoundName('');
  }
};
```

In `CriticalItem` and `WarningItem`, when `foundFormId === item.requirementId`, show the inline form instead of the buttons:

```tsx
{foundFormId === item.requirementId ? (
  <div className="flex items-center gap-2 pl-10">
    <input
      type="text"
      placeholder="Όνομα (π.χ. Παπαδόπουλος Ηλεκτρικά)"
      value={foundName}
      onChange={(e) => setFoundName(e.target.value)}
      className="flex-1 px-3 py-1.5 text-xs rounded-md border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
      autoFocus
    />
    <Button size="sm" className="cursor-pointer h-7 text-xs bg-emerald-600 text-white" onClick={handleConfirmFound}>
      OK
    </Button>
    <Button size="sm" variant="ghost" className="cursor-pointer h-7 text-xs" onClick={() => setFoundFormId(null)}>
      ✕
    </Button>
  </div>
) : (
  /* existing buttons */
)}
```

Pass `onMarkFound` and `foundFormId`/`foundName` through props to `CriticalItem` and `WarningItem`, or lift the inline form to `EnvelopeBlock` level.

- [ ] **Step 6: Show assigned name for COVERED subcontractor items**

In `OkItem`, when the item has `matchedAsset?.name` and `itemType === 'subcontractor'`, display the assigned name prominently:

```tsx
{item.itemType === 'subcontractor' && item.matchedAsset?.name && (
  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
    {item.matchedAsset.name}
  </span>
)}
```

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/components/tender/fakelos-tab.tsx
git commit -m "feat: render Envelope Δ (subcontractors/suppliers) in Fakelos tab"
```

---

### Task 7: Full Analysis Pipeline Integration

**Files:**
- Modify: `src/app/(dashboard)/tenders/[id]/page.tsx:128-155`

- [ ] **Step 1: Add the mutation**

After line 128 (after `goNoGoMutation`), add:

```typescript
const analyzeSubcontractorsMutation = trpc.aiRoles.analyzeSubcontractorNeeds.useMutation({
  onError: handleAiError('tender.subcontractorError'),
});
```

- [ ] **Step 2: Add to the pipeline**

In `runFullAnalysis()`, after the financial extraction (line 143) and before go/no-go (line 144), add:

```typescript
      setAnalysisStep(t('tender.subcontractorAnalysis'));
      await analyzeSubcontractorsMutation.mutateAsync({ tenderId, language });
```

- [ ] **Step 3: Invalidate fakelos report after analysis**

After the existing invalidations (around line 150), add:

```typescript
      utils.fakelos.getReport.invalidate({ tenderId });
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/tenders/[id]/page.tsx
git commit -m "feat: add subcontractor needs extraction to Full Analysis pipeline"
```

---

### Task 8: Context Builder — Assistant Integration

**Files:**
- Modify: `src/server/services/context-builder.ts:173-209`

- [ ] **Step 1: Load SubcontractorNeeds alongside tasks and requirements**

In the status_check block (line 174), add to the `Promise.all`:

```typescript
  if (intent === 'status_check' || intent === 'mixed' || intent === 'guidance') {
    // Note: broadened to include 'guidance' intent so users asking
    // "ποιους υπεργολάβους χρειάζομαι;" get subcontractor context
    const [tasks, requirements, subcontractorNeeds] = await Promise.all([
      db.task.findMany({
        where: { tenderId },
        select: { title: true, status: true, priority: true, dueDate: true },
      }),
      db.tenderRequirement.findMany({
        where: { tenderId },
        select: { text: true, category: true, coverageStatus: true, mandatory: true },
      }),
      db.subcontractorNeed.findMany({
        where: { tenderId },
        select: { specialty: true, kind: true, status: true, isMandatory: true, assignedName: true },
      }),
    ]);
```

- [ ] **Step 2: Add subcontractor context**

After the requirements block (after line 208), add:

```typescript
    if (subcontractorNeeds.length > 0) {
      const pending = subcontractorNeeds.filter((n) => n.status === 'PENDING').length;
      const inProgress = subcontractorNeeds.filter((n) => n.status === 'IN_PROGRESS').length;
      const covered = subcontractorNeeds.filter((n) => n.status === 'COVERED').length;

      let subText = `=== ΥΠΕΡΓΟΛΑΒΟΙ & ΠΡΟΜΗΘΕΥΤΕΣ ===\nΣύνολο: ${subcontractorNeeds.length} | Εκκρεμούν: ${pending} | Σε αναζήτηση: ${inProgress} | Βρέθηκαν: ${covered}`;

      const missingNeeds = subcontractorNeeds.filter((n) => n.status !== 'COVERED');
      if (missingNeeds.length > 0) {
        subText += '\nΛείπουν: ' + missingNeeds.map((n) => {
          const kindLabel = n.kind === 'SUPPLIER' ? 'Προμηθευτής' : 'Υπεργολάβος';
          const mandatory = n.isMandatory ? ' (ΥΠΟΧΡΕΩΤΙΚΟ)' : '';
          return `${n.specialty} [${kindLabel}]${mandatory}`;
        }).join(', ');
      }

      contextParts.push(subText);
      sources.push({ type: 'structured_data', reference: 'Subcontractors', content: `${subcontractorNeeds.length} needs` });
    }
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/services/context-builder.ts
git commit -m "feat: include subcontractor needs in AI assistant context"
```

---

### Task 9: Manual Add Form in Fakelos Tab

**Files:**
- Modify: `src/components/tender/fakelos-tab.tsx`

- [ ] **Step 1: Add manual creation mutation and state**

In the `FakelosTab` component, add:

```typescript
const createSubcontractorMutation = trpc.subcontractorNeed.create.useMutation({
  onSuccess: () => {
    utils.fakelos.getReport.invalidate({ tenderId });
    setShowAddForm(false);
    setNewNeed({ specialty: '', kind: 'SUBCONTRACTOR' as const, reason: '', isMandatory: false });
  },
});

const [showAddForm, setShowAddForm] = useState(false);
const [newNeed, setNewNeed] = useState({
  specialty: '',
  kind: 'SUBCONTRACTOR' as const,
  reason: '',
  isMandatory: false,
});
```

- [ ] **Step 2: Add the form UI at the bottom of Envelope Δ**

After the envelope rendering loop (line 629), add a check: if Envelope Δ exists and is open, show the add button/form below it. Alternatively, add the form inside the `EnvelopeBlock` for id="D".

Better approach: Add a slot after the items in `EnvelopeBlock` when `envelope.id === 'D'`. Pass a `footer` prop or render it conditionally.

Add after the `{sortedItems.map(...)}` section inside `EnvelopeBlock`, when the envelope is Δ:

```tsx
{envelope.id === 'D' && (
  <div className="border-t border-border/40 pt-3 mt-2">
    {!showAddForm ? (
      <Button
        variant="ghost"
        size="sm"
        className="cursor-pointer gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full justify-center"
        onClick={() => setShowAddForm(true)}
      >
        <Plus className="h-3.5 w-3.5" />
        {t('tender.addSubcontractor')}
      </Button>
    ) : (
      <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
        <input
          type="text"
          placeholder="Ειδικότητα (π.χ. Υδραυλικός)"
          value={newNeed.specialty}
          onChange={(e) => setNewNeed(prev => ({ ...prev, specialty: e.target.value }))}
          className="w-full px-3 py-2 text-sm rounded-md border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <input
          type="text"
          placeholder="Λόγος (π.χ. Άρθρο 3.2 — εγκατάσταση υδραυλικών)"
          value={newNeed.reason}
          onChange={(e) => setNewNeed(prev => ({ ...prev, reason: e.target.value }))}
          className="w-full px-3 py-2 text-sm rounded-md border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="flex items-center gap-3">
          <select
            value={newNeed.kind}
            onChange={(e) => setNewNeed(prev => ({ ...prev, kind: e.target.value as 'SUBCONTRACTOR' | 'SUPPLIER' }))}
            className="px-3 py-2 text-sm rounded-md border border-border/60 bg-background cursor-pointer"
          >
            <option value="SUBCONTRACTOR">{t('tender.subcontractorKindSub')}</option>
            <option value="SUPPLIER">{t('tender.subcontractorKindSup')}</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={newNeed.isMandatory}
              onChange={(e) => setNewNeed(prev => ({ ...prev, isMandatory: e.target.checked }))}
              className="cursor-pointer"
            />
            Υποχρεωτικό
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="cursor-pointer gap-1.5 h-8 text-xs"
            disabled={!newNeed.specialty.trim() || createSubcontractorMutation.isPending}
            onClick={() => createSubcontractorMutation.mutate({
              tenderId,
              specialty: newNeed.specialty.trim(),
              kind: newNeed.kind,
              reason: newNeed.reason.trim() || undefined,
              isMandatory: newNeed.isMandatory,
            })}
          >
            {createSubcontractorMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            Προσθήκη
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="cursor-pointer h-8 text-xs"
            onClick={() => setShowAddForm(false)}
          >
            Ακύρωση
          </Button>
        </div>
      </div>
    )}
  </div>
)}
```

Add `Plus` to the Lucide imports at the top.

- [ ] **Step 3: Thread showAddForm state through to EnvelopeBlock**

The `showAddForm` and `setShowAddForm` state lives in `FakelosTab`. Pass them as props to `EnvelopeBlock` only when `envelope.id === 'D'`. Update `EnvelopeBlock` props:

```typescript
function EnvelopeBlock({
  envelope,
  isOpen,
  onToggle,
  onMarkStatus,
  isPending,
  footer, // NEW — optional ReactNode
}: {
  envelope: EnvelopeSection;
  isOpen: boolean;
  onToggle: () => void;
  onMarkStatus: (reqId: string, status: string, itemType?: string) => void;
  isPending: boolean;
  footer?: React.ReactNode; // NEW
}) {
```

Render `{footer}` after the items list inside the expanded section.

Then in the envelope rendering loop, pass the add form only for Δ:

```tsx
{report.envelopes.map((envelope) => (
  <EnvelopeBlock
    key={envelope.id}
    envelope={envelope}
    isOpen={openEnvelopes.has(envelope.id)}
    onToggle={() => handleToggleEnvelope(envelope.id)}
    onMarkStatus={handleMarkStatus}
    isPending={markStatusMutation.isPending || markSubcontractorStatusMutation.isPending}
    footer={envelope.id === 'D' ? /* the add form JSX above */ : undefined}
  />
))}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/tender/fakelos-tab.tsx
git commit -m "feat: add manual subcontractor/supplier creation form in Fakelos Δ"
```

---

### Task 10: Smoke Test & Final Verification

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: Server starts without errors.

- [ ] **Step 2: Test full analysis pipeline**

Open a tender with attached documents → click "Full Analysis" → verify:
1. The analysis step "Ανάλυση υπεργολάβων & προμηθευτών..." appears
2. No errors in the pipeline
3. Analysis completes successfully

- [ ] **Step 3: Test Fakelos tab**

Go to Fakelos tab → click "Τρέξε Έλεγχο" → verify:
1. Envelope Δ appears with orange Δ badge
2. Subcontractor items appear with correct statuses
3. Mandatory items show as CRITICAL (red)
4. Readiness score includes Envelope Δ items

- [ ] **Step 4: Test manual actions**

1. Click "Σε Αναζήτηση" on a subcontractor item → status changes to IN_PROGRESS (blue)
2. Click "Βρέθηκε" → status changes to COVERED (green)
3. Click "+ Προσθήκη" → fill form → add custom subcontractor → appears in Envelope Δ

- [ ] **Step 5: Test AI assistant**

Open AI assistant chat → ask "Τι μένει;" → verify the response mentions missing subcontractors/suppliers.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete subcontractor/supplier needs in Fakelos — Level 1"
```
