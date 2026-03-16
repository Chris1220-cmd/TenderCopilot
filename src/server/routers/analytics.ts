import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';

export const analyticsRouter = router({
  getTenderStats: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
    }

    const tenders = await ctx.db.tender.findMany({
      where: { tenantId: ctx.tenantId },
      select: {
        status: true,
        complianceScore: true,
        submissionDeadline: true,
      },
    });

    // Count by status
    const countByStatus: Record<string, number> = {};
    for (const t of tenders) {
      countByStatus[t.status] = (countByStatus[t.status] || 0) + 1;
    }

    // Average compliance score (only where set)
    const scores = tenders
      .map((t) => t.complianceScore)
      .filter((s): s is number => s !== null);
    const avgComplianceScore =
      scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

    // Upcoming deadlines (next 30 days)
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const upcomingDeadlines = tenders
      .filter(
        (t) =>
          t.submissionDeadline &&
          t.submissionDeadline >= now &&
          t.submissionDeadline <= thirtyDaysFromNow
      )
      .length;

    return {
      countByStatus,
      avgComplianceScore,
      upcomingDeadlines,
      totalTenders: tenders.length,
    };
  }),

  getCompanyStats: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
    }

    const tenders = await ctx.db.tender.findMany({
      where: { tenantId: ctx.tenantId },
      select: {
        status: true,
        complianceScore: true,
        createdAt: true,
      },
    });

    // Tenders per year
    const tendersPerYear: Record<number, number> = {};
    for (const t of tenders) {
      const year = t.createdAt.getFullYear();
      tendersPerYear[year] = (tendersPerYear[year] || 0) + 1;
    }

    // Win/loss ratio
    const won = tenders.filter((t) => t.status === 'WON').length;
    const lost = tenders.filter((t) => t.status === 'LOST').length;
    const winLossRatio = lost > 0 ? won / lost : won > 0 ? Infinity : 0;

    // Avg compliance for won vs lost
    const wonScores = tenders
      .filter((t) => t.status === 'WON' && t.complianceScore !== null)
      .map((t) => t.complianceScore as number);
    const lostScores = tenders
      .filter((t) => t.status === 'LOST' && t.complianceScore !== null)
      .map((t) => t.complianceScore as number);

    const avgComplianceWon =
      wonScores.length > 0 ? wonScores.reduce((a, b) => a + b, 0) / wonScores.length : null;
    const avgComplianceLost =
      lostScores.length > 0
        ? lostScores.reduce((a, b) => a + b, 0) / lostScores.length
        : null;

    return {
      tendersPerYear,
      won,
      lost,
      winLossRatio,
      avgComplianceWon,
      avgComplianceLost,
    };
  }),

  getTenderTimeline: protectedProcedure
    .input(z.object({ tenderId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const tender = await ctx.db.tender.findUnique({ where: { id: input.tenderId } });
      if (!tender || tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
      }

      return ctx.db.activity.findMany({
        where: { tenderId: input.tenderId },
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }),
});
