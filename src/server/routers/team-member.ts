import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';
import {
  teamMemberCreateSchema,
  teamMemberUpdateSchema,
} from '@/lib/team-member-schemas';

export const teamMemberRouter = router({
  // ─── Queries ──────────────────────────────────────────────

  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
    }

    return ctx.db.teamMember.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
        _count: {
          select: {
            education: true,
            experience: true,
            certifications: true,
            assignments: true,
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const member = await ctx.db.teamMember.findUnique({
        where: { id: input.id },
        include: {
          education: { orderBy: { year: 'desc' } },
          experience: { orderBy: { startYear: 'desc' } },
          certifications: { orderBy: { name: 'asc' } },
          assignments: {
            include: {
              tender: { select: { id: true, title: true, status: true } },
            },
          },
        },
      });

      if (!member || member.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Team member not found.' });
      }

      return member;
    }),

  // ─── Mutations ────────────────────────────────────────────

  create: protectedProcedure
    .input(teamMemberCreateSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const { education, experience, certifications, ...memberData } = input;

      return ctx.db.teamMember.create({
        data: {
          tenantId: ctx.tenantId,
          ...memberData,
          education: { create: education.map(({ id: _id, ...e }) => e) },
          experience: {
            create: experience.map(({ id: _id, ...e }) => ({
              ...e,
              budget: e.budget != null ? e.budget : undefined,
            })),
          },
          certifications: { create: certifications.map(({ id: _id, ...c }) => c) },
        },
        include: {
          education: true,
          experience: true,
          certifications: true,
        },
      });
    }),

  update: protectedProcedure
    .input(teamMemberUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const { id, education, experience, certifications, ...memberData } = input;

      const existing = await ctx.db.teamMember.findUnique({ where: { id } });
      if (!existing || existing.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Team member not found.' });
      }

      return ctx.db.$transaction(async (tx) => {
        await tx.teamMember.update({
          where: { id },
          data: memberData,
        });

        if (education !== undefined) {
          await tx.teamMemberEducation.deleteMany({ where: { memberId: id } });
          if (education.length > 0) {
            await tx.teamMemberEducation.createMany({
              data: education.map(({ id: _id, ...e }) => ({ ...e, memberId: id })),
            });
          }
        }

        if (experience !== undefined) {
          await tx.teamMemberExperience.deleteMany({ where: { memberId: id } });
          if (experience.length > 0) {
            await tx.teamMemberExperience.createMany({
              data: experience.map(({ id: _id, ...e }) => ({
                ...e,
                memberId: id,
                budget: e.budget != null ? e.budget : undefined,
              })),
            });
          }
        }

        if (certifications !== undefined) {
          await tx.teamMemberCertification.deleteMany({ where: { memberId: id } });
          if (certifications.length > 0) {
            await tx.teamMemberCertification.createMany({
              data: certifications.map(({ id: _id, ...c }) => ({ ...c, memberId: id })),
            });
          }
        }

        // Sync mappedStaffName on any assigned TeamRequirements
        if (memberData.fullName) {
          await tx.teamRequirement.updateMany({
            where: { assignedMemberId: id },
            data: { mappedStaffName: memberData.fullName },
          });
        }

        return tx.teamMember.findUnique({
          where: { id },
          include: { education: true, experience: true, certifications: true },
        });
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const member = await ctx.db.teamMember.findUnique({
        where: { id: input.id },
        include: { _count: { select: { assignments: true } } },
      });

      if (!member || member.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Team member not found.' });
      }

      // Soft delete if has assignments, hard delete otherwise
      if (member._count.assignments > 0) {
        return ctx.db.teamMember.update({
          where: { id: input.id },
          data: { isActive: false },
        });
      }

      return ctx.db.teamMember.delete({ where: { id: input.id } });
    }),

  // ─── Assignment ───────────────────────────────────────────

  assignToRequirement: protectedProcedure
    .input(z.object({
      requirementId: z.string().cuid(),
      memberId: z.string().cuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const member = await ctx.db.teamMember.findUnique({ where: { id: input.memberId } });
      if (!member || member.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Team member not found.' });
      }

      return ctx.db.teamRequirement.update({
        where: { id: input.requirementId },
        data: {
          assignedMemberId: input.memberId,
          mappedStaffName: member.fullName,
          status: 'COVERED',
        },
      });
    }),

  unassignFromRequirement: protectedProcedure
    .input(z.object({ requirementId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      return ctx.db.teamRequirement.update({
        where: { id: input.requirementId },
        data: {
          assignedMemberId: null,
          mappedStaffName: null,
          status: 'UNMAPPED',
        },
      });
    }),
});
