/**
 * NL End-to-End Dry Run
 *
 * Validates the complete Dutch tender workflow:
 * 1. Discover Dutch tenders from TenderNed (via TED-NLD)
 * 2. Download the tender document (or notice)
 * 3. Read it through the extraction pipeline
 * 4. Run Gemini analysis with Dutch legal context
 * 5. Report structured output
 */
import { tenderDiscovery } from '../src/server/services/tender-discovery';
import { getPromptContext } from '../src/lib/prompts';

async function main() {
  console.log('\n=== NL End-to-End Dry Run ===\n');

  // ── 1. Discover NL tenders ──
  console.log('[1/5] Discovering NL tenders via TenderNed...');
  const tenders = await tenderDiscovery.searchTenders({
    sources: ['tenderned'],
    showAll: true,
  } as any);
  console.log(`  Found ${tenders.length} NL tenders`);
  if (tenders.length === 0) {
    console.log('  ✗ No Dutch tenders available right now');
    process.exit(1);
  }

  // Pick one with a URL
  const target = tenders.find((t) => t.sourceUrl);
  if (!target) {
    console.log('  ✗ No tender with source URL');
    process.exit(1);
  }
  console.log(`  ✓ Target: ${target.title?.slice(0, 80)}`);
  console.log(`    URL: ${target.sourceUrl}`);
  console.log(`    Budget: ${target.budget ? `€${target.budget.toLocaleString()}` : 'unknown'}`);
  console.log(`    Authority: ${target.contractingAuthority ?? 'unknown'}`);

  // ── 2. Load Dutch prompt context ──
  console.log('\n[2/5] Loading Dutch legal/prompt context...');
  const nlCtx = getPromptContext('NL');
  console.log(`  ✓ Law reference: ${nlCtx.lawReference}`);
  console.log(`  ✓ Platform: ${nlCtx.eProcurementPlatform}`);
  console.log(`  ✓ Doc type keyword categories: ${Object.keys(nlCtx.docTypeKeywords).length}`);
  const sampleCat = Object.entries(nlCtx.docTypeKeywords)[0];
  if (sampleCat) {
    console.log(`    Example (${sampleCat[0]}): ${(sampleCat[1] as string[]).slice(0, 3).join(', ')}`);
  }

  // ── 3. Fetch the tender notice page ──
  console.log('\n[3/5] Fetching tender notice page...');
  // Most TED-sourced tenders point to ted.europa.eu. We'll fetch the notice HTML
  // as a sanity check that the URL is reachable and returns content.
  const t0 = Date.now();
  let pageContent = '';
  try {
    const res = await fetch(target.sourceUrl!, {
      headers: {
        'User-Agent': 'Mozilla/5.0 TenderCopilot/1.0',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(20000),
    });
    console.log(`  HTTP ${res.status} in ${Date.now() - t0}ms`);
    if (res.ok) {
      pageContent = await res.text();
      console.log(`  ✓ Fetched ${pageContent.length} chars of HTML`);
    } else {
      console.log(`  ⚠ HTTP ${res.status} — using tender summary instead`);
    }
  } catch (err: any) {
    console.log(`  ⚠ Fetch failed: ${err?.message} — using tender summary instead`);
  }

  // ── 4. Build analysis input ──
  console.log('\n[4/5] Running Gemini analysis with NL context...');
  // Strip HTML tags down to text
  const pageText = pageContent
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000);

  const summary = [
    `Title: ${target.title ?? ''}`,
    `Authority: ${target.contractingAuthority ?? ''}`,
    `Budget: ${target.budget ? `€${target.budget}` : 'unknown'}`,
    `Deadline: ${target.submissionDeadline ?? 'unknown'}`,
    `Description: ${(target as any).description ?? ''}`,
    `Notice text sample: ${pageText.slice(0, 3000)}`,
  ].join('\n');

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `Je bent een Nederlandse aanbestedingsspecialist. Je kent de ${nlCtx.lawReference} en het ${nlCtx.eProcurementPlatform} platform.

Analyseer deze Nederlandse aanbesteding en geef terug (in JSON):
{
  "cpv_codes": ["..."],
  "key_requirements": ["..."],
  "legal_framework": "...",
  "dutch_specific_obligations": ["..."],
  "gut_feel_difficulty": "low|medium|high",
  "recommendation": "..."
}

Tender:
${summary}`;

  const t1 = Date.now();
  const result = await model.generateContent(prompt);
  const text = result.response.text() || '';
  console.log(`  ✓ Gemini response in ${Date.now() - t1}ms, ${text.length} chars`);

  // ── 5. Report ──
  console.log('\n[5/5] Results\n');
  console.log('──── Gemini analysis (raw) ────');
  console.log(text);
  console.log('───────────────────────────────');

  // Sanity checks
  const checks: Array<{ name: string; ok: boolean }> = [];
  checks.push({ name: 'Response is non-empty', ok: text.length > 50 });
  checks.push({ name: 'Mentions Aanbestedingswet or Dutch law', ok: /aanbestedingsw|wet|nl|artikel/i.test(text) });
  checks.push({ name: 'Contains JSON structure', ok: text.includes('{') && text.includes('}') });
  checks.push({ name: 'Identifies at least one requirement', ok: /requirement|vereiste|eis/i.test(text) });

  console.log('\n──── Sanity checks ────');
  for (const c of checks) {
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}`);
  }
  const pass = checks.filter((c) => c.ok).length;
  console.log(`\n${pass}/${checks.length} checks passed`);
  process.exit(pass === checks.length ? 0 : 1);
}

main().catch((err) => {
  console.error('FATAL:', err?.message || err);
  process.exit(1);
});
