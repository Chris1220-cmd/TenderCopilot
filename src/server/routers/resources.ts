import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';

export const resourcesRouter = router({
  // ─── Top Bar KPIs ──────────────────────────────────────────
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

  // ─── Section A: Cross-Tender Alerts ────────────────────────
  getAlerts: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
    }

    const now = new Date();

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
            source: 'AUTHORITY_PUBLISHED',
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

    type AlertImpact = { tenderId: string; tenderTitle: string; deadline: Date | null };
    type Alert = {
      id: string;
      type: string;
      severity: 'CRITICAL' | 'WARNING' | 'INFO';
      title: string;
      impact: AlertImpact[];
      action: string;
      daysLeft: number | null;
    };

    const alerts: Alert[] = [];
    const fourteenDaysMs = 14 * 86400000;

    // 1. Expiring certificates + legal docs → grouped by document
    const allDocs = [
      ...certificates.map((c) => ({ ...c, kind: 'cert' as const })),
      ...legalDocs.map((d) => ({ ...d, kind: 'legal' as const })),
    ];

    for (const doc of allDocs) {
      const expiry = doc.expiryDate!;
      const daysToExpiry = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);

      if (daysToExpiry > 14) continue;

      const affected = activeTenders.filter(
        (t) => t.submissionDeadline && expiry < t.submissionDeadline
      );

      if (affected.length === 0 && daysToExpiry > 0) continue;

      const severity: Alert['severity'] =
        daysToExpiry <= 3 ? 'CRITICAL' : daysToExpiry <= 7 ? 'WARNING' : 'INFO';

      alerts.push({
        id: `cert-${doc.id}`,
        type: 'CERTIFICATE_EXPIRING',
        severity,
        title: doc.title,
        impact: affected.map((t) => ({
          tenderId: t.id,
          tenderTitle: t.title,
          deadline: t.submissionDeadline,
        })),
        action: 'orderCertificate',
        daysLeft: daysToExpiry,
      });
    }

    // 2. Pending guarantees with approaching deadlines
    for (const g of guarantees) {
      if (!g.tender.submissionDeadline) continue;
      const daysToDeadline = Math.ceil(
        (g.tender.submissionDeadline.getTime() - now.getTime()) / 86400000
      );
      if (daysToDeadline > 14) continue;

      alerts.push({
        id: `guarantee-${g.id}`,
        type: 'GUARANTEE_PENDING',
        severity: daysToDeadline <= 3 ? 'CRITICAL' : 'WARNING',
        title: `Εγγυητική €${g.amount.toLocaleString('el-GR')}`,
        impact: [
          {
            tenderId: g.tender.id,
            tenderTitle: g.tender.title,
            deadline: g.tender.submissionDeadline,
          },
        ],
        action: 'callBank',
        daysLeft: daysToDeadline,
      });
    }

    // 3. Approaching tender deadlines (≤7 days)
    for (const t of activeTenders) {
      if (!t.submissionDeadline) continue;
      const daysLeft = Math.ceil(
        (t.submissionDeadline.getTime() - now.getTime()) / 86400000
      );
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
      const daysLeft = Math.ceil(
        (t.submissionDeadline.getTime() - now.getTime()) / 86400000
      );
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
    const clarByTender = new Map<
      string,
      { tenderId: string; tenderTitle: string; count: number }
    >();
    for (const c of clarifications) {
      const existing = clarByTender.get(c.tender.id);
      if (existing) {
        existing.count++;
      } else {
        clarByTender.set(c.tender.id, {
          tenderId: c.tender.id,
          tenderTitle: c.tender.title,
          count: 1,
        });
      }
    }
    for (const info of Array.from(clarByTender.values())) {
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
      const daysOverdue = Math.ceil(
        (now.getTime() - item.dueDate.getTime()) / 86400000
      );
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

    // Sort: CRITICAL first, then WARNING, then INFO. Within same severity, by daysLeft ASC
    const severityOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    alerts.sort((a, b) => {
      const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (sevDiff !== 0) return sevDiff;
      return (a.daysLeft ?? 999) - (b.daysLeft ?? 999);
    });

    return {
      alerts,
      criticalCount: alerts.filter(
        (a) => a.severity === 'CRITICAL' || a.severity === 'WARNING'
      ).length,
    };
  }),

  // ─── Section B: Certificate × Tender Matrix ────────────────
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

    // Deduplicate by type: keep latest expiryDate
    const certByType = new Map<string, (typeof certificates)[0]>();
    for (const c of certificates) {
      const existing = certByType.get(c.type);
      if (
        !existing ||
        (c.expiryDate && existing.expiryDate && c.expiryDate > existing.expiryDate)
      ) {
        certByType.set(c.type, c);
      }
    }

    const legalByType = new Map<string, (typeof legalDocs)[0]>();
    for (const d of legalDocs) {
      const existing = legalByType.get(d.type);
      if (
        !existing ||
        (d.expiryDate && existing.expiryDate && d.expiryDate > existing.expiryDate)
      ) {
        legalByType.set(d.type, d);
      }
    }

    type DocRow = {
      id: string;
      title: string;
      type: string;
      expiryDate: Date;
      kind: 'cert' | 'legal';
    };
    const documents: DocRow[] = [
      ...Array.from(legalByType.values()).map((d) => ({
        ...d,
        expiryDate: d.expiryDate!,
        kind: 'legal' as const,
      })),
      ...Array.from(certByType.values()).map((c) => ({
        ...c,
        expiryDate: c.expiryDate!,
        kind: 'cert' as const,
      })),
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

  // ─── Section C: Guarantee Overview ─────────────────────────
  getGuaranteeOverview: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
    }

    const [guarantees, companyProfile] = await Promise.all([
      ctx.db.guaranteeLetter.findMany({
        where: { tenantId: ctx.tenantId },
        include: {
          tender: { select: { id: true, title: true, submissionDeadline: true } },
        },
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

    const statusOrder: Record<string, number> = {
      REQUESTED: 0,
      ACTIVE: 1,
      ISSUED: 2,
      RELEASED: 3,
      EXPIRED: 4,
    };
    const sorted = [...guarantees].sort(
      (a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
    );

    return { guarantees: sorted, creditLine, committed, available };
  }),

  // ─── Guarantee CRUD ────────────────────────────────────────
  createGuarantee: protectedProcedure
    .input(
      z.object({
        tenderId: z.string().cuid(),
        type: z.enum(['PARTICIPATION', 'PERFORMANCE', 'ADVANCE_PAYMENT']),
        amount: z.number().positive(),
        bank: z.string().optional(),
        referenceNumber: z.string().optional(),
        status: z
          .enum(['REQUESTED', 'ISSUED', 'ACTIVE', 'RELEASED', 'EXPIRED'])
          .default('REQUESTED'),
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
        status: z
          .enum(['REQUESTED', 'ISSUED', 'ACTIVE', 'RELEASED', 'EXPIRED'])
          .optional(),
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
      const existing = await ctx.db.guaranteeLetter.findUnique({
        where: { id: input.id },
      });
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
      const existing = await ctx.db.guaranteeLetter.findUnique({
        where: { id: input.id },
      });
      if (!existing || existing.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Guarantee not found.' });
      }
      return ctx.db.guaranteeLetter.delete({ where: { id: input.id } });
    }),
});
