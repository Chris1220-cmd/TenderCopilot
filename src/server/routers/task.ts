import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';

const taskStatusEnum = z.enum(['TODO', 'IN_PROGRESS', 'DONE']);
const taskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export const taskRouter = router({
  listByTender: protectedProcedure
    .input(z.object({ tenderId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const tender = await ctx.db.tender.findUnique({ where: { id: input.tenderId } });
      if (!tender || tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
      }

      return ctx.db.task.findMany({
        where: { tenderId: input.tenderId },
        include: {
          assignee: {
            select: { id: true, name: true, email: true, image: true },
          },
          requirement: {
            select: { id: true, text: true, category: true },
          },
        },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      });
    }),

  listMyTasks: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
    }

    return ctx.db.task.findMany({
      where: {
        assigneeId: ctx.userId,
        tender: { tenantId: ctx.tenantId },
      },
      include: {
        tender: {
          select: {
            id: true,
            title: true,
            status: true,
            submissionDeadline: true,
          },
        },
        requirement: {
          select: { id: true, text: true, category: true },
        },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        tenderId: z.string().cuid(),
        title: z.string().min(1),
        description: z.string().nullish(),
        assigneeId: z.string().cuid().nullish(),
        dueDate: z.coerce.date().nullish(),
        priority: taskPriorityEnum.optional(),
        requirementId: z.string().cuid().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const tender = await ctx.db.tender.findUnique({ where: { id: input.tenderId } });
      if (!tender || tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
      }

      return ctx.db.task.create({
        data: {
          tenderId: input.tenderId,
          title: input.title,
          description: input.description,
          assigneeId: input.assigneeId ?? undefined,
          dueDate: input.dueDate,
          priority: input.priority,
          requirementId: input.requirementId ?? undefined,
          creatorId: ctx.userId,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        title: z.string().min(1).optional(),
        description: z.string().nullish(),
        status: taskStatusEnum.optional(),
        priority: taskPriorityEnum.optional(),
        dueDate: z.coerce.date().nullish(),
        assigneeId: z.string().cuid().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const { id, ...data } = input;

      const task = await ctx.db.task.findUnique({
        where: { id },
        include: { tender: { select: { tenantId: true } } },
      });

      if (!task || task.tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found.' });
      }

      return ctx.db.task.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const task = await ctx.db.task.findUnique({
        where: { id: input.id },
        include: { tender: { select: { tenantId: true } } },
      });

      if (!task || task.tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found.' });
      }

      return ctx.db.task.delete({ where: { id: input.id } });
    }),
});
