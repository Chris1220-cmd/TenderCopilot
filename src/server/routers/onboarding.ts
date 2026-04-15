import { z } from 'zod';
import { router, protectedProcedure } from '@/server/trpc';

export const onboardingRouter = router({
  complete: protectedProcedure
    .input(z.object({
      companyName: z.string().min(1),
      taxId: z.string().optional(),
      city: z.string().optional(),
      address: z.string().optional(),
      kadCodes: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.tenantId) {
        await ctx.db.companyProfile.upsert({
          where: { tenantId_country: { tenantId: ctx.tenantId, country: 'GR' } },
          create: {
            tenantId: ctx.tenantId,
            country: 'GR',
            legalName: input.companyName,
            taxId: input.taxId ?? '',
            city: input.city,
            address: input.address,
            kadCodes: input.kadCodes ?? [],
          },
          update: {
            legalName: input.companyName,
            taxId: input.taxId,
            city: input.city,
            address: input.address,
            kadCodes: input.kadCodes ?? [],
          },
        });
      }

      await ctx.db.user.update({
        where: { id: ctx.user.id },
        data: { onboardingCompletedAt: new Date() },
      });

      return { success: true };
    }),

  skip: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.user.update({
      where: { id: ctx.user.id },
      data: { onboardingCompletedAt: new Date() },
    });
    return { success: true };
  }),

  status: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.user.id },
      select: { onboardingCompletedAt: true },
    });
    return { completed: user?.onboardingCompletedAt != null };
  }),
});
