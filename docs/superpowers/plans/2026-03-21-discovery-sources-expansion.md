# Discovery Sources Expansion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand tender discovery from 3 working sources (Διαύγεια only returns results) to 16+ sources across Greek public, ΔΕΚΟ, EU, and aggregators — with a source selector sidebar so users choose which sources to search.

**Architecture:** Replace `private-sources.json` with a typed `tender-sources.ts` registry. Add source selector sidebar to discovery UI. Fix ΚΗΜΔΗΣ API (correct endpoint), fix TED to support EU-wide, add ΕΣΗΔΗΣ portal scraping, add 10 ΔΕΚΟ scrapers, add promitheies.gr. Remove dead sources (b2b.gr, eprocurement.gr, ypodomes.com). Pass selected sources from UI → router → service.

**Tech Stack:** Next.js, tRPC, Tailwind CSS, fetch API, cheerio-free HTML regex scraping

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/data/tender-sources.ts` | CREATE | Typed source registry with categories, URLs, defaults |
| `src/data/private-sources.json` | DELETE | Replaced by tender-sources.ts |
| `src/server/services/tender-discovery.ts` | MODIFY | Fix ΚΗΜΔΗΣ, TED; add ΕΣΗΔΗΣ, ΔΕΚΟ, promitheies.gr scrapers; accept `sources` param |
| `src/server/routers/discovery.ts` | MODIFY | Add `sources` to search input schema; add `getSources` query |
| `src/components/discovery/source-selector.tsx` | CREATE | Sidebar checklist grouped by category |
| `src/components/discovery/filter-bar.tsx` | MODIFY | Remove country/entityType filters (replaced by source selector) |
| `src/components/tender/discovery-results.tsx` | MODIFY | Add source selector sidebar layout, pass selected sources to query |

---

### Task 1: Create Source Registry

**Files:**
- Create: `src/data/tender-sources.ts`
- Delete: `src/data/private-sources.json`

- [ ] **Step 1: Create tender-sources.ts with full registry**

```ts
// src/data/tender-sources.ts

export interface TenderSource {
  id: string;
  name: string;
  category: 'public' | 'deko' | 'private' | 'eu' | 'aggregator';
  categoryLabel: string;
  url: string;
  country: 'GR' | 'EU';
  defaultEnabled: boolean;
  supportsCpvFilter: boolean;
}

export const TENDER_SOURCES: TenderSource[] = [
  // ── Δημόσιος Τομέας (API-based) ──────────────────────
  { id: 'kimdis',    name: 'ΚΗΜΔΗΣ',           category: 'public', categoryLabel: 'Δημόσιος Τομέας',   url: 'https://cerpp.eprocurement.gov.gr', country: 'GR', defaultEnabled: true,  supportsCpvFilter: true },
  { id: 'diavgeia',  name: 'Διαύγεια',          category: 'public', categoryLabel: 'Δημόσιος Τομέας',   url: 'https://diavgeia.gov.gr',           country: 'GR', defaultEnabled: true,  supportsCpvFilter: true },
  { id: 'esidis',    name: 'ΕΣΗΔΗΣ',           category: 'public', categoryLabel: 'Δημόσιος Τομέας',   url: 'https://portal.eprocurement.gov.gr', country: 'GR', defaultEnabled: true,  supportsCpvFilter: false },

  // ── ΔΕΚΟ / Δημόσιοι Οργανισμοί ────────────────────────
  { id: 'dei',       name: 'ΔΕΗ',              category: 'deko', categoryLabel: 'ΔΕΚΟ',               url: 'https://eprocurement.dei.gr',        country: 'GR', defaultEnabled: true,  supportsCpvFilter: false },
  { id: 'deddie',    name: 'ΔΕΔΔΗΕ',           category: 'deko', categoryLabel: 'ΔΕΚΟ',               url: 'https://www.deddie.gr/el/tender-notice-common/', country: 'GR', defaultEnabled: true,  supportsCpvFilter: false },
  { id: 'admie',     name: 'ΑΔΜΗΕ',            category: 'deko', categoryLabel: 'ΔΕΚΟ',               url: 'https://www.admie.gr/nea/promitheies', country: 'GR', defaultEnabled: true,  supportsCpvFilter: false },
  { id: 'eydap',     name: 'ΕΥΔΑΠ',            category: 'deko', categoryLabel: 'ΔΕΚΟ',               url: 'https://www.eydap.gr/TheCompany/Contests/ProjectNotices/', country: 'GR', defaultEnabled: true, supportsCpvFilter: false },
  { id: 'eyath',     name: 'ΕΥΑΘ',             category: 'deko', categoryLabel: 'ΔΕΚΟ',               url: 'https://www.eyath.gr/category/prokiryxeis-diagonismoi/', country: 'GR', defaultEnabled: false, supportsCpvFilter: false },
  { id: 'depa',      name: 'ΔΕΠΑ',             category: 'deko', categoryLabel: 'ΔΕΚΟ',               url: 'https://www.depa.gr/prokiryxis/',     country: 'GR', defaultEnabled: false, supportsCpvFilter: false },
  { id: 'ose',       name: 'ΟΣΕ',              category: 'deko', categoryLabel: 'ΔΕΚΟ',               url: 'https://ose.gr/epikoinonia/deltia-tipou/diagonismoi/', country: 'GR', defaultEnabled: false, supportsCpvFilter: false },
  { id: 'oasa',      name: 'ΟΑΣΑ',             category: 'deko', categoryLabel: 'ΔΕΚΟ',               url: 'https://www.oasa.gr/en/procurements/', country: 'GR', defaultEnabled: false, supportsCpvFilter: false },
  { id: 'emetro',    name: 'Ελληνικό Μετρό',    category: 'deko', categoryLabel: 'ΔΕΚΟ',               url: 'https://www.emetro.gr/?page_id=8088&lang=el', country: 'GR', defaultEnabled: false, supportsCpvFilter: false },
  { id: 'ert',       name: 'ΕΡΤ',              category: 'deko', categoryLabel: 'ΔΕΚΟ',               url: 'https://www.ert.gr/diagonismoi/',     country: 'GR', defaultEnabled: false, supportsCpvFilter: false },
  { id: 'efka',      name: 'e-ΕΦΚΑ',           category: 'deko', categoryLabel: 'ΔΕΚΟ',               url: 'https://www.e-efka.gov.gr/el/diagonismoi', country: 'GR', defaultEnabled: false, supportsCpvFilter: false },
  { id: 'cosmote',   name: 'OTE/Cosmote',       category: 'deko', categoryLabel: 'ΔΕΚΟ',               url: 'https://www.cosmote.gr/cs/otegroup/en/prokirixeis_diagonismon.html', country: 'GR', defaultEnabled: false, supportsCpvFilter: false },

  // ── Ευρωπαϊκή Ένωση ──────────────────────────────────
  { id: 'ted_gr',    name: 'TED (Ελλάδα)',      category: 'eu', categoryLabel: 'Ευρωπαϊκή Ένωση',     url: 'https://api.ted.europa.eu',           country: 'GR', defaultEnabled: true,  supportsCpvFilter: true },
  { id: 'ted_eu',    name: 'TED (Όλη η EU)',    category: 'eu', categoryLabel: 'Ευρωπαϊκή Ένωση',     url: 'https://api.ted.europa.eu',           country: 'EU', defaultEnabled: false, supportsCpvFilter: true },

  // ── Aggregators ───────────────────────────────────────
  { id: 'promitheies', name: 'promitheies.gr',  category: 'aggregator', categoryLabel: 'Aggregators',  url: 'https://www.promitheies.gr',          country: 'GR', defaultEnabled: false, supportsCpvFilter: false },
  { id: 'google',   name: 'Google Search',      category: 'aggregator', categoryLabel: 'Aggregators',  url: 'https://www.googleapis.com/customsearch/v1', country: 'GR', defaultEnabled: true,  supportsCpvFilter: true },
];

export const SOURCE_CATEGORIES = [
  { id: 'public',     label: 'Δημόσιος Τομέας',     icon: 'Building2' },
  { id: 'deko',       label: 'ΔΕΚΟ',                 icon: 'Factory' },
  { id: 'eu',         label: 'Ευρωπαϊκή Ένωση',     icon: 'Globe' },
  { id: 'aggregator', label: 'Aggregators',           icon: 'Search' },
] as const;

export function getDefaultEnabledSourceIds(): string[] {
  return TENDER_SOURCES.filter(s => s.defaultEnabled).map(s => s.id);
}

export function getSourceById(id: string): TenderSource | undefined {
  return TENDER_SOURCES.find(s => s.id === id);
}
```

- [ ] **Step 2: Delete private-sources.json**

```bash
git rm src/data/private-sources.json
```

- [ ] **Step 3: Update tender-discovery.ts import**

Replace `import builtinPrivateSources from '@/data/private-sources.json';` with `import { TENDER_SOURCES, getSourceById } from '@/data/tender-sources';`

- [ ] **Step 4: Build and verify no errors**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: replace private-sources.json with typed tender-sources registry"
```

---

### Task 2: Fix ΚΗΜΔΗΣ API (correct endpoint)

**Files:**
- Modify: `src/server/services/tender-discovery.ts` (lines 303-346)

- [ ] **Step 1: Replace ΚΗΜΔΗΣ implementation with correct REST API**

Replace `getLatestFromKIMDIS()` function. The correct API is `POST /khmdhs-opendata/notice` with JSON body, returning JSON notices. Rate limit: 350 req/min.

```ts
async function getLatestFromKIMDIS(cpvCodes?: string[]): Promise<DiscoveredTender[]> {
  try {
    const body: Record<string, any> = {
      size: 20,
      sort: 'publishDate,desc',
    };

    if (cpvCodes && cpvCodes.length > 0) {
      body.cpvCodes = cpvCodes.slice(0, 5).map(c => c.split('-')[0]);
    }

    const res = await fetch(
      'https://cerpp.eprocurement.gov.gr/khmdhs-opendata/notice?page=0',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) {
      console.error(`[KIMDIS] API error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const notices = data.content || data.notices || data.data || [];

    return notices.slice(0, 15).map((n: any) => ({
      title: n.subject || n.title || 'ΚΗΜΔΗΣ Notice',
      referenceNumber: n.referenceNumber || n.ada || n.id || '',
      contractingAuthority: n.organizationName || n.contractingAuthorityName || '',
      platform: 'KIMDIS' as const,
      budget: n.estimatedValue || n.totalAmount ? parseFloat(String(n.estimatedValue || n.totalAmount)) : undefined,
      submissionDeadline: n.submissionDeadline || n.deadline ? new Date(n.submissionDeadline || n.deadline) : undefined,
      cpvCodes: n.cpvCodes || (n.cpv ? [n.cpv] : []),
      sourceUrl: `https://cerpp.eprocurement.gov.gr/kimds2/unprotected/searchNotices.htm?noticeId=${n.referenceNumber || n.id}`,
      summary: n.description || n.subject || undefined,
      publishedAt: n.publishDate ? new Date(n.publishDate) : new Date(),
      country: 'GR',
      sourceLabel: 'ΚΗΜΔΗΣ',
      isPrivate: false,
    }));
  } catch (err) {
    console.error('[KIMDIS] Fetch error:', err);
    return [];
  }
}
```

- [ ] **Step 2: Build and verify**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/server/services/tender-discovery.ts && git commit -m "fix: ΚΗΜΔΗΣ — use correct REST API endpoint POST /khmdhs-opendata/notice"
```

---

### Task 3: Fix TED to support EU-wide search

**Files:**
- Modify: `src/server/services/tender-discovery.ts` (lines 228-295)

- [ ] **Step 1: Add country parameter to TED function**

Change signature to `getLatestFromTED(cpvCodes?: string[], countryFilter?: 'GR' | 'EU')`. When `countryFilter === 'EU'`, omit the `CY=GRC` filter.

```ts
async function getLatestFromTED(cpvCodes?: string[], countryFilter: 'GR' | 'EU' = 'GR'): Promise<DiscoveredTender[]> {
  try {
    let query = 'TD=3';
    if (countryFilter === 'GR') {
      query += ' AND CY=GRC';
    }
    // ... rest of existing code unchanged
```

- [ ] **Step 2: Build and verify**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat: TED — support EU-wide search by omitting country filter"
```

---

### Task 4: Add ΕΣΗΔΗΣ portal scraper + ΔΕΚΟ scrapers

**Files:**
- Modify: `src/server/services/tender-discovery.ts`

- [ ] **Step 1: Add generic DEKO scraper function**

Add a `scrapeDEKOSource()` function that fetches HTML and extracts tender links using the existing `scrapePrivateSource()` pattern but with expanded keyword matching for Greek procurement terms.

```ts
async function scrapeDEKOSource(source: { id: string; name: string; url: string }): Promise<DiscoveredTender[]> {
  try {
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'el,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return [];
    const html = await response.text();

    const results: DiscoveredTender[] = [];
    const linkRegex = /<a[^>]+href="([^"]*)"[^>]*>([^<]{8,300})<\/a>/gi;
    let match: RegExpExecArray | null;

    const tenderKeywords = [
      'διαγωνισμ', 'προκήρυξ', 'προκηρυξ', 'διακήρυξ', 'διακηρυξ',
      'πρόσκληση', 'προσκληση', 'προμήθει', 'προμηθει',
      'δημοπρασ', 'tender', 'rfp', 'rfq', 'procurement',
      'σύμβαση', 'συμβαση', 'ανοικτ', 'ηλεκτρονικ',
    ];

    while ((match = linkRegex.exec(html)) !== null) {
      const [, href, text] = match;
      const lowerText = text.toLowerCase();
      if (tenderKeywords.some(kw => lowerText.includes(kw))) {
        const fullUrl = href.startsWith('http') ? href : new URL(href, source.url).href;
        if (results.length >= 15) break;
        results.push({
          title: text.trim().replace(/\s+/g, ' '),
          referenceNumber: '',
          contractingAuthority: source.name,
          platform: 'PRIVATE',
          cpvCodes: [],
          sourceUrl: fullUrl,
          publishedAt: new Date(),
          country: 'GR',
          sourceLabel: source.name,
          isPrivate: false,
        });
      }
    }

    return results;
  } catch (err) {
    console.warn(`[DEKO] ${source.name} scrape failed:`, (err as Error).message);
    return [];
  }
}
```

- [ ] **Step 2: Add promitheies.gr scraper**

```ts
async function scrapePromitheies(): Promise<DiscoveredTender[]> {
  try {
    const response = await fetch('https://www.promitheies.gr/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'el,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return [];
    const html = await response.text();

    const results: DiscoveredTender[] = [];
    const linkRegex = /<a[^>]+href="([^"]*(?:tender|diagonism|prokiryx)[^"]*)"[^>]*>([^<]{10,300})<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null && results.length < 15) {
      const [, href, text] = match;
      const fullUrl = href.startsWith('http') ? href : `https://www.promitheies.gr${href}`;
      results.push({
        title: text.trim().replace(/\s+/g, ' '),
        referenceNumber: '',
        contractingAuthority: 'promitheies.gr',
        platform: 'PRIVATE',
        cpvCodes: [],
        sourceUrl: fullUrl,
        publishedAt: new Date(),
        country: 'GR',
        sourceLabel: 'promitheies.gr',
        isPrivate: false,
      });
    }

    return results;
  } catch (err) {
    console.warn('[Discovery] promitheies.gr scrape failed:', (err as Error).message);
    return [];
  }
}
```

- [ ] **Step 3: Build and verify**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add ΔΕΚΟ generic scraper + promitheies.gr aggregator"
```

---

### Task 5: Rewrite searchTenders() to use source IDs

**Files:**
- Modify: `src/server/services/tender-discovery.ts` (lines 736-881)

- [ ] **Step 1: Add `sources` parameter to TenderSearchParams**

```ts
export interface TenderSearchParams {
  // ... existing fields ...
  sources?: string[];  // source IDs from TENDER_SOURCES registry
}
```

- [ ] **Step 2: Rewrite searchTenders() to dispatch based on source IDs**

Replace the platform-based dispatching logic with source-ID-based dispatching. When `sources` array is provided, only run fetchers for those specific source IDs. When not provided, use `getDefaultEnabledSourceIds()`.

Key mapping:
- `kimdis` → `getLatestFromKIMDIS(cpvFilter)`
- `diavgeia` → `getLatestFromDiavgeia(cpvFilter)`
- `esidis` → `scrapeDEKOSource(getSourceById('esidis'))`
- `ted_gr` → `getLatestFromTED(cpvFilter, 'GR')`
- `ted_eu` → `getLatestFromTED(cpvFilter, 'EU')`
- `google` → `searchGoogleCustomSearch(keywords, cpvFilter)`
- `promitheies` → `scrapePromitheies()`
- Any DEKO id → `scrapeDEKOSource(getSourceById(id))`

- [ ] **Step 3: Remove dead sources** — remove `searchPrivateSector()` function (b2b.gr, eprocurement.gr, ypodomes.com are dead)

- [ ] **Step 4: Build and verify**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat: searchTenders dispatches by source IDs instead of platform enum"
```

---

### Task 6: Add getSources query + update search input in router

**Files:**
- Modify: `src/server/routers/discovery.ts`

- [ ] **Step 1: Add getSources query**

```ts
import { TENDER_SOURCES, SOURCE_CATEGORIES } from '@/data/tender-sources';

// Add before discoveryRouter:
getSources: protectedProcedure.query(() => {
  return {
    sources: TENDER_SOURCES,
    categories: SOURCE_CATEGORIES,
  };
}),
```

- [ ] **Step 2: Add `sources` to search input schema**

Add `sources: z.array(z.string()).optional()` to the search input object. Pass it through to `tenderDiscovery.searchTenders()`.

- [ ] **Step 3: Build and verify**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add getSources query + sources param in search input"
```

---

### Task 7: Create Source Selector Sidebar Component

**Files:**
- Create: `src/components/discovery/source-selector.tsx`

- [ ] **Step 1: Create source-selector.tsx**

Collapsible sidebar with checkboxes grouped by category. Each category has a header with select-all toggle. Individual sources have checkboxes. Bottom has budget min/max inputs and a "Αναζήτηση" button.

```tsx
'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Factory, Globe, Search,
  ChevronDown, ChevronRight, Loader2,
} from 'lucide-react';
import type { TenderSource } from '@/data/tender-sources';

const categoryIcons: Record<string, React.ReactNode> = {
  public: <Building2 className="h-4 w-4" />,
  deko: <Factory className="h-4 w-4" />,
  eu: <Globe className="h-4 w-4" />,
  aggregator: <Search className="h-4 w-4" />,
};

interface SourceSelectorProps {
  sources: TenderSource[];
  categories: readonly { id: string; label: string }[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onSearch: () => void;
  isLoading: boolean;
  minBudget: string;
  maxBudget: string;
  onMinBudgetChange: (v: string) => void;
  onMaxBudgetChange: (v: string) => void;
}

export function SourceSelector({
  sources, categories, selectedIds, onSelectionChange,
  onSearch, isLoading,
  minBudget, maxBudget, onMinBudgetChange, onMaxBudgetChange,
}: SourceSelectorProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleSource = (id: string) => {
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter(s => s !== id)
        : [...selectedIds, id]
    );
  };

  const toggleCategory = (categoryId: string) => {
    const catSourceIds = sources.filter(s => s.category === categoryId).map(s => s.id);
    const allSelected = catSourceIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      onSelectionChange(selectedIds.filter(id => !catSourceIds.includes(id)));
    } else {
      onSelectionChange([...new Set([...selectedIds, ...catSourceIds])]);
    }
  };

  const selectAll = () => {
    onSelectionChange(sources.map(s => s.id));
  };

  const selectNone = () => {
    onSelectionChange([]);
  };

  return (
    <div className="w-64 shrink-0 space-y-4">
      <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Πηγές Αναζήτησης</h3>
          <Badge variant="outline" className="text-[10px]">
            {selectedIds.length}/{sources.length}
          </Badge>
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="h-6 text-[10px] cursor-pointer" onClick={selectAll}>
            Όλες
          </Button>
          <Button variant="ghost" size="sm" className="h-6 text-[10px] cursor-pointer" onClick={selectNone}>
            Καμία
          </Button>
        </div>

        {categories.map(cat => {
          const catSources = sources.filter(s => s.category === cat.id);
          const selectedCount = catSources.filter(s => selectedIds.includes(s.id)).length;
          const isCollapsed = collapsed[cat.id] ?? false;

          return (
            <div key={cat.id}>
              <button
                onClick={() => setCollapsed(p => ({ ...p, [cat.id]: !p[cat.id] }))}
                className="flex items-center gap-2 w-full text-left cursor-pointer hover:bg-muted/30 rounded px-1 py-1 transition-colors"
              >
                {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {categoryIcons[cat.id]}
                <span className="text-xs font-medium flex-1">{cat.label}</span>
                <span className="text-[10px] text-muted-foreground">{selectedCount}/{catSources.length}</span>
              </button>

              {!isCollapsed && (
                <div className="ml-5 mt-1 space-y-1">
                  <button
                    onClick={() => toggleCategory(cat.id)}
                    className="text-[10px] text-blue-500 hover:text-blue-400 cursor-pointer"
                  >
                    {selectedCount === catSources.length ? 'Αποεπιλογή όλων' : 'Επιλογή όλων'}
                  </button>
                  {catSources.map(source => (
                    <label key={source.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/20 rounded px-1 py-0.5">
                      <Checkbox
                        checked={selectedIds.includes(source.id)}
                        onCheckedChange={() => toggleSource(source.id)}
                        className="h-3.5 w-3.5"
                      />
                      <span className="text-xs">{source.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Budget filters */}
        <div className="border-t border-border/30 pt-3 space-y-2">
          <Label className="text-xs text-muted-foreground">Προϋπολογισμός (€)</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Από"
              value={minBudget}
              onChange={e => onMinBudgetChange(e.target.value)}
              className="h-7 text-xs"
              type="number"
            />
            <Input
              placeholder="Έως"
              value={maxBudget}
              onChange={e => onMaxBudgetChange(e.target.value)}
              className="h-7 text-xs"
              type="number"
            />
          </div>
        </div>

        {/* Search button */}
        <Button
          onClick={onSearch}
          disabled={isLoading || selectedIds.length === 0}
          className="w-full cursor-pointer gap-2"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Αναζήτηση
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build and verify**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add SourceSelector sidebar component"
```

---

### Task 8: Integrate Source Selector into Discovery Results

**Files:**
- Modify: `src/components/tender/discovery-results.tsx`
- Modify: `src/components/discovery/filter-bar.tsx`

- [ ] **Step 1: Update DiscoveryResults to use source selector**

Major changes:
- Import `SourceSelector` and `TENDER_SOURCES`/`SOURCE_CATEGORIES` from data
- Replace `trpc.discovery.search.useQuery()` with a manual query triggered by search button
- Add sidebar layout: flex row with SourceSelector on left, results on right
- Remove the old FilterBar (country/entityType handled by source selection)
- State: `selectedSources`, `minBudget`, `maxBudget`, `hasSearched`
- On search click: call `trpc.discovery.search.useQuery({ sources: selectedSources, minBudget, maxBudget })`

Key layout change:
```tsx
<div className="flex gap-6">
  <SourceSelector ... />
  <div className="flex-1 space-y-4">
    {/* Search bar + results */}
  </div>
</div>
```

- [ ] **Step 2: Remove old FilterBar import** (keep the file for now but remove from discovery-results)

- [ ] **Step 3: Build and verify**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat: integrate source selector sidebar into discovery UI"
```

---

### Task 9: Final integration + cleanup + push

**Files:**
- All modified files

- [ ] **Step 1: Full build test**

Run: `npm run build`
Expected: Clean build, no errors

- [ ] **Step 2: Test on dev server**

Run: `npm run dev`
Open: `http://localhost:3000/tenders/new`
Verify:
- Source selector sidebar appears with all categories
- Checkboxes work (select/deselect)
- Search button triggers query with selected sources
- Results appear from multiple sources (not just Διαύγεια)
- Budget filters work

- [ ] **Step 3: Commit final cleanup**

```bash
git add -A && git commit -m "feat: complete discovery sources expansion — 16+ sources with source selector UI"
```

- [ ] **Step 4: Push to GitHub**

```bash
git push origin main
```
