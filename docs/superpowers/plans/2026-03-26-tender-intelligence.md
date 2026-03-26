# Tender Intelligence Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Intelligence panel to the tender Overview tab that fetches similar award data from ΔΙΑΥΓΕΙΑ/ΚΗΜΔΗΣ + own history, shows competitors, authority profile, repeat detection, prep time estimate, and AI advisory.

**Architecture:** New Prisma model `TenderIntelligence` caches results. New service `ai-tender-intelligence.ts` fetches from external APIs (reusing patterns from `tender-discovery.ts`) and own `TenderOutcome` data, then calls AI for advisory synthesis. Panel component renders in the Overview tab grid.

**Tech Stack:** Prisma, tRPC, ΔΙΑΥΓΕΙΑ LUMINAPI, ΚΗΜΔΗΣ OpenData API, Gemini AI (via `ai()` provider), React, motion/react, lucide-react.

**Spec:** `docs/superpowers/specs/2026-03-26-tender-intelligence-design.md`

---

### Task 1: Prisma Schema — Add TenderIntelligence Model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add TenderIntelligence model**

In `prisma/schema.prisma`, after the `EvaluationCriterion` model (before `// ─── Activity Log`), add:

```prisma
// ─── Tender Intelligence ────────────────────────────────────

model TenderIntelligence {
  id        String   @id @default(cuid())
  tenderId  String   @unique
  tender    Tender   @relation(fields: [tenderId], references: [id], onDelete: Cascade)

  similarAwards    Json?
  competitors      Json?
  authorityProfile Json?
  repeatTender     Json?
  prepTimeEstimate Json?
  aiAdvisory       Json?

  language   String    @default("el")
  fetchedAt  DateTime  @default(now())

  @@index([tenderId])
}
```

- [ ] **Step 2: Add relation to Tender model**

In the Tender model, after `evaluationCriteria EvaluationCriterion[]`, add:

```prisma
  // Tender Intelligence
  intelligence TenderIntelligence?
```

- [ ] **Step 3: Push schema and generate client**

Run:
```bash
npx prisma db push
```

Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(intelligence): add TenderIntelligence model"
```

---

### Task 2: Award Fetcher — External Data Functions

**Files:**
- Create: `src/server/services/award-fetcher.ts`

- [ ] **Step 1: Create the award fetcher service**

Create `src/server/services/award-fetcher.ts`:

```typescript
/**
 * Award Fetcher — fetches award/κατακύρωση data from ΔΙΑΥΓΕΙΑ and ΚΗΜΔΗΣ.
 * Separate from tender-discovery.ts which fetches NEW procurement notices.
 * This fetches PAST award decisions for intelligence/analytics.
 */

// ─── Types ──────────────────────────────────────────────

export interface AwardResult {
  title: string;
  winner: string;
  amount: number | null;
  authority: string;
  date: Date;
  cpvCodes: string[];
  source: 'DIAVGEIA' | 'KIMDIS';
  sourceUrl: string;
  budgetAmount?: number | null;
  numberOfBids?: number | null;
}

// ─── Safe date helper ───────────────────────────────────

function safeDate(value: unknown): Date {
  if (!value) return new Date();
  const d = new Date(String(value).split('+')[0]);
  return isNaN(d.getTime()) ? new Date() : d;
}

// ─── ΔΙΑΥΓΕΙΑ: Award decisions ──────────────────────────

export async function fetchDiavgeiaAwards(
  cpvCodes: string[],
  authority?: string,
): Promise<AwardResult[]> {
  const results: AwardResult[] = [];
  const searchTerms = ['ΚΑΤΑΚΥΡΩΣΗ', 'ΑΝΑΘΕΣΗ'];
  const cpvKeywords = cpvCodes.slice(0, 3).map((c) => c.split('-')[0]);

  for (const term of searchTerms) {
    try {
      const params = new URLSearchParams({
        subject: term,
        size: '100',
        page: '0',
      });
      if (cpvKeywords.length > 0) {
        params.set('q', cpvKeywords.join(' OR '));
      }
      if (authority) {
        params.set('organizationLabel', authority);
      }

      const res = await fetch(
        `https://diavgeia.gov.gr/luminapi/opendata/search?${params.toString()}`,
        {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(10000),
        },
      );

      if (!res.ok) continue;
      const data = await res.json();
      if (!data.decisions) continue;

      for (const d of data.decisions) {
        if (!d.ada) continue;
        const subject = (d.subject || '').toLowerCase();
        // Skip payment orders and irrelevant decisions
        if (subject.includes('εντολή πληρωμής') || subject.includes('χρηματικό ένταλμα')) continue;

        // Extract winner and amount from decision text/metadata
        const winner = extractWinnerFromDecision(d);
        const amount = d.amount?.amount ?? d.extraFieldValues?.awardAmount?.amount ?? null;

        if (winner || amount) {
          results.push({
            title: d.subject || '',
            winner: winner || 'Δεν αναφέρεται',
            amount: amount ? Number(amount) : null,
            authority: d.organizationLabel || d.organization?.label || '',
            date: safeDate(d.submissionTimestamp || d.issueDate),
            cpvCodes: cpvKeywords,
            source: 'DIAVGEIA',
            sourceUrl: `https://diavgeia.gov.gr/decision/view/${d.ada}`,
            budgetAmount: d.extraFieldValues?.estimatedAmount?.amount ?? null,
            numberOfBids: null,
          });
        }
      }
    } catch {
      // Continue with other search terms
    }
  }

  // Deduplicate by ADA-derived URL
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.sourceUrl)) return false;
    seen.add(r.sourceUrl);
    return true;
  });
}

function extractWinnerFromDecision(decision: any): string | null {
  // Try structured fields first
  if (decision.extraFieldValues?.contractorName) {
    return decision.extraFieldValues.contractorName;
  }
  if (decision.extraFieldValues?.awardee?.name) {
    return decision.extraFieldValues.awardee.name;
  }
  // Try signers
  if (decision.signers && decision.signers.length > 0) {
    // Signers are usually the authority, not the winner — skip
  }
  return null;
}

// ─── ΚΗΜΔΗΣ: Award notices ──────────────────────────────

export async function fetchKimdisAwards(
  cpvCodes: string[],
  authority?: string,
): Promise<AwardResult[]> {
  try {
    const body: Record<string, any> = {
      noticeType: ['AWARD'], // Only award notices
    };
    if (cpvCodes.length > 0) {
      body.cpvCodes = cpvCodes.slice(0, 5).map((c) => c.split('-')[0]);
    }
    if (authority) {
      body.organizationName = authority;
    }

    const res = await fetch(
      'https://cerpp.eprocurement.gov.gr/khmdhs-opendata/notice?page=0&size=100',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!res.ok) return [];
    const data = await res.json();
    const notices = data.content || data.notices || data.data || [];

    return notices
      .filter((n: any) => n.contractorName || n.totalCostWithoutVAT)
      .slice(0, 100)
      .map((n: any): AwardResult => {
        const cpvs: string[] = [];
        if (Array.isArray(n.objectDetails)) {
          for (const obj of n.objectDetails) {
            if (Array.isArray(obj.cpvs)) {
              for (const cpv of obj.cpvs) {
                if (cpv.key && !cpvs.includes(cpv.key)) cpvs.push(cpv.key);
              }
            }
          }
        }
        return {
          title: n.title || n.subject || '',
          winner: n.contractorName || n.awardee?.name || 'Δεν αναφέρεται',
          amount: n.totalCostWithoutVAT ?? n.totalCostWithVAT ?? null,
          authority: n.organization?.value || '',
          date: safeDate(n.submissionDate || n.publicationDate),
          cpvCodes: cpvs,
          source: 'KIMDIS',
          sourceUrl: `https://cerpp.eprocurement.gov.gr/kimds2/unprotected/searchNotices.htm?noticeId=${n.referenceNumber || ''}`,
          budgetAmount: n.estimatedValue ?? null,
          numberOfBids: n.numberOfTenders ?? n.numberOfBids ?? null,
        };
      });
  } catch {
    return [];
  }
}

// ─── Combined fetch ─────────────────────────────────────

export async function fetchAllAwards(
  cpvCodes: string[],
  authority?: string,
): Promise<AwardResult[]> {
  const [diavgeia, kimdis] = await Promise.all([
    fetchDiavgeiaAwards(cpvCodes, authority),
    fetchKimdisAwards(cpvCodes, authority),
  ]);
  return [...diavgeia, ...kimdis].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -i "award-fetcher" | head -10
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/services/award-fetcher.ts
git commit -m "feat(intelligence): add award fetcher for ΔΙΑΥΓΕΙΑ and ΚΗΜΔΗΣ"
```

---

### Task 3: Intelligence Service — `ai-tender-intelligence.ts`

**Files:**
- Create: `src/server/services/ai-tender-intelligence.ts`

- [ ] **Step 1: Create the intelligence service**

Create `src/server/services/ai-tender-intelligence.ts`:

```typescript
import { db } from '@/lib/db';
import { ai, logTokenUsage } from '@/server/ai';
import { parseAIResponse } from './ai-prompts';
import { fetchAllAwards, type AwardResult } from './award-fetcher';

// ─── Types ──────────────────────────────────────────────

interface CompetitorProfile {
  name: string;
  wins: number;
  avgAmount: number | null;
  avgDiscount: number | null;
}

interface AuthorityProfile {
  totalTenders: number;
  cancellationRate: number | null;
  avgDiscount: number | null;
  avgBidders: number | null;
  topWinners: Array<{ name: string; wins: number }>;
}

interface RepeatTenderInfo {
  found: boolean;
  previousWinner?: string;
  previousAmount?: number;
  previousDate?: string;
  sourceUrl?: string;
}

interface PrepTimeEstimate {
  avgDays: number | null;
  currentDaysLeft: number;
  isTight: boolean;
}

interface IntelligenceResult {
  similarAwards: AwardResult[];
  competitors: CompetitorProfile[];
  authorityProfile: AuthorityProfile;
  repeatTender: RepeatTenderInfo;
  prepTimeEstimate: PrepTimeEstimate;
  aiAdvisory: { bullets: string[] };
}

// ─── Prompts ────────────────────────────────────────────

const SYSTEM_PROMPT_EL = `Είσαι σύμβουλος δημοσίων διαγωνισμών. Ανάλυσε τα δεδομένα αγοράς και δώσε 3-5 πρακτικές συμβουλές.

Κάθε συμβουλή πρέπει να είναι:
- Συγκεκριμένη (αριθμοί, ποσοστά, ονόματα)
- Actionable (τι να κάνει ο χρήστης)
- Βασισμένη στα δεδομένα (όχι γενικές συμβουλές)

Θέματα να καλύψεις:
1. Τιμολογιακή στρατηγική (βάσει τιμών κατακύρωσης)
2. Ανταγωνισμός (ποιος κερδίζει και γιατί)
3. Κίνδυνοι (ακυρώσεις, αξιοπιστία αναθέτουσας)
4. Μαθήματα από δική σου ιστορία (αν υπάρχει)
5. Χρόνος προετοιμασίας (αν είναι πιεσμένο)

Απάντησε ΜΟΝΟ σε JSON: { "bullets": ["...", "...", "..."] }`;

const SYSTEM_PROMPT_EN = `You are a public procurement advisor. Analyze the market data and give 3-5 practical recommendations.

Each recommendation must be:
- Specific (numbers, percentages, names)
- Actionable (what the user should do)
- Data-driven (not generic advice)

Topics to cover:
1. Pricing strategy (based on award prices)
2. Competition (who wins and why)
3. Risks (cancellations, authority reliability)
4. Lessons from own history (if available)
5. Preparation time (if tight)

Respond ONLY in JSON: { "bullets": ["...", "...", "..."] }`;

// ─── Service ────────────────────────────────────────────

class TenderIntelligenceService {
  async generateIntelligence(
    tenderId: string,
    tenantId: string,
    language: 'el' | 'en' = 'el',
  ): Promise<IntelligenceResult> {
    // 1. Load tender
    const tender = await db.tender.findUniqueOrThrow({
      where: { id: tenderId },
      select: {
        id: true,
        title: true,
        cpvCodes: true,
        budget: true,
        contractingAuthority: true,
        submissionDeadline: true,
        createdAt: true,
      },
    });

    // 2. Fetch external awards (ΔΙΑΥΓΕΙΑ + ΚΗΜΔΗΣ) by CPV
    const allAwards = tender.cpvCodes.length > 0
      ? await fetchAllAwards(tender.cpvCodes, undefined)
      : [];

    // 3. Filter by budget range (±50%) if budget exists
    const similarAwards = tender.budget
      ? allAwards.filter((a) =>
          a.amount == null ||
          (a.amount >= tender.budget! * 0.5 && a.amount <= tender.budget! * 1.5),
        )
      : allAwards;

    // 4. Build competitor profiles
    const competitorMap = new Map<string, { wins: number; amounts: number[] }>();
    for (const award of similarAwards) {
      if (!award.winner || award.winner === 'Δεν αναφέρεται') continue;
      const existing = competitorMap.get(award.winner) || { wins: 0, amounts: [] };
      existing.wins++;
      if (award.amount != null) existing.amounts.push(award.amount);
      competitorMap.set(award.winner, existing);
    }
    const competitors: CompetitorProfile[] = Array.from(competitorMap.entries())
      .map(([name, data]) => ({
        name,
        wins: data.wins,
        avgAmount: data.amounts.length > 0
          ? Math.round(data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length)
          : null,
        avgDiscount: tender.budget && data.amounts.length > 0
          ? Math.round(
              ((tender.budget - data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length) /
                tender.budget) * 100,
            )
          : null,
      }))
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 10);

    // 5. Authority profile — filter awards by this authority
    const authorityAwards = tender.contractingAuthority
      ? allAwards.filter(
          (a) =>
            a.authority &&
            a.authority.toLowerCase().includes(tender.contractingAuthority!.toLowerCase().slice(0, 20)),
        )
      : [];
    const authorityProfile: AuthorityProfile = {
      totalTenders: authorityAwards.length,
      cancellationRate: null, // Would need cancelled tenders data
      avgDiscount:
        tender.budget && authorityAwards.length > 0
          ? Math.round(
              ((tender.budget -
                authorityAwards
                  .filter((a) => a.amount != null)
                  .reduce((sum, a) => sum + a.amount!, 0) /
                  authorityAwards.filter((a) => a.amount != null).length) /
                tender.budget) * 100,
            )
          : null,
      avgBidders:
        authorityAwards.filter((a) => a.numberOfBids != null).length > 0
          ? Math.round(
              authorityAwards
                .filter((a) => a.numberOfBids != null)
                .reduce((sum, a) => sum + a.numberOfBids!, 0) /
                authorityAwards.filter((a) => a.numberOfBids != null).length,
            )
          : null,
      topWinners: Array.from(
        authorityAwards
          .filter((a) => a.winner && a.winner !== 'Δεν αναφέρεται')
          .reduce((map, a) => {
            map.set(a.winner, (map.get(a.winner) || 0) + 1);
            return map;
          }, new Map<string, number>()),
      )
        .map(([name, wins]) => ({ name, wins }))
        .sort((a, b) => b.wins - a.wins)
        .slice(0, 5),
    };

    // 6. Repeat tender detection
    const repeatTender = this.detectRepeat(tender, similarAwards);

    // 7. Prep time estimate from own history
    const prepTimeEstimate = await this.estimatePrepTime(tender, tenantId);

    // 8. Own history
    const ownOutcomes = await db.tenderOutcome.findMany({
      where: { tenantId },
      include: { tender: { select: { cpvCodes: true, title: true, budget: true } } },
    });
    const ownSimilar = ownOutcomes.filter((o) =>
      o.tender.cpvCodes.some((c) => tender.cpvCodes.includes(c)),
    );

    // 9. AI advisory
    const aiAdvisory = await this.getAdvisory(
      tender,
      similarAwards.slice(0, 20),
      competitors.slice(0, 5),
      authorityProfile,
      repeatTender,
      prepTimeEstimate,
      ownSimilar,
      language,
    );

    // 10. Cache results
    await db.tenderIntelligence.upsert({
      where: { tenderId },
      create: {
        tenderId,
        similarAwards: JSON.parse(JSON.stringify(similarAwards.slice(0, 50))),
        competitors: competitors as any,
        authorityProfile: authorityProfile as any,
        repeatTender: repeatTender as any,
        prepTimeEstimate: prepTimeEstimate as any,
        aiAdvisory: aiAdvisory as any,
        language,
      },
      update: {
        similarAwards: JSON.parse(JSON.stringify(similarAwards.slice(0, 50))),
        competitors: competitors as any,
        authorityProfile: authorityProfile as any,
        repeatTender: repeatTender as any,
        prepTimeEstimate: prepTimeEstimate as any,
        aiAdvisory: aiAdvisory as any,
        language,
        fetchedAt: new Date(),
      },
    });

    return {
      similarAwards: similarAwards.slice(0, 50),
      competitors,
      authorityProfile,
      repeatTender,
      prepTimeEstimate,
      aiAdvisory,
    };
  }

  private detectRepeat(
    tender: { title: string; cpvCodes: string[]; contractingAuthority: string | null; budget: number | null },
    awards: AwardResult[],
  ): RepeatTenderInfo {
    if (!tender.contractingAuthority) return { found: false };

    // Look for same authority + similar title keywords
    const titleWords = tender.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4);

    for (const award of awards) {
      const sameAuthority =
        award.authority.toLowerCase().includes(tender.contractingAuthority.toLowerCase().slice(0, 20));
      if (!sameAuthority) continue;

      const awardWords = award.title.toLowerCase().split(/\s+/);
      const matchCount = titleWords.filter((w) => awardWords.some((aw) => aw.includes(w))).length;
      const matchRatio = titleWords.length > 0 ? matchCount / titleWords.length : 0;

      if (matchRatio >= 0.4) {
        return {
          found: true,
          previousWinner: award.winner,
          previousAmount: award.amount ?? undefined,
          previousDate: award.date.toISOString().slice(0, 10),
          sourceUrl: award.sourceUrl,
        };
      }
    }
    return { found: false };
  }

  private async estimatePrepTime(
    tender: { submissionDeadline: Date | null; cpvCodes: string[]; createdAt: Date },
    tenantId: string,
  ): Promise<PrepTimeEstimate> {
    const daysLeft = tender.submissionDeadline
      ? Math.max(0, Math.ceil((tender.submissionDeadline.getTime() - Date.now()) / 86400000))
      : 30;

    // Find own tenders with same CPV that have outcomes
    const ownTenders = await db.tender.findMany({
      where: {
        tenantId,
        cpvCodes: { hasSome: tender.cpvCodes },
        status: { in: ['SUBMITTED', 'WON', 'LOST'] },
        submissionDeadline: { not: null },
      },
      select: { createdAt: true, submissionDeadline: true },
    });

    if (ownTenders.length === 0) {
      return { avgDays: null, currentDaysLeft: daysLeft, isTight: daysLeft < 14 };
    }

    const prepDays = ownTenders.map((t) => {
      const days = Math.ceil(
        (t.submissionDeadline!.getTime() - t.createdAt.getTime()) / 86400000,
      );
      return Math.max(1, days);
    });
    const avgDays = Math.round(prepDays.reduce((a, b) => a + b, 0) / prepDays.length);

    return {
      avgDays,
      currentDaysLeft: daysLeft,
      isTight: daysLeft < avgDays,
    };
  }

  private async getAdvisory(
    tender: any,
    awards: AwardResult[],
    competitors: CompetitorProfile[],
    authority: AuthorityProfile,
    repeat: RepeatTenderInfo,
    prepTime: PrepTimeEstimate,
    ownHistory: any[],
    language: 'el' | 'en',
  ): Promise<{ bullets: string[] }> {
    const context: string[] = [];
    context.push(`Τρέχων διαγωνισμός: ${tender.title}`);
    if (tender.budget) context.push(`Προϋπολογισμός: €${tender.budget.toLocaleString('el-GR')}`);
    if (tender.contractingAuthority) context.push(`Αναθέτουσα: ${tender.contractingAuthority}`);

    if (awards.length > 0) {
      const amounts = awards.filter((a) => a.amount).map((a) => a.amount!);
      if (amounts.length > 0) {
        const avg = Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length);
        const min = Math.min(...amounts);
        const max = Math.max(...amounts);
        context.push(`\nΑγορά: ${awards.length} παρόμοιες κατακυρώσεις`);
        context.push(`Μέση τιμή: €${avg.toLocaleString('el-GR')}, Εύρος: €${min.toLocaleString('el-GR')} - €${max.toLocaleString('el-GR')}`);
      }
    }

    if (competitors.length > 0) {
      context.push(`\nΑνταγωνισμός:`);
      for (const c of competitors.slice(0, 5)) {
        context.push(`- ${c.name}: ${c.wins} νίκες${c.avgAmount ? `, μέση τιμή €${c.avgAmount.toLocaleString('el-GR')}` : ''}`);
      }
    }

    if (authority.totalTenders > 0) {
      context.push(`\nΑναθέτουσα αρχή: ${authority.totalTenders} διαγωνισμοί`);
      if (authority.avgBidders) context.push(`Μέσος αριθμός προσφορών: ${authority.avgBidders}`);
    }

    if (repeat.found) {
      context.push(`\nΕπαναληπτικός: Προηγούμενος νικητής ${repeat.previousWinner}${repeat.previousAmount ? ` στα €${repeat.previousAmount.toLocaleString('el-GR')}` : ''}`);
    }

    if (prepTime.avgDays != null) {
      context.push(`\nΧρόνος: ${prepTime.currentDaysLeft} εργάσιμες διαθέσιμες, μέσος χρόνος σε παρόμοιους: ${prepTime.avgDays} ημέρες`);
    }

    if (ownHistory.length > 0) {
      const won = ownHistory.filter((o) => o.outcome === 'won').length;
      const lost = ownHistory.filter((o) => o.outcome === 'lost').length;
      context.push(`\nΔικό σου ιστορικό: ${won} νίκες, ${lost} ήττες σε παρόμοιους CPV`);
      for (const o of ownHistory.slice(0, 3)) {
        if (o.reason) context.push(`- ${o.outcome}: ${o.reason}`);
      }
    }

    try {
      const systemPrompt = language === 'el' ? SYSTEM_PROMPT_EL : SYSTEM_PROMPT_EN;
      const result = await ai().complete({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: context.join('\n') },
        ],
        maxTokens: 2000,
        temperature: 0.3,
        responseFormat: 'json',
      });

      await logTokenUsage(tender.id, 'intelligence_advisory', {
        input: result.inputTokens || 0,
        output: result.outputTokens || 0,
        total: result.totalTokens || 0,
      });

      return parseAIResponse<{ bullets: string[] }>(result.content, ['bullets'], 'intelligence');
    } catch {
      return { bullets: [] };
    }
  }
}

export const tenderIntelligence = new TenderIntelligenceService();
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -i "intelligence" | head -10
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/services/ai-tender-intelligence.ts
git commit -m "feat(intelligence): add tender intelligence service with AI advisory"
```

---

### Task 4: tRPC Endpoints

**Files:**
- Modify: `src/server/routers/ai-roles.ts`

- [ ] **Step 1: Add import**

In `src/server/routers/ai-roles.ts`, after the `aiCriteriaAnalyzer` import, add:

```typescript
import { tenderIntelligence } from '@/server/services/ai-tender-intelligence';
```

- [ ] **Step 2: Add endpoints**

Before the closing `});` of the router, add:

```typescript
  // ─── Tender Intelligence ──────────────────────────────────

  getIntelligence: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      const cached = await db.tenderIntelligence.findUnique({
        where: { tenderId: input.tenderId },
      });
      return cached;
    }),

  generateIntelligence: protectedProcedure
    .input(z.object({ tenderId: z.string(), language: z.enum(['el', 'en']).default('el') }))
    .mutation(async ({ ctx, input }) => {
      const { tenantId } = await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return tenderIntelligence.generateIntelligence(input.tenderId, tenantId, input.language);
    }),
```

- [ ] **Step 3: Verify and commit**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -i "ai-roles" | head -5
```

```bash
git add src/server/routers/ai-roles.ts
git commit -m "feat(intelligence): add tRPC endpoints"
```

---

### Task 5: i18n Translation Keys

**Files:**
- Modify: `messages/el.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Add Greek keys**

In `messages/el.json`, after the `"criteria"` section closing `}`, add:

```json
  "intelligence": {
    "title": "Intelligence",
    "analyze": "Ανάλυση Αγοράς",
    "analyzing": "Ανάλυση αγοράς...",
    "refresh": "Ανανέωση",
    "noData": "Δεν βρέθηκαν παρόμοιοι διαγωνισμοί",
    "similarFound": "{{count}} παρόμοιοι διαγωνισμοί",
    "marketOverview": "Αγορά",
    "avgAwardPrice": "Μέση τιμή κατακύρωσης",
    "priceRange": "Εύρος τιμών",
    "competitors": "Ανταγωνισμός",
    "wins": "νίκες",
    "avgPrice": "μέση τιμή",
    "authorityProfile": "Προφίλ Αναθέτουσας",
    "totalTenders": "Διαγωνισμοί (2 έτη)",
    "cancellationRate": "Ακυρώσεις",
    "avgDiscount": "Μέση έκπτωση",
    "avgBidders": "Μέσος αριθμός προσφορών",
    "repeatAlert": "Επαναληπτικός Διαγωνισμός",
    "previousWinner": "Προηγούμενος νικητής",
    "previousPrice": "Προηγούμενη τιμή",
    "prepTime": "Χρόνος Προετοιμασίας",
    "avgPrepDays": "Μέσος χρόνος σε παρόμοιους",
    "daysAvailable": "Διαθέσιμες εργάσιμες",
    "tight": "Πιεσμένο",
    "comfortable": "Άνετο",
    "aiAdvisory": "AI Συμβουλές",
    "yourHistory": "Δικό σου ιστορικό",
    "winRate": "Win rate",
    "submissions": "υποβολές",
    "errorAnalysis": "Σφάλμα ανάλυσης αγοράς",
    "cachedAt": "Τελευταία ανανέωση"
  }
```

- [ ] **Step 2: Add English keys**

In `messages/en.json`, after `"criteria"` section, add:

```json
  "intelligence": {
    "title": "Intelligence",
    "analyze": "Market Analysis",
    "analyzing": "Analyzing market...",
    "refresh": "Refresh",
    "noData": "No similar tenders found",
    "similarFound": "{{count}} similar tenders",
    "marketOverview": "Market",
    "avgAwardPrice": "Avg. award price",
    "priceRange": "Price range",
    "competitors": "Competition",
    "wins": "wins",
    "avgPrice": "avg. price",
    "authorityProfile": "Authority Profile",
    "totalTenders": "Tenders (2 years)",
    "cancellationRate": "Cancellations",
    "avgDiscount": "Avg. discount",
    "avgBidders": "Avg. number of bids",
    "repeatAlert": "Repeat Tender",
    "previousWinner": "Previous winner",
    "previousPrice": "Previous price",
    "prepTime": "Preparation Time",
    "avgPrepDays": "Avg. time on similar",
    "daysAvailable": "Working days available",
    "tight": "Tight",
    "comfortable": "Comfortable",
    "aiAdvisory": "AI Advisory",
    "yourHistory": "Your history",
    "winRate": "Win rate",
    "submissions": "submissions",
    "errorAnalysis": "Market analysis error",
    "cachedAt": "Last updated"
  }
```

- [ ] **Step 3: Commit**

```bash
git add messages/el.json messages/en.json
git commit -m "feat(intelligence): add i18n translation keys"
```

---

### Task 6: UI Component — `intelligence-panel.tsx`

**Files:**
- Create: `src/components/tender/intelligence-panel.tsx`

- [ ] **Step 1: Create the Intelligence Panel component**

Create `src/components/tender/intelligence-panel.tsx`:

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
import { BlurFade } from '@/components/ui/blur-fade';
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Loader2,
  Play,
  RefreshCw,
  Users,
  Building2,
  Repeat,
  Clock,
  Sparkles,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface IntelligencePanelProps {
  tenderId: string;
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return `€${n.toLocaleString('el-GR')}`;
}

export function TenderIntelligencePanel({ tenderId }: IntelligencePanelProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [langModalOpen, setLangModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const cachedQuery = trpc.aiRoles.getIntelligence.useQuery({ tenderId });
  const generateMutation = trpc.aiRoles.generateIntelligence.useMutation({
    onSuccess: () => {
      setIsAnalyzing(false);
      utils.aiRoles.getIntelligence.invalidate({ tenderId });
    },
    onError: (err) => {
      setIsAnalyzing(false);
      toast({ title: t('intelligence.errorAnalysis'), description: err.message, variant: 'destructive' });
    },
  });

  const handleAnalyze = () => setLangModalOpen(true);
  const handleAnalyzeWithLang = (lang: AnalysisLanguage) => {
    setLangModalOpen(false);
    setIsAnalyzing(true);
    generateMutation.mutate({ tenderId, language: lang });
  };

  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const data = cachedQuery.data;
  const isLoading = cachedQuery.isLoading;
  const hasData = !!data;

  const similarAwards = (data?.similarAwards as any[]) ?? [];
  const competitors = (data?.competitors as any[]) ?? [];
  const authority = (data?.authorityProfile as any) ?? {};
  const repeat = (data?.repeatTender as any) ?? { found: false };
  const prepTime = (data?.prepTimeEstimate as any) ?? {};
  const advisory = (data?.aiAdvisory as any) ?? { bullets: [] };

  const amounts = similarAwards.filter((a: any) => a.amount).map((a: any) => a.amount as number);
  const avgPrice = amounts.length > 0 ? Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length) : null;
  const minPrice = amounts.length > 0 ? Math.min(...amounts) : null;
  const maxPrice = amounts.length > 0 ? Math.max(...amounts) : null;

  return (
    <BlurFade delay={0.15}>
      <div className="group rounded-xl border border-border/60 bg-card transition-colors hover:border-primary/20">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4.5 w-4.5 text-primary" />
            <h3 className="font-semibold text-foreground">{t('intelligence.title')}</h3>
            {hasData && (
              <Badge variant="outline" className="text-xs tabular-nums">
                {t('intelligence.similarFound').replace('{{count}}', String(similarAwards.length))}
              </Badge>
            )}
          </div>
          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            variant="outline"
            size="sm"
            className="gap-2 cursor-pointer h-8"
          >
            {isAnalyzing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : hasData ? (
              <RefreshCw className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {isAnalyzing ? t('intelligence.analyzing') : hasData ? t('intelligence.refresh') : t('intelligence.analyze')}
          </Button>
        </div>

        <div className="border-t border-border/40">
          {isLoading ? (
            <div className="p-5 space-y-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-52" />
            </div>
          ) : !hasData ? (
            <div className="p-5 text-center text-sm text-muted-foreground">
              {t('intelligence.noData')}
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {/* Repeat Alert — always on top, highlighted */}
              {repeat.found && (
                <div className="px-5 py-3 bg-amber-500/10">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                    <Repeat className="h-4 w-4" />
                    {t('intelligence.repeatAlert')}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {t('intelligence.previousWinner')}: <strong className="text-foreground">{repeat.previousWinner}</strong>
                    {repeat.previousAmount && <> — {fmt(repeat.previousAmount)}</>}
                    {repeat.previousDate && <> ({repeat.previousDate})</>}
                  </div>
                </div>
              )}

              {/* Market Overview — always visible */}
              {amounts.length > 0 && (
                <div className="px-5 py-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    {t('intelligence.marketOverview')}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('intelligence.avgAwardPrice')}:</span>
                      <div className="font-semibold text-foreground tabular-nums">{fmt(avgPrice)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('intelligence.priceRange')}:</span>
                      <div className="font-semibold text-foreground tabular-nums">{fmt(minPrice)} — {fmt(maxPrice)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Competitors — expandable */}
              {competitors.length > 0 && (
                <div>
                  <button
                    onClick={() => toggle('comp')}
                    className="flex w-full items-center justify-between px-5 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Users className="h-4 w-4 text-primary" />
                      {t('intelligence.competitors')} ({competitors.length})
                    </div>
                    {expanded.comp ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  </button>
                  <AnimatePresence>
                    {expanded.comp && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-3 space-y-1.5">
                          {competitors.map((c: any, i: number) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="text-foreground truncate">{c.name}</span>
                              <div className="flex items-center gap-3 shrink-0 ml-3 text-muted-foreground tabular-nums">
                                <span>{c.wins} {t('intelligence.wins')}</span>
                                {c.avgAmount && <span>{fmt(c.avgAmount)}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Authority Profile — expandable */}
              {authority.totalTenders > 0 && (
                <div>
                  <button
                    onClick={() => toggle('auth')}
                    className="flex w-full items-center justify-between px-5 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Building2 className="h-4 w-4 text-primary" />
                      {t('intelligence.authorityProfile')}
                    </div>
                    {expanded.auth ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  </button>
                  <AnimatePresence>
                    {expanded.auth && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-3 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('intelligence.totalTenders')}:</span>
                            <span className="text-foreground font-medium">{authority.totalTenders}</span>
                          </div>
                          {authority.avgDiscount != null && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t('intelligence.avgDiscount')}:</span>
                              <span className="text-foreground font-medium">{authority.avgDiscount}%</span>
                            </div>
                          )}
                          {authority.avgBidders != null && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t('intelligence.avgBidders')}:</span>
                              <span className="text-foreground font-medium">{authority.avgBidders}</span>
                            </div>
                          )}
                          {authority.topWinners?.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border/30">
                              {authority.topWinners.map((w: any, i: number) => (
                                <div key={i} className="flex justify-between text-sm">
                                  <span className="text-foreground truncate">{w.name}</span>
                                  <span className="text-muted-foreground tabular-nums shrink-0 ml-2">{w.wins} {t('intelligence.wins')}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Prep Time */}
              {prepTime.avgDays != null && (
                <div className="px-5 py-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-1">
                    <Clock className="h-4 w-4 text-primary" />
                    {t('intelligence.prepTime')}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">{t('intelligence.avgPrepDays')}: <strong className="text-foreground">{prepTime.avgDays}d</strong></span>
                    <span className="text-muted-foreground">{t('intelligence.daysAvailable')}: <strong className={cn('text-foreground', prepTime.isTight && 'text-destructive')}>{prepTime.currentDaysLeft}d</strong></span>
                    {prepTime.isTight && (
                      <Badge variant="destructive" className="text-xs gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {t('intelligence.tight')}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* AI Advisory — always visible */}
              {advisory.bullets?.length > 0 && (
                <div className="px-5 py-3 bg-primary/5">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {t('intelligence.aiAdvisory')}
                  </div>
                  <ul className="space-y-1.5">
                    {advisory.bullets.map((bullet: string, i: number) => (
                      <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                        <span className="text-primary mt-0.5 shrink-0">&#8226;</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Cache timestamp */}
              {data?.fetchedAt && (
                <div className="px-5 py-2 text-[11px] text-muted-foreground/60">
                  {t('intelligence.cachedAt')}: {new Date(data.fetchedAt).toLocaleString('el-GR')}
                </div>
              )}
            </div>
          )}
        </div>

        <LanguageModal
          open={langModalOpen}
          onSelect={handleAnalyzeWithLang}
          onClose={() => setLangModalOpen(false)}
        />
      </div>
    </BlurFade>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -i "intelligence-panel" | head -10
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/tender/intelligence-panel.tsx
git commit -m "feat(intelligence): add Intelligence Panel UI component"
```

---

### Task 7: Integration — Add Panel to Overview Tab

**Files:**
- Modify: `src/app/(dashboard)/tenders/[id]/page.tsx`

- [ ] **Step 1: Add import**

After the `CriteriaTab` import, add:

```typescript
import { TenderIntelligencePanel } from '@/components/tender/intelligence-panel';
```

- [ ] **Step 2: Add panel to Overview grid**

In the Overview TabsContent, after the existing grid with AIBriefPanel + GoNoGoPanel (line 430-433), add the Intelligence panel:

Replace:
```tsx
                      <div className="grid gap-4 lg:grid-cols-2">
                        <AIBriefPanel tenderId={tenderId} sourceUrl={sourceUrl} platform={tenderPlatform} />
                        <GoNoGoPanel tenderId={tenderId} sourceUrl={sourceUrl} platform={tenderPlatform} />
                      </div>
                      <OverviewTab tender={tender} />
```

With:
```tsx
                      <div className="grid gap-4 lg:grid-cols-2">
                        <AIBriefPanel tenderId={tenderId} sourceUrl={sourceUrl} platform={tenderPlatform} />
                        <GoNoGoPanel tenderId={tenderId} sourceUrl={sourceUrl} platform={tenderPlatform} />
                      </div>
                      <TenderIntelligencePanel tenderId={tenderId} />
                      <OverviewTab tender={tender} />
```

- [ ] **Step 3: Build verification**

Run:
```bash
npx next build 2>&1 | tail -15
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/"(dashboard)"/tenders/\[id\]/page.tsx
git commit -m "feat(intelligence): integrate Intelligence Panel into Overview tab"
```

---

### Task 8: End-to-End Verification

- [ ] **Step 1: Start dev server**

Run:
```bash
npm run dev
```

Open `http://localhost:3000/tenders/<any-tender-id>` and verify:
1. Overview tab shows Intelligence panel below the Brief + Go/No-Go panels
2. Panel shows "Ανάλυση Αγοράς" button
3. Button opens language modal
4. After analysis: market data, competitors, authority profile, AI advisory appear
5. Expandable sections work (competitors, authority)
6. Repeat alert shows if detected (amber highlight)
7. Prep time shows with "Tight" badge if applicable

- [ ] **Step 2: Full build**

Run:
```bash
npx next build
```

Expected: Build succeeds with no errors.
