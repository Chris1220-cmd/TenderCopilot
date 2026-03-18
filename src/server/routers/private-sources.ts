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
