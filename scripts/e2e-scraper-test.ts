/**
 * End-to-end scraper health check.
 * Calls tenderDiscovery.searchTenders() for each source in isolation,
 * reports count + latency + error per source.
 * Usage: npx tsx scripts/e2e-scraper-test.ts
 */
import { tenderDiscovery } from '../src/server/services/tender-discovery';
import { TENDER_SOURCES } from '../src/data/tender-sources';

type Result = {
  id: string;
  name: string;
  country: string;
  category: string;
  count: number;
  sample?: string;
  docUrl?: string;
  ms: number;
  error?: string;
};

async function testOne(source: { id: string; name: string; country: string; category: string }): Promise<Result> {
  const t0 = Date.now();
  try {
    const tenders = await tenderDiscovery.searchTenders({
      sources: [source.id],
      showAll: true,
    } as any);
    const ms = Date.now() - t0;
    const first = tenders[0];
    return {
      id: source.id,
      name: source.name,
      country: source.country,
      category: source.category,
      count: tenders.length,
      sample: first?.title?.slice(0, 70),
      docUrl: first?.sourceUrl,
      ms,
    };
  } catch (err: any) {
    return {
      id: source.id,
      name: source.name,
      country: source.country,
      category: source.category,
      count: 0,
      ms: Date.now() - t0,
      error: err?.message || String(err),
    };
  }
}

async function main() {
  const onlyIds = process.argv.slice(2);
  const sources = (onlyIds.length > 0
    ? TENDER_SOURCES.filter((s) => onlyIds.includes(s.id))
    : TENDER_SOURCES) as any[];

  console.log(`\n=== Scraper Test: ${sources.length} sources ===\n`);

  const results: Result[] = [];
  // Run sequentially to isolate failures and avoid hammering targets
  for (const s of sources) {
    process.stdout.write(`[${s.country}] ${s.id.padEnd(15)} ... `);
    const r = await testOne(s);
    results.push(r);
    if (r.error) {
      console.log(`ERROR  (${r.ms}ms) ${r.error.slice(0, 100)}`);
    } else {
      console.log(`${String(r.count).padStart(4)} tenders (${r.ms}ms)${r.sample ? ' | ' + r.sample : ''}`);
    }
  }

  console.log('\n=== Summary ===');
  const ok = results.filter((r) => !r.error && r.count > 0);
  const empty = results.filter((r) => !r.error && r.count === 0);
  const fail = results.filter((r) => r.error);
  console.log(`  OK with data:    ${ok.length}/${results.length}`);
  console.log(`  OK empty:        ${empty.length}/${results.length}`);
  console.log(`  Errored:         ${fail.length}/${results.length}`);
  console.log(`  Total tenders:   ${results.reduce((s, r) => s + r.count, 0)}`);

  if (fail.length > 0) {
    console.log('\nFailures:');
    for (const f of fail) console.log(`  - ${f.id}: ${f.error?.slice(0, 140)}`);
  }
  if (empty.length > 0) {
    console.log('\nReturned zero:');
    for (const f of empty) console.log(`  - ${f.id}`);
  }

  // Export sample tender for document test
  const firstWithDoc = ok.find((r) => r.docUrl);
  if (firstWithDoc) {
    const fs = await import('fs');
    fs.writeFileSync(
      'scripts/.last-tender-sample.json',
      JSON.stringify({ sourceId: firstWithDoc.id, sourceUrl: firstWithDoc.docUrl, title: firstWithDoc.sample }, null, 2)
    );
    console.log(`\nSample tender written to scripts/.last-tender-sample.json`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
