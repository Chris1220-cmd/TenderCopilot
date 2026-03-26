# Evaluation Criteria Writing Assistant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Criteria" tab to the tender detail page that uses AI to extract evaluation criteria from tender documents and generate writing guidance (proposed outline, evidence needed, tips) for each criterion.

**Architecture:** New Prisma model `EvaluationCriterion` stores extracted criteria with AI-generated guidance. New service `ai-criteria-analyzer.ts` follows the existing `ai-bid-orchestrator.ts` pattern (load docs from DB, build context, call `ai().complete()`, parse JSON response). New tab component `criteria-tab.tsx` renders accordion cards with markdown content.

**Tech Stack:** Prisma, tRPC, Gemini AI (via existing `ai()` provider), React, motion/react, lucide-react, existing i18n system.

**Spec:** `docs/superpowers/specs/2026-03-26-evaluation-criteria-writing-assistant-design.md`

---

### Task 1: Prisma Schema — Add EvaluationCriterion Model

**Files:**
- Modify: `prisma/schema.prisma:873` (after SubcontractorNeed model)
- Modify: `prisma/schema.prisma:273-339` (Tender model — add relation)

- [ ] **Step 1: Add the CriterionStatus enum and EvaluationCriterion model**

In `prisma/schema.prisma`, after the `SubcontractorNeed` model closing brace (line 873), add:

```prisma
// ─── Evaluation Criteria Writing Assistant ──────────────────

enum CriterionStatus {
  NOT_STARTED
  IN_PROGRESS
  DRAFT_READY
  FINAL
}

model EvaluationCriterion {
  id          String   @id @default(cuid())
  tenderId    String
  tender      Tender   @relation(fields: [tenderId], references: [id], onDelete: Cascade)

  name        String                  // "Μεθοδολογία Υλοποίησης"
  weight      Float?                  // 25.0 (percentage)
  parentId    String?
  parent      EvaluationCriterion?    @relation("CriteriaTree", fields: [parentId], references: [id])
  children    EvaluationCriterion[]   @relation("CriteriaTree")
  sortOrder   Int       @default(0)

  description String?   @db.Text      // what the tender document says
  guidance    String?   @db.Text      // AI: proposed outline + writing tips
  evidence    String?   @db.Text      // AI: documents/evidence to include
  suggestions String?   @db.Text      // AI: tips referencing specific pages

  status      CriterionStatus @default(NOT_STARTED)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([tenderId])
  @@index([parentId])
}
```

- [ ] **Step 2: Add relation to the Tender model**

In the Tender model (around line 310, after `espdData Json?`), add:

```prisma
  // Evaluation Criteria Writing Assistant
  evaluationCriteria EvaluationCriterion[]
```

- [ ] **Step 3: Generate and apply migration**

Run:
```bash
npx prisma migrate dev --name add_evaluation_criteria
```

Expected: Migration created and applied, `prisma generate` runs automatically.

- [ ] **Step 4: Verify**

Run:
```bash
npx prisma validate
```

Expected: "The Prisma schema is valid."

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat(criteria): add EvaluationCriterion model and migration"
```

---

### Task 2: AI Service — `ai-criteria-analyzer.ts`

**Files:**
- Create: `src/server/services/ai-criteria-analyzer.ts`

- [ ] **Step 1: Create the service file with types and class skeleton**

Create `src/server/services/ai-criteria-analyzer.ts`:

```typescript
import { db } from '@/lib/db';
import { ai, logTokenUsage } from '@/server/ai';
import { parseAIResponse } from './ai-prompts';

// ─── Types ──────────────────────────────────────────────

interface CriterionData {
  name: string;
  weight: number | null;
  parentName: string | null;
  sortOrder: number;
  description: string;
  guidance: string;
  evidence: string;
  suggestions: string;
}

interface CriteriaAnalysisResult {
  awardType: 'lowest_price' | 'best_value' | 'cost_effectiveness';
  criteria: CriterionData[];
}

// ─── Prompts ────────────────────────────────────────────

const SYSTEM_PROMPT_EL = `Είσαι ειδικός σε ελληνικούς δημόσιους διαγωνισμούς (Ν.4412/2016).

Ανάλυσε τα έγγραφα της διακήρυξης και εξήγαγε ΟΛΑ τα κριτήρια αξιολόγησης/ανάθεσης.

Για ΚΑΘΕ κριτήριο δώσε:
- name: Όνομα κριτηρίου (π.χ. "Μεθοδολογία Υλοποίησης")
- weight: Βάρος σε % (null αν δεν αναφέρεται)
- parentName: Όνομα γονικού κριτηρίου (null αν είναι top-level)
- sortOrder: Σειρά εμφάνισης (0, 1, 2...)
- description: Τι ΑΚΡΙΒΩΣ ζητάει η διακήρυξη για αυτό το κριτήριο — αντέγραψε τις σχετικές παραγράφους
- guidance: Προτεινόμενη δομή τεχνικής προσφοράς σε markdown. Δώσε συγκεκριμένες ενότητες και τι να γράψει ο υποψήφιος σε καθεμία. Αναφέρσου σε ISO πιστοποιήσεις, βεβαιώσεις καλής εκτέλεσης, ή CVs αν σχετίζονται.
- evidence: Τι αποδεικτικά/έγγραφα πρέπει να συμπεριληφθούν, σε markdown λίστα
- suggestions: Πρακτικά tips βασισμένα στη διακήρυξη — αναφέρσου σε συγκεκριμένα άρθρα/σελίδες αν τα βρίσκεις

Επίσης προσδιόρισε τον τύπο ανάθεσης (awardType):
- "lowest_price" αν η ανάθεση γίνεται μόνο με χαμηλότερη τιμή
- "best_value" αν υπάρχουν κριτήρια ποιότητας-τιμής
- "cost_effectiveness" αν χρησιμοποιεί κόστος κύκλου ζωής

Απάντησε ΜΟΝΟ σε JSON format.`;

const SYSTEM_PROMPT_EN = `You are an expert in public procurement evaluation criteria.

Analyze the tender documents and extract ALL evaluation/award criteria.

For EACH criterion provide:
- name: Criterion name (e.g. "Technical Methodology")
- weight: Weight in % (null if not specified)
- parentName: Parent criterion name (null if top-level)
- sortOrder: Display order (0, 1, 2...)
- description: What EXACTLY the tender requires for this criterion — quote relevant paragraphs
- guidance: Proposed technical proposal structure in markdown. Give specific sections and what to write in each. Reference ISO certifications, reference letters, or CVs if relevant.
- evidence: What supporting documents/evidence to include, as markdown list
- suggestions: Practical tips based on the tender — reference specific articles/pages if found

Also identify the award type (awardType):
- "lowest_price" if award is based solely on lowest price
- "best_value" if there are quality-price criteria
- "cost_effectiveness" if it uses life-cycle cost analysis

Respond ONLY in JSON format.`;

// ─── Service ────────────────────────────────────────────

class AICriteriaAnalyzer {
  async analyzeCriteria(
    tenderId: string,
    tenantId: string,
    language: 'el' | 'en' = 'el'
  ): Promise<{ awardType: string; count: number }> {

    // 1. Load tender with documents
    const tender = await db.tender.findUniqueOrThrow({
      where: { id: tenderId },
      include: {
        attachedDocuments: { select: { fileName: true, extractedText: true } },
        requirements: true,
      },
    });

    // 2. Build metadata context
    const meta: string[] = [];
    meta.push(`Τίτλος: ${tender.title}`);
    if (tender.referenceNumber) meta.push(`Αρ. Αναφοράς: ${tender.referenceNumber}`);
    if (tender.contractingAuthority) meta.push(`Αναθέτουσα Αρχή: ${tender.contractingAuthority}`);
    if (tender.budget) meta.push(`Προϋπολογισμός: ${tender.budget.toLocaleString('el-GR')}€`);
    if (tender.awardCriteria) meta.push(`Κριτήριο Ανάθεσης: ${tender.awardCriteria}`);
    if (tender.cpvCodes.length > 0) meta.push(`CPV: ${tender.cpvCodes.join(', ')}`);
    const metadataText = meta.join('\n');

    // 3. Load document texts (max 50K chars)
    const docsWithText = tender.attachedDocuments.filter(
      (d): d is typeof d & { extractedText: string } => !!d.extractedText && d.extractedText.length > 50
    );
    if (docsWithText.length === 0) {
      throw new Error('Δεν βρέθηκαν έγγραφα με κείμενο. Ανεβάστε PDF πρώτα.');
    }
    let documentText = docsWithText
      .map((d) => `\n--- ${d.fileName} ---\n${d.extractedText}`)
      .join('\n');
    if (documentText.length > 50000) {
      documentText = documentText.slice(0, 50000) + '\n\n[...κείμενο περικόπηκε λόγω μεγέθους]';
    }

    // 4. Load company certificates for cross-reference
    const certs = await db.certificate.findMany({
      where: { tenantId },
      select: { name: true, type: true, issuingBody: true, expiresAt: true },
    });
    const certText = certs.length > 0
      ? '\n\n--- Πιστοποιητικά Εταιρείας ---\n' +
        certs.map((c) => `- ${c.name} (${c.type}) — ${c.issuingBody}${c.expiresAt ? ` — λήξη: ${c.expiresAt.toISOString().slice(0, 10)}` : ''}`).join('\n')
      : '';

    const fullText = `${metadataText}\n\n=== ΚΕΙΜΕΝΟ ΕΓΓΡΑΦΩΝ ===\n${documentText}${certText}`;

    // 5. Call AI
    const systemPrompt = language === 'el' ? SYSTEM_PROMPT_EL : SYSTEM_PROMPT_EN;
    const result = await ai().complete({
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Ανάλυσε τα κριτήρια αξιολόγησης αυτού του διαγωνισμού:\n\n${fullText}`,
        },
      ],
      maxTokens: 8000,
      temperature: 0.2,
      responseFormat: 'json',
    });

    await logTokenUsage(tenderId, 'criteria_analysis', {
      input: result.inputTokens || 0,
      output: result.outputTokens || 0,
      total: result.totalTokens || 0,
    });

    // 6. Parse response
    const parsed = parseAIResponse<CriteriaAnalysisResult>(
      result.content,
      ['awardType', 'criteria'],
      'criteria_analysis'
    );

    // 7. Save to DB — delete old criteria first, then insert new
    await db.evaluationCriterion.deleteMany({ where: { tenderId } });

    // First pass: create top-level criteria
    const parentMap = new Map<string, string>(); // name → id
    for (const c of parsed.criteria.filter((c) => !c.parentName)) {
      const created = await db.evaluationCriterion.create({
        data: {
          tenderId,
          name: c.name,
          weight: c.weight,
          sortOrder: c.sortOrder,
          description: c.description,
          guidance: c.guidance,
          evidence: c.evidence,
          suggestions: c.suggestions,
        },
      });
      parentMap.set(c.name, created.id);
    }

    // Second pass: create sub-criteria with parentId
    for (const c of parsed.criteria.filter((c) => c.parentName)) {
      const parentId = parentMap.get(c.parentName!) ?? null;
      await db.evaluationCriterion.create({
        data: {
          tenderId,
          name: c.name,
          weight: c.weight,
          parentId,
          sortOrder: c.sortOrder,
          description: c.description,
          guidance: c.guidance,
          evidence: c.evidence,
          suggestions: c.suggestions,
        },
      });
    }

    return { awardType: parsed.awardType, count: parsed.criteria.length };
  }
}

export const aiCriteriaAnalyzer = new AICriteriaAnalyzer();
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors related to `ai-criteria-analyzer.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/server/services/ai-criteria-analyzer.ts
git commit -m "feat(criteria): add AI criteria analyzer service"
```

---

### Task 3: tRPC Router — Add Criteria Endpoints

**Files:**
- Modify: `src/server/routers/ai-roles.ts:1-14` (imports)
- Modify: `src/server/routers/ai-roles.ts` (add endpoints at end of router)

- [ ] **Step 1: Add import for the new service**

In `src/server/routers/ai-roles.ts`, after line 8 (`import { aiCompliance }...`), add:

```typescript
import { aiCriteriaAnalyzer } from '@/server/services/ai-criteria-analyzer';
```

- [ ] **Step 2: Add the analyzeCriteria mutation**

Add inside the `aiRolesRouter` (before the closing `})`):

```typescript
  // ─── Evaluation Criteria Writing Assistant ────────────────

  analyzeCriteria: protectedProcedure
    .input(z.object({ tenderId: z.string(), language: z.enum(['el', 'en']).default('el') }))
    .mutation(async ({ ctx, input }) => {
      const { tenantId } = await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return aiCriteriaAnalyzer.analyzeCriteria(input.tenderId, tenantId, input.language);
    }),

  getCriteria: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return db.evaluationCriterion.findMany({
        where: { tenderId: input.tenderId, parentId: null },
        include: { children: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { sortOrder: 'asc' },
      });
    }),

  updateCriterionStatus: protectedProcedure
    .input(z.object({
      criterionId: z.string(),
      status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DRAFT_READY', 'FINAL']),
    }))
    .mutation(async ({ ctx, input }) => {
      const criterion = await db.evaluationCriterion.findUniqueOrThrow({
        where: { id: input.criterionId },
        select: { tenderId: true },
      });
      await ensureTenderAccess(criterion.tenderId, ctx.tenantId);
      return db.evaluationCriterion.update({
        where: { id: input.criterionId },
        data: { status: input.status },
      });
    }),
```

- [ ] **Step 3: Verify build**

Run:
```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/ai-roles.ts
git commit -m "feat(criteria): add tRPC endpoints for criteria analysis"
```

---

### Task 4: i18n — Add Translation Keys

**Files:**
- Modify: `messages/el.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Add Greek translation keys**

In `messages/el.json`, add a new `"criteria"` section after the `"tender"` section (after its closing `}`):

```json
  "criteria": {
    "tab": "Κριτήρια",
    "analyze": "Ανάλυση Κριτηρίων",
    "analyzing": "Ανάλυση κριτηρίων...",
    "reanalyze": "Επανανάλυση",
    "noDocuments": "Ανεβάστε έγγραφα διακήρυξης πρώτα για να γίνει ανάλυση κριτηρίων.",
    "noCriteria": "Δεν έχουν αναλυθεί κριτήρια αξιολόγησης ακόμα.",
    "noCriteriaDesc": "Πατήστε «Ανάλυση Κριτηρίων» για να εξαγάγει το AI τα κριτήρια της διακήρυξης και να σας δώσει οδηγίες σύνταξης.",
    "whatTenderAsks": "Τι ζητάει η διακήρυξη",
    "proposedOutline": "Προτεινόμενη Δομή Προσφοράς",
    "evidenceNeeded": "Αποδεικτικά που χρειάζονται",
    "tips": "Tips",
    "copyOutline": "Αντιγραφή",
    "copied": "Αντιγράφηκε!",
    "statusNotStarted": "Δεν ξεκίνησε",
    "statusInProgress": "Σε εξέλιξη",
    "statusDraftReady": "Draft έτοιμο",
    "statusFinal": "Τελικό",
    "awardType": "Τύπος Ανάθεσης",
    "lowestPrice": "Χαμηλότερη Τιμή",
    "bestValue": "Βέλτιστη Σχέση Ποιότητας-Τιμής",
    "costEffectiveness": "Κόστος-Αποτελεσματικότητα",
    "weight": "Βάρος",
    "criteriaCount": "{{count}} κριτήρια εντοπίστηκαν",
    "errorAnalysis": "Σφάλμα κατά την ανάλυση κριτηρίων"
  }
```

- [ ] **Step 2: Add English translation keys**

In `messages/en.json`, add matching section:

```json
  "criteria": {
    "tab": "Criteria",
    "analyze": "Analyze Criteria",
    "analyzing": "Analyzing criteria...",
    "reanalyze": "Re-analyze",
    "noDocuments": "Upload tender documents first to analyze evaluation criteria.",
    "noCriteria": "No evaluation criteria analyzed yet.",
    "noCriteriaDesc": "Click \"Analyze Criteria\" to extract evaluation criteria and get writing guidance.",
    "whatTenderAsks": "What the tender requires",
    "proposedOutline": "Proposed Proposal Structure",
    "evidenceNeeded": "Evidence Needed",
    "tips": "Tips",
    "copyOutline": "Copy",
    "copied": "Copied!",
    "statusNotStarted": "Not Started",
    "statusInProgress": "In Progress",
    "statusDraftReady": "Draft Ready",
    "statusFinal": "Final",
    "awardType": "Award Type",
    "lowestPrice": "Lowest Price",
    "bestValue": "Best Price-Quality Ratio",
    "costEffectiveness": "Cost-Effectiveness",
    "weight": "Weight",
    "criteriaCount": "{{count}} criteria found",
    "errorAnalysis": "Error analyzing criteria"
  }
```

- [ ] **Step 3: Add tab key to tender section**

In both `messages/el.json` and `messages/en.json`, inside the `"tender"` section (after `"activityTab"` on line 422), add:

**el.json:**
```json
    "criteriaTab": "Κριτήρια",
```

**en.json:**
```json
    "criteriaTab": "Criteria",
```

- [ ] **Step 4: Commit**

```bash
git add messages/el.json messages/en.json
git commit -m "feat(criteria): add i18n translation keys"
```

---

### Task 5: UI Component — `criteria-tab.tsx`

**Files:**
- Create: `src/components/tender/criteria-tab.tsx`

- [ ] **Step 1: Create the CriteriaTab component**

Create `src/components/tender/criteria-tab.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { trpc } from '@/lib/trpc';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { LanguageModal, type AnalysisLanguage } from '@/components/tender/language-modal';
import { EmptyStateIllustration } from '@/components/ui/empty-state';
import { Ripple } from '@/components/ui/ripple';
import { BlurFade } from '@/components/ui/blur-fade';
import {
  Award,
  ChevronDown,
  ChevronRight,
  Loader2,
  Play,
  RefreshCw,
  Copy,
  Check,
  FileText,
  Lightbulb,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────

interface CriteriaTabProps {
  tenderId: string;
}

type CriterionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DRAFT_READY' | 'FINAL';

const STATUS_VARIANTS: Record<CriterionStatus, 'secondary' | 'warning' | 'default' | 'success'> = {
  NOT_STARTED: 'secondary',
  IN_PROGRESS: 'warning',
  DRAFT_READY: 'default',
  FINAL: 'success',
};

const STATUS_ORDER: CriterionStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'DRAFT_READY', 'FINAL'];

// ─── Markdown simple renderer ───────────────────────────

function SimpleMarkdown({ content }: { content: string }) {
  // Split by lines, render headers, bullets, bold
  const lines = content.split('\n');
  return (
    <div className="space-y-1 text-sm text-muted-foreground leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;
        if (trimmed.startsWith('### '))
          return <h4 key={i} className="font-semibold text-foreground mt-3 mb-1 text-sm">{trimmed.slice(4)}</h4>;
        if (trimmed.startsWith('## '))
          return <h3 key={i} className="font-semibold text-foreground mt-3 mb-1">{trimmed.slice(3)}</h3>;
        if (trimmed.startsWith('# '))
          return <h3 key={i} className="font-bold text-foreground mt-3 mb-1">{trimmed.slice(2)}</h3>;
        if (trimmed.startsWith('- ') || trimmed.startsWith('* '))
          return (
            <div key={i} className="flex gap-2 pl-2">
              <span className="text-primary mt-0.5 shrink-0">&#8226;</span>
              <span dangerouslySetInnerHTML={{ __html: boldify(trimmed.slice(2)) }} />
            </div>
          );
        if (/^\d+\.\s/.test(trimmed)) {
          const match = trimmed.match(/^(\d+)\.\s(.*)$/);
          if (match)
            return (
              <div key={i} className="flex gap-2 pl-2">
                <span className="text-primary font-medium shrink-0">{match[1]}.</span>
                <span dangerouslySetInnerHTML={{ __html: boldify(match[2]) }} />
              </div>
            );
        }
        return <p key={i} dangerouslySetInnerHTML={{ __html: boldify(trimmed) }} />;
      })}
    </div>
  );
}

function boldify(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground font-medium">$1</strong>')
    .replace(/`(.+?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs">$1</code>');
}

// ─── Criterion Card ─────────────────────────────────────

function CriterionCard({
  criterion,
  onStatusChange,
}: {
  criterion: any;
  onStatusChange: (id: string, status: CriterionStatus) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const statusKey = `criteria.status${criterion.status.charAt(0) + criterion.status.slice(1).toLowerCase().replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase())}` as const;

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const cycleStatus = () => {
    const currentIdx = STATUS_ORDER.indexOf(criterion.status);
    const nextStatus = STATUS_ORDER[(currentIdx + 1) % STATUS_ORDER.length];
    onStatusChange(criterion.id, nextStatus);
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card transition-colors hover:border-primary/20">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-4 cursor-pointer text-left"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {expanded
            ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          }
          <span className="font-medium text-foreground truncate">{criterion.name}</span>
          {criterion.weight != null && (
            <Badge variant="outline" className="shrink-0 tabular-nums">
              {criterion.weight}%
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 ml-3 shrink-0">
          <Badge
            variant={STATUS_VARIANTS[criterion.status as CriterionStatus]}
            className="cursor-pointer"
            onClick={(e) => { e.stopPropagation(); cycleStatus(); }}
          >
            {t(statusKey)}
          </Badge>
        </div>
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/40 px-5 py-4 space-y-5">
              {/* What the tender asks */}
              {criterion.description && (
                <Section
                  icon={<FileText className="h-4 w-4" />}
                  title={t('criteria.whatTenderAsks')}
                  content={criterion.description}
                />
              )}

              {/* Proposed outline */}
              {criterion.guidance && (
                <Section
                  icon={<BookOpen className="h-4 w-4" />}
                  title={t('criteria.proposedOutline')}
                  content={criterion.guidance}
                  copyable
                  onCopy={() => handleCopy(criterion.guidance!, 'guidance')}
                  copied={copiedField === 'guidance'}
                  copyLabel={t('criteria.copyOutline')}
                  copiedLabel={t('criteria.copied')}
                />
              )}

              {/* Evidence needed */}
              {criterion.evidence && (
                <Section
                  icon={<Award className="h-4 w-4" />}
                  title={t('criteria.evidenceNeeded')}
                  content={criterion.evidence}
                />
              )}

              {/* Tips */}
              {criterion.suggestions && (
                <Section
                  icon={<Lightbulb className="h-4 w-4" />}
                  title={t('criteria.tips')}
                  content={criterion.suggestions}
                  highlight
                />
              )}

              {/* Sub-criteria */}
              {criterion.children && criterion.children.length > 0 && (
                <div className="space-y-3 pl-4 border-l-2 border-primary/20">
                  {criterion.children.map((child: any) => (
                    <CriterionCard
                      key={child.id}
                      criterion={child}
                      onStatusChange={onStatusChange}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Section block ──────────────────────────────────────

function Section({
  icon,
  title,
  content,
  copyable,
  onCopy,
  copied,
  copyLabel,
  copiedLabel,
  highlight,
}: {
  icon: React.ReactNode;
  title: string;
  content: string;
  copyable?: boolean;
  onCopy?: () => void;
  copied?: boolean;
  copyLabel?: string;
  copiedLabel?: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-lg p-4',
      highlight ? 'bg-primary/5 border border-primary/10' : 'bg-muted/30',
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-foreground font-medium text-sm">
          {icon}
          {title}
        </div>
        {copyable && onCopy && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopy}
            className="h-7 gap-1.5 text-xs cursor-pointer"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? copiedLabel : copyLabel}
          </Button>
        )}
      </div>
      <SimpleMarkdown content={content} />
    </div>
  );
}

// ─── Award type badge ───────────────────────────────────

function AwardTypeBadge({ criteria }: { criteria: any[] }) {
  const { t } = useTranslation();
  // Infer from data — if all criteria have no weight, it's likely lowest_price
  const hasWeights = criteria.some((c) => c.weight != null);
  if (!hasWeights) return null;

  const totalWeight = criteria
    .filter((c) => !c.parentId && c.weight != null)
    .reduce((sum, c) => sum + (c.weight ?? 0), 0);

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Sparkles className="h-3.5 w-3.5 text-primary" />
      <span>{t('criteria.awardType')}: <strong className="text-foreground">{t('criteria.bestValue')}</strong></span>
      {totalWeight > 0 && (
        <Badge variant="outline" className="text-xs tabular-nums">{Math.round(totalWeight)}%</Badge>
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────

export function CriteriaTab({ tenderId }: CriteriaTabProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [langModalOpen, setLangModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const criteriaQuery = trpc.aiRoles.getCriteria.useQuery({ tenderId });
  const analyzeMutation = trpc.aiRoles.analyzeCriteria.useMutation({
    onSuccess: (data) => {
      setIsAnalyzing(false);
      utils.aiRoles.getCriteria.invalidate({ tenderId });
      toast({
        title: t('criteria.tab'),
        description: t('criteria.criteriaCount', { count: data.count }),
      });
    },
    onError: (err) => {
      setIsAnalyzing(false);
      toast({
        title: t('criteria.errorAnalysis'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const statusMutation = trpc.aiRoles.updateCriterionStatus.useMutation({
    onSuccess: () => {
      utils.aiRoles.getCriteria.invalidate({ tenderId });
    },
  });

  const handleAnalyze = () => setLangModalOpen(true);

  const handleAnalyzeWithLang = (lang: AnalysisLanguage) => {
    setLangModalOpen(false);
    setIsAnalyzing(true);
    analyzeMutation.mutate({ tenderId, language: lang });
  };

  const handleStatusChange = (criterionId: string, status: CriterionStatus) => {
    statusMutation.mutate({ criterionId, status });
  };

  const criteria = criteriaQuery.data ?? [];
  const isLoading = criteriaQuery.isLoading;
  const hasCriteria = criteria.length > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Award className="h-5 w-5 text-primary" />
          <h2 className="text-title text-foreground">{t('criteria.tab')}</h2>
          {hasCriteria && <AwardTypeBadge criteria={criteria} />}
        </div>
        <Button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          variant={hasCriteria ? 'outline' : 'default'}
          size="sm"
          className="gap-2 cursor-pointer"
        >
          {isAnalyzing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : hasCriteria ? (
            <RefreshCw className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {isAnalyzing
            ? t('criteria.analyzing')
            : hasCriteria
              ? t('criteria.reanalyze')
              : t('criteria.analyze')
          }
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : !hasCriteria ? (
        <BlurFade delay={0.1}>
          <div className="relative rounded-xl border border-border/60 bg-card py-16 text-center overflow-hidden">
            <Ripple mainCircleSize={120} mainCircleOpacity={0.06} numCircles={5} />
            <div className="relative z-10">
              <EmptyStateIllustration variant="tenders" className="mb-4" />
              <p className="text-body text-muted-foreground">{t('criteria.noCriteria')}</p>
              <p className="text-caption text-muted-foreground/70 mt-1 max-w-md mx-auto">
                {t('criteria.noCriteriaDesc')}
              </p>
            </div>
          </div>
        </BlurFade>
      ) : (
        <BlurFade delay={0.1}>
          <div className="space-y-3">
            {criteria.map((criterion: any, i: number) => (
              <motion.div
                key={criterion.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <CriterionCard
                  criterion={criterion}
                  onStatusChange={handleStatusChange}
                />
              </motion.div>
            ))}
          </div>
        </BlurFade>
      )}

      {/* Language Modal */}
      <LanguageModal
        open={langModalOpen}
        onSelect={handleAnalyzeWithLang}
        onClose={() => setLangModalOpen(false)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors related to `criteria-tab.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/tender/criteria-tab.tsx
git commit -m "feat(criteria): add CriteriaTab UI component with accordion cards"
```

---

### Task 6: Integration — Add Tab to Tender Detail Page

**Files:**
- Modify: `src/app/(dashboard)/tenders/[id]/page.tsx:1-59` (imports)
- Modify: `src/app/(dashboard)/tenders/[id]/page.tsx:380-399` (TabsList)
- Modify: `src/app/(dashboard)/tenders/[id]/page.tsx:411-466` (TabsContent)

- [ ] **Step 1: Add import**

In `src/app/(dashboard)/tenders/[id]/page.tsx`, after the `FakelosTab` import (around line 41), add:

```typescript
import { CriteriaTab } from '@/components/tender/criteria-tab';
```

Add `Award` to the lucide-react imports (the `import { ChevronRight, ... }` block):

```typescript
  Award,
```

- [ ] **Step 2: Add tab trigger**

In the `TabsList` section, after the `documents` tab trigger and before the `fakelos` tab trigger, add:

```tsx
  <AnimatedTabsTrigger value="criteria" activeValue={activeTab}><Award className="h-3.5 w-3.5" />{t('tender.criteriaTab')}</AnimatedTabsTrigger>
```

- [ ] **Step 3: Add tab content**

After the `documents` `TabsContent` and before the `fakelos` `TabsContent`, add:

```tsx
  <TabsContent value="criteria" forceMount={activeTab === 'criteria' ? true : undefined}>
    <CriteriaTab tenderId={tenderId} />
  </TabsContent>
```

- [ ] **Step 4: Verify build**

Run:
```bash
npx next build 2>&1 | tail -15
```

Expected: Build succeeds, `/tenders/[id]` route compiles.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/tenders/[id]/page.tsx
git commit -m "feat(criteria): integrate Criteria tab into tender detail page"
```

---

### Task 7: End-to-End Verification

**Files:** None (testing only)

- [ ] **Step 1: Start dev server and navigate**

Run:
```bash
npm run dev
```

Open `http://localhost:3000/tenders/<any-tender-id>` and verify:
1. "Κριτήρια" tab appears between "Documents" and "Fakelos"
2. Tab shows empty state with "Ανάλυση Κριτηρίων" button
3. Button opens language modal
4. If tender has no documents, mutation throws error with "Ανεβάστε PDF πρώτα"
5. If tender has documents, AI analyzes and criteria cards appear

- [ ] **Step 2: Test criterion card interactions**

Verify:
1. Cards expand/collapse on click
2. Status badge cycles: Not Started → In Progress → Draft Ready → Final
3. Copy button copies guidance text to clipboard
4. Sub-criteria render nested under parent
5. Weight badges display correctly

- [ ] **Step 3: Full build verification**

Run:
```bash
npx next build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit BlurFade fix from earlier**

```bash
git add src/components/ui/blur-fade.tsx
git commit -m "fix(ui): remove unnecessary AnimatePresence from BlurFade to fix ref warning"
```
