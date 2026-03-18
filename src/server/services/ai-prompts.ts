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

/** Parse and validate JSON response from AI */
export function parseAIResponse<T>(
  raw: string,
  requiredFields: string[] = [],
  label: string = 'AI response'
): T {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Αποτυχία ανάλυσης AI απάντησης (${label}): μη έγκυρο JSON`);
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
