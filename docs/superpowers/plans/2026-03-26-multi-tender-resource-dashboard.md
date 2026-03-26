# Feature 10 — Multi-Tender Resource Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/resources` page ("Κέντρο Ελέγχου") with cross-tender alerts, certificate×tender validity matrix, and guarantee exposure tracker.

**Architecture:** New tRPC router (`resources`) with 3 query endpoints + CRUD for guarantees. One new Prisma model (`GuaranteeLetter`), one new field on `CompanyProfile`. Page built with 3 focused components matching existing patterns (PremiumStatCardV2, motion animations, Recharts-free).

**Tech Stack:** Next.js 14 App Router, tRPC, Prisma, Tailwind CSS, motion/react, Lucide icons, Zod validation.

**Spec:** `docs/superpowers/specs/2026-03-26-multi-tender-resource-dashboard-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `prisma/schema.prisma` | Modify | Add GuaranteeLetter model, enums, guaranteeCreditLine on CompanyProfile, relations on Tender + Tenant |
| `src/server/routers/resources.ts` | Create | tRPC router: getKpis, getAlerts, getCertificateMatrix, getGuaranteeOverview, createGuarantee, updateGuarantee, deleteGuarantee |
| `src/server/root.ts` | Modify | Register resources router |
| `src/app/(dashboard)/resources/page.tsx` | Create | Main page: KPI cards + 3 sections |
| `src/components/resources/alerts-section.tsx` | Create | Section A: cross-tender alert cards |
| `src/components/resources/certificate-matrix.tsx` | Create | Section B: certificate×tender validity table |
| `src/components/resources/guarantee-section.tsx` | Create | Section C: exposure bar + guarantee list |
| `src/components/resources/guarantee-form-sheet.tsx` | Create | Sheet form for add/edit guarantee |
| `src/components/layout/top-nav.tsx` | Modify | Add "Κέντρο Ελέγχου" nav item |
| `messages/el.json` | Modify | Greek translations |
| `messages/en.json` | Modify | English translations |

---

## Task 1: Schema — GuaranteeLetter model + CompanyProfile field

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums to schema**

Add before the existing `LegalDocType` enum block:

```prisma
// ─── Guarantee Letters ──────────────────────────────────────

enum GuaranteeType {
  PARTICIPATION    // Εγγυητική Συμμετοχής (2%)
  PERFORMANCE      // Εγγυητική Καλής Εκτέλεσης (4%)
  ADVANCE_PAYMENT  // Εγγυητική Προκαταβολής
}

enum GuaranteeStatus {
  REQUESTED
  ISSUED
  ACTIVE
  RELEASED
  EXPIRED
}
```

- [ ] **Step 2: Add GuaranteeLetter model**

Add after the enums:

```prisma
model GuaranteeLetter {
  id              String          @id @default(cuid())
  tenderId        String
  tenantId        String
  type            GuaranteeType   @default(PARTICIPATION)
  amount          Float
  bank            String?
  referenceNumber String?
  status          GuaranteeStatus @default(REQUESTED)
  requestedAt     DateTime?
  issuedAt        DateTime?
  validUntil      DateTime?
  releasedAt      DateTime?
  notes           String?         @db.Text
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  tender Tender @relation(fields: [tenderId], references: [id], onDelete: Cascade)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([tenderId])
}
```

- [ ] **Step 3: Add guaranteeCreditLine field to CompanyProfile**

In the `CompanyProfile` model, add after `description`:

```prisma
  guaranteeCreditLine Float?   // Total credit line for guarantee letters (EUR)
```

- [ ] **Step 4: Add relations to Tender and Tenant models**

In the `Tender` model, add in the relations section:

```prisma
  guaranteeLetters  GuaranteeLetter[]
```

In the `Tenant` model, add in the relations section:

```prisma
  guaranteeLetters  GuaranteeLetter[]
```

- [ ] **Step 5: Run migration**

```bash
npx prisma migrate dev --name add_guarantee_letter
```

Expected: Migration succeeds, new table `GuaranteeLetter` created, `CompanyProfile` gets `guaranteeCreditLine` column.

- [ ] **Step 6: Verify generated client**

```bash
npx prisma generate
```

Expected: Prisma Client regenerated with `GuaranteeLetter`, `GuaranteeType`, `GuaranteeStatus`.

- [ ] **Step 7: Commit**

```bash
git add prisma/
git commit -m "feat(resources): add GuaranteeLetter model and guaranteeCreditLine field"
```

---

## Task 2: tRPC Router — resources

**Files:**
- Create: `src/server/routers/resources.ts`
- Modify: `src/server/root.ts`

- [ ] **Step 1: Create resources router with getKpis**

Create `src/server/routers/resources.ts`:

```typescript
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';

export const resourcesRouter = router({
  getKpis: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
    }

    const [tenders, guarantees, companyProfile] = await Promise.all([
      ctx.db.tender.findMany({
        where: { tenantId: ctx.tenantId },
        select: { status: true },
      }),
      ctx.db.guaranteeLetter.findMany({
        where: {
          tenantId: ctx.tenantId,
          status: { in: ['REQUESTED', 'ISSUED', 'ACTIVE'] },
        },
        select: { amount: true },
      }),
      ctx.db.companyProfile.findUnique({
        where: { tenantId: ctx.tenantId },
        select: { guaranteeCreditLine: true },
      }),
    ]);

    const activeTenders = tenders.filter((t) =>
      ['DISCOVERY', 'GO_NO_GO', 'IN_PROGRESS'].includes(t.status)
    ).length;
    const won = tenders.filter((t) => t.status === 'WON').length;
    const lost = tenders.filter((t) => t.status === 'LOST').length;
    const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;
    const guaranteeCommitted = guarantees.reduce((sum, g) => sum + g.amount, 0);
    const guaranteeCreditLine = companyProfile?.guaranteeCreditLine ?? null;

    return { activeTenders, winRate, guaranteeCommitted, guaranteeCreditLine };
  }),
});
```

- [ ] **Step 2: Add getAlerts endpoint**

Add to the router object, after `getKpis`:

```typescript
  getAlerts: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
    }

    const now = new Date();
    const fourteenDays = new Date(now.getTime() + 14 * 86400000);
    const sevenDays = new Date(now.getTime() + 7 * 86400000);

    const [activeTenders, certificates, legalDocs, guarantees, deadlineItems, clarifications, generatedDocs] =
      await Promise.all([
        ctx.db.tender.findMany({
          where: {
            tenantId: ctx.tenantId,
            status: { in: ['DISCOVERY', 'GO_NO_GO', 'IN_PROGRESS'] },
            submissionDeadline: { not: null },
          },
          select: { id: true, title: true, submissionDeadline: true },
        }),
        ctx.db.certificate.findMany({
          where: { tenantId: ctx.tenantId, expiryDate: { not: null } },
          select: { id: true, title: true, type: true, expiryDate: true },
        }),
        ctx.db.legalDocument.findMany({
          where: { tenantId: ctx.tenantId, expiryDate: { not: null } },
          select: { id: true, title: true, type: true, expiryDate: true },
        }),
        ctx.db.guaranteeLetter.findMany({
          where: { tenantId: ctx.tenantId, status: 'REQUESTED' },
          include: { tender: { select: { id: true, title: true, submissionDeadline: true } } },
        }),
        ctx.db.deadlinePlanItem.findMany({
          where: {
            tenantId: ctx.tenantId,
            dueDate: { lt: now },
            status: { not: 'OBTAINED' },
          },
          include: { tender: { select: { id: true, title: true } } },
        }),
        ctx.db.clarificationQuestion.findMany({
          where: {
            tender: { tenantId: ctx.tenantId, status: { in: ['DISCOVERY', 'GO_NO_GO', 'IN_PROGRESS'] } },
            source: 'AUTHORITY',
            isRead: false,
          },
          include: { tender: { select: { id: true, title: true } } },
        }),
        ctx.db.generatedDocument.findMany({
          where: {
            tender: { tenantId: ctx.tenantId, status: { in: ['DISCOVERY', 'GO_NO_GO', 'IN_PROGRESS'] } },
            type: 'SOLEMN_DECLARATION',
            status: 'FINAL',
          },
          select: { tenderId: true },
        }),
      ]);

    type Alert = {
      id: string;
      type: string;
      severity: 'CRITICAL' | 'WARNING' | 'INFO';
      title: string;
      impact: { tenderId: string; tenderTitle: string; deadline: Date | null }[];
      action: string;
      daysLeft: number | null;
    };

    const alerts: Alert[] = [];

    // 1. Expiring certificates + legal docs → grouped by document
    const allDocs = [
      ...certificates.map((c) => ({ ...c, kind: 'cert' as const })),
      ...legalDocs.map((d) => ({ ...d, kind: 'legal' as const })),
    ];

    for (const doc of allDocs) {
      const expiry = doc.expiryDate!;
      const daysToExpiry = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);

      // Only alert if expiry is within 14 days from now
      if (daysToExpiry > 14) continue;

      // Find tenders affected: deadline is after now but cert expires before deadline
      const affected = activeTenders.filter(
        (t) => t.submissionDeadline && expiry < t.submissionDeadline
      );

      if (affected.length === 0 && daysToExpiry > 0) continue; // cert expiring but no tenders affected

      const severity: Alert['severity'] =
        daysToExpiry <= 0 ? 'CRITICAL' : daysToExpiry <= 3 ? 'CRITICAL' : daysToExpiry <= 7 ? 'WARNING' : 'INFO';

      alerts.push({
        id: `cert-${doc.id}`,
        type: 'CERTIFICATE_EXPIRING',
        severity,
        title: doc.title,
        impact: affected.length > 0
          ? affected.map((t) => ({ tenderId: t.id, tenderTitle: t.title, deadline: t.submissionDeadline }))
          : [], // expired cert with no active tenders
        action: 'orderCertificate',
        daysLeft: daysToExpiry,
      });
    }

    // 2. Pending guarantees with approaching deadlines
    for (const g of guarantees) {
      if (!g.tender.submissionDeadline) continue;
      const daysToDeadline = Math.ceil((g.tender.submissionDeadline.getTime() - now.getTime()) / 86400000);
      if (daysToDeadline > 14) continue;

      alerts.push({
        id: `guarantee-${g.id}`,
        type: 'GUARANTEE_PENDING',
        severity: daysToDeadline <= 3 ? 'CRITICAL' : 'WARNING',
        title: `Εγγυητική €${g.amount.toLocaleString('el-GR')}`,
        impact: [{ tenderId: g.tender.id, tenderTitle: g.tender.title, deadline: g.tender.submissionDeadline }],
        action: 'callBank',
        daysLeft: daysToDeadline,
      });
    }

    // 3. Approaching tender deadlines (≤7 days)
    for (const t of activeTenders) {
      if (!t.submissionDeadline) continue;
      const daysLeft = Math.ceil((t.submissionDeadline.getTime() - now.getTime()) / 86400000);
      if (daysLeft > 7 || daysLeft < 0) continue;

      alerts.push({
        id: `deadline-${t.id}`,
        type: 'DEADLINE_APPROACHING',
        severity: daysLeft <= 3 ? 'CRITICAL' : 'WARNING',
        title: t.title,
        impact: [{ tenderId: t.id, tenderTitle: t.title, deadline: t.submissionDeadline }],
        action: 'checkReadiness',
        daysLeft,
      });
    }

    // 4. Missing ΥΔ on tenders with deadline ≤14 days
    const tendersWithFinalYD = new Set(generatedDocs.map((d) => d.tenderId));
    for (const t of activeTenders) {
      if (!t.submissionDeadline) continue;
      const daysLeft = Math.ceil((t.submissionDeadline.getTime() - now.getTime()) / 86400000);
      if (daysLeft > 14 || daysLeft < 0) continue;
      if (tendersWithFinalYD.has(t.id)) continue;

      alerts.push({
        id: `yd-${t.id}`,
        type: 'YD_MISSING',
        severity: 'INFO',
        title: t.title,
        impact: [{ tenderId: t.id, tenderTitle: t.title, deadline: t.submissionDeadline }],
        action: 'signDocuments',
        daysLeft,
      });
    }

    // 5. Unread clarifications — group by tender
    const clarByTender = new Map<string, { tenderId: string; tenderTitle: string; count: number }>();
    for (const c of clarifications) {
      const existing = clarByTender.get(c.tender.id);
      if (existing) {
        existing.count++;
      } else {
        clarByTender.set(c.tender.id, { tenderId: c.tender.id, tenderTitle: c.tender.title, count: 1 });
      }
    }
    for (const [, info] of clarByTender) {
      alerts.push({
        id: `clar-${info.tenderId}`,
        type: 'CLARIFICATION_UNREAD',
        severity: 'INFO',
        title: `${info.count} διευκρινίσεις`,
        impact: [{ tenderId: info.tenderId, tenderTitle: info.tenderTitle, deadline: null }],
        action: 'checkClarifications',
        daysLeft: null,
      });
    }

    // 6. Overdue DeadlinePlanItems
    for (const item of deadlineItems) {
      const daysOverdue = Math.ceil((now.getTime() - item.dueDate.getTime()) / 86400000);
      alerts.push({
        id: `overdue-${item.id}`,
        type: 'DEADLINE_ITEM_OVERDUE',
        severity: 'WARNING',
        title: item.title,
        impact: [{ tenderId: item.tender.id, tenderTitle: item.tender.title, deadline: null }],
        action: 'checkReadiness',
        daysLeft: -daysOverdue,
      });
    }

    // Sort: CRITICAL first, then WARNING, then INFO. Within same, by daysLeft ASC
    const severityOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    alerts.sort((a, b) => {
      const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (sevDiff !== 0) return sevDiff;
      return (a.daysLeft ?? 999) - (b.daysLeft ?? 999);
    });

    return { alerts, criticalCount: alerts.filter((a) => a.severity === 'CRITICAL' || a.severity === 'WARNING').length };
  }),
```

- [ ] **Step 3: Add getCertificateMatrix endpoint**

Add after `getAlerts`:

```typescript
  getCertificateMatrix: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
    }

    const [activeTenders, certificates, legalDocs] = await Promise.all([
      ctx.db.tender.findMany({
        where: {
          tenantId: ctx.tenantId,
          status: { in: ['DISCOVERY', 'GO_NO_GO', 'IN_PROGRESS'] },
          submissionDeadline: { not: null },
        },
        select: { id: true, title: true, submissionDeadline: true },
        orderBy: { submissionDeadline: 'asc' },
      }),
      ctx.db.certificate.findMany({
        where: { tenantId: ctx.tenantId, expiryDate: { not: null } },
        select: { id: true, title: true, type: true, expiryDate: true },
        orderBy: { expiryDate: 'asc' },
      }),
      ctx.db.legalDocument.findMany({
        where: { tenantId: ctx.tenantId, expiryDate: { not: null } },
        select: { id: true, title: true, type: true, expiryDate: true },
        orderBy: { expiryDate: 'asc' },
      }),
    ]);

    // Deduplicate certs by type: keep latest expiryDate
    const certByType = new Map<string, typeof certificates[0]>();
    for (const c of certificates) {
      const existing = certByType.get(c.type);
      if (!existing || (c.expiryDate && existing.expiryDate && c.expiryDate > existing.expiryDate)) {
        certByType.set(c.type, c);
      }
    }

    const legalByType = new Map<string, typeof legalDocs[0]>();
    for (const d of legalDocs) {
      const existing = legalByType.get(d.type);
      if (!existing || (d.expiryDate && existing.expiryDate && d.expiryDate > existing.expiryDate)) {
        legalByType.set(d.type, d);
      }
    }

    type DocRow = { id: string; title: string; type: string; expiryDate: Date; kind: 'cert' | 'legal' };
    const documents: DocRow[] = [
      ...Array.from(legalByType.values()).map((d) => ({ ...d, expiryDate: d.expiryDate!, kind: 'legal' as const })),
      ...Array.from(certByType.values()).map((c) => ({ ...c, expiryDate: c.expiryDate!, kind: 'cert' as const })),
    ];

    type CellStatus = 'OK' | 'MARGINAL' | 'EXPIRING' | 'EXPIRED' | 'NA';
    const now = new Date();
    const sevenDaysMs = 7 * 86400000;

    const cells: { docId: string; tenderId: string; status: CellStatus }[] = [];

    for (const doc of documents) {
      for (const tender of activeTenders) {
        const deadline = tender.submissionDeadline!;
        let status: CellStatus;

        if (doc.expiryDate < now) {
          status = 'EXPIRED';
        } else if (doc.expiryDate < deadline) {
          status = 'EXPIRING';
        } else if (doc.expiryDate.getTime() < deadline.getTime() + sevenDaysMs) {
          status = 'MARGINAL';
        } else {
          status = 'OK';
        }

        cells.push({ docId: doc.id, tenderId: tender.id, status });
      }
    }

    return {
      tenders: activeTenders.map((t) => ({
        id: t.id,
        title: t.title,
        deadline: t.submissionDeadline!,
      })),
      documents: documents.map((d) => ({
        id: d.id,
        title: d.title,
        type: d.type,
        expiryDate: d.expiryDate,
        kind: d.kind,
      })),
      cells,
    };
  }),
```

- [ ] **Step 4: Add guarantee endpoints**

Add after `getCertificateMatrix`:

```typescript
  getGuaranteeOverview: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
    }

    const [guarantees, companyProfile] = await Promise.all([
      ctx.db.guaranteeLetter.findMany({
        where: { tenantId: ctx.tenantId },
        include: { tender: { select: { id: true, title: true, submissionDeadline: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      ctx.db.companyProfile.findUnique({
        where: { tenantId: ctx.tenantId },
        select: { guaranteeCreditLine: true },
      }),
    ]);

    const activeStatuses = ['REQUESTED', 'ISSUED', 'ACTIVE'];
    const committed = guarantees
      .filter((g) => activeStatuses.includes(g.status))
      .reduce((sum, g) => sum + g.amount, 0);
    const creditLine = companyProfile?.guaranteeCreditLine ?? null;
    const available = creditLine !== null ? creditLine - committed : null;

    // Sort: REQUESTED first, then ACTIVE, ISSUED, RELEASED, EXPIRED
    const statusOrder: Record<string, number> = { REQUESTED: 0, ACTIVE: 1, ISSUED: 2, RELEASED: 3, EXPIRED: 4 };
    const sorted = [...guarantees].sort(
      (a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
    );

    return { guarantees: sorted, creditLine, committed, available };
  }),

  createGuarantee: protectedProcedure
    .input(
      z.object({
        tenderId: z.string().cuid(),
        type: z.enum(['PARTICIPATION', 'PERFORMANCE', 'ADVANCE_PAYMENT']),
        amount: z.number().positive(),
        bank: z.string().optional(),
        referenceNumber: z.string().optional(),
        status: z.enum(['REQUESTED', 'ISSUED', 'ACTIVE', 'RELEASED', 'EXPIRED']).default('REQUESTED'),
        requestedAt: z.date().optional(),
        issuedAt: z.date().optional(),
        validUntil: z.date().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }
      const tender = await ctx.db.tender.findUnique({ where: { id: input.tenderId } });
      if (!tender || tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
      }
      return ctx.db.guaranteeLetter.create({
        data: { ...input, tenantId: ctx.tenantId },
      });
    }),

  updateGuarantee: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        type: z.enum(['PARTICIPATION', 'PERFORMANCE', 'ADVANCE_PAYMENT']).optional(),
        amount: z.number().positive().optional(),
        bank: z.string().nullable().optional(),
        referenceNumber: z.string().nullable().optional(),
        status: z.enum(['REQUESTED', 'ISSUED', 'ACTIVE', 'RELEASED', 'EXPIRED']).optional(),
        requestedAt: z.date().nullable().optional(),
        issuedAt: z.date().nullable().optional(),
        validUntil: z.date().nullable().optional(),
        releasedAt: z.date().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }
      const existing = await ctx.db.guaranteeLetter.findUnique({ where: { id: input.id } });
      if (!existing || existing.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Guarantee not found.' });
      }
      const { id, ...data } = input;
      return ctx.db.guaranteeLetter.update({ where: { id }, data });
    }),

  deleteGuarantee: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }
      const existing = await ctx.db.guaranteeLetter.findUnique({ where: { id: input.id } });
      if (!existing || existing.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Guarantee not found.' });
      }
      return ctx.db.guaranteeLetter.delete({ where: { id: input.id } });
    }),
```

- [ ] **Step 5: Register router in root.ts**

In `src/server/root.ts`, add import and registration:

```typescript
// Add import:
import { resourcesRouter } from '@/server/routers/resources';

// Add to appRouter object:
  resources: resourcesRouter,
```

- [ ] **Step 6: Verify build**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add src/server/routers/resources.ts src/server/root.ts
git commit -m "feat(resources): add resources tRPC router with alerts, matrix, guarantees"
```

---

## Task 3: i18n Translations

**Files:**
- Modify: `messages/el.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Add Greek translations**

Add a `"resources"` key at the top level of `messages/el.json`:

```json
"resources": {
  "title": "Κέντρο Ελέγχου",
  "subtitle": "Συνολική εικόνα σε όλους τους φακέλους",
  "kpi": {
    "activeTenders": "Ενεργοί Φάκελοι",
    "criticalAlerts": "Κρίσιμα Alerts",
    "guaranteeCommitted": "Εγγυητικά Δεσμευμένα",
    "winRate": "Win Rate"
  },
  "alerts": {
    "title": "Σήμερα / Αυτή την Εβδομάδα",
    "empty": "Δεν υπάρχουν εκκρεμότητες — όλα καλά!",
    "daysLeft": "{{count}} ημέρες",
    "oneDay": "1 ημέρα",
    "today": "ΣΗΜΕΡΑ",
    "expired": "ΕΛΗΞΕ",
    "overdue": "ΕΚΠΡΟΘΕΣΜΟ",
    "affects": "Επηρεάζει",
    "action": {
      "orderCertificate": "Παράγγειλε νέο σήμερα",
      "callBank": "Κάλεσε τράπεζα για status",
      "signDocuments": "Ετοίμασε ΥΔ για υπογραφή",
      "checkClarifications": "Δες τις νέες διευκρινίσεις",
      "checkReadiness": "Έλεγξε ετοιμότητα φακέλου"
    }
  },
  "matrix": {
    "title": "Πιστοποιητικά × Φάκελοι",
    "certificate": "Πιστοποιητικό",
    "expires": "Λήγει",
    "ok": "OK",
    "expiring": "ΛΗΓΕΙ",
    "marginal": "ΟΡΙΑΚΑ",
    "expired": "ΕΛΗΞΕ",
    "na": "N/A",
    "empty": "Δεν υπάρχουν πιστοποιητικά με ημερομηνία λήξης"
  },
  "guarantees": {
    "title": "Εγγυητική Έκθεση",
    "committed": "Δεσμευμένα",
    "creditLine": "Γραμμή",
    "available": "Διαθέσιμο",
    "maxTenderValue": "χωράει νέος διαγωνισμός μέχρι",
    "add": "Προσθήκη Εγγυητικής",
    "edit": "Επεξεργασία",
    "delete": "Διαγραφή",
    "deleteConfirm": "Σίγουρα θέλετε να διαγράψετε αυτή την εγγυητική;",
    "noCreditLine": "Ορίσε πιστωτικό όριο εγγυητικών στο Εταιρικό Προφίλ",
    "empty": "Δεν υπάρχουν εγγυητικές επιστολές",
    "status": {
      "REQUESTED": "Αιτήθηκε",
      "ISSUED": "Εκδόθηκε",
      "ACTIVE": "Ενεργή",
      "RELEASED": "Αποδεσμεύτηκε",
      "EXPIRED": "Έληξε"
    },
    "type": {
      "PARTICIPATION": "Συμμετοχής",
      "PERFORMANCE": "Καλής Εκτέλεσης",
      "ADVANCE_PAYMENT": "Προκαταβολής"
    },
    "form": {
      "title": "Εγγυητική Επιστολή",
      "tender": "Διαγωνισμός",
      "type": "Τύπος",
      "amount": "Ποσό (€)",
      "bank": "Τράπεζα",
      "referenceNumber": "Αρ. Αναφοράς",
      "status": "Κατάσταση",
      "requestedAt": "Ημ. Αίτησης",
      "issuedAt": "Ημ. Έκδοσης",
      "validUntil": "Ισχύς Μέχρι",
      "notes": "Σημειώσεις",
      "save": "Αποθήκευση",
      "cancel": "Ακύρωση"
    }
  }
},
```

Also add to `nav` section:

```json
"resources": "Κέντρο Ελέγχου",
```

- [ ] **Step 2: Add English translations**

Add matching `"resources"` key in `messages/en.json`:

```json
"resources": {
  "title": "Control Center",
  "subtitle": "Cross-tender overview across all dossiers",
  "kpi": {
    "activeTenders": "Active Tenders",
    "criticalAlerts": "Critical Alerts",
    "guaranteeCommitted": "Guarantees Committed",
    "winRate": "Win Rate"
  },
  "alerts": {
    "title": "Today / This Week",
    "empty": "No pending actions — all good!",
    "daysLeft": "{{count}} days",
    "oneDay": "1 day",
    "today": "TODAY",
    "expired": "EXPIRED",
    "overdue": "OVERDUE",
    "affects": "Affects",
    "action": {
      "orderCertificate": "Order new today",
      "callBank": "Call bank for status",
      "signDocuments": "Prepare declarations for signing",
      "checkClarifications": "Check new clarifications",
      "checkReadiness": "Check dossier readiness"
    }
  },
  "matrix": {
    "title": "Certificates × Tenders",
    "certificate": "Certificate",
    "expires": "Expires",
    "ok": "OK",
    "expiring": "EXPIRING",
    "marginal": "MARGINAL",
    "expired": "EXPIRED",
    "na": "N/A",
    "empty": "No certificates with expiry dates"
  },
  "guarantees": {
    "title": "Guarantee Exposure",
    "committed": "Committed",
    "creditLine": "Credit Line",
    "available": "Available",
    "maxTenderValue": "fits new tender up to",
    "add": "Add Guarantee",
    "edit": "Edit",
    "delete": "Delete",
    "deleteConfirm": "Are you sure you want to delete this guarantee?",
    "noCreditLine": "Set guarantee credit line in Company Profile",
    "empty": "No guarantee letters",
    "status": {
      "REQUESTED": "Requested",
      "ISSUED": "Issued",
      "ACTIVE": "Active",
      "RELEASED": "Released",
      "EXPIRED": "Expired"
    },
    "type": {
      "PARTICIPATION": "Participation",
      "PERFORMANCE": "Performance",
      "ADVANCE_PAYMENT": "Advance Payment"
    },
    "form": {
      "title": "Guarantee Letter",
      "tender": "Tender",
      "type": "Type",
      "amount": "Amount (€)",
      "bank": "Bank",
      "referenceNumber": "Reference No.",
      "status": "Status",
      "requestedAt": "Requested Date",
      "issuedAt": "Issued Date",
      "validUntil": "Valid Until",
      "notes": "Notes",
      "save": "Save",
      "cancel": "Cancel"
    }
  }
},
```

Also add to `nav` section:

```json
"resources": "Control Center",
```

- [ ] **Step 3: Commit**

```bash
git add messages/
git commit -m "feat(resources): add i18n translations for Control Center"
```

---

## Task 4: Navigation — Add to TopNav

**Files:**
- Modify: `src/components/layout/top-nav.tsx`

- [ ] **Step 1: Add nav item**

In `src/components/layout/top-nav.tsx`, add `Shield` to the Lucide import:

```typescript
import { LayoutDashboard, FileText, FolderCheck, BarChart3, Shield } from 'lucide-react';
```

Add to `navItems` array after the analytics entry:

```typescript
{ labelKey: 'nav.resources', href: '/resources', icon: Shield },
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/top-nav.tsx
git commit -m "feat(resources): add Control Center to navigation"
```

---

## Task 5: UI — Alerts Section Component

**Files:**
- Create: `src/components/resources/alerts-section.tsx`

- [ ] **Step 1: Create alerts section component**

Create `src/components/resources/alerts-section.tsx`:

```typescript
'use client';

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const } },
};

type Alert = {
  id: string;
  type: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  impact: { tenderId: string; tenderTitle: string; deadline: Date | null }[];
  action: string;
  daysLeft: number | null;
};

function formatDaysLeft(days: number | null, t: (k: string) => string): { text: string; color: string; bgColor: string; borderColor: string } {
  if (days === null) return { text: 'INFO', color: 'text-white', bgColor: 'bg-[#48A4D6]', borderColor: 'border-[#48A4D6]/30' };
  if (days <= 0) return { text: t('resources.alerts.expired'), color: 'text-white', bgColor: 'bg-[#ef4444]', borderColor: 'border-[#ef4444]/30' };
  if (days === 1) return { text: t('resources.alerts.oneDay'), color: 'text-white', bgColor: 'bg-[#ef4444]', borderColor: 'border-[#ef4444]/30' };
  if (days <= 3) return { text: t('resources.alerts.daysLeft').replace('{{count}}', String(days)), color: 'text-white', bgColor: 'bg-[#ef4444]', borderColor: 'border-[#ef4444]/30' };
  if (days <= 7) return { text: t('resources.alerts.daysLeft').replace('{{count}}', String(days)), color: 'text-black', bgColor: 'bg-[#f59e0b]', borderColor: 'border-[#f59e0b]/30' };
  return { text: t('resources.alerts.daysLeft').replace('{{count}}', String(days)), color: 'text-white', bgColor: 'bg-[#48A4D6]', borderColor: 'border-[#48A4D6]/30' };
}

const actionKeyMap: Record<string, string> = {
  orderCertificate: 'resources.alerts.action.orderCertificate',
  callBank: 'resources.alerts.action.callBank',
  signDocuments: 'resources.alerts.action.signDocuments',
  checkClarifications: 'resources.alerts.action.checkClarifications',
  checkReadiness: 'resources.alerts.action.checkReadiness',
};

export function AlertsSection({ alerts }: { alerts: Alert[] }) {
  const { t } = useTranslation();

  if (alerts.length === 0) {
    return (
      <motion.div variants={itemVariants} className="rounded-xl border border-border/60 bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
        <p className="text-body text-muted-foreground">{t('resources.alerts.empty')}</p>
      </motion.div>
    );
  }

  return (
    <motion.div variants={itemVariants} className="flex flex-col gap-3">
      {alerts.map((alert) => {
        const badge = formatDaysLeft(alert.daysLeft, t);
        const actionText = actionKeyMap[alert.action] ? t(actionKeyMap[alert.action]) : alert.action;

        return (
          <div
            key={alert.id}
            className={cn(
              'rounded-xl border bg-card/50 px-5 py-4 flex items-start gap-3',
              badge.borderColor
            )}
            style={{ borderColor: undefined }}
          >
            <span className={cn('shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold', badge.bgColor, badge.color)}>
              {badge.text}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{alert.title}</p>
              {alert.impact.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('resources.alerts.affects')}:{' '}
                  {alert.impact.map((imp, i) => (
                    <span key={imp.tenderId}>
                      {i > 0 && ' + '}
                      <Link href={`/tenders/${imp.tenderId}`} className="text-foreground hover:underline cursor-pointer">
                        {imp.tenderTitle}
                      </Link>
                      {imp.deadline && (
                        <span className="text-muted-foreground">
                          {' '}({new Date(imp.deadline).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit' })})
                        </span>
                      )}
                    </span>
                  ))}
                </p>
              )}
              <p className="text-xs text-muted-foreground/70 mt-1 flex items-center gap-1">
                <ArrowRight className="h-3 w-3" /> {actionText}
              </p>
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/resources/alerts-section.tsx
git commit -m "feat(resources): add alerts section component"
```

---

## Task 6: UI — Certificate Matrix Component

**Files:**
- Create: `src/components/resources/certificate-matrix.tsx`

- [ ] **Step 1: Create certificate matrix component**

Create `src/components/resources/certificate-matrix.tsx`:

```typescript
'use client';

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { FileWarning } from 'lucide-react';
import Link from 'next/link';

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const } },
};

type CellStatus = 'OK' | 'MARGINAL' | 'EXPIRING' | 'EXPIRED' | 'NA';

type MatrixData = {
  tenders: { id: string; title: string; deadline: Date }[];
  documents: { id: string; title: string; type: string; expiryDate: Date; kind: 'cert' | 'legal' }[];
  cells: { docId: string; tenderId: string; status: CellStatus }[];
};

const statusConfig: Record<CellStatus, { label: string; key: string; bg: string; text: string }> = {
  OK: { label: 'OK', key: 'resources.matrix.ok', bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  MARGINAL: { label: 'ΟΡΙΑΚΑ', key: 'resources.matrix.marginal', bg: 'bg-[#f59e0b]/20', text: 'text-[#f59e0b]' },
  EXPIRING: { label: 'ΛΗΓΕΙ', key: 'resources.matrix.expiring', bg: 'bg-[#ef4444]/20', text: 'text-[#ef4444]' },
  EXPIRED: { label: 'ΕΛΗΞΕ', key: 'resources.matrix.expired', bg: 'bg-[#ef4444]/30', text: 'text-[#ef4444]' },
  NA: { label: 'N/A', key: 'resources.matrix.na', bg: 'bg-muted/20', text: 'text-muted-foreground' },
};

function daysUntil(date: Date): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

export function CertificateMatrix({ data }: { data: MatrixData }) {
  const { t } = useTranslation();

  if (data.documents.length === 0) {
    return (
      <motion.div variants={itemVariants} className="rounded-xl border border-border/60 bg-card p-8 text-center">
        <FileWarning className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-body text-muted-foreground">{t('resources.matrix.empty')}</p>
      </motion.div>
    );
  }

  // Build lookup map
  const cellMap = new Map<string, CellStatus>();
  for (const c of data.cells) {
    cellMap.set(`${c.docId}-${c.tenderId}`, c.status);
  }

  return (
    <motion.div variants={itemVariants} className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                {t('resources.matrix.certificate')}
              </th>
              <th className="text-center px-3 py-3 text-xs font-medium text-muted-foreground">
                {t('resources.matrix.expires')}
              </th>
              {data.tenders.map((tender) => {
                const days = daysUntil(tender.deadline);
                return (
                  <th key={tender.id} className="text-center px-3 py-3 min-w-[90px]">
                    <Link href={`/tenders/${tender.id}`} className="hover:underline cursor-pointer">
                      <div className="text-xs font-medium text-foreground truncate max-w-[100px] mx-auto">
                        {tender.title}
                      </div>
                      <div className={cn(
                        'text-[10px] font-semibold mt-0.5',
                        days <= 3 ? 'text-[#ef4444]' : days <= 7 ? 'text-[#f59e0b]' : 'text-muted-foreground'
                      )}>
                        {new Date(tender.deadline).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit' })}
                      </div>
                    </Link>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.documents.map((doc) => (
              <tr key={doc.id} className="border-b border-border/20 last:border-0">
                <td className="px-4 py-2.5 text-sm text-foreground font-medium">{doc.title}</td>
                <td className="text-center px-3 py-2.5">
                  <span className={cn(
                    'text-xs font-semibold tabular-nums',
                    daysUntil(doc.expiryDate) <= 0 ? 'text-[#ef4444]' :
                    daysUntil(doc.expiryDate) <= 7 ? 'text-[#f59e0b]' :
                    'text-emerald-400'
                  )}>
                    {new Date(doc.expiryDate).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit' })}
                  </span>
                </td>
                {data.tenders.map((tender) => {
                  const status = cellMap.get(`${doc.id}-${tender.id}`) ?? 'NA';
                  const config = statusConfig[status];
                  return (
                    <td key={tender.id} className="text-center px-3 py-2.5">
                      <span className={cn('inline-block rounded px-2 py-0.5 text-[11px] font-semibold', config.bg, config.text)}>
                        {t(config.key)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/resources/certificate-matrix.tsx
git commit -m "feat(resources): add certificate × tender matrix component"
```

---

## Task 7: UI — Guarantee Section + Form

**Files:**
- Create: `src/components/resources/guarantee-section.tsx`
- Create: `src/components/resources/guarantee-form-sheet.tsx`

- [ ] **Step 1: Create guarantee form sheet**

Create `src/components/resources/guarantee-form-sheet.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Loader2 } from 'lucide-react';

type GuaranteeFormData = {
  tenderId: string;
  type: 'PARTICIPATION' | 'PERFORMANCE' | 'ADVANCE_PAYMENT';
  amount: number;
  bank: string;
  referenceNumber: string;
  status: 'REQUESTED' | 'ISSUED' | 'ACTIVE' | 'RELEASED' | 'EXPIRED';
  notes: string;
};

export function GuaranteeFormSheet({
  open,
  onOpenChange,
  onSuccess,
  editData,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editData?: { id: string } & GuaranteeFormData;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const { data: tenders } = trpc.tender.list.useQuery(undefined, { enabled: open });
  const activeTenders = (tenders ?? []).filter((t: any) =>
    ['DISCOVERY', 'GO_NO_GO', 'IN_PROGRESS'].includes(t.status)
  );

  const [form, setForm] = useState<GuaranteeFormData>(
    editData ?? {
      tenderId: '',
      type: 'PARTICIPATION',
      amount: 0,
      bank: '',
      referenceNumber: '',
      status: 'REQUESTED',
      notes: '',
    }
  );

  const createMutation = trpc.resources.createGuarantee.useMutation({
    onSuccess: () => {
      utils.resources.invalidate();
      onSuccess();
      onOpenChange(false);
    },
  });

  const updateMutation = trpc.resources.updateGuarantee.useMutation({
    onSuccess: () => {
      utils.resources.invalidate();
      onSuccess();
      onOpenChange(false);
    },
  });

  const isLoading = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editData?.id) {
      updateMutation.mutate({ id: editData.id, ...form, bank: form.bank || undefined, referenceNumber: form.referenceNumber || undefined, notes: form.notes || undefined });
    } else {
      createMutation.mutate({ ...form, bank: form.bank || undefined, referenceNumber: form.referenceNumber || undefined, notes: form.notes || undefined });
    }
  }

  // Auto-fill amount when tender changes and type is PARTICIPATION
  function handleTenderChange(tenderId: string) {
    setForm((prev) => {
      const tender = activeTenders.find((t: any) => t.id === tenderId);
      const autoAmount = prev.type === 'PARTICIPATION' && tender?.budget ? tender.budget * 0.02 : prev.amount;
      return { ...prev, tenderId, amount: autoAmount };
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('resources.guarantees.form.title')}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-6">
          {/* Tender */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('resources.guarantees.form.tender')}</label>
            <Select value={form.tenderId} onValueChange={handleTenderChange} disabled={!!editData}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {activeTenders.map((tender: any) => (
                  <SelectItem key={tender.id} value={tender.id}>{tender.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('resources.guarantees.form.type')}</label>
            <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v as any }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PARTICIPATION">{t('resources.guarantees.type.PARTICIPATION')}</SelectItem>
                <SelectItem value="PERFORMANCE">{t('resources.guarantees.type.PERFORMANCE')}</SelectItem>
                <SelectItem value="ADVANCE_PAYMENT">{t('resources.guarantees.type.ADVANCE_PAYMENT')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('resources.guarantees.form.amount')}</label>
            <Input type="number" step="0.01" min="0" value={form.amount || ''} onChange={(e) => setForm((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} />
          </div>

          {/* Bank */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('resources.guarantees.form.bank')}</label>
            <Input value={form.bank} onChange={(e) => setForm((p) => ({ ...p, bank: e.target.value }))} />
          </div>

          {/* Reference */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('resources.guarantees.form.referenceNumber')}</label>
            <Input value={form.referenceNumber} onChange={(e) => setForm((p) => ({ ...p, referenceNumber: e.target.value }))} />
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('resources.guarantees.form.status')}</label>
            <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as any }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['REQUESTED', 'ISSUED', 'ACTIVE', 'RELEASED', 'EXPIRED'] as const).map((s) => (
                  <SelectItem key={s} value={s}>{t(`resources.guarantees.status.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('resources.guarantees.form.notes')}</label>
            <Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1 cursor-pointer" onClick={() => onOpenChange(false)}>
              {t('resources.guarantees.form.cancel')}
            </Button>
            <Button type="submit" className="flex-1 cursor-pointer" disabled={isLoading || !form.tenderId || !form.amount}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('resources.guarantees.form.save')}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Create guarantee section component**

Create `src/components/resources/guarantee-section.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Loader2, Landmark } from 'lucide-react';
import Link from 'next/link';
import { GuaranteeFormSheet } from './guarantee-form-sheet';

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const } },
};

const statusColors: Record<string, string> = {
  REQUESTED: 'bg-[#f59e0b]/20 text-[#f59e0b]',
  ISSUED: 'bg-[#48A4D6]/20 text-[#48A4D6]',
  ACTIVE: 'bg-emerald-500/20 text-emerald-400',
  RELEASED: 'bg-muted/40 text-muted-foreground',
  EXPIRED: 'bg-[#ef4444]/20 text-[#ef4444]',
};

type GuaranteeOverview = {
  guarantees: any[];
  creditLine: number | null;
  committed: number;
  available: number | null;
};

export function GuaranteeSection({ data }: { data: GuaranteeOverview }) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingGuarantee, setEditingGuarantee] = useState<any>(null);

  const deleteMutation = trpc.resources.deleteGuarantee.useMutation({
    onSuccess: () => utils.resources.invalidate(),
  });

  const percentage = data.creditLine ? Math.round((data.committed / data.creditLine) * 100) : null;
  const barColor = percentage === null ? '' : percentage <= 50 ? 'bg-emerald-500' : percentage <= 80 ? 'bg-[#f59e0b]' : 'bg-[#ef4444]';

  function formatEur(n: number) {
    return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
  }

  return (
    <motion.div variants={itemVariants} className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between border-b border-border/40">
        <h3 className="text-sm font-semibold text-foreground">{t('resources.guarantees.title')}</h3>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 cursor-pointer"
          onClick={() => { setEditingGuarantee(null); setSheetOpen(true); }}
        >
          <Plus className="h-3.5 w-3.5" /> {t('resources.guarantees.add')}
        </Button>
      </div>

      <div className="px-5 py-4">
        {/* Progress bar */}
        {data.creditLine !== null ? (
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">
                {t('resources.guarantees.committed')}: <span className="font-semibold text-foreground">{formatEur(data.committed)}</span>
              </span>
              <span className="text-muted-foreground">
                {t('resources.guarantees.creditLine')}: <span className="font-semibold text-foreground">{formatEur(data.creditLine)}</span>
              </span>
            </div>
            <div className="h-5 bg-muted/30 rounded-lg overflow-hidden">
              <div
                className={cn('h-full rounded-lg flex items-center justify-center text-[11px] font-semibold', barColor, percentage! > 80 ? 'text-white' : 'text-black')}
                style={{ width: `${Math.min(percentage!, 100)}%` }}
              >
                {percentage}%
              </div>
            </div>
            {data.available !== null && data.available > 0 && (
              <p className="text-xs text-muted-foreground mt-1.5">
                {t('resources.guarantees.available')}: {formatEur(data.available)} — {t('resources.guarantees.maxTenderValue')} ~{formatEur(data.available / 0.02)}
              </p>
            )}
          </div>
        ) : (
          <div className="mb-4 rounded-lg bg-muted/20 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              <Link href="/company" className="text-[#48A4D6] hover:underline cursor-pointer">
                {t('resources.guarantees.noCreditLine')}
              </Link>
            </p>
          </div>
        )}

        {/* Guarantee list */}
        {data.guarantees.length === 0 ? (
          <div className="py-6 text-center">
            <Landmark className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">{t('resources.guarantees.empty')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {data.guarantees.map((g: any) => {
              const isActive = ['REQUESTED', 'ISSUED', 'ACTIVE'].includes(g.status);
              return (
                <div
                  key={g.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg',
                    isActive ? 'bg-muted/10' : 'bg-muted/5 opacity-60'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <Link href={`/tenders/${g.tenderId}`} className="text-sm font-medium text-foreground hover:underline cursor-pointer truncate block">
                      {g.tender?.title ?? g.tenderId}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className={cn('text-[10px]', statusColors[g.status])}>
                        {t(`resources.guarantees.status.${g.status}`)}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {t(`resources.guarantees.type.${g.type}`)}
                      </span>
                      {g.bank && <span className="text-[10px] text-muted-foreground">• {g.bank}</span>}
                    </div>
                  </div>
                  <span className={cn('text-sm font-semibold tabular-nums shrink-0', isActive ? 'text-foreground' : 'text-muted-foreground')}>
                    {formatEur(g.amount)}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 cursor-pointer"
                      onClick={() => { setEditingGuarantee(g); setSheetOpen(true); }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 cursor-pointer text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(t('resources.guarantees.deleteConfirm'))) {
                          deleteMutation.mutate({ id: g.id });
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <GuaranteeFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSuccess={() => setEditingGuarantee(null)}
        editData={editingGuarantee ? {
          id: editingGuarantee.id,
          tenderId: editingGuarantee.tenderId,
          type: editingGuarantee.type,
          amount: editingGuarantee.amount,
          bank: editingGuarantee.bank ?? '',
          referenceNumber: editingGuarantee.referenceNumber ?? '',
          status: editingGuarantee.status,
          notes: editingGuarantee.notes ?? '',
        } : undefined}
      />
    </motion.div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/resources/
git commit -m "feat(resources): add guarantee section and form sheet components"
```

---

## Task 8: UI — Main Page

**Files:**
- Create: `src/app/(dashboard)/resources/page.tsx`

- [ ] **Step 1: Create the resources page**

Create `src/app/(dashboard)/resources/page.tsx`:

```typescript
'use client';

import { trpc } from '@/lib/trpc';
import { useTranslation } from '@/lib/i18n';
import { motion } from 'motion/react';
import { Shield, AlertTriangle, Landmark, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PremiumStatCardV2 } from '@/components/ui/premium-stat-card-v2';
import { BlurFade } from '@/components/ui/blur-fade';
import { AlertsSection } from '@/components/resources/alerts-section';
import { CertificateMatrix } from '@/components/resources/certificate-matrix';
import { GuaranteeSection } from '@/components/resources/guarantee-section';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function ResourcesPage() {
  const { t } = useTranslation();

  const { data: kpis, isLoading: kpisLoading } = trpc.resources.getKpis.useQuery();
  const { data: alertsData, isLoading: alertsLoading } = trpc.resources.getAlerts.useQuery();
  const { data: matrixData, isLoading: matrixLoading } = trpc.resources.getCertificateMatrix.useQuery();
  const { data: guaranteeData, isLoading: guaranteeLoading } = trpc.resources.getGuaranteeOverview.useQuery();

  const isLoading = kpisLoading || alertsLoading || matrixLoading || guaranteeLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  function formatEur(n: number) {
    return new Intl.NumberFormat('el-GR', { maximumFractionDigits: 0 }).format(n);
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 p-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <BlurFade delay={0.05}>
          <h1 className="text-2xl font-bold text-foreground">{t('resources.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('resources.subtitle')}</p>
        </BlurFade>
      </motion.div>

      {/* KPI Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PremiumStatCardV2
          title={t('resources.kpi.activeTenders')}
          value={kpis?.activeTenders ?? 0}
          subtitle=""
          icon={Shield}
          index={0}
        />
        <PremiumStatCardV2
          title={t('resources.kpi.criticalAlerts')}
          value={alertsData?.criticalCount ?? 0}
          subtitle=""
          icon={AlertTriangle}
          index={1}
          colorClass={alertsData?.criticalCount ? 'text-[#ef4444]' : 'text-emerald-500'}
        />
        <PremiumStatCardV2
          title={t('resources.kpi.guaranteeCommitted')}
          value={kpis?.guaranteeCommitted ?? 0}
          suffix="€"
          subtitle=""
          icon={Landmark}
          index={2}
        />
        <PremiumStatCardV2
          title={t('resources.kpi.winRate')}
          value={kpis?.winRate ?? 0}
          suffix="%"
          subtitle=""
          icon={TrendingUp}
          index={3}
        />
      </motion.div>

      {/* Section A: Alerts */}
      <motion.div variants={itemVariants}>
        <h2 className="text-sm font-semibold text-foreground mb-3">{t('resources.alerts.title')}</h2>
        <AlertsSection alerts={alertsData?.alerts ?? []} />
      </motion.div>

      {/* Section B: Certificate Matrix */}
      <motion.div variants={itemVariants}>
        <h2 className="text-sm font-semibold text-foreground mb-3">{t('resources.matrix.title')}</h2>
        {matrixData && <CertificateMatrix data={matrixData} />}
      </motion.div>

      {/* Section C: Guarantee Exposure */}
      {guaranteeData && <GuaranteeSection data={guaranteeData} />}
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Run dev server and check page**

```bash
npm run dev
```

Open `http://localhost:3000/resources` — verify page loads with KPI cards, empty alerts, empty matrix, empty guarantees.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/resources/
git commit -m "feat(resources): add Control Center page with KPIs, alerts, matrix, guarantees"
```

---

## Task 9: Build Verification + Final Commit

**Files:** None new — verification only.

- [ ] **Step 1: Full build check**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Verify navigation**

Open app, confirm "Κέντρο Ελέγχου" appears in TopNav after "Analytics", clicking it goes to `/resources`.

- [ ] **Step 3: Verify empty states**

On `/resources` page:
- KPI cards show 0 values
- Alerts section shows "Δεν υπάρχουν εκκρεμότητες"
- Matrix shows empty message or table (depending on cert data)
- Guarantee section shows empty state + "Ορίσε πιστωτικό όριο" link

- [ ] **Step 4: Test guarantee CRUD**

1. Click "Προσθήκη Εγγυητικής"
2. Select a tender, set amount, select bank
3. Save → verify it appears in the list
4. Edit → change status to ISSUED → verify badge updates
5. Delete → confirm → verify removed

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: Feature 10 — Multi-Tender Resource Dashboard (Κέντρο Ελέγχου)"
```
