import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';
import { DOC_TYPE_TO_LEGAL_DOC_TYPE } from '@/lib/greek-document-defaults';

export const companyRouter = router({
  // ─── Company Profile ────────────────────────────────────────

  getProfile: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
    }

    return ctx.db.companyProfile.findUnique({
      where: { tenantId: ctx.tenantId },
    });
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        legalName: z.string().min(1),
        tradeName: z.string().nullish(),
        taxId: z.string().min(1),
        taxOffice: z.string().nullish(),
        registrationNumber: z.string().nullish(),
        address: z.string().nullish(),
        city: z.string().nullish(),
        postalCode: z.string().nullish(),
        phone: z.string().nullish(),
        email: z.string().email().nullish(),
        website: z.string().url().nullish(),
        legalRepName: z.string().nullish(),
        legalRepTitle: z.string().nullish(),
        legalRepIdNumber: z.string().nullish(),
        kadCodes: z.array(z.string()).optional(),
        description: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      return ctx.db.companyProfile.upsert({
        where: { tenantId: ctx.tenantId },
        create: {
          tenantId: ctx.tenantId,
          ...input,
        },
        update: input,
      });
    }),

  // ─── Certificates ───────────────────────────────────────────

  getCertificates: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
    }

    return ctx.db.certificate.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
        _count: { select: { deadlinePlanItems: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }),

  createCertificate: protectedProcedure
    .input(
      z.object({
        type: z.string().min(1),
        title: z.string().min(1),
        issuer: z.string().nullish(),
        issueDate: z.coerce.date().nullish(),
        expiryDate: z.coerce.date().nullish(),
        fileKey: z.string().nullish(),
        fileName: z.string().nullish(),
        notes: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const created = await ctx.db.certificate.create({
        data: {
          tenantId: ctx.tenantId,
          ...input,
        },
      });

      // Auto-link to pending DeadlinePlanItems
      if (created.type) {
        await ctx.db.deadlinePlanItem.updateMany({
          where: {
            tenantId: ctx.tenantId!,
            certificateId: null,
            status: { in: ['PENDING', 'OVERDUE'] },
            documentType: created.type.toUpperCase(),
          },
          data: { certificateId: created.id },
        });
      }

      return created;
    }),

  updateCertificate: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        type: z.string().min(1).optional(),
        title: z.string().min(1).optional(),
        issuer: z.string().nullish(),
        issueDate: z.coerce.date().nullish(),
        expiryDate: z.coerce.date().nullish(),
        fileKey: z.string().nullish(),
        fileName: z.string().nullish(),
        notes: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const { id, ...data } = input;

      const cert = await ctx.db.certificate.findUnique({ where: { id } });
      if (!cert || cert.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Certificate not found.' });
      }

      const updated = await ctx.db.certificate.update({ where: { id }, data });

      // Auto-update linked DeadlinePlanItems when certificate expiry changes
      if (updated.expiryDate) {
        const linkedItems = await ctx.db.deadlinePlanItem.findMany({
          where: { certificateId: updated.id },
          include: { tender: { select: { submissionDeadline: true } } },
        });
        for (const item of linkedItems) {
          const deadline = item.tender?.submissionDeadline;
          if (!deadline) continue;
          const newStatus = updated.expiryDate > deadline ? 'OBTAINED' : 'EXPIRED';
          if (item.status !== newStatus) {
            await ctx.db.deadlinePlanItem.update({
              where: { id: item.id },
              data: { status: newStatus, obtainedAt: newStatus === 'OBTAINED' ? new Date() : null },
            });
          }
        }
      }

      return updated;
    }),

  deleteCertificate: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const cert = await ctx.db.certificate.findUnique({ where: { id: input.id } });
      if (!cert || cert.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Certificate not found.' });
      }

      return ctx.db.certificate.delete({ where: { id: input.id } });
    }),

  // ─── Legal Documents ────────────────────────────────────────

  getLegalDocs: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
    }

    return ctx.db.legalDocument.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
        _count: { select: { deadlinePlanItems: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }),

  createLegalDoc: protectedProcedure
    .input(
      z.object({
        type: z.enum([
          'TAX_CLEARANCE',
          'SOCIAL_SECURITY_CLEARANCE',
          'GEMI_CERTIFICATE',
          'CRIMINAL_RECORD',
          'JUDICIAL_CERTIFICATE',
          'OTHER',
        ]),
        title: z.string().min(1),
        issueDate: z.coerce.date().nullish(),
        expiryDate: z.coerce.date().nullish(),
        fileKey: z.string().nullish(),
        fileName: z.string().nullish(),
        notes: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const created = await ctx.db.legalDocument.create({
        data: {
          tenantId: ctx.tenantId,
          ...input,
        },
      });

      // Auto-link to pending DeadlinePlanItems
      if (created.type) {
        const matchingDocTypes = Object.entries(DOC_TYPE_TO_LEGAL_DOC_TYPE)
          .filter(([, ldt]) => ldt === created.type)
          .map(([dt]) => dt);

        if (matchingDocTypes.length > 0) {
          await ctx.db.deadlinePlanItem.updateMany({
            where: {
              tenantId: ctx.tenantId!,
              legalDocId: null,
              status: { in: ['PENDING', 'OVERDUE'] },
              documentType: { in: matchingDocTypes },
            },
            data: { legalDocId: created.id },
          });
        }
      }

      return created;
    }),

  updateLegalDoc: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        type: z
          .enum([
            'TAX_CLEARANCE',
            'SOCIAL_SECURITY_CLEARANCE',
            'GEMI_CERTIFICATE',
            'CRIMINAL_RECORD',
            'JUDICIAL_CERTIFICATE',
            'OTHER',
          ])
          .optional(),
        title: z.string().min(1).optional(),
        issueDate: z.coerce.date().nullish(),
        expiryDate: z.coerce.date().nullish(),
        fileKey: z.string().nullish(),
        fileName: z.string().nullish(),
        notes: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const { id, ...data } = input;

      const doc = await ctx.db.legalDocument.findUnique({ where: { id } });
      if (!doc || doc.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Legal document not found.' });
      }

      const updated = await ctx.db.legalDocument.update({ where: { id }, data });

      // Auto-update linked DeadlinePlanItems when legal doc expiry changes
      if (updated.expiryDate) {
        const linkedItems = await ctx.db.deadlinePlanItem.findMany({
          where: { legalDocId: updated.id },
          include: { tender: { select: { submissionDeadline: true } } },
        });
        for (const item of linkedItems) {
          const deadline = item.tender?.submissionDeadline;
          if (!deadline) continue;
          const newStatus = updated.expiryDate > deadline ? 'OBTAINED' : 'EXPIRED';
          if (item.status !== newStatus) {
            await ctx.db.deadlinePlanItem.update({
              where: { id: item.id },
              data: { status: newStatus, obtainedAt: newStatus === 'OBTAINED' ? new Date() : null },
            });
          }
        }
      }

      return updated;
    }),

  deleteLegalDoc: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const doc = await ctx.db.legalDocument.findUnique({ where: { id: input.id } });
      if (!doc || doc.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Legal document not found.' });
      }

      return ctx.db.legalDocument.delete({ where: { id: input.id } });
    }),

  // ─── Projects ───────────────────────────────────────────────

  getProjects: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
    }

    return ctx.db.project.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }),

  createProject: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().nullish(),
        client: z.string().nullish(),
        contractAmount: z.number().nullish(),
        startDate: z.coerce.date().nullish(),
        endDate: z.coerce.date().nullish(),
        category: z.string().nullish(),
        proofFileKey: z.string().nullish(),
        proofFileName: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      return ctx.db.project.create({
        data: {
          tenantId: ctx.tenantId,
          ...input,
        },
      });
    }),

  updateProject: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        title: z.string().min(1).optional(),
        description: z.string().nullish(),
        client: z.string().nullish(),
        contractAmount: z.number().nullish(),
        startDate: z.coerce.date().nullish(),
        endDate: z.coerce.date().nullish(),
        category: z.string().nullish(),
        proofFileKey: z.string().nullish(),
        proofFileName: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const { id, ...data } = input;

      const project = await ctx.db.project.findUnique({ where: { id } });
      if (!project || project.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found.' });
      }

      return ctx.db.project.update({ where: { id }, data });
    }),

  deleteProject: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const project = await ctx.db.project.findUnique({ where: { id: input.id } });
      if (!project || project.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found.' });
      }

      return ctx.db.project.delete({ where: { id: input.id } });
    }),

  // ─── Content Library ────────────────────────────────────────

  getContentLibrary: protectedProcedure
    .input(
      z
        .object({
          category: z
            .enum([
              'COMPANY_PROFILE',
              'METHODOLOGY',
              'QA_PLAN',
              'HSE_PLAN',
              'TEAM_DESCRIPTION',
              'RISK_MANAGEMENT',
              'OTHER',
            ])
            .optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      return ctx.db.contentLibraryItem.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(input?.category ? { category: input.category } : {}),
        },
        orderBy: { updatedAt: 'desc' },
      });
    }),

  createContentItem: protectedProcedure
    .input(
      z.object({
        category: z.enum([
          'COMPANY_PROFILE',
          'METHODOLOGY',
          'QA_PLAN',
          'HSE_PLAN',
          'TEAM_DESCRIPTION',
          'RISK_MANAGEMENT',
          'OTHER',
        ]),
        title: z.string().min(1),
        content: z.string().min(1),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      return ctx.db.contentLibraryItem.create({
        data: {
          tenantId: ctx.tenantId,
          ...input,
          tags: input.tags ?? [],
        },
      });
    }),

  updateContentItem: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        category: z
          .enum([
            'COMPANY_PROFILE',
            'METHODOLOGY',
            'QA_PLAN',
            'HSE_PLAN',
            'TEAM_DESCRIPTION',
            'RISK_MANAGEMENT',
            'OTHER',
          ])
          .optional(),
        title: z.string().min(1).optional(),
        content: z.string().min(1).optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const { id, ...data } = input;

      const item = await ctx.db.contentLibraryItem.findUnique({ where: { id } });
      if (!item || item.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Content item not found.' });
      }

      return ctx.db.contentLibraryItem.update({ where: { id }, data });
    }),

  deleteContentItem: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const item = await ctx.db.contentLibraryItem.findUnique({ where: { id: input.id } });
      if (!item || item.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Content item not found.' });
      }

      return ctx.db.contentLibraryItem.delete({ where: { id: input.id } });
    }),

  // ─── Expiring Documents ─────────────────────────────────────

  getExpiringDocuments: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant.' });
    }

    const ninetyDaysFromNow = new Date(Date.now() + 90 * 86400000);

    const [certificates, legalDocs] = await Promise.all([
      ctx.db.certificate.findMany({
        where: {
          tenantId: ctx.tenantId,
          expiryDate: { not: null, lte: ninetyDaysFromNow },
        },
        include: {
          _count: { select: { deadlinePlanItems: true } },
        },
        orderBy: { expiryDate: 'asc' },
      }),
      ctx.db.legalDocument.findMany({
        where: {
          tenantId: ctx.tenantId,
          expiryDate: { not: null, lte: ninetyDaysFromNow },
        },
        include: {
          _count: { select: { deadlinePlanItems: true } },
        },
        orderBy: { expiryDate: 'asc' },
      }),
    ]);

    return { certificates, legalDocs };
  }),
});
