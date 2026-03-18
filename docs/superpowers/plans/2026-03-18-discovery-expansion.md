# Discovery Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Greek private sector tender sources (ΔΕΚΟ, banks, telecoms) with built-in + custom URLs; add country/type/relevance filters; add language selection (el/en) for all AI analysis.

**Architecture:** Extend `DiscoveredTender` type with `country`, `sourceLabel`, `isPrivate` fields. Add `scrapePrivateSource()` as a new fetcher complementing the existing `searchPrivateSector()`. Add `PrivateTenderSource` model for user-managed URLs. Add `Tender.analysisLanguage` for per-tender language preference. Add filter params to tRPC `discovery.search`. TED and private sector scrapers already partially exist — extend, do not rewrite.

**Tech Stack:** Next.js 14, tRPC (`trpc` import from `@/lib/trpc`), Prisma, Supabase PostgreSQL, Vitest, TypeScript

**Prerequisite:** `2026-03-18-reliability-fixes.md` plan must be completed first.

**Out of scope:** EU Funding & Tenders Portal (`ec.europa.eu`) — deferred to Phase 2.

**Spec:** `docs/superpowers/specs/2026-03-18-discovery-reliability-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add `PrivateTenderSource` model, `Tenant` back-relation, `Tender.analysisLanguage` |
| `src/server/services/tender-discovery.ts` | Modify | Add `country`/`sourceLabel`/`isPrivate` to `DiscoveredTender`; add `scrapePrivateSource()`; extend existing TED mapper; add filter params |
| `src/server/services/tender-discovery.test.ts` | Create | Unit tests for new type fields and filter logic |
| `src/server/routers/discovery.ts` | Modify | Add `country`, `entityType`, `relevanceOnly`, `'OTHER'`/`'PRIVATE'` to `platforms` enum |
| `src/server/routers/private-sources.ts` | Create | tRPC CRUD router for `PrivateTenderSource` |
| `src/server/root.ts` | Modify | Register `privateSourcesRouter` |
| `src/data/private-sources.json` | Create | Built-in Greek private sector procurement URLs |
| `src/components/discovery/filter-bar.tsx` | Create | Country / entity type / relevance filter bar |
| `src/components/tender/language-modal.tsx` | Create | Language selection modal (el/en) |
| `src/components/tender/ai-brief-panel.tsx` | Modify | Show language modal before triggering analysis |
| `src/components/tender/go-no-go-panel.tsx` | Modify | Show language modal before triggering analysis |
| `src/components/tender/legal-tab.tsx` | Modify | Show language modal before triggering analysis |
| `src/components/tender/financial-tab.tsx` | Modify | Show language modal before triggering analysis |
| `src/components/tender/technical-tab-enhanced.tsx` | Modify | Show language modal before triggering analysis |
| `src/server/services/ai-bid-orchestrator.ts` | Modify | Accept `language` param, inject into prompts, save to DB |
| `src/server/services/ai-legal-analyzer.ts` | Modify | Accept `language` param |
| `src/server/services/ai-financial.ts` | Modify | Accept `language` param |
| `src/server/services/ai-technical.ts` | Modify | Accept `language` param |
| `src/server/routers/ai-roles.ts` | Modify | Pass `language` from input to AI services |

---

## Task 1: Schema migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `PrivateTenderSource` model**

In `prisma/schema.prisma`, add after the `Tender` model block:
```prisma
model PrivateTenderSource {
  id        String   @id @default(cuid())
  tenantId  String
  name      String
  url       String
  country   String   @default("GR")
  active    Boolean  @default(true)
  createdAt DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
}
```

Find the `Tenant` model and add the back-relation inside it:
```prisma
privateTenderSources PrivateTenderSource[]
```

- [ ] **Step 2: Add `analysisLanguage` to `Tender` model**

In the `Tender` model block, add before `createdAt`:
```prisma
analysisLanguage  String  @default("el")
```

- [ ] **Step 3: Run migration**

```bash
cd c:/Users/athan/Desktop/TenderCopilot && eval "$(fnm env)" && fnm use 22 --arch x64 && npx prisma migrate dev --name "add_private_tender_source_and_analysis_language"
```
Expected: Migration created and applied. If Supabase is running, both fields appear in the database.

- [ ] **Step 4: Regenerate Prisma client**

```bash
npx prisma generate
```
Expected: Generated without errors.

- [ ] **Step 5: Build check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add PrivateTenderSource model and Tender.analysisLanguage"
```

---

## Task 2: Extend `DiscoveredTender` type + filter params

**Files:**
- Modify: `src/server/services/tender-discovery.ts`
- Create: `src/server/services/tender-discovery.test.ts`

**Important:** Read `tender-discovery.ts` before editing. The file already has:
- A working `getLatestFromTED()` implementation — do NOT replace it, only extend it to populate the new fields
- A working `searchPrivateSector()` — do NOT replace it, the new `scrapePrivateSource()` in Task 4 is a complementary fetcher for company-specific portals
- `platform: 'PRIVATE'` already in the union — adding it again is a no-op

- [ ] **Step 1: Write failing test**

Create `src/server/services/tender-discovery.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('DiscoveredTender type fields', () => {
  it('accepts country, sourceLabel, isPrivate fields', () => {
    const tender: import('./tender-discovery').DiscoveredTender = {
      title: 'Test',
      referenceNumber: 'REF-001',
      contractingAuthority: 'Authority',
      platform: 'OTHER',
      cpvCodes: ['72000000-5'],
      sourceUrl: 'https://example.com',
      publishedAt: new Date(),
      country: 'GR',
      sourceLabel: 'ΔΕΗ',
      isPrivate: true,
    };
    expect(tender.country).toBe('GR');
    expect(tender.sourceLabel).toBe('ΔΕΗ');
    expect(tender.isPrivate).toBe(true);
  });
});

describe('TenderSearchParams filter fields', () => {
  it('accepts country, entityType, relevanceOnly fields', () => {
    const params: import('./tender-discovery').TenderSearchParams = {
      country: 'GR',
      entityType: 'private',
      relevanceOnly: true,
    };
    expect(params.entityType).toBe('private');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
eval "$(fnm env)" && fnm use 22 --arch x64 && npx vitest run src/server/services/tender-discovery.test.ts
```
Expected: TypeScript error — new fields don't exist yet

- [ ] **Step 3: Update `DiscoveredTender` interface in tender-discovery.ts**

Find the `DiscoveredTender` interface and add the three new optional fields:
```ts
export interface DiscoveredTender {
  // ... existing fields unchanged ...
  platform: 'KIMDIS' | 'DIAVGEIA' | 'TED' | 'ESIDIS' | 'OTHER' | 'PRIVATE';
  country?: string;       // ISO code: 'GR', 'DE', etc.
  sourceLabel?: string;   // human-readable source name e.g. 'ΔΕΗ', 'TED'
  isPrivate?: boolean;    // true for private sector sources
}
```

Update `TenderSearchParams`:
```ts
export interface TenderSearchParams {
  // ... existing fields unchanged ...
  country?: 'GR' | 'EU' | 'international' | 'all';
  entityType?: 'public' | 'private' | 'all';
  relevanceOnly?: boolean;
  tenantId?: string;   // optional, needed for custom private sources
}
```

- [ ] **Step 4: Add `country` field to existing TED mapper**

Find `getLatestFromTED()` in `tender-discovery.ts`. In its return mapper, add:
```ts
country: 'GR',      // TED already filters for GR by default
sourceLabel: 'TED',
isPrivate: false,
```
(Do not rewrite the function — only add these three fields to each mapped result object.)

- [ ] **Step 5: Update tRPC discovery.search input schema**

In `src/server/routers/discovery.ts`, update the `search` procedure's input schema:
```ts
platforms: z
  .array(z.enum(['KIMDIS', 'DIAVGEIA', 'TED', 'ESIDIS', 'OTHER', 'PRIVATE']))
  .optional(),
country: z.enum(['GR', 'EU', 'international', 'all']).optional(),
entityType: z.enum(['public', 'private', 'all']).optional(),
relevanceOnly: z.boolean().optional(),
```
Pass the new params through to `tenderDiscovery.searchTenders()`.

- [ ] **Step 6: Run tests**

```bash
npx vitest run src/server/services/tender-discovery.test.ts
```
Expected: PASS

- [ ] **Step 7: Build check**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add src/server/services/tender-discovery.ts src/server/services/tender-discovery.test.ts src/server/routers/discovery.ts
git commit -m "feat: extend DiscoveredTender type with country/sourceLabel/isPrivate and filter params"
```

---

## Task 3: Private sector — built-in company list

**Files:**
- Create: `src/data/private-sources.json`
- Modify: `src/server/services/tender-discovery.ts`

**Note:** The file already has `searchPrivateSector()` which scrapes aggregator sites (b2b.gr, eprocurement.gr). The new `scrapePrivateSource()` added here targets **individual company** procurement portals (ΔΕΗ, ΕΥΔΑΠ, etc.). Both coexist.

- [ ] **Step 1: Research actual procurement portal URLs**

Before writing the JSON file, manually visit each company's website and find their procurement / supplier page:
- ΔΕΗ: search `dei.gr "προμηθευτές"` or `dei.gr "διαγωνισμοί"`
- ΕΥΔΑΠ: search `eydap.gr "διαγωνισμοί"`
- OTE/Cosmote: search `ote.gr "προμήθειες"`
- Εθνική Τράπεζα: search `nbg.gr "procurement"`
- Alpha Bank: search `alpha.gr "suppliers"`

Mark `"active": false` for any URL that cannot be verified or requires login.

- [ ] **Step 2: Create `src/data/private-sources.json`**

```json
[
  {
    "id": "dei",
    "name": "ΔΕΗ",
    "url": "<verified URL>",
    "country": "GR",
    "sector": "energy",
    "active": true
  },
  {
    "id": "eydap",
    "name": "ΕΥΔΑΠ",
    "url": "<verified URL>",
    "country": "GR",
    "sector": "utilities",
    "active": true
  },
  {
    "id": "ote",
    "name": "OTE/Cosmote",
    "url": "<verified URL>",
    "country": "GR",
    "sector": "telecom",
    "active": false
  },
  {
    "id": "nbg",
    "name": "Εθνική Τράπεζα",
    "url": "<verified URL>",
    "country": "GR",
    "sector": "finance",
    "active": false
  },
  {
    "id": "alpha",
    "name": "Alpha Bank",
    "url": "<verified URL>",
    "country": "GR",
    "sector": "finance",
    "active": false
  }
]
```

- [ ] **Step 3: Add `scrapePrivateSource()` to tender-discovery.ts**

Add this new function (do NOT modify or remove the existing `searchPrivateSector()`):
```ts
async function scrapePrivateSource(source: { name: string; url: string; country: string }): Promise<DiscoveredTender[]> {
  try {
    const response = await fetch(source.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TenderCopilot/1.0)' },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return [];
    const html = await response.text();

    const results: DiscoveredTender[] = [];
    const linkRegex = /<a[^>]+href="([^"]*)"[^>]*>([^<]{5,200})<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null) {
      const [, href, text] = match;
      const lowerText = text.toLowerCase();
      if (
        lowerText.includes('διαγωνισμ') ||
        lowerText.includes('προμήθει') ||
        lowerText.includes('tender') ||
        lowerText.includes('rfp') ||
        lowerText.includes('rfq')
      ) {
        const fullUrl = href.startsWith('http') ? href : new URL(href, source.url).href;
        results.push({
          title: text.trim(),
          referenceNumber: '',
          contractingAuthority: source.name,
          platform: 'PRIVATE',
          cpvCodes: [],
          sourceUrl: fullUrl,
          publishedAt: new Date(),
          country: source.country,
          sourceLabel: source.name,
          isPrivate: true,
        });
      }
    }

    return results.slice(0, 10);
  } catch (err) {
    console.error(`[Discovery] Private source ${source.name} error:`, err);
    return [];
  }
}
```

- [ ] **Step 4: Wire into `searchTenders()` for private entity type**

In `searchTenders()`, when `entityType === 'private'` or `entityType === 'all'` (or `platforms` includes `'PRIVATE'`):
1. Load `private-sources.json` (use `import builtinSources from '@/data/private-sources.json'`)
2. Filter `active: true`
3. Run `scrapePrivateSource()` in parallel for each: `await Promise.allSettled(sources.map(s => scrapePrivateSource(s)))`
4. Merge results into the output array

- [ ] **Step 5: Build check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/data/private-sources.json src/server/services/tender-discovery.ts
git commit -m "feat: add private sector built-in company source list and scraper"
```

---

## Task 4: Custom private sources (DB + tRPC + UI)

**Files:**
- Create: `src/server/routers/private-sources.ts`
- Modify: `src/server/root.ts`

- [ ] **Step 1: Create private-sources tRPC router**

Create `src/server/routers/private-sources.ts`:
```ts
import { z } from 'zod';
import { router, protectedProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import { db } from '@/lib/db';

export const privateSourcesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant.' });
    return db.privateTenderSource.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      url: z.string().url(),
      country: z.string().length(2).default('GR'),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant.' });
      return db.privateTenderSource.create({
        data: { ...input, tenantId: ctx.tenantId },
      });
    }),

  toggle: protectedProcedure
    .input(z.object({ id: z.string(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant.' });
      const source = await db.privateTenderSource.findUnique({ where: { id: input.id } });
      if (!source || source.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      return db.privateTenderSource.update({
        where: { id: input.id },
        data: { active: input.active },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant.' });
      const source = await db.privateTenderSource.findUnique({ where: { id: input.id } });
      if (!source || source.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      return db.privateTenderSource.delete({ where: { id: input.id } });
    }),
});
```

- [ ] **Step 2: Register in `src/server/root.ts`**

Open `src/server/root.ts`. Add import:
```ts
import { privateSourcesRouter } from '@/server/routers/private-sources';
```
Add to the `appRouter` merge object:
```ts
privateSources: privateSourcesRouter,
```

- [ ] **Step 3: Wire custom sources into discovery**

In `searchTenders()` in `tender-discovery.ts`, when `entityType === 'private'` or `'all'`, also query `db.privateTenderSource.findMany({ where: { tenantId: params.tenantId, active: true } })` and run `scrapePrivateSource()` for each result. `tenantId` is already an optional param added in Task 2.

- [ ] **Step 4: Build check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/server/routers/private-sources.ts src/server/root.ts src/server/services/tender-discovery.ts
git commit -m "feat: add custom private tender sources CRUD router"
```

---

## Task 5: Discovery filter bar UI

**Files:**
- Create: `src/components/discovery/filter-bar.tsx`
- Modify: discovery page component

**Important:** Use `trpc` from `@/lib/trpc`, not `api`.

- [ ] **Step 1: Create FilterBar component**

Create `src/components/discovery/filter-bar.tsx`:
```tsx
'use client';

import { Globe, Building2, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type CountryFilter = 'GR' | 'EU' | 'international' | 'all';
export type EntityTypeFilter = 'public' | 'private' | 'all';

interface FilterBarProps {
  country: CountryFilter;
  entityType: EntityTypeFilter;
  relevanceOnly: boolean;
  onCountryChange: (v: CountryFilter) => void;
  onEntityTypeChange: (v: EntityTypeFilter) => void;
  onRelevanceOnlyChange: (v: boolean) => void;
}

const COUNTRY_OPTIONS: { value: CountryFilter; label: string }[] = [
  { value: 'GR', label: 'Ελλάδα' },
  { value: 'EU', label: 'Ευρώπη' },
  { value: 'international', label: 'Διεθνές' },
  { value: 'all', label: 'Όλες' },
];

const ENTITY_OPTIONS: { value: EntityTypeFilter; label: string }[] = [
  { value: 'all', label: 'Όλοι' },
  { value: 'public', label: 'Δημόσιοι' },
  { value: 'private', label: 'Ιδιωτικοί' },
];

export function FilterBar({
  country, entityType, relevanceOnly,
  onCountryChange, onEntityTypeChange, onRelevanceOnlyChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-card/50 p-3">
      <div className="flex items-center gap-1">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground mr-1">Χώρα:</span>
        {COUNTRY_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={country === opt.value ? 'default' : 'ghost'}
            size="sm"
            className="h-7 cursor-pointer px-2 text-xs"
            onClick={() => onCountryChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
      <div className="h-5 w-px bg-border" />
      <div className="flex items-center gap-1">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground mr-1">Φορέας:</span>
        {ENTITY_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={entityType === opt.value ? 'default' : 'ghost'}
            size="sm"
            className="h-7 cursor-pointer px-2 text-xs"
            onClick={() => onEntityTypeChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
      <div className="h-5 w-px bg-border" />
      <div className="flex items-center gap-1">
        <Target className="h-4 w-4 text-muted-foreground" />
        <Button
          variant={relevanceOnly ? 'default' : 'ghost'}
          size="sm"
          className="h-7 cursor-pointer px-2 text-xs"
          onClick={() => onRelevanceOnlyChange(!relevanceOnly)}
        >
          Μόνο ΚΑΔ matching
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire filter bar into discovery page**

Find the discovery page (look in `src/app/(dashboard)/` for a discovery route). Add state and wire to tRPC query using `trpc`:

```tsx
import { trpc } from '@/lib/trpc';
import { FilterBar, type CountryFilter, type EntityTypeFilter } from '@/components/discovery/filter-bar';

const [country, setCountry] = useState<CountryFilter>('GR');
const [entityType, setEntityType] = useState<EntityTypeFilter>('all');
const [relevanceOnly, setRelevanceOnly] = useState(false);

const { data } = trpc.discovery.search.useQuery({
  country, entityType, relevanceOnly,
});
```

Render `<FilterBar>` above the tender list, passing state and setters.

- [ ] **Step 3: Build check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/discovery/filter-bar.tsx
git commit -m "feat: add discovery filter bar (country, entity type, relevance)"
```

---

## Task 6: Language selection

**Files:**
- Create: `src/components/tender/language-modal.tsx`
- Modify: `src/server/routers/ai-roles.ts`
- Modify: `src/server/services/ai-bid-orchestrator.ts`
- Modify: `src/server/services/ai-legal-analyzer.ts`
- Modify: `src/server/services/ai-financial.ts`
- Modify: `src/server/services/ai-technical.ts`
- Modify: all five AI panel/tab files

**Note:** Task 1 added `Tender.analysisLanguage` to the schema. This task must be deployed together with Task 1 — do not deploy Task 1's migration without completing this task in the same deployment.

- [ ] **Step 1: Create LanguageModal component**

Create `src/components/tender/language-modal.tsx`:
```tsx
'use client';

import { Globe } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export type AnalysisLanguage = 'el' | 'en';

interface LanguageModalProps {
  open: boolean;
  onSelect: (lang: AnalysisLanguage) => void;
  onClose: () => void;
}

export function LanguageModal({ open, onSelect, onClose }: LanguageModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Γλώσσα αποτελεσμάτων
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1 h-16 cursor-pointer flex-col gap-1"
            onClick={() => onSelect('el')}
          >
            <span className="text-lg font-semibold">GR</span>
            <span className="text-xs text-muted-foreground">Ελληνικά</span>
          </Button>
          <Button
            variant="outline"
            className="flex-1 h-16 cursor-pointer flex-col gap-1"
            onClick={() => onSelect('en')}
          >
            <span className="text-lg font-semibold">EN</span>
            <span className="text-xs text-muted-foreground">English</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Add `language` param to tRPC AI mutations in ai-roles.ts**

Open `src/server/routers/ai-roles.ts`. For each of these procedures, add `language: z.enum(['el', 'en']).default('el')` to the input schema and pass it to the service call:
- `summarizeTender`
- `goNoGo`
- `extractLegalClauses`
- `extractFinancials`
- `analyzeTechRequirements`

Example change:
```ts
summarizeTender: protectedProcedure
  .input(z.object({
    tenderId: z.string(),
    language: z.enum(['el', 'en']).default('el'),
  }))
  .mutation(async ({ ctx, input }) => {
    await ensureTenderAccess(input.tenderId, ctx.tenantId);
    return aiBidOrchestrator.summarizeTender(input.tenderId, input.language);
  }),
```

- [ ] **Step 3: Add `language` param to each AI service method**

In each service, add `language: 'el' | 'en' = 'el'` to the relevant method signature. Inject into each system prompt:
```ts
const langInstruction = language === 'en'
  ? 'Respond entirely in English.'
  : 'Απάντησε εξ ολοκλήρου στα ελληνικά.';
// Append to the content of the system message role:
content: `${existingSystemContent}\n\n${langInstruction}`,
```

After successful analysis, save language to DB:
```ts
await db.tender.update({
  where: { id: tenderId },
  data: { analysisLanguage: language },
});
```

- [ ] **Step 4: Wire LanguageModal into AI panels**

Read each of the five panel files:
```
src/components/tender/ai-brief-panel.tsx
src/components/tender/go-no-go-panel.tsx
src/components/tender/legal-tab.tsx
src/components/tender/financial-tab.tsx
src/components/tender/technical-tab-enhanced.tsx
```

For each, apply this pattern:

a) Import:
```tsx
import { LanguageModal, type AnalysisLanguage } from './language-modal';
```

b) Add state:
```tsx
const [langModalOpen, setLangModalOpen] = useState(false);
```

c) Replace direct mutation trigger in the analysis button's `onClick` with:
```tsx
onClick={() => setLangModalOpen(true)}
```

d) In the existing mutation call (wherever it currently fires), replace with a new handler:
```tsx
const handleAnalyze = (lang: AnalysisLanguage) => {
  setLangModalOpen(false);
  mutation.mutate({ tenderId, language: lang });
};
```

e) Render the modal at the bottom of JSX:
```tsx
<LanguageModal
  open={langModalOpen}
  onSelect={handleAnalyze}
  onClose={() => setLangModalOpen(false)}
/>
```

- [ ] **Step 5: Pre-populate language from `tender.analysisLanguage`**

In the parent page that fetches the tender, pass `tender.analysisLanguage` to each panel. In each panel, initialize the language preference for display:
```tsx
// If the tender already has a language set, show it next to the button
// This is informational only — the modal still asks each time
```

- [ ] **Step 6: Build check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 7: Run all tests**

```bash
eval "$(fnm env)" && fnm use 22 --arch x64 && npx vitest run
```
Expected: all PASS

- [ ] **Step 8: Commit**

```bash
git add src/components/tender/language-modal.tsx src/server/routers/ai-roles.ts src/server/services/
git commit -m "feat: add language selection (el/en) to all AI analysis"
```

---

## Smoke Test (manual)

1. Discovery filter bar visible with Χώρα / Φορέας / ΚΑΔ matching
2. Switch to "Ιδιωτικοί" → ΔΕΗ/ΕΥΔΑΠ tenders appear (if URL is active)
3. Open a tender with documents → click "Εκτέλεση Ανάλυσης"
4. Language modal appears with GR / EN buttons
5. Select "EN" → brief/gonogo generated in English
6. Re-open the same tender → `analysisLanguage` shows `en` in DB
