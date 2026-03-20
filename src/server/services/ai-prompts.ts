/**
 * Shared AI prompt templates and response validation.
 * Every AI analysis call uses these rules to prevent fabrication.
 */

// ─── Analysis Rules (prepended to every AI prompt) ──────────

export const ANALYSIS_RULES = `
ΚΑΝΟΝΕΣ ΑΝΑΛΥΣΗΣ:
1. Απάντησε ΑΠΟΚΛΕΙΣΤΙΚΑ βάσει του κειμένου που σου δίνεται.
   ΜΗΝ υποθέσεις, ΜΗΝ συμπληρώσεις, ΜΗΝ επινοήσεις πληροφορίες.
2. Αν μια πληροφορία ΔΕΝ υπάρχει στο κείμενο, γράψε: "ΔΕΝ ΑΝΑΦΕΡΕΤΑΙ ΣΤΟ ΕΓΓΡΑΦΟ"
3. Για κάθε πληροφορία που εξάγεις, βαθμολόγησε confidence (0.0-1.0)
4. Απάντησε σε ελληνικά
5. Χρησιμοποίησε ορολογία σύμφωνη με τον Ν.4412/2016
`.trim();

export const NOT_FOUND = 'ΔΕΝ ΑΝΑΦΕΡΕΤΑΙ ΣΤΟ ΕΓΓΡΑΦΟ';

// ─── Token Limits ───────────────────────────────────────────

/** Max chars to send in a single AI call (~100K tokens for Greek text) */
export const MAX_CHARS_PER_CALL = 150_000;

/** If text exceeds this, we need to chunk */
export function shouldChunk(text: string): boolean {
  return text.length > MAX_CHARS_PER_CALL;
}

/** Split text into chunks by document boundaries or paragraphs */
export function chunkText(text: string, maxChars = MAX_CHARS_PER_CALL): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  // Try to split by document boundaries first
  const docParts = text.split(/\n---\s+.*?\s+---\n/);

  let current = '';
  for (const part of docParts) {
    if ((current + part).length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = part;
    } else {
      current += '\n\n' + part;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  // If any chunk is still too large, split by paragraphs
  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= maxChars) {
      result.push(chunk);
    } else {
      const paras = chunk.split(/\n\n+/);
      let acc = '';
      for (const p of paras) {
        if ((acc + p).length > maxChars && acc.length > 0) {
          result.push(acc.trim());
          acc = p;
        } else {
          acc += '\n\n' + p;
        }
      }
      if (acc.trim()) result.push(acc.trim());
    }
  }

  return result;
}

// ─── Response Validation ────────────────────────────────────

/** Parse and validate JSON response from AI, with recovery for malformed output */
export function parseAIResponse<T>(
  raw: string,
  requiredFields: string[] = [],
  label: string = 'AI response'
): T {
  let parsed: any;

  // Attempt 1: Direct JSON parse
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Attempt 2: Extract JSON from markdown fences
    const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) {
      try { parsed = JSON.parse(fenceMatch[1].trim()); } catch { /* continue */ }
    }

    // Attempt 3: Find first { or [ and extract to matching bracket
    if (!parsed) {
      const objStart = raw.indexOf('{');
      const arrStart = raw.indexOf('[');
      const start = objStart >= 0 && arrStart >= 0
        ? Math.min(objStart, arrStart)
        : Math.max(objStart, arrStart);
      if (start >= 0) {
        const bracket = raw[start];
        const closeBracket = bracket === '{' ? '}' : ']';
        const lastClose = raw.lastIndexOf(closeBracket);
        if (lastClose > start) {
          try { parsed = JSON.parse(raw.slice(start, lastClose + 1)); } catch { /* continue */ }
        }
      }
    }

    // Attempt 4: Fix common Gemini JSON issues (trailing commas, control chars, unescaped newlines)
    if (!parsed) {
      try {
        let cleaned = raw;
        // Extract JSON portion
        const jsonStart = cleaned.indexOf('{');
        const jsonEnd = cleaned.lastIndexOf('}');
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
        }
        // Remove trailing commas before } or ]
        cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
        // Remove control characters (except \n, \r, \t)
        cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
        // Fix unescaped newlines inside strings — replace with \\n
        cleaned = cleaned.replace(/(?<=:\s*"[^"]*)\n(?=[^"]*")/g, '\\n');
        parsed = JSON.parse(cleaned);
      } catch { /* continue */ }
    }

    // Attempt 5: Truncated JSON — try to close open brackets/braces
    if (!parsed) {
      try {
        let truncated = raw;
        const jsonStart = truncated.indexOf('{');
        if (jsonStart >= 0) {
          truncated = truncated.slice(jsonStart);
          // Remove trailing commas
          truncated = truncated.replace(/,\s*([\]}])/g, '$1');
          // Count open vs close braces/brackets
          let openBraces = 0, openBrackets = 0;
          let inString = false, escape = false;
          for (const ch of truncated) {
            if (escape) { escape = false; continue; }
            if (ch === '\\') { escape = true; continue; }
            if (ch === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (ch === '{') openBraces++;
            if (ch === '}') openBraces--;
            if (ch === '[') openBrackets++;
            if (ch === ']') openBrackets--;
          }
          // Close any open structures
          // First, try to find a reasonable truncation point (last complete value)
          const lastComma = truncated.lastIndexOf(',');
          const lastBrace = truncated.lastIndexOf('}');
          const lastBracket = truncated.lastIndexOf(']');
          const cutPoint = Math.max(lastComma, lastBrace, lastBracket);
          if (cutPoint > 0 && (openBraces > 0 || openBrackets > 0)) {
            let repaired = truncated.slice(0, cutPoint + 1);
            // Remove trailing comma if we cut at a comma
            repaired = repaired.replace(/,\s*$/, '');
            // Close remaining open structures
            for (let i = 0; i < openBrackets; i++) repaired += ']';
            for (let i = 0; i < openBraces; i++) repaired += '}';
            try { parsed = JSON.parse(repaired); } catch { /* give up */ }
          }
        }
      } catch { /* final fallback */ }
    }

    if (!parsed) {
      console.error(`[parseAIResponse] Failed to parse (${label}). Raw response (first 500 chars):`, raw.slice(0, 500));
      throw new Error(`Αποτυχία ανάλυσης AI απάντησης (${label}): μη έγκυρο JSON`);
    }
  }

  // Validate required fields exist
  for (const field of requiredFields) {
    if (!(field in parsed)) {
      throw new Error(`Λείπει το πεδίο "${field}" από την AI απάντηση (${label})`);
    }
  }

  // Validate confidence scores are 0-1
  validateConfidenceScores(parsed);

  return parsed as T;
}

function validateConfidenceScores(obj: any, path = ''): void {
  if (obj === null || obj === undefined) return;
  if (typeof obj !== 'object') return;

  for (const [key, value] of Object.entries(obj)) {
    if (key === 'confidence' && typeof value === 'number') {
      if (value < 0 || value > 1) {
        console.warn(`[AI Validation] confidence at ${path}.${key} = ${value}, clamping to 0-1`);
        (obj as any)[key] = Math.max(0, Math.min(1, value));
      }
    }
    if (typeof value === 'object') {
      validateConfidenceScores(value, `${path}.${key}`);
    }
  }
}

// ─── Missing Info Helpers ───────────────────────────────────

export interface MissingInfoItem {
  field: string;
  source: 'brief' | 'legal' | 'financial' | 'technical';
  severity: 'critical' | 'important' | 'nice_to_have';
}

export const BRIEF_CRITICAL_FIELDS = [
  'Τίτλος διαγωνισμού',
  'Προϋπολογισμός',
  'Προθεσμία υποβολής',
  'Αναθέτουσα αρχή',
  'CPV κωδικοί',
];

export const LEGAL_CRITICAL_FIELDS = [
  'Εγγυητική συμμετοχής',
  'Δικαιολογητικά συμμετοχής',
  'Κριτήρια αποκλεισμού',
  'Κριτήρια ανάθεσης',
];

export const FINANCIAL_CRITICAL_FIELDS = [
  'Προϋπολογισμός',
  'Ποσοστό εγγυητικής',
  'Πηγή χρηματοδότησης',
  'Κριτήρια οικονομικής επάρκειας',
];
