# Feature 5: Evaluation Criteria Writing Assistant

## Concept

Ο χρήστης πατάει "Ανάλυση Κριτηρίων" — το AI διαβάζει τη διακήρυξη, βρίσκει τα κριτήρια αξιολόγησης, και για κάθε κριτήριο δίνει **draft outline της τεχνικής προσφοράς** με πρακτικές οδηγίες: τι να γράψει, πώς να το δομήσει, τι αποδεικτικά χρειάζεται, και tips βασισμένα στη διακήρυξη.

Δεν είναι score simulator. Δεν είναι πίνακας. Είναι **writing assistant κατευθυνόμενο από τα κριτήρια**.

## Where It Lives

New tab **"Κριτήρια"** (`value="criteria"`) in the tender detail page, between "Documents" and "Fakelos" tabs. Icon: `Award` from lucide-react.

## Data Model

New Prisma model:

```prisma
model EvaluationCriterion {
  id          String   @id @default(cuid())
  tenderId    String
  tender      Tender   @relation(fields: [tenderId], references: [id], onDelete: Cascade)

  name        String                  // "Μεθοδολογία Υλοποίησης"
  weight      Float?                  // 25.0 (percentage)
  parentId    String?                 // for sub-criteria nesting
  parent      EvaluationCriterion?    @relation("CriteriaTree", fields: [parentId], references: [id])
  children    EvaluationCriterion[]   @relation("CriteriaTree")
  sortOrder   Int       @default(0)

  description String?   @db.Text      // what the tender document says about this criterion
  guidance    String?   @db.Text      // AI-generated: proposed outline + writing tips
  evidence    String?   @db.Text      // AI-generated: what documents/evidence to include
  suggestions String?   @db.Text      // AI tips referencing specific pages/sections

  status      CriterionStatus @default(NOT_STARTED)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

enum CriterionStatus {
  NOT_STARTED
  IN_PROGRESS
  DRAFT_READY
  FINAL
}
```

Add relation to Tender model:
```prisma
evaluationCriteria EvaluationCriterion[]
```

## AI Service: `ai-criteria-analyzer.ts`

Single method following existing pattern:

```typescript
async analyzeCriteria(tenderId: string, language: 'el' | 'en' = 'el'): Promise<CriteriaAnalysisResult>
```

### Context Building
Same pattern as `ai-bid-orchestrator.ts`:
1. Load tender metadata (title, awardCriteria, budget, cpvCodes)
2. Load attached documents (`extractedText`, max 50K chars)
3. Load company profile (certificates, past projects) for cross-reference
4. Load existing requirements for context

### AI Prompt
System prompt instructs AI to:
1. Find all evaluation/award criteria in the tender documents
2. Extract name, weight (%), and description for each
3. Identify sub-criteria hierarchy
4. For EACH criterion, generate:
   - **Proposed outline**: structured sections for the technical proposal
   - **Evidence needed**: specific documents, certificates, CVs, case studies
   - **Writing tips**: what the evaluation committee looks for, referencing specific tender pages/articles
   - **Cross-reference**: match against company's certificates and past projects

### Response Schema
```typescript
interface CriteriaAnalysisResult {
  awardType: 'lowest_price' | 'best_value' | 'cost_effectiveness';
  criteria: Array<{
    name: string;
    weight: number | null;
    parentName: string | null;
    sortOrder: number;
    description: string;
    guidance: string;      // markdown - proposed outline for this section
    evidence: string;      // markdown - what to include
    suggestions: string;   // markdown - tips from the tender
  }>;
}
```

## tRPC Router

Add to `ai-roles.ts`:

```typescript
analyzeCriteria: protectedProcedure
  .input(z.object({ tenderId: z.string(), language: z.enum(['el', 'en']).default('el') }))
  .mutation(async ({ ctx, input }) => {
    await ensureTenderAccess(input.tenderId, ctx.tenantId);
    return aiCriteriaAnalyzer.analyzeCriteria(input.tenderId, input.language);
  }),

getCriteria: protectedProcedure
  .input(z.object({ tenderId: z.string() }))
  .query(async ({ ctx, input }) => {
    await ensureTenderAccess(input.tenderId, ctx.tenantId);
    return db.evaluationCriterion.findMany({
      where: { tenderId: input.tenderId },
      include: { children: true },
      orderBy: { sortOrder: 'asc' },
    });
  }),
```

## UI: `CriteriaTab` Component

### States

**Empty state**: No criteria analyzed yet. Shows "Ανάλυση Κριτηρίων" button with language selector (same pattern as Go/No-Go).

**Loading state**: Skeleton cards while AI processes.

**Results state**: Accordion/expandable cards, one per top-level criterion.

### Card Layout per Criterion

```
┌─────────────────────────────────────────────────┐
│ ▸ Μεθοδολογία Υλοποίησης              25%  [IN_PROGRESS] │
├─────────────────────────────────────────────────┤
│ Τι ζητάει η διακήρυξη:                          │
│ "Αναλυτική περιγραφή μεθοδολογίας..."           │
│                                                  │
│ ─── Προτεινόμενη Δομή Προσφοράς ───            │
│ 1. Σχέδιο Ποιότητας                             │
│    - Αναφορά σε ISO 9001 (✅ το έχετε)          │
│    - Διαδικασίες ελέγχου ποιότητας              │
│ 2. Χρονοδιάγραμμα                               │
│    - Gantt chart με milestones ανά παραδοτέο    │
│ 3. Διαχείριση Κινδύνων                          │
│    - Risk matrix με μέτρα αντιμετώπισης          │
│                                                  │
│ ─── Αποδεικτικά που χρειάζονται ───             │
│ • ISO 9001 πιστοποιητικό (✅ uploaded)           │
│ • Βεβαιώσεις καλής εκτέλεσης παρόμοιων έργων   │
│ • CV υπευθύνου ποιότητας                         │
│                                                  │
│ ─── Tips ───                                     │
│ ⚡ Η διακήρυξη δίνει extra βαθμούς σε            │
│    "καινοτόμες μεθόδους" (Άρθρο 3.2, σελ. 47)  │
│                                                  │
│ Status: ○ Not Started  ● In Progress  ○ Ready   │
└─────────────────────────────────────────────────┘
```

### Features
- **Accordion expand/collapse** per criterion
- **Status toggle** per criterion (NOT_STARTED → IN_PROGRESS → DRAFT_READY → FINAL) — manual, so users track their writing progress
- **Sub-criteria nesting** — collapsible children under parent
- **Weight badges** — shown next to criterion name
- **Cross-reference indicators**: ✅ for items the company already has (matched against certificates/documents)
- **Re-analyze button** — re-run AI analysis if tender documents change
- **Copy guidance** — copy the proposed outline to clipboard for pasting into their document editor

### Design Rules
- Cards: `bg-card border border-border/60 rounded-xl`
- No purple/violet/indigo
- Accent color: Picton Blue `#48A4D6`
- All text via `t()` i18n
- `cursor-pointer` on clickable elements
- BlurFade entrance animations
- Markdown rendering for guidance/evidence/suggestions fields

## i18n Keys

```json
{
  "criteria": {
    "tab": "Κριτήρια",
    "analyze": "Ανάλυση Κριτηρίων",
    "analyzing": "Ανάλυση κριτηρίων...",
    "reanalyze": "Επανανάλυση",
    "noDocuments": "Ανεβάστε έγγραφα πρώτα",
    "noCriteria": "Δεν έχουν αναλυθεί κριτήρια ακόμα",
    "whatTenderAsks": "Τι ζητάει η διακήρυξη",
    "proposedOutline": "Προτεινόμενη Δομή Προσφοράς",
    "evidenceNeeded": "Αποδεικτικά που χρειάζονται",
    "tips": "Tips",
    "copyOutline": "Αντιγραφή Δομής",
    "copied": "Αντιγράφηκε!",
    "statusNotStarted": "Δεν ξεκίνησε",
    "statusInProgress": "Σε εξέλιξη",
    "statusDraftReady": "Draft έτοιμο",
    "statusFinal": "Τελικό",
    "awardType": "Τύπος Ανάθεσης",
    "lowestPrice": "Χαμηλότερη Τιμή",
    "bestValue": "Βέλτιστη Σχέση Ποιότητας-Τιμής",
    "costEffectiveness": "Κόστος-Αποτελεσματικότητα",
    "weight": "Βάρος"
  }
}
```

## Files to Create/Modify

### New Files
1. `prisma/migrations/XXXX_add_evaluation_criteria/migration.sql`
2. `src/server/services/ai-criteria-analyzer.ts`
3. `src/components/tender/criteria-tab.tsx`

### Modified Files
4. `prisma/schema.prisma` — add EvaluationCriterion model + enum
5. `src/server/routers/ai-roles.ts` — add analyzeCriteria + getCriteria endpoints
6. `src/app/(dashboard)/tenders/[id]/page.tsx` — add Criteria tab
7. `messages/el.json` — add criteria keys
8. `messages/en.json` — add criteria keys (English)

## What This Does NOT Do
- No score simulation or sliders
- No bid scoring or point calculation
- No modification to existing AI logic/prompts
- No changes to Go/No-Go or compliance features
