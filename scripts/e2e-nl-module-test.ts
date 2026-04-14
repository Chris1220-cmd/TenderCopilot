/**
 * E2E for NL country module (SP1-SP4).
 */
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('\n=== NL Country Module E2E ===\n');

  const report: Array<{ area: string; check: string; ok: boolean; detail: string }> = [];
  const pass = (area: string, check: string, detail: string) => report.push({ area, check, ok: true, detail });
  const fail = (area: string, check: string, detail: string) => report.push({ area, check, ok: false, detail });

  // ── SP1: multi-country foundation ────────────────────────────
  console.log('[SP1] Multi-country foundation');
  try {
    const { SUPPORTED_COUNTRIES, getDefaultSourcesForCountries } = await import('../src/lib/country-config');
    const countries = SUPPORTED_COUNTRIES.map((c: { code: string }) => c.code);
    console.log(`  Registered countries: ${countries.join(', ')}`);
    if (countries.includes('GR') && countries.includes('NL')) {
      pass('SP1', 'country configs', `registered: ${countries.join(', ')}`);
    } else {
      fail('SP1', 'country configs', `missing GR or NL in ${countries.join(',')}`);
    }

    const grSources = getDefaultSourcesForCountries(['GR']);
    const nlSources = getDefaultSourcesForCountries(['NL']);
    console.log(`  GR default sources: ${grSources.join(', ')}`);
    console.log(`  NL default sources: ${nlSources.join(', ')}`);
    if (grSources.length > 0 && nlSources.length > 0) {
      pass('SP1', 'default sources per country', `GR=${grSources.length}, NL=${nlSources.length}`);
    } else {
      fail('SP1', 'default sources per country', `GR=${grSources.length}, NL=${nlSources.length}`);
    }
    if (nlSources.includes('tenderned')) {
      pass('SP1', 'NL routes to TenderNed', 'tenderned in NL default sources');
    } else {
      fail('SP1', 'NL routes to TenderNed', `tenderned missing, got: ${nlSources.join(',')}`);
    }
  } catch (err: any) {
    fail('SP1', 'country-config module', err.message);
  }

  // ── SP1b: Plan.maxCountries, Tenant.countries schema ────────
  try {
    const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
    if (/countries\s+String\[\]/.test(schema)) pass('SP1', 'Tenant.countries[] field', 'schema has String[]');
    else fail('SP1', 'Tenant.countries[] field', 'not found in schema');
    if (/maxCountries/.test(schema)) pass('SP1', 'Plan.maxCountries', 'schema has maxCountries');
    else fail('SP1', 'Plan.maxCountries', 'not found in schema');
    if (/CompanyProfile/.test(schema)) pass('SP1', 'CompanyProfile model', 'exists');
    else fail('SP1', 'CompanyProfile model', 'not found');
  } catch (err: any) {
    fail('SP1', 'schema read', err.message);
  }

  // ── SP2: Dutch i18n ────────────────────────────────────────
  console.log('\n[SP2] Dutch i18n');
  try {
    const nlPath = path.join(process.cwd(), 'messages/nl.json');
    const elPath = path.join(process.cwd(), 'messages/el.json');
    const enPath = path.join(process.cwd(), 'messages/en.json');
    const nl = JSON.parse(fs.readFileSync(nlPath, 'utf8'));
    const el = JSON.parse(fs.readFileSync(elPath, 'utf8'));
    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const countKeys = (o: any, prefix = ''): number => {
      let n = 0;
      for (const [k, v] of Object.entries(o)) {
        if (v && typeof v === 'object') n += countKeys(v, prefix + k + '.');
        else n++;
      }
      return n;
    };
    const nlKeys = countKeys(nl);
    const elKeys = countKeys(el);
    const enKeys = countKeys(en);
    console.log(`  NL keys: ${nlKeys}, EL keys: ${elKeys}, EN keys: ${enKeys}`);
    if (nlKeys > 500) pass('SP2', 'nl.json exists with content', `${nlKeys} keys`);
    else fail('SP2', 'nl.json missing content', `only ${nlKeys} keys`);
    const parity = Math.abs(nlKeys - elKeys) / elKeys;
    if (parity < 0.15) pass('SP2', 'NL key parity with EL', `nl=${nlKeys}, el=${elKeys}, diff=${(parity * 100).toFixed(1)}%`);
    else fail('SP2', 'NL key parity with EL', `nl=${nlKeys}, el=${elKeys}, diff=${(parity * 100).toFixed(1)}%`);
  } catch (err: any) {
    fail('SP2', 'i18n files', err.message);
  }

  // ── SP3: Prompt context ─────────────────────────────────────
  console.log('\n[SP3] Country-aware AI prompts');
  try {
    const { getPromptContext } = await import('../src/lib/prompts');
    const grCtx = getPromptContext('GR');
    const nlCtx = getPromptContext('NL');
    console.log(`  GR ctx keys: ${Object.keys(grCtx).join(', ')}`);
    console.log(`  NL ctx keys: ${Object.keys(nlCtx).join(', ')}`);
    if (grCtx && nlCtx && Object.keys(grCtx).length > 0 && Object.keys(nlCtx).length > 0) {
      pass('SP3', 'getPromptContext per country', `GR ${Object.keys(grCtx).length} keys, NL ${Object.keys(nlCtx).length}`);
    } else {
      fail('SP3', 'getPromptContext per country', 'empty context');
    }
    // Ensure distinct — prompts should mention country-specific terms
    const grStr = JSON.stringify(grCtx).toLowerCase();
    const nlStr = JSON.stringify(nlCtx).toLowerCase();
    if (grStr.includes('εσηδης') || grStr.includes('esidis') || grStr.includes('κημδησ') || grStr.includes('ελλ')) {
      pass('SP3', 'GR context has GR-specific terms', 'found ESIDIS/KIMDIS/greek refs');
    } else {
      fail('SP3', 'GR context', 'no GR-specific markers');
    }
    if (nlStr.includes('tenderned') || nlStr.includes('nederland') || nlStr.includes('aanbest')) {
      pass('SP3', 'NL context has NL-specific terms', 'found TenderNed/aanbesteding/nederland');
    } else {
      fail('SP3', 'NL context', 'no NL-specific markers');
    }
  } catch (err: any) {
    fail('SP3', 'prompts module', err.message);
  }

  // ── SP4: Dutch knowledge base ──────────────────────────────
  console.log('\n[SP4] Dutch knowledge base');
  try {
    const nlKbDir = path.join(process.cwd(), 'src/server/knowledge/nl');
    const grKbDir = path.join(process.cwd(), 'src/server/knowledge/gr');
    const nlFiles = fs.existsSync(nlKbDir) ? fs.readdirSync(nlKbDir) : [];
    const grFiles = fs.existsSync(grKbDir) ? fs.readdirSync(grKbDir) : [];
    console.log(`  NL kb files: ${nlFiles.join(', ')}`);
    console.log(`  GR kb files: ${grFiles.join(', ')}`);
    if (nlFiles.length > 0) pass('SP4', 'NL knowledge dir', `${nlFiles.length} files`);
    else fail('SP4', 'NL knowledge dir', 'empty');
    // Check specific expected modules
    for (const expected of ['law-articles', 'mistakes', 'lead-times']) {
      const match = nlFiles.find((f) => f.toLowerCase().includes(expected));
      if (match) pass('SP4', `NL has ${expected}`, match);
      else fail('SP4', `NL has ${expected}`, 'missing');
    }
  } catch (err: any) {
    fail('SP4', 'NL kb dir', err.message);
  }

  // ── Output ────────────────────────────────────────────────
  console.log('\n=== NL Module Report ===\n');
  const grouped: Record<string, typeof report> = {};
  for (const r of report) (grouped[r.area] ||= []).push(r);
  for (const [area, rows] of Object.entries(grouped)) {
    console.log(`\n[${area}]`);
    for (const r of rows) {
      console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.check.padEnd(38)} ${r.detail}`);
    }
  }
  const passed = report.filter((r) => r.ok).length;
  console.log(`\n${passed}/${report.length} checks passed`);
  process.exit(passed === report.length ? 0 : 1);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
