/**
 * Award Normalizer — pure functions for normalizing Greek company/authority
 * names and computing derived fields for HistoricalAward records.
 */

// Full-word Greek legal form suffixes (matched before abbreviations)
const LEGAL_SUFFIX_PHRASES = [
  'ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ',
  'ΑΝΩΝΥΜΟΣ ΕΤΑΙΡΕΙΑ',
  'ΕΤΑΙΡΕΙΑ ΠΕΡΙΟΡΙΣΜΕΝΗΣ ΕΥΘΥΝΗΣ',
  'ΙΔΙΩΤΙΚΗ ΚΕΦΑΛΑΙΟΥΧΙΚΗ ΕΤΑΙΡΕΙΑ',
  'ΟΜΟΡΡΥΘΜΗ ΕΤΑΙΡΕΙΑ',
  'ΕΤΕΡΟΡΡΥΘΜΗ ΕΤΑΙΡΕΙΑ',
  'ΚΟΙΝΟΠΡΑΞΙΑ',
];

// Short abbreviation suffixes — stored as plain strings, matched case-insensitively
// Each entry is [pattern-with-escapes, requireWordBoundary]
const LEGAL_SUFFIX_ABBREVS = [
  // Greek-letter abbreviations (as they appear in raw input before normalization)
  'Α\\.?Ε\\.?',
  'Ε\\.?Π\\.?Ε\\.?',
  'Ι\\.?Κ\\.?Ε\\.?',
  'Ο\\.?Ε\\.?',
  'Ε\\.?Ε\\.?',
  // Latin abbreviations
  'A\\.?E\\.?',
  'E\\.?P\\.?E\\.?',
  'I\\.?K\\.?E\\.?',
  'O\\.?E\\.?',
  'S\\.?A\\.?',
  'LTD\\.?',
  'GMBH',
  'B\\.?V\\.?',
  // Bare Greek/Latin AE without dots (common in practice)
  'ΑΕ',
  'ΕΠΕ',
  'ΙΚΕ',
  'ΟΕ',
  'AE',
  'SA',
  'LTD',
];

function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeCompanyName(name: string): string {
  if (!name) return '';
  // Step 1: strip diacritics and uppercase — keeps Greek letters intact
  let result = name.trim();
  result = stripDiacritics(result);
  result = result.toUpperCase();

  // Step 2: strip full-phrase legal suffixes (Greek phrases, case-insensitive)
  for (const phrase of LEGAL_SUFFIX_PHRASES) {
    // Strip as trailing phrase first
    const tail = new RegExp(`\\s+${phrase}\\s*$`, 'i');
    result = result.replace(tail, '');
    // Then strip anywhere as standalone phrase (surrounded by spaces or boundaries)
    const mid = new RegExp(`(?:^|\\s)${phrase}(?:\\s|$)`, 'gi');
    result = result.replace(mid, ' ');
  }

  // Step 3: strip short abbreviation suffixes (trailing only for safety)
  for (const abbrev of LEGAL_SUFFIX_ABBREVS) {
    const tail = new RegExp(`\\s+${abbrev}\\s*$`, 'i');
    result = result.replace(tail, '');
  }

  // Step 4: lowercase, remove non-letter/number/space chars, collapse spaces
  result = result.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  return result;
}

export function normalizeAuthority(name: string): string {
  if (!name) return '';
  let result = name.trim();
  result = stripDiacritics(result);
  result = result.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  return result;
}

export function computeAwardRatio(
  awardAmount: number | null,
  budgetAmount: number | null,
): number | null {
  if (awardAmount == null || budgetAmount == null) return null;
  if (budgetAmount <= 0) return null;
  const ratio = awardAmount / budgetAmount;
  if (ratio > 2.0) return null;
  return Math.round(ratio * 10000) / 10000;
}
