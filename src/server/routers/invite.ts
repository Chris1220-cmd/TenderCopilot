import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '@/server/trpc';

export const inviteRouter = router({
  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const invitation = await ctx.db.invitation.findUnique({
        where: { token: input.token },
        include: { tenant: { select: { name: true } } },
      });

      if (!invitation) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Το invitation δεν βρέθηκε.' });
      }
      if (invitation.expiresAt < new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Το invitation έχει λήξει.' });
      }
      if (invitation.status !== 'PENDING') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Το invitation έχει ήδη χρησιμοποιηθεί.' });
      }

      return {
        email: invitation.email,
        role: invitation.role,
        tenantId: invitation.tenantId,
        tenantName: invitation.tenant.name,
        token: invitation.token,
      };
    }),

  accept: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await ctx.db.invitation.findUnique({
        where: { token: input.token },
      });

      if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt < new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Μη έγκυρο ή ληγμένο invitation.' });
      }
      if (invitation.email !== ctx.user.email) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Το invitation δεν ανήκει σε αυτό το email.' });
      }

      await ctx.db.tenantUser.create({
        data: { tenantId: invitation.tenantId, userId: ctx.user.id, role: invitation.role },
      });

      await ctx.db.invitation.update({
        where: { token: input.token },
        data: { status: 'ACCEPTED' },
      });

      return { tenantId: invitation.tenantId };
    }),
});
