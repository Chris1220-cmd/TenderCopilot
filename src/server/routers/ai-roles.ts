import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';
import { aiBidOrchestrator } from '@/server/services/ai-bid-orchestrator';
import { aiLegalAnalyzer } from '@/server/services/ai-legal-analyzer';
import { aiTechnical } from '@/server/services/ai-technical';
import { aiFinancial } from '@/server/services/ai-financial';
import { aiCompliance } from '@/server/services/ai-compliance';
import { aiOps } from '@/server/services/ai-ops';
import { db } from '@/lib/db';
import { ai, logTokenUsage } from '@/server/ai';
import { buildContext } from '@/server/services/context-builder';
import { validateResponse } from '@/server/services/trust-shield';
import { tenderAnalysisService } from '@/server/services/tender-analysis';

/**
 * Helper to ensure the calling user has a tenant and the tender belongs to that tenant.
 */
async function ensureTenderAccess(tenderId: string, tenantId: string | null) {
  if (!tenantId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
  }

  const tender = await db.tender.findUnique({ where: { id: tenderId } });
  if (!tender || tender.tenantId !== tenantId) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
  }

  return { tender, tenantId };
}

export const aiRolesRouter = router({
  // ═══════════════════════════════════════════════════════════
  // Data Loading Queries (load existing AI analysis from DB)
  // ═══════════════════════════════════════════════════════════

  getTechnicalData: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      const [sections, risks, team] = await Promise.all([
        db.technicalProposalSection.findMany({
          where: { tenderId: input.tenderId },
          orderBy: { ordering: 'asc' },
        }),
        db.technicalRisk.findMany({
          where: { tenderId: input.tenderId },
          orderBy: { createdAt: 'asc' },
        }),
        db.teamRequirement.findMany({
          where: { tenderId: input.tenderId },
          orderBy: { createdAt: 'asc' },
        }),
      ]);
      return { sections, risks, team };
    }),

  getBrief: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return db.tenderBrief.findUnique({ where: { tenderId: input.tenderId } });
    }),

  getGoNoGo: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return db.goNoGoDecision.findFirst({
        where: { tenderId: input.tenderId },
        orderBy: { createdAt: 'desc' },
      });
    }),

  getLegalClauses: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      const clauses = await db.legalClause.findMany({
        where: { tenderId: input.tenderId },
        orderBy: { createdAt: 'asc' },
      });
      const clarifications = await db.clarificationQuestion.findMany({
        where: { tenderId: input.tenderId },
        orderBy: { createdAt: 'asc' },
      });
      const summary = await aiLegalAnalyzer.getLegalRiskSummary(input.tenderId);
      return { clauses, summary, clarifications };
    }),

  // ═══════════════════════════════════════════════════════════
  // AI Bid Orchestrator (Bid Manager)
  // ═══════════════════════════════════════════════════════════

  summarizeTender: protectedProcedure
    .input(z.object({ tenderId: z.string(), language: z.enum(['el', 'en']).default('el') }))
    .mutation(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return aiBidOrchestrator.summarizeTender(input.tenderId, input.language);
    }),

  goNoGo: protectedProcedure
    .input(z.object({ tenderId: z.string(), language: z.enum(['el', 'en']).default('el') }))
    .mutation(async ({ ctx, input }) => {
      const { tenantId } = await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return aiBidOrchestrator.goNoGoAnalysis(input.tenderId, tenantId, input.language);
    }),

  approveGoNoGo: protectedProcedure
    .input(
      z.object({
        decisionId: z.string(),
        approved: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      // Verify the decision exists and belongs to a tender the user has access to
      const decision = await db.goNoGoDecision.findUnique({
        where: { id: input.decisionId },
        include: { tender: { select: { tenantId: true } } },
      });

      if (!decision || decision.tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Decision not found.' });
      }

      return db.goNoGoDecision.update({
        where: { id: input.decisionId },
        data: {
          approvedById: input.approved ? ctx.userId : null,
          approvedAt: input.approved ? new Date() : null,
        },
      });
    }),

  generateWorkPlan: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return aiBidOrchestrator.generateWorkPlan(input.tenderId);
    }),

  analyzeTeam: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return aiBidOrchestrator.analyzeTeamRequirements(input.tenderId);
    }),

  analyzeSubcontractorNeeds: protectedProcedure
    .input(z.object({ tenderId: z.string(), language: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return aiBidOrchestrator.analyzeSubcontractorNeeds(input.tenderId, input.language);
    }),

  askQuestion: protectedProcedure
    .input(
      z.object({
        tenderId: z.string(),
        question: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { tenderId, question } = input;
      // ctx.tenantId null guard (match existing pattern in this file)
      const tenantId = ctx.tenantId;
      if (!tenantId) throw new Error('No tenant');

      // Use new smart context builder
      const context = await buildContext(tenderId, tenantId, question);

      const result = await ai().complete({
        messages: [
          { role: 'system', content: context.systemPrompt },
          { role: 'user', content: `CONTEXT:\n${context.contextText}\n\nΕΡΩΤΗΣΗ: ${question}` },
        ],
        responseFormat: 'json',
        temperature: 0.3,
        maxTokens: 3000,
      });

      await logTokenUsage(tenderId, 'smart_chat', {
        input: result.inputTokens ?? 0,
        output: result.outputTokens ?? 0,
        total: result.totalTokens ?? 0,
      });

      const providedChunks = context.sources
        .filter((s) => s.type === 'document')
        .map((s) => s.content);
      const trusted = validateResponse(result.content, providedChunks);

      return {
        answer: trusted.answer,
        highlights: trusted.highlights,
        confidence: trusted.confidence,
        sources: trusted.sources,
        caveats: trusted.caveats,
      };
    }),

  // ═══════════════════════════════════════════════════════════
  // AI Legal Analyzer (Legal Advisor)
  // ═══════════════════════════════════════════════════════════

  extractLegalClauses: protectedProcedure
    .input(z.object({ tenderId: z.string(), language: z.enum(['el', 'en']).default('el') }))
    .mutation(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return aiLegalAnalyzer.extractClauses(input.tenderId, input.language);
    }),

  assessLegalRisks: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return aiLegalAnalyzer.assessRisks(input.tenderId);
    }),

  proposeClarifications: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return aiLegalAnalyzer.proposeClarifications(input.tenderId);
    }),

  updateClarification: protectedProcedure
    .input(z.object({ id: z.string(), text: z.string() }))
    .mutation(async ({ input }) => {
      return db.clarificationQuestion.update({
        where: { id: input.id },
        data: { questionText: input.text },
      });
    }),

  approveClarification: protectedProcedure
    .input(z.object({ id: z.string(), approved: z.boolean() }))
    .mutation(async ({ input }) => {
      return db.clarificationQuestion.update({
        where: { id: input.id },
        data: { status: input.approved ? 'APPROVED' : 'DRAFT' },
      });
    }),

  selectPricingScenario: protectedProcedure
    .input(z.object({ tenderId: z.string(), scenarioId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      await db.$transaction([
        db.pricingScenario.updateMany({
          where: { tenderId: input.tenderId, id: { not: input.scenarioId } },
          data: { isSelected: false },
        }),
        db.pricingScenario.update({
          where: { id: input.scenarioId },
          data: { isSelected: true },
        }),
      ]);
      return db.pricingScenario.findUnique({ where: { id: input.scenarioId } });
    }),

  getLegalSummary: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return aiLegalAnalyzer.getLegalRiskSummary(input.tenderId);
    }),

  // ═══════════════════════════════════════════════════════════
  // AI Financial Modeller (Finance Director)
  // ═══════════════════════════════════════════════════════════

  getFinancialData: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      const scenarios = await db.pricingScenario.findMany({
        where: { tenderId: input.tenderId },
        orderBy: { createdAt: 'asc' },
      });
      return { scenarios };
    }),

  extractFinancials: protectedProcedure
    .input(z.object({ tenderId: z.string(), language: z.enum(['el', 'en']).default('el') }))
    .mutation(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return aiFinancial.extractFinancialRequirements(input.tenderId, input.language);
    }),

  checkFinancialEligibility: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { tenantId } = await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return aiFinancial.checkEligibility(input.tenderId, tenantId);
    }),

  getFinancialSummary: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { tenantId } = await ensureTenderAccess(input.tenderId, ctx.tenantId);

      const [scenarios, reqCount, profileCount] = await Promise.all([
        db.pricingScenario.findMany({
          where: { tenderId: input.tenderId },
          orderBy: { createdAt: 'asc' },
        }),
        db.tenderRequirement.count({
          where: { tenderId: input.tenderId, category: 'FINANCIAL_REQUIREMENTS' },
        }),
        db.financialProfile.count({
          where: { tenantId },
        }),
      ]);

      const hasExtractedRequirements = reqCount > 0;
      const hasFinancialProfile = profileCount > 0;

      let eligibility = null;
      if (hasExtractedRequirements && hasFinancialProfile) {
        try {
          eligibility = await aiFinancial.checkEligibility(input.tenderId, tenantId);
        } catch (err) {
          console.warn('[getFinancialSummary] checkEligibility failed:', err);
        }
      }

      return {
        scenarios,
        eligibility,
        hasFinancialProfile,
        hasExtractedRequirements,
      };
    }),

  suggestPricing: protectedProcedure
    .input(
      z.object({
        tenderId: z.string(),
        costs: z
          .object({
            labor: z.number().optional(),
            materials: z.number().optional(),
            subcontracting: z.number().optional(),
            overhead: z.number().optional(),
            other: z.number().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return aiFinancial.suggestPricingScenarios(input.tenderId, input.costs);
    }),

  // ═══════════════════════════════════════════════════════════
  // AI Technical Engine (Technical Director)
  // ═══════════════════════════════════════════════════════════

  analyzeTechRequirements: protectedProcedure
    .input(z.object({ tenderId: z.string(), language: z.enum(['el', 'en']).default('el') }))
    .mutation(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return aiTechnical.analyzeTechnicalRequirements(input.tenderId, input.language);
    }),

  generateProposal: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { tenantId } = await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return aiTechnical.generateTechnicalProposal(input.tenderId, tenantId);
    }),

  flagTechRisks: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return aiTechnical.flagTechnicalRisks(input.tenderId);
    }),

  scoreProposalStrength: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return aiTechnical.scoreProposalStrength(input.tenderId);
    }),

  // ═══════════════════════════════════════════════════════════
  // AI Compliance Guardian (QA/Compliance Officer)
  // ═══════════════════════════════════════════════════════════

  updateCompliance: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { tenantId } = await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return aiCompliance.updateComplianceMatrix(input.tenderId, tenantId);
    }),

  getChecklist: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return aiCompliance.generateSubmissionChecklist(input.tenderId);
    }),

  validatePackage: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return aiCompliance.validateSubmissionPackage(input.tenderId);
    }),

  getComplianceReport: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return aiCompliance.getComplianceReport(input.tenderId);
    }),

  // ═══════════════════════════════════════════════════════════
  // AI Ops (Project Admin)
  // ═══════════════════════════════════════════════════════════

  prioritizeTasks: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return aiOps.prioritizeTasks(input.tenderId);
    }),

  getReminders: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return aiOps.generateReminders(input.tenderId);
    }),

  suggestNextActions: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      return aiOps.suggestNextActions(input.tenderId);
    }),

  /** Extract requirements (participation, exclusion, technical, financial, documentation, contract) */
  extractRequirements: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);

      // Get all attached document texts
      const docs = await db.attachedDocument.findMany({
        where: { tenderId: input.tenderId },
        select: { extractedText: true },
      });

      const documentTexts = docs
        .map(d => d.extractedText)
        .filter((t): t is string => !!t && t.length > 50);

      if (documentTexts.length === 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Δεν βρέθηκαν έγγραφα με κείμενο. Ανεβάστε PDF πρώτα.',
        });
      }

      // Clear existing requirements before re-extraction
      await db.tenderRequirement.deleteMany({ where: { tenderId: input.tenderId } });

      const analysis = await tenderAnalysisService.analyzeTender(input.tenderId, documentTexts);
      await tenderAnalysisService.saveRequirements(input.tenderId, analysis);

      return { requirementsCount: analysis.requirements.length };
    }),
});
