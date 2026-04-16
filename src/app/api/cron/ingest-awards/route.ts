import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchDiavgeiaByDateRange, fetchKimdisByDateRange } from '@/server/services/award-fetcher';
import { ingestBatch } from '@/server/services/award-ingester';
import type { AwardResult } from '@/server/services/award-fetcher';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const MAX_RUNTIME_MS = 55_000;
  const MAX_RECORDS = 500;

  const results: Record<string, { inserted: number; duplicates: number; errors: number }> = {};

  try {
    const sources = ['DIAVGEIA', 'KIMDIS'] as const;

    for (const source of sources) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log(`[CronAwards] Timeout approaching, stopping at source ${source}`);
        break;
      }

      const latestAward = await db.historicalAward.findFirst({
        where: { source },
        orderBy: { awardDate: 'desc' },
        select: { awardDate: true },
      });

      const fromDate = latestAward
        ? new Date(latestAward.awardDate.getTime() - 24 * 60 * 60 * 1000)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const toDate = new Date();

      let allAwards: AwardResult[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore && allAwards.length < MAX_RECORDS && Date.now() - startTime < MAX_RUNTIME_MS) {
        const fetcher = source === 'DIAVGEIA'
          ? fetchDiavgeiaByDateRange
          : fetchKimdisByDateRange;

        const response = await fetcher(fromDate, toDate, page);
        allAwards = allAwards.concat(response.awards);
        hasMore = response.hasMorePages;
        page++;
      }

      const batchResult = await ingestBatch(allAwards, db);
      results[source] = batchResult;

      console.log(`[CronAwards] ${source}: +${batchResult.inserted} inserted, ${batchResult.duplicates} dup, ${batchResult.errors} err`);
    }

    return NextResponse.json({
      success: true,
      results,
      runtime_ms: Date.now() - startTime,
    });
  } catch (err) {
    console.error('[CronAwards] Fatal error:', err);
    return NextResponse.json(
      { error: 'Internal error', message: (err as Error).message },
      { status: 500 },
    );
  }
}
