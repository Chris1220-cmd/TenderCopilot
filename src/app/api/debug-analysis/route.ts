import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readTenderDocuments } from '@/server/services/document-reader';
import { ai } from '@/server/ai';

export const maxDuration = 60;

export async function GET() {
  const timings: Record<string, number> = {};
  const logs: string[] = [];
  const t0 = Date.now();

  try {
    // Step 1: Find latest tender
    const tender = await db.tender.findFirst({ orderBy: { createdAt: 'desc' } });
    timings['1_find_tender'] = Date.now() - t0;
    if (!tender) return NextResponse.json({ error: 'No tender found' });
    logs.push(`Tender: ${tender.id} - ${tender.title}`);

    // Step 2: Check documents
    const docs = await db.attachedDocument.findMany({
      where: { tenderId: tender.id },
      select: { id: true, fileName: true, parsingStatus: true, extractedText: true },
    });
    timings['2_find_docs'] = Date.now() - t0;
    logs.push(`Docs: ${docs.length}, cached: ${docs.filter(d => d.extractedText && d.extractedText.length > 100).length}`);
    for (const d of docs) {
      logs.push(`  - ${d.fileName}: status=${d.parsingStatus}, textLen=${d.extractedText?.length || 0}`);
    }

    // Step 3: Read tender documents (should use cache)
    const t3 = Date.now();
    const docText = await readTenderDocuments(tender.id);
    timings['3_read_docs'] = Date.now() - t3;
    logs.push(`Document text: ${docText.length} chars (took ${timings['3_read_docs']}ms)`);

    // Step 4: Quick Gemini test
    const t4 = Date.now();
    const result = await ai().complete({
      messages: [
        { role: 'system', content: 'Respond in JSON' },
        { role: 'user', content: 'Say {"status":"ok","model":"gemini"}' },
      ],
      maxTokens: 100,
      temperature: 0,
      responseFormat: 'json',
    });
    timings['4_gemini_test'] = Date.now() - t4;
    logs.push(`Gemini test: ${result.content.substring(0, 100)} (took ${timings['4_gemini_test']}ms)`);

    // Step 5: Real brief call with first 5000 chars
    const t5 = Date.now();
    const briefResult = await ai().complete({
      messages: [
        { role: 'system', content: 'Extract JSON: {"test": true, "authority": "name of authority"}' },
        { role: 'user', content: `Find the contracting authority:\n${docText.substring(0, 5000)}` },
      ],
      maxTokens: 500,
      temperature: 0.2,
      responseFormat: 'json',
    });
    timings['5_brief_test'] = Date.now() - t5;
    logs.push(`Brief test: ${briefResult.content.substring(0, 200)} (took ${timings['5_brief_test']}ms)`);

    timings['total'] = Date.now() - t0;

    return NextResponse.json({ timings, logs }, { status: 200 });
  } catch (err) {
    timings['error_at'] = Date.now() - t0;
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unknown',
      stack: err instanceof Error ? err.stack?.split('\n').slice(0, 5) : undefined,
      timings,
      logs,
    }, { status: 500 });
  }
}
