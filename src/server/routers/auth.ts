import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import { router, publicProcedure } from '@/server/trpc';
import { slugify } from '@/lib/utils';

export const authRouter = router({
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email('Invalid email address'),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        name: z.string().min(1, 'Name is required'),
        companyName: z.string().min(1, 'Company name is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { email, password, name, companyName } = input;

      try {
        // Check if user already exists
        const existingUser = await ctx.db.user.findUnique({
          where: { email },
        });

        if (existingUser) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Υπάρχει ήδη χρήστης με αυτό το email.',
          });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = await ctx.db.user.create({
          data: { email, name, hashedPassword },
        });

        // Create tenant
        let slug = slugify(companyName) || `tenant-${Date.now()}`;
        const existingTenant = await ctx.db.tenant.findUnique({
          where: { slug },
        });
        if (existingTenant) {
          slug = `${slug}-${Date.now()}`;
        }

        const tenant = await ctx.db.tenant.create({
          data: { name: companyName, slug },
        });

        // Link user to tenant
        await ctx.db.tenantUser.create({
          data: { userId: user.id, tenantId: tenant.id, role: 'ADMIN' },
        });

        // Create empty company profile
        await ctx.db.companyProfile.create({
          data: { tenantId: tenant.id, legalName: companyName, taxId: '' },
        });

        return {
          success: true,
          userId: user.id,
          tenantId: tenant.id,
        };
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        console.error('[Register] Error:', error?.message || error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error?.message || 'Αποτυχία εγγραφής. Δοκιμάστε ξανά.',
        });
      }
    }),
});
