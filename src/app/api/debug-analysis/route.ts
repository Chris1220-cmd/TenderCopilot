import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { aiBidOrchestrator } from '@/server/services/ai-bid-orchestrator';

export const maxDuration = 60;

export async function GET() {
  const t0 = Date.now();
  const logs: string[] = [];

  try {
    const tender = await db.tender.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!tender) return NextResponse.json({ error: 'No tender found' });
    logs.push(`Tender: ${tender.id}`);

    // Reset stuck flag
    await db.tender.update({ where: { id: tender.id }, data: { analysisInProgress: false } });
    logs.push(`Reset analysisInProgress: ${Date.now() - t0}ms`);

    // Run ACTUAL summarizeTender
    const brief = await aiBidOrchestrator.summarizeTender(tender.id, 'el');
    logs.push(`summarizeTender done: ${Date.now() - t0}ms`);
    logs.push(`Brief summary: ${brief.summaryText?.substring(0, 200)}`);
    logs.push(`Sector: ${brief.sector}, Award: ${brief.awardType}, Duration: ${brief.duration}`);

    return NextResponse.json({
      success: true,
      totalMs: Date.now() - t0,
      logs,
      briefId: brief.id,
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unknown',
      stack: err instanceof Error ? err.stack?.split('\n').slice(0, 8) : undefined,
      totalMs: Date.now() - t0,
      logs,
    }, { status: 500 });
  }
}
