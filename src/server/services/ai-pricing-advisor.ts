/**
 * AI Pricing Advisor — generates natural-language pricing recommendations
 * using computed statistics from pricing-stats.ts.
 */

import { ai, logTokenUsage } from '@/server/ai';
import { parseAIResponse } from './ai-prompts';
import type { PricingAdviceResult } from './pricing-stats';

export interface AIPricingAdvice {
  summary: string;
  recommendation: string;
  reasoning: string[];
  risks: string[];
  confidence: string;
}

export async function generatePricingAdvice(
  stats: PricingAdviceResult,
  tender: {
    title: string;
    budget: number | null;
    authority: string | null;
    cpvPrimary: string | null;
  },
  language: 'el' | 'en' | 'nl' = 'el',
  tenantId?: string,
): Promise<AIPricingAdvice> {
  const langNames = { el: 'Greek', en: 'English', nl: 'Dutch' };

  const prompt = `You are a pricing intelligence advisor for public procurement tenders.

Based on the following historical data analysis, provide a pricing recommendation.

## Tender Details
- Title: ${tender.title}
- Budget: ${tender.budget ? '€' + tender.budget.toLocaleString() : 'Unknown'}
- Authority: ${tender.authority || 'Unknown'}
- CPV: ${tender.cpvPrimary || 'Unknown'}

## Historical Analysis (${stats.sampleSize} similar awards)
${stats.ratioStats.count > 0 ? `- Average award-to-budget ratio: ${stats.ratioStats.mean ? (stats.ratioStats.mean * 100).toFixed(1) + '%' : 'N/A'}
- Median ratio: ${stats.ratioStats.median ? (stats.ratioStats.median * 100).toFixed(1) + '%' : 'N/A'}
- 25th percentile: ${stats.ratioStats.p25 ? (stats.ratioStats.p25 * 100).toFixed(1) + '%' : 'N/A'}
- 75th percentile: ${stats.ratioStats.p75 ? (stats.ratioStats.p75 * 100).toFixed(1) + '%' : 'N/A'}` : 'No ratio data available.'}

${stats.recommendedRange ? `## Recommended Price Range
- Conservative (p75): €${stats.recommendedRange.high.toLocaleString()}
- Median: €${stats.recommendedRange.mid.toLocaleString()}
- Aggressive (p25): €${stats.recommendedRange.low.toLocaleString()}` : ''}

## Competition (${stats.competitorCount} known competitors)
${stats.topCompetitors.slice(0, 5).map((c) =>
  '- ' + c.name + ': ' + c.wins + ' wins' + (c.avgRatio ? ', avg ratio ' + (c.avgRatio * 100).toFixed(1) + '%' : '')
).join('\n') || 'No competitor data available.'}

${stats.authority ? `## Authority Profile: ${stats.authority.authority}
- Total awards: ${stats.authority.totalAwards}
- Average amount: ${stats.authority.avgAmount ? '€' + stats.authority.avgAmount.toLocaleString() : 'N/A'}
- Average ratio: ${stats.authority.avgRatio ? (stats.authority.avgRatio * 100).toFixed(1) + '%' : 'N/A'}` : ''}

## Confidence: ${stats.confidence}

Respond in ${langNames[language]}. Return a JSON object with these exact keys:
{
  "summary": "One sentence overview of the pricing situation",
  "recommendation": "Specific recommended bid price with reasoning",
  "reasoning": ["bullet point 1", "bullet point 2", ...],
  "risks": ["risk 1", "risk 2", ...],
  "confidence": "Explanation of data confidence level"
}`;

  try {
    const provider = ai();
    const result = await provider.complete({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 1000,
    });

    if (tenantId && result.usage) {
      await logTokenUsage(tenantId, 'pricing-intelligence', {
        input: result.usage.inputTokens,
        output: result.usage.outputTokens,
        total: result.usage.inputTokens + result.usage.outputTokens,
      });
    }

    const parsed = parseAIResponse<AIPricingAdvice>(result.content);
    return parsed ?? {
      summary: result.content.slice(0, 200),
      recommendation: 'Δεν ήταν δυνατή η ανάλυση.',
      reasoning: [],
      risks: [],
      confidence: stats.confidence,
    };
  } catch (err) {
    console.error('[AIPricingAdvisor] Error:', (err as Error).message);
    return {
      summary: 'Σφάλμα κατά τη δημιουργία σύστασης τιμής.',
      recommendation: 'Παρακαλούμε δοκιμάστε ξανά.',
      reasoning: [],
      risks: [],
      confidence: stats.confidence,
    };
  }
}
