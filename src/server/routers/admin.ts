import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';

const superAdminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const user = await ctx.db.user.findUnique({
    where: { id: ctx.userId },
    select: { isSuperAdmin: true },
  });

  if (!user?.isSuperAdmin) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Super admin access required.' });
  }

  return next({ ctx });
});

export const adminRouter = router({
  overview: superAdminProcedure.query(async ({ ctx }) => {
    const [totalTenants, totalUsers, subscriptions, recentSignups] = await Promise.all([
      ctx.db.tenant.count(),
      ctx.db.user.count(),
      ctx.db.subscription.findMany({ include: { plan: true } }),
      ctx.db.tenant.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
    ]);

    const activeTenants = subscriptions.filter(
      (s) => s.status === 'ACTIVE' || s.status === 'TRIAL'
    ).length;
    const trialTenants = subscriptions.filter((s) => s.status === 'TRIAL').length;
    const mrr = subscriptions
      .filter((s) => s.status === 'ACTIVE')
      .reduce((sum, s) => {
        const price = s.billingCycle === 'ANNUAL' ? s.plan.priceAnnual : s.plan.price;
        return sum + price;
      }, 0);
    const planDistribution = subscriptions.reduce(
      (acc, s) => {
        acc[s.plan.name] = (acc[s.plan.name] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalTenants,
      totalUsers,
      activeTenants,
      trialTenants,
      mrr,
      recentSignups,
      planDistribution,
    };
  }),

  tenants: superAdminProcedure
    .input(
      z
        .object({
          status: z
            .enum(['ALL', 'TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELLED'])
            .default('ALL'),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const filters = input || { status: 'ALL' as const };
      const tenants = await ctx.db.tenant.findMany({
        include: {
          subscription: { include: { plan: true } },
          users: {
            include: { user: { select: { id: true, email: true, name: true } } },
          },
          usageRecords: { orderBy: { period: 'desc' }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
      });

      const tenantIds = tenants.map((t) => t.id);
      const lastLogins = await ctx.db.loginEvent.groupBy({
        by: ['tenantId'],
        where: { tenantId: { in: tenantIds } },
        _max: { createdAt: true },
      });
      const lastLoginMap = new Map(lastLogins.map((l) => [l.tenantId, l._max.createdAt]));

      let result = tenants.map((t) => {
        const usage = t.usageRecords[0];
        const sub = t.subscription;
        const plan = sub?.plan;
        return {
          id: t.id,
          name: t.name,
          slug: t.slug,
          createdAt: t.createdAt,
          plan: plan?.name ?? 'None',
          status: sub?.status ?? 'NONE',
          trialEndsAt: sub?.trialEndsAt,
          userCount: t.users.length,
          lastLogin: lastLoginMap.get(t.id) ?? null,
          usage: usage
            ? {
                activeTenders: usage.activeTenders,
                maxTenders: plan?.maxActiveTenders ?? null,
                aiCreditsUsed: usage.aiCreditsUsed,
                maxAiCredits: plan?.maxAiCreditsPerMonth ?? null,
              }
            : null,
        };
      });

      if (filters.status !== 'ALL') {
        result = result.filter((t) => t.status === filters.status);
      }
      if (filters.search) {
        const s = filters.search.toLowerCase();
        result = result.filter(
          (t) => t.name.toLowerCase().includes(s) || t.slug.toLowerCase().includes(s)
        );
      }

      return result;
    }),

  tenantDetail: superAdminProcedure
    .input(z.object({ tenantId: z.string() }))
    .query(async ({ ctx, input }) => {
      const tenant = await ctx.db.tenant.findUnique({
        where: { id: input.tenantId },
        include: {
          subscription: { include: { plan: true } },
          users: {
            include: { user: { select: { id: true, email: true, name: true } } },
          },
          usageRecords: { orderBy: { period: 'desc' }, take: 1 },
        },
      });
      if (!tenant)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant not found.' });

      const loginEvents = await ctx.db.loginEvent.findMany({
        where: { tenantId: input.tenantId },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      const userLastLogins = await ctx.db.loginEvent.groupBy({
        by: ['userId'],
        where: { tenantId: input.tenantId },
        _max: { createdAt: true },
      });
      const userLoginMap = new Map(
        userLastLogins.map((l) => [l.userId, l._max.createdAt])
      );

      const usage = tenant.usageRecords[0];
      const plan = tenant.subscription?.plan;

      return {
        id: tenant.id,
        name: tenant.name,
        createdAt: tenant.createdAt,
        subscription: tenant.subscription
          ? {
              status: tenant.subscription.status,
              billingCycle: tenant.subscription.billingCycle,
              currentPeriodEnd: tenant.subscription.currentPeriodEnd,
              trialEndsAt: tenant.subscription.trialEndsAt,
              plan: plan
                ? {
                    name: plan.name,
                    slug: plan.slug,
                    price: plan.price,
                    priceAnnual: plan.priceAnnual,
                  }
                : null,
            }
          : null,
        usage:
          usage && plan
            ? [
                {
                  key: 'activeTenders',
                  label: 'Διαγωνισμοί',
                  current: usage.activeTenders,
                  max: plan.maxActiveTenders,
                },
                {
                  key: 'aiCreditsUsed',
                  label: 'AI Credits',
                  current: usage.aiCreditsUsed,
                  max: plan.maxAiCreditsPerMonth,
                },
                {
                  key: 'documentsGenerated',
                  label: 'Έγγραφα',
                  current: usage.documentsGenerated,
                  max: plan.maxDocumentsPerMonth,
                },
                {
                  key: 'searchesPerformed',
                  label: 'Αναζητήσεις',
                  current: usage.searchesPerformed,
                  max: plan.maxSearchesPerMonth,
                },
                {
                  key: 'storageUsedMB',
                  label: 'Storage (MB)',
                  current: Math.round(usage.storageUsedMB),
                  max: plan.maxStorageMB,
                },
              ]
            : [],
        users: tenant.users.map((tu) => ({
          id: tu.user.id,
          name: tu.user.name,
          email: tu.user.email,
          role: tu.role,
          lastLogin: userLoginMap.get(tu.userId) ?? null,
        })),
        loginEvents: loginEvents.map((e) => ({
          id: e.id,
          userName: e.user.name ?? e.user.email,
          ipAddress: e.ipAddress,
          deviceType: e.deviceType,
          geoCity: e.geoCity,
          geoCountry: e.geoCountry,
          createdAt: e.createdAt,
        })),
      };
    }),

  changePlan: superAdminProcedure
    .input(z.object({ tenantId: z.string(), planId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.subscription.update({
        where: { tenantId: input.tenantId },
        data: { planId: input.planId },
      });
    }),

  extendTrial: superAdminProcedure
    .input(z.object({ tenantId: z.string(), days: z.number().min(1).max(90) }))
    .mutation(async ({ ctx, input }) => {
      const sub = await ctx.db.subscription.findUnique({
        where: { tenantId: input.tenantId },
      });
      if (!sub) throw new TRPCError({ code: 'NOT_FOUND' });
      const newEnd = new Date(
        (sub.trialEndsAt ?? new Date()).getTime() + input.days * 24 * 60 * 60 * 1000
      );
      return ctx.db.subscription.update({
        where: { tenantId: input.tenantId },
        data: { status: 'TRIAL', trialEndsAt: newEnd, currentPeriodEnd: newEnd },
      });
    }),

  cancelSubscription: superAdminProcedure
    .input(z.object({ tenantId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.subscription.update({
        where: { tenantId: input.tenantId },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
    }),

  plans: superAdminProcedure.query(async ({ ctx }) => {
    return ctx.db.plan.findMany({ orderBy: { sortOrder: 'asc' } });
  }),

  updatePlan: superAdminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        price: z.number().min(0).optional(),
        priceAnnual: z.number().min(0).optional(),
        maxActiveTenders: z.number().nullable().optional(),
        maxAiCreditsPerMonth: z.number().nullable().optional(),
        maxDocumentsPerMonth: z.number().nullable().optional(),
        maxSearchesPerMonth: z.number().nullable().optional(),
        maxStorageMB: z.number().nullable().optional(),
        features: z.record(z.boolean()).optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.plan.update({ where: { id }, data });
    }),

  alerts: superAdminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    const [expiringTrials, expiredSubs, allTenants] = await Promise.all([
      ctx.db.subscription.findMany({
        where: { status: 'TRIAL', trialEndsAt: { lte: threeDaysFromNow, gte: now } },
        include: { tenant: true, plan: true },
      }),
      ctx.db.subscription.findMany({
        where: { status: 'EXPIRED' },
        include: { tenant: true },
      }),
      ctx.db.tenant.findMany({
        include: {
          subscription: { include: { plan: true } },
          usageRecords: { orderBy: { period: 'desc' }, take: 1 },
        },
      }),
    ]);

    const lastLogins = await ctx.db.loginEvent.groupBy({
      by: ['tenantId'],
      _max: { createdAt: true },
    });
    const loginMap = new Map(lastLogins.map((l) => [l.tenantId, l._max.createdAt]));

    const alerts: Array<{
      type: 'trial_expiring' | 'expired' | 'churn_risk' | 'upgrade_opportunity';
      severity: 'warning' | 'error' | 'info';
      tenantId: string;
      tenantName: string;
      message: string;
    }> = [];

    for (const sub of expiringTrials) {
      const daysLeft = Math.ceil(
        ((sub.trialEndsAt?.getTime() ?? 0) - now.getTime()) / (24 * 60 * 60 * 1000)
      );
      alerts.push({
        type: 'trial_expiring',
        severity: 'warning',
        tenantId: sub.tenant.id,
        tenantName: sub.tenant.name,
        message: `Trial expires in ${daysLeft} days`,
      });
    }

    for (const sub of expiredSubs) {
      alerts.push({
        type: 'expired',
        severity: 'error',
        tenantId: sub.tenant.id,
        tenantName: sub.tenant.name,
        message: 'Subscription expired',
      });
    }

    for (const tenant of allTenants) {
      const lastLogin = loginMap.get(tenant.id);
      if (lastLogin && lastLogin < fiveDaysAgo && tenant.subscription?.status === 'ACTIVE') {
        alerts.push({
          type: 'churn_risk',
          severity: 'error',
          tenantId: tenant.id,
          tenantName: tenant.name,
          message: `No login for ${Math.ceil((now.getTime() - lastLogin.getTime()) / (24 * 60 * 60 * 1000))} days`,
        });
      }

      const usage = tenant.usageRecords[0];
      const plan = tenant.subscription?.plan;
      if (usage && plan) {
        const checks = [
          { current: usage.activeTenders, max: plan.maxActiveTenders, label: 'tenders' },
          {
            current: usage.aiCreditsUsed,
            max: plan.maxAiCreditsPerMonth,
            label: 'AI credits',
          },
        ];
        for (const c of checks) {
          if (c.max && c.current / c.max >= 0.8) {
            alerts.push({
              type: 'upgrade_opportunity',
              severity: 'info',
              tenantId: tenant.id,
              tenantName: tenant.name,
              message: `${Math.round((c.current / c.max) * 100)}% of ${c.label} used`,
            });
          }
        }
      }
    }

    return alerts.sort((a, b) => {
      const sev = { error: 0, warning: 1, info: 2 };
      return sev[a.severity] - sev[b.severity];
    });
  }),
});
