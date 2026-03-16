import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';

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

      return ctx.db.certificate.create({
        data: {
          tenantId: ctx.tenantId,
          ...input,
        },
      });
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

      return ctx.db.certificate.update({ where: { id }, data });
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

      return ctx.db.legalDocument.create({
        data: {
          tenantId: ctx.tenantId,
          ...input,
        },
      });
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

      return ctx.db.legalDocument.update({ where: { id }, data });
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
});
