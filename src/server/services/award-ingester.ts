/**
 * Award Ingester — dedup-and-insert logic for HistoricalAward records.
 * Used by both the backfill script and the daily cron job.
 */

import type { PrismaClient, AwardSource } from '@prisma/client';
import type { AwardResult } from './award-fetcher';
import {
  normalizeCompanyName,
  normalizeAuthority,
  computeAwardRatio,
} from './award-normalizer';

// ─── Types ──────────────────────────────────────────────

export interface AwardRecord {
  source: AwardSource;
  sourceUrl: string;
  sourceRefId: string | null;
  title: string;
  winner: string;
  winnerNormalized: string;
  awardAmount: number | null;
  budgetAmount: number | null;
  awardRatio: number | null;
  authority: string;
  authorityNormalized: string;
  region: string | null;
  cpvCodes: string[];
  cpvPrimary: string | null;
  tenderType: string | null;
  procedureType: string | null;
  awardDate: Date;
  publishedDate: Date | null;
  numberOfBids: number | null;
  rawJson: any;
}

export type IngestResult = 'inserted' | 'duplicate-url' | 'duplicate-fuzzy' | 'error';

// ─── Mapping ────────────────────────────────────────────

export function mapAwardToRecord(award: AwardResult): AwardRecord {
  const cpvPrimary = award.cpvCodes.length > 0
    ? award.cpvCodes[0].split('-')[0]
    : null;

  return {
    source: award.source as AwardSource,
    sourceUrl: award.sourceUrl,
    sourceRefId: null,
    title: award.title,
    winner: award.winner,
    winnerNormalized: normalizeCompanyName(award.winner),
    awardAmount: award.amount ?? null,
    budgetAmount: award.budgetAmount ?? null,
    awardRatio: computeAwardRatio(award.amount ?? null, award.budgetAmount ?? null),
    authority: award.authority,
    authorityNormalized: normalizeAuthority(award.authority),
    region: null,
    cpvCodes: award.cpvCodes,
    cpvPrimary,
    tenderType: null,
    procedureType: null,
    awardDate: award.date,
    publishedDate: null,
    numberOfBids: award.numberOfBids ?? null,
    rawJson: null,
  };
}

// ─── Dedup & Insert ─────────────────────────────────────

export async function dedupAndInsert(
  award: AwardResult,
  db: PrismaClient,
): Promise<IngestResult> {
  try {
    const record = mapAwardToRecord(award);

    // 1. URL-based dedup
    const existingByUrl = await db.historicalAward.findUnique({
      where: { sourceUrl: record.sourceUrl },
      select: { id: true },
    });
    if (existingByUrl) return 'duplicate-url';

    // 2. Fuzzy cross-source dedup
    if (record.awardAmount != null && record.winnerNormalized && record.authorityNormalized) {
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      const fuzzyMatch = await db.historicalAward.findFirst({
        where: {
          authorityNormalized: record.authorityNormalized,
          winnerNormalized: record.winnerNormalized,
          awardAmount: record.awardAmount,
          awardDate: {
            gte: new Date(record.awardDate.getTime() - threeDaysMs),
            lte: new Date(record.awardDate.getTime() + threeDaysMs),
          },
        },
        select: { id: true },
      });
      if (fuzzyMatch) return 'duplicate-fuzzy';
    }

    // 3. Insert
    await db.historicalAward.create({ data: record });
    return 'inserted';
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      return 'duplicate-url';
    }
    console.error('[AwardIngester] Insert error:', (err as Error).message);
    return 'error';
  }
}

export async function ingestBatch(
  awards: AwardResult[],
  db: PrismaClient,
): Promise<{ inserted: number; duplicates: number; errors: number }> {
  let inserted = 0;
  let duplicates = 0;
  let errors = 0;

  for (const award of awards) {
    const result = await dedupAndInsert(award, db);
    switch (result) {
      case 'inserted': inserted++; break;
      case 'duplicate-url':
      case 'duplicate-fuzzy': duplicates++; break;
      case 'error': errors++; break;
    }
  }

  return { inserted, duplicates, errors };
}
