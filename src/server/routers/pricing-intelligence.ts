import { z } from 'zod';
import { router, protectedProcedure } from '@/server/trpc';
import { normalizeAuthority } from '@/server/services/award-normalizer';
import {
  computeCpvStats,
  computeAuthorityProfile,
  computeCompetitorRanking,
  computePricingAdvice,
} from '@/server/services/pricing-stats';
import { generatePricingAdvice } from '@/server/services/ai-pricing-advisor';

export const pricingIntelligenceRouter = router({
  similarAwards: protectedProcedure
    .input(z.object({
      cpvPrimary: z.string(),
      budgetMin: z.number().optional(),
      budgetMax: z.number().optional(),
      limit: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = { cpvPrimary: input.cpvPrimary };
      if (input.budgetMin != null || input.budgetMax != null) {
        where.awardAmount = {};
        if (input.budgetMin != null) where.awardAmount.gte = input.budgetMin;
        if (input.budgetMax != null) where.awardAmount.lte = input.budgetMax;
      }

      return ctx.db.historicalAward.findMany({
        where,
        orderBy: { awardDate: 'desc' },
        take: input.limit,
        select: {
          id: true,
          title: true,
          winner: true,
          awardAmount: true,
          budgetAmount: true,
          awardRatio: true,
          authority: true,
          awardDate: true,
          source: true,
          sourceUrl: true,
          cpvPrimary: true,
          numberOfBids: true,
        },
      });
    }),

  cpvStats: protectedProcedure
    .input(z.object({
      cpvPrimary: z.string(),
      yearsBack: z.number().default(2),
    }))
    .query(async ({ ctx, input }) => {
      return computeCpvStats(ctx.db, input.cpvPrimary, input.yearsBack);
    }),

  authorityProfile: protectedProcedure
    .input(z.object({
      authority: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const normalized = normalizeAuthority(input.authority);
      return computeAuthorityProfile(ctx.db, normalized);
    }),

  competitorRanking: protectedProcedure
    .input(z.object({
      cpvPrimary: z.string(),
      budgetMin: z.number().optional(),
      budgetMax: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return computeCompetitorRanking(ctx.db, input.cpvPrimary, input.budgetMin, input.budgetMax);
    }),

  pricingAdvice: protectedProcedure
    .input(z.object({
      tenderId: z.string(),
      language: z.enum(['el', 'en', 'nl']).default('el'),
    }))
    .query(async ({ ctx, input }) => {
      const tender = await ctx.db.tender.findUniqueOrThrow({
        where: { id: input.tenderId },
        select: {
          id: true,
          title: true,
          budget: true,
          contractingAuthority: true,
          cpvCodes: true,
        },
      });

      const cpvPrimary = tender.cpvCodes.length > 0
        ? tender.cpvCodes[0].split('-')[0]
        : null;
      const authorityNormalized = tender.contractingAuthority
        ? normalizeAuthority(tender.contractingAuthority)
        : null;

      // Compute stats
      const stats = await computePricingAdvice(ctx.db, {
        cpvPrimary,
        budget: tender.budget,
        authorityNormalized,
      });

      // Generate AI advice (skip if insufficient data)
      let aiAdvice = null;
      if (stats.confidence !== 'insufficient') {
        aiAdvice = await generatePricingAdvice(
          stats,
          {
            title: tender.title,
            budget: tender.budget,
            authority: tender.contractingAuthority,
            cpvPrimary,
          },
          input.language,
          ctx.tenantId ?? undefined,
        );
      }

      return { stats, aiAdvice };
    }),
});
