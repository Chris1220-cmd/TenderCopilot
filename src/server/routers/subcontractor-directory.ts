import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';

export const subcontractorDirectoryRouter = router({
  list: protectedProcedure
    .input(z.object({
      kind: z.enum(['SUBCONTRACTOR', 'SUPPLIER']).optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant' });

      const where: any = { tenantId: ctx.tenantId };
      if (input?.kind) where.kind = input.kind;
      if (input?.search) {
        where.OR = [
          { companyName: { contains: input.search, mode: 'insensitive' } },
          { specialties: { hasSome: [input.search] } },
          { contactPerson: { contains: input.search, mode: 'insensitive' } },
        ];
      }

      return ctx.db.subcontractorContact.findMany({
        where,
        orderBy: [{ rating: 'desc' }, { companyName: 'asc' }],
      });
    }),

  create: protectedProcedure
    .input(z.object({
      companyName: z.string().min(1).max(200),
      contactPerson: z.string().max(200).optional(),
      email: z.string().email().optional().or(z.literal('')),
      phone: z.string().max(30).optional(),
      specialties: z.array(z.string()).default([]),
      kind: z.enum(['SUBCONTRACTOR', 'SUPPLIER']).default('SUBCONTRACTOR'),
      certifications: z.array(z.string()).default([]),
      regions: z.array(z.string()).default([]),
      cpvCodes: z.array(z.string()).default([]),
      rating: z.number().min(1).max(5).optional(),
      notes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant' });
      return ctx.db.subcontractorContact.create({
        data: { ...input, email: input.email || null, tenantId: ctx.tenantId },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      companyName: z.string().min(1).max(200).optional(),
      contactPerson: z.string().max(200).optional(),
      email: z.string().email().optional().or(z.literal('')),
      phone: z.string().max(30).optional(),
      specialties: z.array(z.string()).optional(),
      kind: z.enum(['SUBCONTRACTOR', 'SUPPLIER']).optional(),
      certifications: z.array(z.string()).optional(),
      regions: z.array(z.string()).optional(),
      cpvCodes: z.array(z.string()).optional(),
      rating: z.number().min(1).max(5).optional(),
      notes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant' });
      const { id, ...data } = input;
      const existing = await ctx.db.subcontractorContact.findUnique({ where: { id } });
      if (!existing || existing.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      return ctx.db.subcontractorContact.update({ where: { id }, data: { ...data, email: data.email || null } });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant' });
      const existing = await ctx.db.subcontractorContact.findUnique({ where: { id: input.id } });
      if (!existing || existing.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      return ctx.db.subcontractorContact.delete({ where: { id: input.id } });
    }),

  // Match subcontractors from directory to a tender's needs
  matchForTender: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant' });

      // Get tender's subcontractor needs
      const needs = await ctx.db.subcontractorNeed.findMany({
        where: { tenderId: input.tenderId },
      });

      if (needs.length === 0) return [];

      // Get all contacts for this tenant
      const contacts = await ctx.db.subcontractorContact.findMany({
        where: { tenantId: ctx.tenantId },
      });

      // Match: for each need, find contacts whose specialties overlap
      return needs.map((need) => {
        const matched = contacts.filter((c) => {
          // Match by kind
          if (c.kind !== need.kind) return false;
          // Match by specialty (case-insensitive substring)
          const needSpecLower = need.specialty.toLowerCase();
          return c.specialties.some((s) =>
            s.toLowerCase().includes(needSpecLower) || needSpecLower.includes(s.toLowerCase())
          );
        });

        return {
          need: { id: need.id, specialty: need.specialty, kind: need.kind, isMandatory: need.isMandatory, status: need.status },
          matches: matched.map((c) => ({
            id: c.id,
            companyName: c.companyName,
            contactPerson: c.contactPerson,
            email: c.email,
            phone: c.phone,
            rating: c.rating,
            specialties: c.specialties,
          })),
        };
      });
    }),
});
