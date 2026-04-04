import { db } from '@/lib/db';

export type UsageMetric =
  | 'activeTenders'
  | 'aiCreditsUsed'
  | 'documentsGenerated'
  | 'searchesPerformed'
  | 'storageUsedMB';

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function getOrCreateUsageRecord(tenantId: string) {
  const period = getCurrentPeriod();

  let record = await db.usageRecord.findUnique({
    where: { tenantId_period: { tenantId, period } },
  });

  if (!record) {
    const prevRecords = await db.usageRecord.findMany({
      where: { tenantId },
      orderBy: { period: 'desc' },
      take: 1,
    });
    const prevStorage = prevRecords[0]?.storageUsedMB ?? 0;

    const activeTenderCount = await db.tender.count({
      where: {
        tenantId,
        status: { notIn: ['WON', 'LOST'] },
      },
    });

    record = await db.usageRecord.create({
      data: {
        tenantId,
        period,
        activeTenders: activeTenderCount,
        storageUsedMB: prevStorage,
      },
    });
  }

  return record;
}

export async function getSubscriptionWithPlan(tenantId: string) {
  const subscription = await db.subscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });

  if (!subscription) return null;

  if (
    subscription.status === 'TRIAL' &&
    subscription.trialEndsAt &&
    subscription.trialEndsAt < new Date()
  ) {
    await db.subscription.update({
      where: { id: subscription.id },
      data: { status: 'EXPIRED' },
    });
    subscription.status = 'EXPIRED';
  }

  return subscription;
}

interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number | null;
  percentage: number;
  warning: boolean;
}

export async function checkUsage(
  tenantId: string,
  metric: UsageMetric,
  increment: number = 1
): Promise<LimitCheckResult> {
  const subscription = await getSubscriptionWithPlan(tenantId);

  if (!subscription) {
    return { allowed: false, current: 0, limit: 0, percentage: 100, warning: false };
  }

  if (subscription.status === 'EXPIRED' || subscription.status === 'CANCELLED') {
    return { allowed: false, current: 0, limit: 0, percentage: 100, warning: false };
  }

  const plan = subscription.plan;
  const usage = await getOrCreateUsageRecord(tenantId);

  const limitMap: Record<UsageMetric, { current: number; max: number | null }> = {
    activeTenders: { current: usage.activeTenders, max: plan.maxActiveTenders },
    aiCreditsUsed: { current: usage.aiCreditsUsed, max: plan.maxAiCreditsPerMonth },
    documentsGenerated: { current: usage.documentsGenerated, max: plan.maxDocumentsPerMonth },
    searchesPerformed: { current: usage.searchesPerformed, max: plan.maxSearchesPerMonth },
    storageUsedMB: { current: usage.storageUsedMB, max: plan.maxStorageMB },
  };

  const { current, max } = limitMap[metric];

  if (max === null) {
    return { allowed: true, current, limit: null, percentage: 0, warning: false };
  }

  const afterIncrement = current + increment;
  const percentage = Math.round((afterIncrement / max) * 100);

  return {
    allowed: afterIncrement <= max,
    current,
    limit: max,
    percentage: Math.min(percentage, 100),
    warning: percentage >= 80 && percentage < 100,
  };
}

export async function incrementUsage(
  tenantId: string,
  metric: UsageMetric,
  amount: number = 1
) {
  const period = getCurrentPeriod();
  await getOrCreateUsageRecord(tenantId);

  await db.usageRecord.update({
    where: { tenantId_period: { tenantId, period } },
    data: { [metric]: { increment: amount } },
  });
}

export async function decrementUsage(
  tenantId: string,
  metric: UsageMetric,
  amount: number = 1
) {
  const period = getCurrentPeriod();
  const record = await getOrCreateUsageRecord(tenantId);

  const currentVal = record[metric] as number;
  const newVal = Math.max(0, currentVal - amount);

  await db.usageRecord.update({
    where: { tenantId_period: { tenantId, period } },
    data: { [metric]: newVal },
  });
}

export async function syncActiveTenderCount(tenantId: string) {
  const count = await db.tender.count({
    where: {
      tenantId,
      status: { notIn: ['WON', 'LOST'] },
    },
  });

  const period = getCurrentPeriod();
  await getOrCreateUsageRecord(tenantId);

  await db.usageRecord.update({
    where: { tenantId_period: { tenantId, period } },
    data: { activeTenders: count },
  });
}

export async function getUsageSummary(tenantId: string) {
  const subscription = await getSubscriptionWithPlan(tenantId);
  if (!subscription) return null;

  const usage = await getOrCreateUsageRecord(tenantId);
  const plan = subscription.plan;

  const metrics = [
    { key: 'activeTenders', label: 'Active Tenders', current: usage.activeTenders, max: plan.maxActiveTenders },
    { key: 'aiCreditsUsed', label: 'AI Credits', current: usage.aiCreditsUsed, max: plan.maxAiCreditsPerMonth },
    { key: 'documentsGenerated', label: 'Documents', current: usage.documentsGenerated, max: plan.maxDocumentsPerMonth },
    { key: 'searchesPerformed', label: 'Searches', current: usage.searchesPerformed, max: plan.maxSearchesPerMonth },
    { key: 'storageUsedMB', label: 'Storage (MB)', current: Math.round(usage.storageUsedMB), max: plan.maxStorageMB },
  ] as const;

  return {
    plan: { name: plan.name, slug: plan.slug },
    subscription: {
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEndsAt: subscription.trialEndsAt,
    },
    metrics: metrics.map((m) => ({
      ...m,
      percentage: m.max ? Math.round((m.current / m.max) * 100) : 0,
      unlimited: m.max === null,
    })),
  };
}
