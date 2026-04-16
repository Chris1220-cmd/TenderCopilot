/**
 * Backfill script: Ingest 2 years of historical awards from ΔΙΑΥΓΕΙΑ + ΚΗΜΔΗΣ.
 *
 * Run with: npm run backfill:awards
 * Options:  npm run backfill:awards -- --years=2 --resume --source=all
 */

import { PrismaClient } from '@prisma/client';
import { fetchDiavgeiaByDateRange, fetchKimdisByDateRange } from '../src/server/services/award-fetcher';
import { ingestBatch } from '../src/server/services/award-ingester';
import * as fs from 'fs';
import * as path from 'path';

const db = new PrismaClient();

// ─── CLI args ──────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name: string, defaultValue: string): string {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : defaultValue;
}
const hasFlag = (name: string) => args.includes(`--${name}`);

const YEARS = parseInt(getArg('years', '2'), 10);
const SOURCE_FILTER = getArg('source', 'all');
const RESUME = hasFlag('resume');
const DRY_RUN = hasFlag('dry-run');
const DELAY_MS = parseInt(getArg('delay', '1000'), 10);

// ─── State management ──────────────────────────────────

interface BackfillState {
  source: string;
  lastCompletedMonth: string;
  lastCompletedPage: number;
  totalInserted: number;
  totalDuplicates: number;
  totalErrors: number;
}

const STATE_FILE = path.join(process.cwd(), '.backfill-state.json');

function loadState(): BackfillState | null {
  if (!RESUME || !fs.existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    console.error('Warning: Could not parse .backfill-state.json — starting fresh');
    return null;
  }
}

function saveState(state: BackfillState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── Month generation ──────────────────────────────────

function generateMonths(years: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < years * 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

function monthToDateRange(month: string): { from: Date; to: Date } {
  const [year, m] = month.split('-').map(Number);
  const from = new Date(year, m - 1, 1);
  const to = new Date(year, m, 0, 23, 59, 59);
  return { from, to };
}

// ─── Main ──────────────────────────────────────────────

async function backfill() {
  console.log(`\nAward Backfill — ${YEARS} year(s), source: ${SOURCE_FILTER}, resume: ${RESUME}, dry-run: ${DRY_RUN}\n`);

  const months = generateMonths(YEARS);
  const sources = SOURCE_FILTER === 'all'
    ? ['DIAVGEIA', 'KIMDIS'] as const
    : [SOURCE_FILTER as 'DIAVGEIA' | 'KIMDIS'];

  let state = loadState();
  let stats = {
    inserted: state?.totalInserted ?? 0,
    duplicates: state?.totalDuplicates ?? 0,
    errors: state?.totalErrors ?? 0,
  };

  let skipUntilMonth = state?.lastCompletedMonth;
  let skipUntilSource = state?.source;
  let resumeFromPage = state ? state.lastCompletedPage + 1 : 0;
  let pastResumePoint = !RESUME;

  for (const source of sources) {
    for (const month of months) {
      if (!pastResumePoint) {
        if (source === skipUntilSource && month === skipUntilMonth) {
          pastResumePoint = true;
        } else {
          continue;
        }
      }

      const { from, to } = monthToDateRange(month);
      const fetcher = source === 'DIAVGEIA' ? fetchDiavgeiaByDateRange : fetchKimdisByDateRange;

      let page = pastResumePoint && month === skipUntilMonth ? resumeFromPage : 0;
      let hasMore = true;

      while (hasMore) {
        process.stdout.write(`\r[${month}] ${source} page ${page} — ${stats.inserted} inserted, ${stats.duplicates} dup, ${stats.errors} err    `);

        try {
          const response = await fetcher(from, to, page);

          if (!DRY_RUN && response.awards.length > 0) {
            const batch = await ingestBatch(response.awards, db);
            stats.inserted += batch.inserted;
            stats.duplicates += batch.duplicates;
            stats.errors += batch.errors;
          } else if (DRY_RUN) {
            stats.inserted += response.awards.length;
          }

          hasMore = response.hasMorePages;

          const currentState: BackfillState = {
            source,
            lastCompletedMonth: month,
            lastCompletedPage: page,
            totalInserted: stats.inserted,
            totalDuplicates: stats.duplicates,
            totalErrors: stats.errors,
          };
          saveState(currentState);

          page++;
        } catch (err) {
          const msg = `[${month}] ${source} page ${page}: ${(err as Error).message}`;
          console.error(`\nError: ${msg}`);
          fs.appendFileSync('.backfill-errors.log', `${new Date().toISOString()} ${msg}\n`);
          stats.errors++;
          hasMore = false;
        }

        await new Promise((r) => setTimeout(r, DELAY_MS));
      }

      resumeFromPage = 0;
    }
  }

  console.log(`\n\nBackfill complete!`);
  console.log(`   Inserted:   ${stats.inserted}`);
  console.log(`   Duplicates: ${stats.duplicates}`);
  console.log(`   Errors:     ${stats.errors}`);

  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
    console.log('   State file cleaned up.');
  }

  await db.$disconnect();
}

backfill().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
