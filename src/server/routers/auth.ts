import { z } from 'zod';
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

      // Check if user already exists
      const existingUser = await ctx.db.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new Error('A user with this email already exists.');
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user, tenant, tenant membership, and company profile in a transaction
      const result = await ctx.db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            name,
            hashedPassword,
          },
        });

        const slug = slugify(companyName) || `tenant-${Date.now()}`;

        // Ensure slug uniqueness
        let finalSlug = slug;
        const existingTenant = await tx.tenant.findUnique({
          where: { slug: finalSlug },
        });
        if (existingTenant) {
          finalSlug = `${slug}-${Date.now()}`;
        }

        const tenant = await tx.tenant.create({
          data: {
            name: companyName,
            slug: finalSlug,
          },
        });

        await tx.tenantUser.create({
          data: {
            userId: user.id,
            tenantId: tenant.id,
            role: 'ADMIN',
          },
        });

        await tx.companyProfile.create({
          data: {
            tenantId: tenant.id,
            legalName: companyName,
            taxId: '',
          },
        });

        return { user, tenant };
      });

      return {
        success: true,
        userId: result.user.id,
        tenantId: result.tenant.id,
      };
    }),
});
