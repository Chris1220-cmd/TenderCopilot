import { router, protectedProcedure, publicProcedure } from '@/server/trpc';
import { getUsageSummary } from '@/server/services/usage-service';

export const subscriptionRouter = router({
  current: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) return null;
    return getUsageSummary(ctx.tenantId);
  }),

  plans: publicProcedure.query(async ({ ctx }) => {
    const plans = await ctx.db.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        priceAnnual: true,
        maxActiveTenders: true,
        maxAiCreditsPerMonth: true,
        maxDocumentsPerMonth: true,
        maxSearchesPerMonth: true,
        maxStorageMB: true,
        features: true,
      },
    });
    return plans;
  }),
});
