/**
 * Trust Shield — validates AI responses before showing to users.
 * Ensures source attribution, confidence labeling, and anti-hallucination checks.
 */

export interface TrustedResponse {
  answer: string;
  confidence: 'verified' | 'inferred' | 'general';
  sources: Array<{
    type: 'document' | 'law' | 'knowledge_base';
    reference: string;
    quote?: string;
  }>;
  highlights: Array<{
    label: string;
    value: string;
    status: 'ok' | 'warning' | 'critical';
  }>;
  caveats: string[];
}

/**
 * Parse and validate AI response, ensuring it meets trust requirements.
 */
export function validateResponse(
  rawContent: string,
  providedChunks: string[]
): TrustedResponse {
  let parsed: any;

  try {
    parsed = JSON.parse(rawContent);
  } catch {
    // Try to extract JSON from response
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        return {
          answer: rawContent,
          confidence: 'general',
          sources: [],
          highlights: [],
          caveats: ['Η απάντηση δεν περιέχει δομημένες πηγές.'],
        };
      }
    } else {
      return {
        answer: rawContent,
        confidence: 'general',
        sources: [],
        highlights: [],
        caveats: ['Η απάντηση δεν περιέχει δομημένες πηγές.'],
      };
    }
  }

  // Ensure required fields
  const response: TrustedResponse = {
    answer: parsed.answer || rawContent,
    confidence: validateConfidenceLevel(parsed.confidence),
    sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
    caveats: Array.isArray(parsed.caveats) ? parsed.caveats : [],
  };

  // Anti-hallucination: if confidence is 'verified' but no document sources, downgrade
  if (response.confidence === 'verified') {
    const hasDocSource = response.sources.some((s) => s.type === 'document');
    if (!hasDocSource) {
      response.confidence = 'inferred';
      response.caveats.push('Δεν βρέθηκε ακριβές απόσπασμα εγγράφου — η βεβαιότητα υποβαθμίστηκε.');
    }
  }

  // Check if quotes exist in the provided chunks
  for (const source of response.sources) {
    if (source.quote && source.type === 'document') {
      const quoteFound = providedChunks.some((chunk) =>
        chunk.toLowerCase().includes(source.quote!.toLowerCase().slice(0, 50))
      );
      if (!quoteFound) {
        source.quote = undefined;
        if (response.confidence === 'verified') {
          response.confidence = 'inferred';
        }
      }
    }
  }

  return response;
}

function validateConfidenceLevel(level: string): 'verified' | 'inferred' | 'general' {
  if (level === 'verified' || level === 'inferred' || level === 'general') {
    return level;
  }
  return 'general';
}
