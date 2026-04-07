import { db } from '@/lib/db';
import { ai, logTokenUsage } from '@/server/ai';
import { parseAIResponse } from './ai-prompts';
import { fetchAllAwards, type AwardResult } from './award-fetcher';

// ─── Types ──────────────────────────────────────────────

interface CompetitorProfile {
  name: string;
  wins: number;
  avgAmount: number | null;
  avgDiscount: number | null;
}

interface AuthorityProfile {
  totalTenders: number;
  cancellationRate: number | null;
  avgDiscount: number | null;
  avgBidders: number | null;
  topWinners: Array<{ name: string; wins: number }>;
}

interface RepeatTenderInfo {
  found: boolean;
  previousWinner?: string;
  previousAmount?: number;
  previousDate?: string;
  sourceUrl?: string;
}

interface PrepTimeEstimate {
  avgDays: number | null;
  currentDaysLeft: number;
  isTight: boolean;
}

// ─── Prompts ────────────────────────────────────────────

const SYSTEM_PROMPT_EL = `Είσαι σύμβουλος δημοσίων διαγωνισμών. Ανάλυσε τα δεδομένα αγοράς και δώσε 3-5 πρακτικές συμβουλές.

Κάθε συμβουλή πρέπει να είναι:
- Συγκεκριμένη (αριθμοί, ποσοστά, ονόματα)
- Actionable (τι να κάνει ο χρήστης)
- Βασισμένη στα δεδομένα (όχι γενικές συμβουλές)

Θέματα να καλύψεις:
1. Τιμολογιακή στρατηγική (βάσει τιμών κατακύρωσης)
2. Ανταγωνισμός (ποιος κερδίζει και γιατί)
3. Κίνδυνοι (ακυρώσεις, αξιοπιστία αναθέτουσας)
4. Μαθήματα από δική σου ιστορία (αν υπάρχει)
5. Χρόνος προετοιμασίας (αν είναι πιεσμένο)

Απάντησε ΜΟΝΟ σε JSON: { "bullets": ["...", "...", "..."] }`;

const SYSTEM_PROMPT_EN = `You are a public procurement advisor. Analyze the market data and give 3-5 practical recommendations.

Each recommendation must be:
- Specific (numbers, percentages, names)
- Actionable (what the user should do)
- Data-driven (not generic advice)

Topics to cover:
1. Pricing strategy (based on award prices)
2. Competition (who wins and why)
3. Risks (cancellations, authority reliability)
4. Lessons from own history (if available)
5. Preparation time (if tight)

Respond ONLY in JSON: { "bullets": ["...", "...", "..."] }`;

// ─── Service ────────────────────────────────────────────

class TenderIntelligenceService {
  async generateIntelligence(
    tenderId: string,
    tenantId: string,
    language: 'el' | 'en' | 'nl' = 'el',
  ) {
    // 1. Load tender
    const tender = await db.tender.findUniqueOrThrow({
      where: { id: tenderId },
      select: {
        id: true,
        title: true,
        cpvCodes: true,
        budget: true,
        contractingAuthority: true,
        submissionDeadline: true,
        createdAt: true,
      },
    });

    // 2. Fetch external awards by CPV
    const allAwards = tender.cpvCodes.length > 0
      ? await fetchAllAwards(tender.cpvCodes, undefined)
      : [];

    // 3. Filter by budget range (±50%)
    const similarAwards = tender.budget
      ? allAwards.filter((a) =>
          a.amount == null ||
          (a.amount >= tender.budget! * 0.5 && a.amount <= tender.budget! * 1.5),
        )
      : allAwards;

    // 4. Build competitor profiles
    const competitorMap = new Map<string, { wins: number; amounts: number[] }>();
    for (const award of similarAwards) {
      if (!award.winner || award.winner === 'Δεν αναφέρεται') continue;
      const existing = competitorMap.get(award.winner) || { wins: 0, amounts: [] };
      existing.wins++;
      if (award.amount != null) existing.amounts.push(award.amount);
      competitorMap.set(award.winner, existing);
    }
    const competitors: CompetitorProfile[] = Array.from(competitorMap.entries())
      .map(([name, data]) => ({
        name,
        wins: data.wins,
        avgAmount: data.amounts.length > 0
          ? Math.round(data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length)
          : null,
        avgDiscount: tender.budget && data.amounts.length > 0
          ? Math.round(
              ((tender.budget - data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length) /
                tender.budget) * 100,
            )
          : null,
      }))
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 10);

    // 5. Authority profile
    const authorityAwards = tender.contractingAuthority
      ? allAwards.filter(
          (a) =>
            a.authority &&
            a.authority.toLowerCase().includes(tender.contractingAuthority!.toLowerCase().slice(0, 20)),
        )
      : [];
    const authorityAmounts = authorityAwards.filter((a) => a.amount != null);
    const authorityProfile: AuthorityProfile = {
      totalTenders: authorityAwards.length,
      cancellationRate: null,
      avgDiscount:
        tender.budget && authorityAmounts.length > 0
          ? Math.round(
              ((tender.budget -
                authorityAmounts.reduce((sum, a) => sum + a.amount!, 0) / authorityAmounts.length) /
                tender.budget) * 100,
            )
          : null,
      avgBidders:
        authorityAwards.filter((a) => a.numberOfBids != null).length > 0
          ? Math.round(
              authorityAwards
                .filter((a) => a.numberOfBids != null)
                .reduce((sum, a) => sum + a.numberOfBids!, 0) /
                authorityAwards.filter((a) => a.numberOfBids != null).length,
            )
          : null,
      topWinners: Array.from(
        authorityAwards
          .filter((a) => a.winner && a.winner !== 'Δεν αναφέρεται')
          .reduce((map, a) => {
            map.set(a.winner, (map.get(a.winner) || 0) + 1);
            return map;
          }, new Map<string, number>()),
      )
        .map(([name, wins]) => ({ name, wins }))
        .sort((a, b) => b.wins - a.wins)
        .slice(0, 5),
    };

    // 6. Repeat tender detection
    const repeatTender = this.detectRepeat(tender, similarAwards);

    // 7. Prep time estimate
    const prepTimeEstimate = await this.estimatePrepTime(tender, tenantId);

    // 8. Own history
    const ownOutcomes = await db.tenderOutcome.findMany({
      where: { tenantId },
      include: { tender: { select: { cpvCodes: true, title: true, budget: true } } },
    });
    const ownSimilar = ownOutcomes.filter((o) =>
      o.tender.cpvCodes.some((c) => tender.cpvCodes.includes(c)),
    );

    // 9. AI advisory
    const aiAdvisory = await this.getAdvisory(
      tender, similarAwards.slice(0, 20), competitors.slice(0, 5),
      authorityProfile, repeatTender, prepTimeEstimate, ownSimilar, language,
    );

    // 10. Cache
    const serializedAwards = JSON.parse(JSON.stringify(similarAwards.slice(0, 50)));
    await db.tenderIntelligence.upsert({
      where: { tenderId },
      create: {
        tenderId,
        similarAwards: serializedAwards,
        competitors: competitors as any,
        authorityProfile: authorityProfile as any,
        repeatTender: repeatTender as any,
        prepTimeEstimate: prepTimeEstimate as any,
        aiAdvisory: aiAdvisory as any,
        language,
      },
      update: {
        similarAwards: serializedAwards,
        competitors: competitors as any,
        authorityProfile: authorityProfile as any,
        repeatTender: repeatTender as any,
        prepTimeEstimate: prepTimeEstimate as any,
        aiAdvisory: aiAdvisory as any,
        language,
        fetchedAt: new Date(),
      },
    });

    return {
      similarAwards: serializedAwards,
      competitors,
      authorityProfile,
      repeatTender,
      prepTimeEstimate,
      aiAdvisory,
    };
  }

  private detectRepeat(
    tender: { title: string; cpvCodes: string[]; contractingAuthority: string | null },
    awards: AwardResult[],
  ): RepeatTenderInfo {
    if (!tender.contractingAuthority) return { found: false };

    const titleWords = tender.title.toLowerCase().split(/\s+/).filter((w) => w.length > 4);

    for (const award of awards) {
      const sameAuthority =
        award.authority.toLowerCase().includes(tender.contractingAuthority.toLowerCase().slice(0, 20));
      if (!sameAuthority) continue;

      const awardWords = award.title.toLowerCase().split(/\s+/);
      const matchCount = titleWords.filter((w) => awardWords.some((aw) => aw.includes(w))).length;
      const matchRatio = titleWords.length > 0 ? matchCount / titleWords.length : 0;

      if (matchRatio >= 0.4) {
        return {
          found: true,
          previousWinner: award.winner,
          previousAmount: award.amount ?? undefined,
          previousDate: award.date.toISOString().slice(0, 10),
          sourceUrl: award.sourceUrl,
        };
      }
    }
    return { found: false };
  }

  private async estimatePrepTime(
    tender: { submissionDeadline: Date | null; cpvCodes: string[]; createdAt: Date },
    tenantId: string,
  ): Promise<PrepTimeEstimate> {
    const daysLeft = tender.submissionDeadline
      ? Math.max(0, Math.ceil((tender.submissionDeadline.getTime() - Date.now()) / 86400000))
      : 30;

    const ownTenders = await db.tender.findMany({
      where: {
        tenantId,
        cpvCodes: { hasSome: tender.cpvCodes },
        status: { in: ['SUBMITTED', 'WON', 'LOST'] },
        submissionDeadline: { not: null },
      },
      select: { createdAt: true, submissionDeadline: true },
    });

    if (ownTenders.length === 0) {
      return { avgDays: null, currentDaysLeft: daysLeft, isTight: daysLeft < 14 };
    }

    const prepDays = ownTenders.map((t) => Math.max(1, Math.ceil(
      (t.submissionDeadline!.getTime() - t.createdAt.getTime()) / 86400000,
    )));
    const avgDays = Math.round(prepDays.reduce((a, b) => a + b, 0) / prepDays.length);

    return { avgDays, currentDaysLeft: daysLeft, isTight: daysLeft < avgDays };
  }

  private async getAdvisory(
    tender: any,
    awards: AwardResult[],
    competitors: CompetitorProfile[],
    authority: AuthorityProfile,
    repeat: RepeatTenderInfo,
    prepTime: PrepTimeEstimate,
    ownHistory: any[],
    language: 'el' | 'en' | 'nl',
  ): Promise<{ bullets: string[] }> {
    const ctx: string[] = [];
    ctx.push(`Τρέχων διαγωνισμός: ${tender.title}`);
    if (tender.budget) ctx.push(`Προϋπολογισμός: €${tender.budget.toLocaleString('el-GR')}`);
    if (tender.contractingAuthority) ctx.push(`Αναθέτουσα: ${tender.contractingAuthority}`);

    if (awards.length > 0) {
      const amounts = awards.filter((a) => a.amount).map((a) => a.amount!);
      if (amounts.length > 0) {
        const avg = Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length);
        ctx.push(`\nΑγορά: ${awards.length} κατακυρώσεις, μέση τιμή €${avg.toLocaleString('el-GR')}`);
        ctx.push(`Εύρος: €${Math.min(...amounts).toLocaleString('el-GR')} - €${Math.max(...amounts).toLocaleString('el-GR')}`);
      }
    }

    if (competitors.length > 0) {
      ctx.push(`\nΑνταγωνισμός:`);
      for (const c of competitors.slice(0, 5)) {
        ctx.push(`- ${c.name}: ${c.wins} νίκες${c.avgAmount ? `, μέση €${c.avgAmount.toLocaleString('el-GR')}` : ''}`);
      }
    }

    if (authority.totalTenders > 0) {
      ctx.push(`\nΑναθέτουσα: ${authority.totalTenders} διαγωνισμοί`);
      if (authority.avgBidders) ctx.push(`Μέσος αριθμός προσφορών: ${authority.avgBidders}`);
    }

    if (repeat.found) {
      ctx.push(`\nΕπαναληπτικός: νικητής ${repeat.previousWinner}${repeat.previousAmount ? ` στα €${repeat.previousAmount.toLocaleString('el-GR')}` : ''}`);
    }

    if (prepTime.avgDays != null) {
      ctx.push(`\nΧρόνος: ${prepTime.currentDaysLeft}d διαθέσιμες, μέσος: ${prepTime.avgDays}d`);
    }

    if (ownHistory.length > 0) {
      const won = ownHistory.filter((o) => o.outcome === 'won').length;
      const lost = ownHistory.filter((o) => o.outcome === 'lost').length;
      ctx.push(`\nΙστορικό: ${won} νίκες, ${lost} ήττες σε παρόμοιους`);
      for (const o of ownHistory.slice(0, 3)) {
        if (o.reason) ctx.push(`- ${o.outcome}: ${o.reason}`);
      }
    }

    try {
      const systemPrompt = language === 'el' ? SYSTEM_PROMPT_EL : SYSTEM_PROMPT_EN;
      const result = await ai().complete({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: ctx.join('\n') },
        ],
        maxTokens: 2000,
        temperature: 0.3,
        responseFormat: 'json',
      });

      await logTokenUsage(tender.id, 'intelligence_advisory', {
        input: result.inputTokens || 0,
        output: result.outputTokens || 0,
        total: result.totalTokens || 0,
      });

      return parseAIResponse<{ bullets: string[] }>(result.content, ['bullets'], 'intelligence');
    } catch {
      return { bullets: [] };
    }
  }
}

export const tenderIntelligence = new TenderIntelligenceService();
