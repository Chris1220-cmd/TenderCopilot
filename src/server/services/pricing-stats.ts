/**
 * Pricing Statistics — pure computation functions for pricing intelligence.
 * All functions take a PrismaClient + filter params and return typed results.
 */

import type { PrismaClient } from '@prisma/client';

// ─── Types ──────────────────────────────────────────────

export interface PercentilesResult {
  p25: number | null;
  p50: number | null;
  p75: number | null;
}

export interface PricingStatsResult {
  count: number;
  mean: number | null;
  median: number | null;
  p25: number | null;
  p75: number | null;
  stdDev: number | null;
  min: number | null;
  max: number | null;
}

export interface CpvStatsResult {
  cpv: string;
  awardCount: number;
  amountStats: PricingStatsResult;
  ratioStats: PricingStatsResult;
  samplePeriodMonths: number;
}

export interface AuthorityProfileResult {
  authority: string;
  totalAwards: number;
  avgAmount: number | null;
  topWinners: Array<{ name: string; wins: number; avgAmount: number | null }>;
  avgRatio: number | null;
  sectors: Array<{ cpv: string; count: number }>;
}

export interface CompetitorEntry {
  name: string;
  wins: number;
  avgAmount: number | null;
  avgRatio: number | null;
  lastWinDate: Date | null;
}

export interface PricingAdviceResult {
  recommendedRange: { low: number; mid: number; high: number } | null;
  ratioStats: PricingStatsResult;
  competitorCount: number;
  topCompetitors: CompetitorEntry[];
  authority: AuthorityProfileResult | null;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  sampleSize: number;
}

// ─── Pure Math Functions ────────────────────────────────

export function computePercentiles(sorted: number[]): PercentilesResult {
  if (sorted.length === 0) return { p25: null, p50: null, p75: null };

  const n = sorted.length;

  // Median of a sub-array (handles even/odd length with averaging)
  const median = (arr: number[]): number => {
    const mid = Math.floor(arr.length / 2);
    if (arr.length % 2 === 1) return arr[mid];
    return (arr[mid - 1] + arr[mid]) / 2;
  };

  // p50: median of the full array
  const p50 = median(sorted);

  let p25: number;
  let p75: number;

  if (n === 1) {
    p25 = sorted[0];
    p75 = sorted[0];
  } else {
    // Split into lower and upper halves, excluding the median element for odd-length arrays
    const half = Math.floor(n / 2);
    const lower = sorted.slice(0, half);
    const upper = n % 2 === 0 ? sorted.slice(half) : sorted.slice(half + 1);
    p25 = median(lower);
    p75 = median(upper);
  }

  return { p25, p50, p75 };
}

export function computeStatsFromValues(values: number[]): PricingStatsResult {
  if (values.length === 0) {
    return { count: 0, mean: null, median: null, p25: null, p75: null, stdDev: null, min: null, max: null };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;
  const { p25, p50, p75 } = computePercentiles(sorted);

  let stdDev: number | null = null;
  if (sorted.length >= 3) {
    const variance = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / sorted.length;
    stdDev = Math.round(Math.sqrt(variance) * 10000) / 10000;
  }

  return {
    count: sorted.length,
    mean: Math.round(mean * 10000) / 10000,
    median: p50,
    p25,
    p75,
    stdDev,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

// ─── DB-Backed Functions ────────────────────────────────

export async function computeCpvStats(
  db: PrismaClient,
  cpvPrimary: string,
  yearsBack: number = 2,
): Promise<CpvStatsResult> {
  const since = new Date();
  since.setFullYear(since.getFullYear() - yearsBack);

  const awards = await db.historicalAward.findMany({
    where: {
      cpvPrimary,
      awardDate: { gte: since },
    },
    select: {
      awardAmount: true,
      budgetAmount: true,
      awardRatio: true,
    },
  });

  const amounts = awards
    .map((a) => a.awardAmount ? Number(a.awardAmount) : null)
    .filter((v): v is number => v != null);

  const ratios = awards
    .map((a) => a.awardRatio)
    .filter((v): v is number => v != null);

  return {
    cpv: cpvPrimary,
    awardCount: awards.length,
    amountStats: computeStatsFromValues(amounts),
    ratioStats: computeStatsFromValues(ratios),
    samplePeriodMonths: yearsBack * 12,
  };
}

export async function computeAuthorityProfile(
  db: PrismaClient,
  authorityNormalized: string,
): Promise<AuthorityProfileResult> {
  const awards = await db.historicalAward.findMany({
    where: { authorityNormalized },
    select: {
      awardAmount: true,
      awardRatio: true,
      winnerNormalized: true,
      winner: true,
      cpvPrimary: true,
    },
  });

  const amounts = awards
    .map((a) => a.awardAmount ? Number(a.awardAmount) : null)
    .filter((v): v is number => v != null);
  const avgAmount = amounts.length > 0
    ? Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length)
    : null;

  const ratios = awards
    .map((a) => a.awardRatio)
    .filter((v): v is number => v != null);
  const avgRatio = ratios.length > 0
    ? Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 10000) / 10000
    : null;

  // Top winners
  const winnerMap = new Map<string, { displayName: string; count: number; amounts: number[] }>();
  for (const a of awards) {
    if (!a.winnerNormalized || a.winnerNormalized === 'δεν αναφερεται') continue;
    const existing = winnerMap.get(a.winnerNormalized) || { displayName: a.winner, count: 0, amounts: [] };
    existing.count++;
    if (a.awardAmount) existing.amounts.push(Number(a.awardAmount));
    winnerMap.set(a.winnerNormalized, existing);
  }
  const topWinners = Array.from(winnerMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((w) => ({
      name: w.displayName,
      wins: w.count,
      avgAmount: w.amounts.length > 0
        ? Math.round(w.amounts.reduce((a, b) => a + b, 0) / w.amounts.length)
        : null,
    }));

  // Sectors (top CPV categories)
  const cpvMap = new Map<string, number>();
  for (const a of awards) {
    if (!a.cpvPrimary) continue;
    cpvMap.set(a.cpvPrimary, (cpvMap.get(a.cpvPrimary) || 0) + 1);
  }
  const sectors = Array.from(cpvMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cpv, count]) => ({ cpv, count }));

  return {
    authority: authorityNormalized,
    totalAwards: awards.length,
    avgAmount,
    topWinners,
    avgRatio,
    sectors,
  };
}

export async function computeCompetitorRanking(
  db: PrismaClient,
  cpvPrimary: string,
  budgetMin?: number,
  budgetMax?: number,
): Promise<CompetitorEntry[]> {
  const where: any = { cpvPrimary };
  if (budgetMin != null || budgetMax != null) {
    where.awardAmount = {};
    if (budgetMin != null) where.awardAmount.gte = budgetMin;
    if (budgetMax != null) where.awardAmount.lte = budgetMax;
  }

  const awards = await db.historicalAward.findMany({
    where,
    select: {
      winner: true,
      winnerNormalized: true,
      awardAmount: true,
      awardRatio: true,
      awardDate: true,
    },
  });

  const competitorMap = new Map<string, {
    displayName: string;
    wins: number;
    amounts: number[];
    ratios: number[];
    lastDate: Date;
  }>();

  for (const a of awards) {
    if (!a.winnerNormalized || a.winnerNormalized === 'δεν αναφερεται') continue;
    const existing = competitorMap.get(a.winnerNormalized) || {
      displayName: a.winner,
      wins: 0,
      amounts: [],
      ratios: [],
      lastDate: a.awardDate,
    };
    existing.wins++;
    if (a.awardAmount) existing.amounts.push(Number(a.awardAmount));
    if (a.awardRatio) existing.ratios.push(a.awardRatio);
    if (a.awardDate > existing.lastDate) existing.lastDate = a.awardDate;
    competitorMap.set(a.winnerNormalized, existing);
  }

  return Array.from(competitorMap.values())
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 10)
    .map((c) => ({
      name: c.displayName,
      wins: c.wins,
      avgAmount: c.amounts.length > 0
        ? Math.round(c.amounts.reduce((a, b) => a + b, 0) / c.amounts.length)
        : null,
      avgRatio: c.ratios.length > 0
        ? Math.round((c.ratios.reduce((a, b) => a + b, 0) / c.ratios.length) * 10000) / 10000
        : null,
      lastWinDate: c.lastDate,
    }));
}

export async function computePricingAdvice(
  db: PrismaClient,
  tender: { cpvPrimary: string | null; budget: number | null; authorityNormalized: string | null },
): Promise<PricingAdviceResult> {
  const cpv = tender.cpvPrimary;

  if (!cpv) {
    return {
      recommendedRange: null,
      ratioStats: computeStatsFromValues([]),
      competitorCount: 0,
      topCompetitors: [],
      authority: null,
      confidence: 'insufficient',
      sampleSize: 0,
    };
  }

  const cpvStats = await computeCpvStats(db, cpv);
  const competitors = await computeCompetitorRanking(db, cpv);
  const authority = tender.authorityNormalized
    ? await computeAuthorityProfile(db, tender.authorityNormalized)
    : null;

  // Compute recommended range based on budget * ratio percentiles
  let recommendedRange: { low: number; mid: number; high: number } | null = null;
  if (tender.budget && cpvStats.ratioStats.p25 != null && cpvStats.ratioStats.p50 != null && cpvStats.ratioStats.p75 != null) {
    recommendedRange = {
      low: Math.round(tender.budget * cpvStats.ratioStats.p25),
      mid: Math.round(tender.budget * cpvStats.ratioStats.p50),
      high: Math.round(tender.budget * cpvStats.ratioStats.p75),
    };
  } else if (tender.budget && cpvStats.amountStats.p25 != null) {
    // Fallback: use amount percentiles directly
    recommendedRange = {
      low: Math.round(cpvStats.amountStats.p25!),
      mid: Math.round(cpvStats.amountStats.p50!),
      high: Math.round(cpvStats.amountStats.p75!),
    };
  }

  // Confidence based on sample size
  let confidence: 'high' | 'medium' | 'low' | 'insufficient';
  if (cpvStats.awardCount >= 20) confidence = 'high';
  else if (cpvStats.awardCount >= 10) confidence = 'medium';
  else if (cpvStats.awardCount >= 3) confidence = 'low';
  else confidence = 'insufficient';

  return {
    recommendedRange,
    ratioStats: cpvStats.ratioStats,
    competitorCount: competitors.length,
    topCompetitors: competitors,
    authority,
    confidence,
    sampleSize: cpvStats.awardCount,
  };
}
