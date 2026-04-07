import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';

export const tenantRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No tenant associated with your account.',
      });
    }
    return ctx.db.tenant.findUniqueOrThrow({
      where: { id: ctx.tenantId },
      include: {
        subscription: { include: { plan: true } },
      },
    });
  }),

  addCountry: protectedProcedure
    .input(z.object({ country: z.string().length(2) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const tenant = await ctx.db.tenant.findUniqueOrThrow({
        where: { id: ctx.tenantId },
        include: { subscription: { include: { plan: true } } },
      });

      // Check if country already added
      if (tenant.countries.includes(input.country)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Country already added.' });
      }

      // Check subscription limit
      const maxCountries = tenant.subscription?.plan?.maxCountries;
      if (maxCountries !== null && maxCountries !== undefined && tenant.countries.length >= maxCountries) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Upgrade your plan for more countries.' });
      }

      // Validate country is supported
      const { getCountryConfig } = await import('@/lib/country-config');
      getCountryConfig(input.country); // throws if unsupported

      // Add country to tenant
      await ctx.db.tenant.update({
        where: { id: ctx.tenantId },
        data: { countries: { push: input.country } },
      });

      // Create empty company profile for the new country
      await ctx.db.companyProfile.create({
        data: { tenantId: ctx.tenantId, country: input.country, legalName: '', taxId: '' },
      });

      return { success: true };
    }),

  getMembers: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No tenant associated with your account.',
      });
    }

    const members = await ctx.db.tenantUser.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return members;
  }),

  invite: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: z.enum(['ADMIN', 'MEMBER', 'EXTERNAL_COLLABORATOR']).default('MEMBER'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No tenant associated with your account.',
        });
      }

      // Check if already a member
      const existingUser = await ctx.db.user.findUnique({
        where: { email: input.email },
      });

      if (existingUser) {
        const existingMembership = await ctx.db.tenantUser.findUnique({
          where: {
            tenantId_userId: {
              tenantId: ctx.tenantId,
              userId: existingUser.id,
            },
          },
        });

        if (existingMembership) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This user is already a member of your team.',
          });
        }
      }

      // Create invitation
      const invitation = await ctx.db.invitation.upsert({
        where: {
          tenantId_email: {
            tenantId: ctx.tenantId,
            email: input.email,
          },
        },
        update: {
          role: input.role,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
        create: {
          tenantId: ctx.tenantId,
          email: input.email,
          role: input.role,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      // TODO: Send invitation email via nodemailer

      return invitation;
    }),

  updateRole: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.enum(['ADMIN', 'MEMBER', 'EXTERNAL_COLLABORATOR']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No tenant associated with your account.',
        });
      }

      const updated = await ctx.db.tenantUser.update({
        where: {
          tenantId_userId: {
            tenantId: ctx.tenantId,
            userId: input.userId,
          },
        },
        data: {
          role: input.role,
        },
      });

      return updated;
    }),
});
