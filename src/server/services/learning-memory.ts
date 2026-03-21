/**
 * Learning Memory Service — Layer 4 of the Smart AI Assistant.
 * Makes the AI smarter over time by learning from tender outcomes,
 * user feedback, and patterns.
 */

import { db } from '@/lib/db';
import { ai } from '@/server/ai/provider';

// ─── Record Tender Outcome ───────────────────────────────────

export async function recordOutcome(params: {
  tenderId: string;
  tenantId: string;
  outcome: 'won' | 'lost' | 'withdrew' | 'disqualified';
  reason?: string;
  bidAmount?: number;
  winAmount?: number;
  feedback?: string;
}): Promise<void> {
  const { tenderId, tenantId, outcome, reason, bidAmount, winAmount, feedback } = params;

  // Save the outcome
  await db.tenderOutcome.upsert({
    where: { tenderId },
    create: {
      tenderId,
      tenantId,
      outcome,
      reason,
      bidAmount,
      winAmount,
      feedback,
    },
    update: {
      outcome,
      reason,
      bidAmount,
      winAmount,
      feedback,
    },
  });

  // Fetch tender data for AI lesson extraction
  const tender = await db.tender.findUnique({
    where: { id: tenderId },
    include: {
      brief: true,
      goNoGoDecision: true,
      requirements: { select: { text: true, category: true, coverageStatus: true } },
    },
  });

  if (!tender) return;

  // Extract lessons via AI
  try {
    const tenderSummary = [
      `Τίτλος: ${tender.title}`,
      tender.referenceNumber ? `Αρ. Διακήρυξης: ${tender.referenceNumber}` : null,
      tender.contractingAuthority ? `Αναθέτουσα: ${tender.contractingAuthority}` : null,
      tender.budget ? `Προϋπολογισμός: €${tender.budget}` : null,
      tender.brief?.summaryText ? `Περίληψη: ${tender.brief.summaryText.slice(0, 500)}` : null,
      `Αποτέλεσμα: ${outcome}`,
      reason ? `Αιτία: ${reason}` : null,
      bidAmount ? `Ποσό προσφοράς: €${bidAmount}` : null,
      winAmount ? `Ποσό κερδίζοντος: €${winAmount}` : null,
      feedback ? `Σημειώσεις: ${feedback}` : null,
    ].filter(Boolean).join('\n');

    const gaps = tender.requirements
      .filter((r) => r.coverageStatus === 'GAP')
      .map((r) => r.text)
      .slice(0, 5);

    const prompt = `Αναλύοντας το αποτέλεσμα ενός διαγωνισμού, εξήγαγε μαθήματα για την εταιρεία.

ΣΤΟΙΧΕΙΑ ΔΙΑΓΩΝΙΣΜΟΥ:
${tenderSummary}

${gaps.length > 0 ? `ΚΕΝΑ ΠΟΥ ΕΝΤΟΠΙΣΤΗΚΑΝ:\n${gaps.join('\n')}` : ''}

Επέστρεψε JSON array με μαθήματα. Κάθε μάθημα:
{
  "category": "strength" | "weakness" | "preference" | "pattern" | "lesson",
  "key": "short_snake_case_key",
  "value": "Περιγραφή στα ελληνικά (1-2 προτάσεις)",
  "confidence": 0.3-0.9
}

Παραδείγματα:
- Αν κερδήθηκε: {"category":"strength","key":"strong_in_construction","value":"Η εταιρεία κέρδισε διαγωνισμό κατασκευών — δυνατό σημείο","confidence":0.6}
- Αν χάθηκε λόγω τιμής: {"category":"lesson","key":"pricing_too_high","value":"Χάσαμε λόγω υψηλής τιμής — η εταιρεία τιμολογεί ακριβά","confidence":0.5}
- Αν υπήρχαν κενά: {"category":"weakness","key":"missing_meep","value":"Δεν έχει ΜΕΕΠ — αποκλεισμός από τεχνικά έργα","confidence":0.7}

Επέστρεψε ΜΟΝΟ το JSON array, χωρίς markdown ή σχόλια. Μέγιστο 5 μαθήματα.`;

    const result = await ai().complete({
      messages: [
        { role: 'system', content: 'Είσαι ειδικός ανάλυσης διαγωνισμών. Απαντάς αποκλειστικά σε JSON.' },
        { role: 'user', content: prompt },
      ],
      responseFormat: 'json',
      temperature: 0.2,
      maxTokens: 1500,
    });

    let lessons: Array<{ category: string; key: string; value: string; confidence: number }> = [];
    try {
      const parsed = JSON.parse(result.content);
      lessons = Array.isArray(parsed) ? parsed : (parsed.lessons || []);
    } catch {
      console.warn('[LearningMemory] Failed to parse AI lessons:', result.content?.slice(0, 200));
    }

    // Save lessons to TenderOutcome
    if (lessons.length > 0) {
      await db.tenderOutcome.update({
        where: { tenderId },
        data: { lessons: lessons as any },
      });
    }

    // Update TenantMemory for each lesson
    for (const lesson of lessons) {
      await updateMemoryFromAnalysis({
        tenantId,
        tenderId,
        category: lesson.category,
        key: lesson.key,
        value: lesson.value,
        confidence: lesson.confidence,
      });
    }
  } catch (err) {
    console.error('[LearningMemory] AI lesson extraction failed:', err);
    // Non-critical — outcome is already saved
  }
}

// ─── Record Chat Feedback ────────────────────────────────────

export async function recordChatFeedback(params: {
  messageId: string;
  tenantId: string;
  rating: number;
  comment?: string;
}): Promise<void> {
  const { messageId, tenantId, rating, comment } = params;

  await db.chatFeedback.upsert({
    where: { messageId },
    create: {
      messageId,
      tenantId,
      rating,
      comment,
    },
    update: {
      rating,
      comment,
    },
  });
}

// ─── Get Tenant Context ──────────────────────────────────────

export async function getTenantContext(tenantId: string): Promise<string> {
  const memories = await db.tenantMemory.findMany({
    where: { tenantId },
    orderBy: { confidence: 'desc' },
    take: 20,
  });

  if (memories.length === 0) return '';

  const strengths = memories
    .filter((m) => m.category === 'strength')
    .slice(0, 5)
    .map((m) => m.value);

  const weaknesses = memories
    .filter((m) => m.category === 'weakness')
    .slice(0, 5)
    .map((m) => m.value);

  const lessons = memories
    .filter((m) => m.category === 'lesson')
    .slice(0, 5)
    .map((m) => m.value);

  const preferences = memories
    .filter((m) => m.category === 'preference')
    .slice(0, 3)
    .map((m) => m.value);

  const patterns = memories
    .filter((m) => m.category === 'pattern')
    .slice(0, 3)
    .map((m) => m.value);

  const parts: string[] = [];

  if (strengths.length > 0) {
    parts.push(`Δυνατά σημεία: ${strengths.join('. ')}`);
  }
  if (weaknesses.length > 0) {
    parts.push(`Αδυναμίες: ${weaknesses.join('. ')}`);
  }
  if (lessons.length > 0) {
    parts.push(`Μαθήματα: ${lessons.join('. ')}`);
  }
  if (preferences.length > 0) {
    parts.push(`Προτιμήσεις: ${preferences.join('. ')}`);
  }
  if (patterns.length > 0) {
    parts.push(`Μοτίβα: ${patterns.join('. ')}`);
  }

  const result = `ΠΡΟΦΙΛ ΕΤΑΙΡΕΙΑΣ:\n${parts.join('\n')}`;

  // Keep within ~1000 chars budget
  return result.length > 1000 ? result.slice(0, 997) + '...' : result;
}

// ─── Update Memory from Analysis ─────────────────────────────

export async function updateMemoryFromAnalysis(params: {
  tenantId: string;
  tenderId: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
}): Promise<void> {
  const { tenantId, tenderId, category, key, value, confidence } = params;

  const existing = await db.tenantMemory.findUnique({
    where: { tenantId_category_key: { tenantId, category, key } },
  });

  if (existing) {
    // Update existing memory — increase confidence with more evidence
    const existingEvidence = (existing.evidence as any[]) || [];
    const newEvidence = [
      ...existingEvidence,
      { tenderId, date: new Date().toISOString(), detail: value },
    ].slice(-10); // Keep last 10 evidence items

    // Confidence grows with evidence but caps at 0.95
    const newConfidence = Math.min(0.95, existing.confidence + (confidence * 0.2));

    await db.tenantMemory.update({
      where: { id: existing.id },
      data: {
        value: value, // Update to latest description
        confidence: newConfidence,
        evidence: newEvidence as any,
      },
    });
  } else {
    await db.tenantMemory.create({
      data: {
        tenantId,
        category,
        key,
        value,
        confidence: Math.max(0.1, Math.min(0.9, confidence)),
        evidence: [{ tenderId, date: new Date().toISOString(), detail: value }] as any,
      },
    });
  }
}

// ─── Get Outcome Stats ───────────────────────────────────────

export async function getOutcomeStats(tenantId: string): Promise<{
  total: number;
  won: number;
  lost: number;
  withdrew: number;
  disqualified: number;
  winRate: number;
  avgBidAmount: number | null;
  commonLossReasons: string[];
}> {
  const outcomes = await db.tenderOutcome.findMany({
    where: { tenantId },
  });

  const total = outcomes.length;
  const won = outcomes.filter((o) => o.outcome === 'won').length;
  const lost = outcomes.filter((o) => o.outcome === 'lost').length;
  const withdrew = outcomes.filter((o) => o.outcome === 'withdrew').length;
  const disqualified = outcomes.filter((o) => o.outcome === 'disqualified').length;

  const decidedTotal = won + lost;
  const winRate = decidedTotal > 0 ? Math.round((won / decidedTotal) * 100) : 0;

  const bids = outcomes.filter((o) => o.bidAmount != null).map((o) => o.bidAmount!);
  const avgBidAmount = bids.length > 0
    ? Math.round(bids.reduce((a, b) => a + b, 0) / bids.length)
    : null;

  // Collect loss reasons
  const lossReasons = outcomes
    .filter((o) => o.outcome === 'lost' && o.reason)
    .map((o) => o.reason!);

  // Simple frequency count for common reasons
  const reasonCounts = new Map<string, number>();
  for (const reason of lossReasons) {
    const normalized = reason.toLowerCase().trim();
    reasonCounts.set(normalized, (reasonCounts.get(normalized) || 0) + 1);
  }

  const commonLossReasons = Array.from(reasonCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason]) => reason);

  return {
    total,
    won,
    lost,
    withdrew,
    disqualified,
    winRate,
    avgBidAmount,
    commonLossReasons,
  };
}
