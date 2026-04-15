import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import { router, protectedProcedure } from '@/server/trpc';

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        activeCountry: true,
      },
    });
  }),

  updateProfile: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: ctx.user.id },
        data: { name: input.name },
      });
    }),

  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.user.id },
        select: { hashedPassword: true },
      });
      if (!user?.hashedPassword) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ο λογαριασμός δεν έχει κωδικό (χρήση OAuth).' });
      }
      const valid = await bcrypt.compare(input.currentPassword, user.hashedPassword);
      if (!valid) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Λάθος τρέχων κωδικός.' });
      }
      const newHash = await bcrypt.hash(input.newPassword, 12);
      await ctx.db.user.update({ where: { id: ctx.user.id }, data: { hashedPassword: newHash } });
      return { success: true };
    }),
});
