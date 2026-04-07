import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';
import { fetchDocumentsForTender } from '@/server/services/document-fetcher';
import { generateDeadlinePlanForTender } from './deadline-plan';
import { createUsageLimitCheck } from '@/server/middleware/usage-limit';

const tenderStatusEnum = z.enum([
  'DISCOVERY',
  'GO_NO_GO',
  'IN_PROGRESS',
  'SUBMITTED',
  'WON',
  'LOST',
]);

const tenderPlatformEnum = z.enum(['ESIDIS', 'COSMOONE', 'ISUPPLIES', 'DIAVGEIA', 'TED', 'KIMDIS', 'OTHER', 'PRIVATE', 'EU_MEMBER']);

export const tenderRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          status: tenderStatusEnum.optional(),
          platform: tenderPlatformEnum.optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      return ctx.db.tender.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(input?.status ? { status: input.status } : {}),
          ...(input?.platform ? { platform: input.platform } : {}),
          ...(input?.search
            ? {
                OR: [
                  { title: { contains: input.search, mode: 'insensitive' } },
                  { referenceNumber: { contains: input.search, mode: 'insensitive' } },
                  { contractingAuthority: { contains: input.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        include: {
          _count: {
            select: {
              requirements: true,
              tasks: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const tender = await ctx.db.tender.findUnique({
        where: { id: input.id },
        include: {
          requirements: {
            orderBy: { createdAt: 'asc' },
          },
          _count: {
            select: {
              tasks: true,
              attachedDocuments: true,
              generatedDocuments: true,
            },
          },
        },
      });

      if (!tender || tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
      }

      return tender;
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        referenceNumber: z.string().nullish(),
        contractingAuthority: z.string().nullish(),
        platform: tenderPlatformEnum.optional(),
        cpvCodes: z.array(z.string()).optional(),
        budget: z.number().nullish(),
        awardCriteria: z.string().nullish(),
        submissionDeadline: z.coerce.date().nullish(),
        notes: z.string().nullish(),
        sourceUrl: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      await createUsageLimitCheck('activeTenders')(ctx.tenantId);

      // Duplicate check: same title + tenant = already exists
      const existing = await ctx.db.tender.findFirst({
        where: {
          tenantId: ctx.tenantId,
          title: input.title,
        },
        select: { id: true },
      });

      if (existing) {
        // Return existing instead of creating duplicate
        return { id: existing.id };
      }

      const { sourceUrl, ...tenderData } = input;

      const tender = await ctx.db.tender.create({
        data: {
          tenantId: ctx.tenantId,
          ...tenderData,
          cpvCodes: tenderData.cpvCodes ?? [],
        },
      });

      if (tender.submissionDeadline) {
        // Fire-and-forget — don't block tender creation
        generateDeadlinePlanForTender(tender.id, ctx.tenantId!).catch((e) =>
          console.error('Deadline plan auto-generation failed:', e)
        );
      }

      // Must await — Vercel serverless kills fire-and-forget promises after response
      if (sourceUrl) {
        try {
          await fetchDocumentsForTender({
            tenderId: tender.id,
            tenantId: ctx.tenantId,
            sourceUrl,
            platform: input.platform || 'OTHER',
          });
        } catch (err) {
          console.error(`[tender.create] Document fetch failed for ${tender.id}:`, err);
        }
      }

      return { id: tender.id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        title: z.string().min(1).optional(),
        referenceNumber: z.string().nullish(),
        contractingAuthority: z.string().nullish(),
        platform: tenderPlatformEnum.optional(),
        cpvCodes: z.array(z.string()).optional(),
        budget: z.number().nullish(),
        awardCriteria: z.string().nullish(),
        submissionDeadline: z.coerce.date().nullish(),
        complianceScore: z.number().min(0).max(100).nullish(),
        notes: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const { id, ...data } = input;

      const tender = await ctx.db.tender.findUnique({ where: { id } });
      if (!tender || tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
      }

      return ctx.db.tender.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const tender = await ctx.db.tender.findUnique({ where: { id: input.id } });
      if (!tender || tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
      }

      return ctx.db.tender.delete({ where: { id: input.id } });
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        status: tenderStatusEnum,
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const tender = await ctx.db.tender.findUnique({ where: { id: input.id } });
      if (!tender || tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
      }

      return ctx.db.tender.update({
        where: { id: input.id },
        data: { status: input.status },
      });
    }),

  getSectionStatuses: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const tender = await ctx.db.tender.findUnique({
        where: { id: input.id },
        include: {
          brief: { select: { id: true } },
          goNoGoDecision: { select: { id: true } },
          requirements: { select: { id: true, coverageStatus: true } },
          evaluationCriteria: { select: { id: true, status: true } },
          legalClauses: { select: { id: true } },
          clarifications: {
            where: { source: 'AUTHORITY_PUBLISHED', isRead: false },
            select: { id: true },
          },
          technicalSections: { select: { id: true, status: true } },
          pricingScenarios: { select: { id: true, isSelected: true } },
          generatedDocuments: { select: { id: true } },
          tasks: { select: { id: true, status: true, dueDate: true } },
          deadlinePlanItems: { select: { id: true, status: true, isMandatory: true } },
        },
      });

      if (!tender || tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
      }

      type S = 'not_started' | 'in_progress' | 'complete' | 'has_issues';
      const now = new Date();

      const hasBrief = !!tender.brief;
      const hasGoNoGo = !!tender.goNoGoDecision;
      const overview: S = hasBrief && hasGoNoGo ? 'complete' : hasBrief || hasGoNoGo ? 'in_progress' : 'not_started';

      const reqCount = tender.requirements.length;
      const coveredReqs = tender.requirements.filter((r) => r.coverageStatus === 'COVERED').length;
      const requirements: S = reqCount === 0 ? 'not_started' : coveredReqs === reqCount ? 'complete' : 'in_progress';

      const criteriaCount = tender.evaluationCriteria.length;
      const finalCriteria = tender.evaluationCriteria.filter((c) => c.status === 'FINAL').length;
      const criteria: S = criteriaCount === 0 ? 'not_started' : finalCriteria === criteriaCount ? 'complete' : 'in_progress';

      const hasUnread = tender.clarifications.length > 0;
      const hasClauses = tender.legalClauses.length > 0;
      const legal: S = hasUnread ? 'has_issues' : hasClauses ? 'complete' : 'not_started';

      const techCount = tender.technicalSections.length;
      const approvedTech = tender.technicalSections.filter((s) => s.status === 'APPROVED').length;
      const technical: S = techCount === 0 ? 'not_started' : approvedTech === techCount ? 'complete' : 'in_progress';

      const hasScenarios = tender.pricingScenarios.length > 0;
      const hasSelected = tender.pricingScenarios.some((s) => s.isSelected);
      const financial: S = !hasScenarios ? 'not_started' : hasSelected ? 'complete' : 'in_progress';

      const docCount = tender.generatedDocuments.length;
      const documents: S = docCount === 0 ? 'not_started' : docCount >= 2 ? 'complete' : 'in_progress';

      const fakelosReport = tender.fakelosReport as any;
      const fakelosScore = fakelosReport?.score ?? 0;
      const fakelos: S = fakelosScore >= 80 ? 'complete' : fakelosScore > 0 ? 'in_progress' : 'not_started';

      const taskCount = tender.tasks.length;
      const doneTasks = tender.tasks.filter((t) => t.status === 'DONE').length;
      const overdueTasks = tender.tasks.filter(
        (t) => t.status !== 'DONE' && t.dueDate && t.dueDate < now
      ).length;
      const tasks: S = taskCount === 0 ? 'not_started' : overdueTasks > 0 ? 'has_issues' : doneTasks === taskCount ? 'complete' : 'in_progress';

      const dlItems = tender.deadlinePlanItems;
      const mandatoryItems = dlItems.filter((d) => d.isMandatory);
      const obtainedMandatory = mandatoryItems.filter((d) => d.status === 'OBTAINED').length;
      const overdueItems = dlItems.filter((d) => d.status === 'OVERDUE').length;
      const deadline: S =
        dlItems.length === 0
          ? 'not_started'
          : overdueItems > 0
            ? 'has_issues'
            : mandatoryItems.length > 0 && obtainedMandatory === mandatoryItems.length
              ? 'complete'
              : 'in_progress';

      const activity: S = 'complete';

      return {
        overview, requirements, criteria, legal, technical, financial,
        documents, fakelos, tasks, deadline, activity,
      };
    }),
});
