/**
 * End-to-end document pipeline test.
 * 1. Pull a recent tender from Diavgeia (known PDF pipeline)
 * 2. Download the actual PDF
 * 3. Run it through Google Document AI
 * 4. Report extraction length + confidence
 */
import { tenderDiscovery } from '../src/server/services/tender-discovery';
import { extractWithDocumentAI, isDocumentAIAvailable } from '../src/server/services/document-ai';

async function main() {
  console.log('\n=== Document Pipeline E2E ===\n');

  // Check Document AI config
  const daiOk = isDocumentAIAvailable();
  console.log(`Document AI configured: ${daiOk}`);
  if (!daiOk) {
    console.log('  Set GOOGLE_CLOUD_PROJECT_ID + DOCUMENT_AI_PROCESSOR_ID to test');
    process.exit(1);
  }

  // Get a fresh Diavgeia tender (reliable: direct PDF API)
  console.log('\n[1/3] Fetching recent Diavgeia tenders...');
  const tenders = await tenderDiscovery.searchTenders({
    sources: ['diavgeia'],
    showAll: true,
  } as any);
  console.log(`  Got ${tenders.length} tenders`);
  if (tenders.length === 0) {
    console.log('No tenders found — cannot test document pipeline');
    process.exit(1);
  }

  // Find one with an ADA (reference number) and a valid URL
  const target = tenders.find((t) => t.referenceNumber && t.sourceUrl?.includes('diavgeia.gov.gr'));
  if (!target) {
    console.log('No Diavgeia tender with ADA found in results');
    process.exit(1);
  }
  const ada = target.referenceNumber!;
  console.log(`  Target: ${target.title?.slice(0, 80)}`);
  console.log(`  ADA: ${ada}`);

  // Download the PDF
  console.log('\n[2/3] Downloading PDF from luminapi...');
  const docUrl = `https://diavgeia.gov.gr/luminapi/api/decisions/${encodeURIComponent(ada)}/document`;
  const t0 = Date.now();
  const res = await fetch(docUrl, {
    headers: { Accept: 'application/pdf' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    console.log(`  FAILED: HTTP ${res.status}`);
    process.exit(1);
  }
  const ct = res.headers.get('content-type') || '';
  const buf = Buffer.from(await res.arrayBuffer());
  console.log(`  Downloaded: ${(buf.length / 1024).toFixed(1)} KB, ${ct}, ${Date.now() - t0}ms`);
  if (buf.length < 500) {
    console.log('  PDF too small — probably an error page');
    process.exit(1);
  }

  // Run Document AI
  console.log('\n[3/3] Running Google Document AI...');
  const result = await extractWithDocumentAI(buf, 'application/pdf', `${ada}.pdf`);
  if (!result) {
    console.log('  FAILED: Document AI returned null');
    process.exit(1);
  }

  console.log(`\n=== RESULT ===`);
  console.log(`  Chars extracted:  ${result.text.length}`);
  console.log(`  Pages:            ${result.pageCount}`);
  console.log(`  Confidence:       ${(result.confidence * 100).toFixed(1)}%`);
  console.log(`  Processing:       ${result.processingTimeMs}ms`);
  console.log(`\nText preview (first 400 chars):`);
  console.log(`  ${result.text.slice(0, 400).replace(/\n/g, ' ')}...`);

  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL:', err?.message || err);
  process.exit(1);
});
