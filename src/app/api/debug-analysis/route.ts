import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { aiLegalAnalyzer } from '@/server/services/ai-legal-analyzer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const t0 = Date.now();
  try {
    const tender = await db.tender.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!tender) return NextResponse.json({ error: 'No tender found' });

    const result = await aiLegalAnalyzer.extractClauses(tender.id, 'el');
    return NextResponse.json({
      success: true,
      totalMs: Date.now() - t0,
      clauseCount: result.length,
      clauses: result.slice(0, 3),
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unknown',
      stack: err instanceof Error ? err.stack?.split('\n').slice(0, 10) : undefined,
      totalMs: Date.now() - t0,
    }, { status: 500 });
  }
}
