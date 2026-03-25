import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';
import { db } from '@/lib/db';
import { subtractBusinessDays } from '@/lib/deadline-calculator';
import {
  GREEK_DOCUMENT_DEFAULTS,
  DOC_TYPE_TO_LEGAL_DOC_TYPE,
  type DocumentDefault,
} from '@/lib/greek-document-defaults';
import type { LegalDocType, LegalDocument, Certificate } from '@prisma/client';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

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

function classifyStatus(
  doc: DocumentDefault,
  latestStartDate: Date,
  deadline: Date,
  existingCerts: Certificate[],
  existingLegalDocs: LegalDocument[],
): string {
  const legalDocType = DOC_TYPE_TO_LEGAL_DOC_TYPE[doc.type] ?? null;
  if (legalDocType) {
    const match = existingLegalDocs.find((ld) => ld.type === legalDocType);
    if (match) {
      if (match.expiryDate && match.expiryDate < deadline) {
        // Expires BEFORE submission deadline — needs renewal
        return 'EXPIRED';
      }
      return 'OBTAINED';
    }
  }

  const now = new Date();
  if (doc.leadTimeDays > 0 && latestStartDate < now) {
    return 'OVERDUE';
  }

  return 'PENDING';
}

/* ------------------------------------------------------------------ */
/*  Shared generation logic (callable from tender.create)             */
/* ------------------------------------------------------------------ */

export async function generateDeadlinePlanForTender(tenderId: string, tenantId: string) {
  const tender = await db.tender.findUnique({ where: { id: tenderId } });
  if (!tender) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
  }
  if (!tender.submissionDeadline) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Tender has no submission deadline set.',
    });
  }

  const deadline = tender.submissionDeadline;

  // Fetch existing company documents
  const [existingCerts, existingLegalDocs] = await Promise.all([
    db.certificate.findMany({ where: { tenantId } }),
    db.legalDocument.findMany({ where: { tenantId } }),
  ]);

  // Delete existing default plan items (keep custom / AI-generated)
  await db.deadlinePlanItem.deleteMany({
    where: {
      tenderId,
      tenantId,
      isAiGenerated: false,
      documentType: { in: GREEK_DOCUMENT_DEFAULTS.map((d) => d.type) },
    },
  });

  // Build plan items
  const itemsToCreate = GREEK_DOCUMENT_DEFAULTS.map((doc) => {
    const latestStartDate = subtractBusinessDays(deadline, doc.leadTimeDays);
    const BUFFER_DAYS = 2;
    let optimalStartDate: Date | null = null;
    if (doc.validityDays) {
      const earliestUseful = new Date(deadline);
      earliestUseful.setDate(earliestUseful.getDate() - doc.validityDays);
      optimalStartDate = subtractBusinessDays(deadline, doc.leadTimeDays + BUFFER_DAYS);
      if (optimalStartDate < earliestUseful) {
        optimalStartDate = earliestUseful;
      }
    }
    const status = classifyStatus(doc, latestStartDate, deadline, existingCerts, existingLegalDocs);

    // Link to existing legal doc if matched
    const legalDocType = DOC_TYPE_TO_LEGAL_DOC_TYPE[doc.type] ?? null;
    const matchedLegalDoc = legalDocType
      ? existingLegalDocs.find((ld) => ld.type === legalDocType)
      : null;

    return {
      tenderId,
      tenantId,
      documentType: doc.type,
      title: doc.titleEl,
      description: doc.titleEn,
      envelope: doc.envelope,
      leadTimeDays: doc.leadTimeDays,
      validityDays: doc.validityDays,
      latestStartDate,
      optimalStartDate,
      dueDate: deadline,
      status,
      source: doc.source,
      isMandatory: true,
      isAiGenerated: false,
      legalDocId: matchedLegalDoc?.id ?? null,
    };
  });

  // Bulk create
  await db.deadlinePlanItem.createMany({ data: itemsToCreate });

  // Create TenderAlert records for critical items
  const criticalItems = itemsToCreate.filter(
    (item) => item.status === 'OVERDUE' || item.status === 'EXPIRED',
  );

  if (criticalItems.length > 0) {
    await db.tenderAlert.createMany({
      data: criticalItems.map((item) => ({
        tenderId,
        tenantId,
        type: 'DEADLINE_PLAN',
        severity: item.status === 'OVERDUE' ? 'HIGH' : 'MEDIUM',
        title: `${item.title} is ${item.status.toLowerCase()}`,
        detail:
          item.status === 'OVERDUE'
            ? `The latest start date for "${item.title}" has already passed. Immediate action required.`
            : `The existing "${item.title}" has expired and needs renewal before submission.`,
        source: 'deadline-plan',
      })),
    });
  }

  return {
    created: itemsToCreate.length,
    critical: criticalItems.length,
  };
}

/* ------------------------------------------------------------------ */
/*  Router                                                            */
/* ------------------------------------------------------------------ */

export const deadlinePlanRouter = router({
  /** Generate deadline plan items from Greek document defaults */
  generate: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { tenantId } = await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return generateDeadlinePlanForTender(input.tenderId, tenantId);
    }),

  /** List all plan items for a tender */
  listByTender: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ input, ctx }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return db.deadlinePlanItem.findMany({
        where: { tenderId: input.tenderId },
        include: { certificate: true, legalDoc: true },
        orderBy: [{ latestStartDate: 'asc' }, { createdAt: 'asc' }],
      });
    }),

  /** Update item status */
  updateStatus: protectedProcedure
    .input(
      z.object({
        itemId: z.string(),
        status: z.enum(['PENDING', 'IN_PROGRESS', 'OBTAINED', 'EXPIRED', 'OVERDUE']),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant.' });
      }
      const item = await db.deadlinePlanItem.findUnique({ where: { id: input.itemId } });
      if (!item || item.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Item not found.' });
      }
      return db.deadlinePlanItem.update({
        where: { id: input.itemId },
        data: {
          status: input.status,
          obtainedAt: input.status === 'OBTAINED' ? new Date() : undefined,
        },
      });
    }),

  /** Add a custom document to the plan */
  addCustomItem: protectedProcedure
    .input(
      z.object({
        tenderId: z.string(),
        documentType: z.string(),
        title: z.string(),
        description: z.string().optional(),
        envelope: z.enum(['A', 'B', 'C']).nullable().optional(),
        leadTimeDays: z.number().int().min(0).default(0),
        validityDays: z.number().int().min(1).nullable().optional(),
        source: z.string().optional(),
        isMandatory: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { tender, tenantId } = await ensureTenderAccess(input.tenderId, ctx.tenantId);
      if (!tender.submissionDeadline) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Tender has no submission deadline set.',
        });
      }
      const deadline = tender.submissionDeadline;
      const latestStartDate = subtractBusinessDays(deadline, input.leadTimeDays);
      const optimalStartDate = subtractBusinessDays(deadline, input.leadTimeDays + 5);

      return db.deadlinePlanItem.create({
        data: {
          tenderId: input.tenderId,
          tenantId,
          documentType: input.documentType,
          title: input.title,
          description: input.description ?? null,
          envelope: input.envelope ?? null,
          leadTimeDays: input.leadTimeDays,
          validityDays: input.validityDays ?? null,
          latestStartDate,
          optimalStartDate,
          dueDate: deadline,
          status: 'PENDING',
          source: input.source ?? null,
          isMandatory: input.isMandatory,
          isAiGenerated: false,
        },
      });
    }),

  /** Remove a plan item */
  removeItem: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant.' });
      }
      const item = await db.deadlinePlanItem.findUnique({ where: { id: input.itemId } });
      if (!item || item.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Item not found.' });
      }
      await db.deadlinePlanItem.delete({ where: { id: input.itemId } });
      return { success: true };
    }),

  /** Health check summary for the overview banner */
  getHealthCheck: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ input, ctx }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      const items = await db.deadlinePlanItem.findMany({
        where: { tenderId: input.tenderId },
        select: { status: true },
      });

      const total = items.length;
      const obtained = items.filter((i) => i.status === 'OBTAINED').length;
      const overdue = items.filter((i) => i.status === 'OVERDUE').length;
      const expired = items.filter((i) => i.status === 'EXPIRED').length;
      const pending = items.filter((i) => i.status === 'PENDING').length;
      const inProgress = items.filter((i) => i.status === 'IN_PROGRESS').length;

      return { total, obtained, overdue, expired, pending, inProgress };
    }),
});
