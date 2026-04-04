import { TRPCError } from '@trpc/server';
import { checkUsage, incrementUsage, type UsageMetric } from '@/server/services/usage-service';

export function createUsageLimitCheck(metric: UsageMetric, increment: number = 1) {
  return async (tenantId: string | null) => {
    if (!tenantId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
    }

    const result = await checkUsage(tenantId, metric, increment);

    if (!result.allowed) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `You've reached your plan's limit for ${metric}. Upgrade for more.`,
        cause: {
          type: 'USAGE_LIMIT_REACHED',
          metric,
          current: result.current,
          limit: result.limit,
          percentage: result.percentage,
        },
      });
    }

    // Auto-increment after check passes
    await incrementUsage(tenantId, metric, increment);

    return result;
  };
}
