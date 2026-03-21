/**
 * Classifier για αυτόματη αναγνώριση τύπου διαγωνισμού
 * Αναλύει κείμενο διακήρυξης και επιστρέφει τύπο, εκτιμώμενο budget, κατηγορία
 */

export type TenderType =
  | 'open_above'
  | 'open_below'
  | 'restricted'
  | 'direct'
  | 'framework'
  | 'unknown';

export type TenderCategory = 'supplies' | 'services' | 'works' | 'mixed';

export interface TenderClassification {
  type: TenderType;
  estimatedBudget: number | null;
  isEU: boolean;
  category: TenderCategory;
  confidence: number; // 0-1
  detectedKeywords: string[];
}

// EU thresholds (current values)
const EU_THRESHOLDS = {
  supplies_central: 140_000,
  supplies_other: 215_000,
  services_central: 140_000,
  services_other: 215_000,
  works: 5_382_000,
};

const NATIONAL_THRESHOLDS = {
  direct_award: 30_000,
  summary_procedure: 60_000,
  works_below: 1_000_000,
};

/**
 * Extracts budget amounts from tender text
 */
function extractBudget(text: string): number | null {
  const patterns = [
    // "100.000,00€" or "100.000,00 €" or "100.000,00 ευρώ"
    /(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)\s*(?:€|ευρώ|ΕΥΡΩ|EUR)/gi,
    // "εκτιμώμενης αξίας 100.000" or "προϋπολογισμός 100.000"
    /(?:εκτιμ[ωώ]μεν\w+\s+αξ[ιί]\w+|προ[υύ]πολογισμ\w+|δαπ[αά]ν\w+|ποσ[οό](?:ύ|υ)?)\s*(?:των|:)?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)/gi,
    // "100000€" compact
    /(\d{4,9}(?:,\d{1,2})?)\s*(?:€|ευρώ|EUR)/gi,
  ];

  const amounts: number[] = [];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const numStr = (match[1] || match[0])
        .replace(/\./g, '')
        .replace(',', '.')
        .replace(/[^0-9.]/g, '');
      const num = parseFloat(numStr);
      if (!isNaN(num) && num > 100 && num < 100_000_000_000) {
        amounts.push(num);
      }
    }
  }

  if (amounts.length === 0) return null;

  // Return the largest amount (usually the total budget)
  return Math.max(...amounts);
}

/**
 * Detects tender category (supplies, services, works)
 */
function detectCategory(text: string): TenderCategory {
  const lower = text.toLowerCase();

  const suppliesKeywords = [
    'προμήθει',
    'προμηθει',
    'αγορ',
    'ειδ[ηή]',
    'υλικ[ωώ]ν',
    'εξοπλισμ',
    'τρόφιμ',
    'καύσιμ',
    'φαρμάκ',
    'αναλώσιμ',
    'μηχάνημ',
  ];
  const servicesKeywords = [
    'υπηρεσι',
    'υπηρεσί',
    'παροχ[ηή] υπηρεσ',
    'συμβουλευτικ',
    'μελέτ',
    'μελετ',
    'φύλαξ',
    'καθαρισμ',
    'συντήρησ',
    'μεταφορ',
    'σίτισ',
    'εκπαίδευσ',
    'ασφάλισ',
  ];
  const worksKeywords = [
    'έργο',
    'εργο',
    'κατασκευ',
    'οικοδομικ',
    'ΜΕΕΠ',
    'μεεπ',
    'εργολαβ',
    'τεχνικ[οό] έργο',
    'οδοποι',
    'υδραυλικ',
    'ηλεκτρολογικ',
  ];

  let suppliesScore = 0;
  let servicesScore = 0;
  let worksScore = 0;

  for (const kw of suppliesKeywords) {
    if (new RegExp(kw, 'i').test(lower)) suppliesScore++;
  }
  for (const kw of servicesKeywords) {
    if (new RegExp(kw, 'i').test(lower)) servicesScore++;
  }
  for (const kw of worksKeywords) {
    if (new RegExp(kw, 'i').test(lower)) worksScore++;
  }

  const maxScore = Math.max(suppliesScore, servicesScore, worksScore);
  if (maxScore === 0) return 'supplies'; // default

  // Check for mixed
  const scores = [suppliesScore, servicesScore, worksScore].filter(
    (s) => s > 0
  );
  if (scores.length >= 2 && scores.every((s) => s >= maxScore * 0.5)) {
    return 'mixed';
  }

  if (worksScore === maxScore) return 'works';
  if (servicesScore === maxScore) return 'services';
  return 'supplies';
}

/**
 * Main classifier function
 */
export function classifyTenderType(text: string): TenderClassification {
  const lower = text.toLowerCase();
  const detectedKeywords: string[] = [];
  let confidence = 0;

  // --- Detect tender type ---
  let type: TenderType = 'unknown';

  // Framework agreement
  const frameworkPatterns = [
    /συμφων[ιί]α[ςσ]?\s+πλα[ιί]σι/i,
    /πλα[ιί]σιο\s+συμφων/i,
    /framework\s+agreement/i,
    /συμφωνία-πλαίσιο/i,
  ];
  for (const p of frameworkPatterns) {
    if (p.test(text)) {
      type = 'framework';
      detectedKeywords.push('συμφωνία πλαίσιο');
      confidence = 0.9;
      break;
    }
  }

  // Restricted procedure
  if (type === 'unknown') {
    const restrictedPatterns = [
      /κλειστ[ηή]\s+διαδικασ[ιί]/i,
      /κλειστ[οό][ςσ]\s+διαγωνισμ/i,
      /προεπιλογ/i,
      /restricted\s+procedure/i,
    ];
    for (const p of restrictedPatterns) {
      if (p.test(text)) {
        type = 'restricted';
        detectedKeywords.push('κλειστή διαδικασία');
        confidence = 0.85;
        break;
      }
    }
  }

  // Direct award
  if (type === 'unknown') {
    const directPatterns = [
      /απευθε[ιί]α[ςσ]?\s+αν[αά]θεσ/i,
      /απ['']?\s*ευθε[ιί]α[ςσ]/i,
      /[αά]ρθρο\s*118/i,
      /direct\s+award/i,
    ];
    for (const p of directPatterns) {
      if (p.test(text)) {
        type = 'direct';
        detectedKeywords.push('απευθείας ανάθεση');
        confidence = 0.9;
        break;
      }
    }
  }

  // Summary procedure (below threshold)
  if (type === 'unknown') {
    const summaryPatterns = [
      /συνοπτικ[οό][ςσ]?\s+διαγωνισμ/i,
      /πρ[οό]χειρ[οο][ςσ]?\s+διαγωνισμ/i,
      /[αά]ρθρο\s*117/i,
    ];
    for (const p of summaryPatterns) {
      if (p.test(text)) {
        type = 'open_below';
        detectedKeywords.push('συνοπτικός διαγωνισμός');
        confidence = 0.85;
        break;
      }
    }
  }

  // Open procedure
  if (type === 'unknown') {
    const openPatterns = [
      /ανοικτ[ηή]\s+διαδικασ[ιί]/i,
      /ανοι[κχ]τ[οό][ςσ]?\s+(?:ηλεκτρονικ[οό][ςσ]?\s+)?διαγωνισμ/i,
      /[αά]ρθρο\s*27/i,
      /open\s+procedure/i,
      /δι(?:εθν[ηή][ςσ]|εθν)\s+(?:ηλεκτρονικ|ανοικτ)/i,
      /ηλεκτρονικ[οό][ςσ]?\s+(?:ανοικτ[οό][ςσ]?\s+)?(?:δι(?:εθν[ηή][ςσ]|αγωνισμ))/i,
    ];
    for (const p of openPatterns) {
      if (p.test(text)) {
        type = 'open_above'; // will refine below based on budget
        detectedKeywords.push('ανοικτή διαδικασία');
        confidence = 0.8;
        break;
      }
    }
  }

  // --- Detect budget ---
  const estimatedBudget = extractBudget(text);

  // --- Detect category ---
  const category = detectCategory(text);

  // CPV detection
  const cpvMatch = text.match(/(?:CPV|cpv)\s*:?\s*(\d{8})/);
  if (cpvMatch) {
    detectedKeywords.push(`CPV: ${cpvMatch[1]}`);
    confidence = Math.min(confidence + 0.1, 1);
  }

  // --- Refine type based on budget ---
  if (estimatedBudget !== null) {
    detectedKeywords.push(`budget: ${estimatedBudget.toLocaleString('el-GR')}€`);

    if (type === 'unknown' || type === 'open_above') {
      if (estimatedBudget <= NATIONAL_THRESHOLDS.direct_award) {
        type = 'direct';
        confidence = Math.max(confidence, 0.7);
      } else if (
        category === 'works'
          ? estimatedBudget <= NATIONAL_THRESHOLDS.works_below
          : estimatedBudget <= NATIONAL_THRESHOLDS.summary_procedure
      ) {
        type = 'open_below';
        confidence = Math.max(confidence, 0.7);
      } else {
        type = 'open_above';
        confidence = Math.max(confidence, 0.7);
      }
    }
  }

  // --- Determine EU applicability ---
  let isEU = false;
  if (estimatedBudget !== null) {
    if (category === 'works') {
      isEU = estimatedBudget >= EU_THRESHOLDS.works;
    } else {
      // Conservative: use the lower threshold
      isEU = estimatedBudget >= EU_THRESHOLDS.supplies_central;
    }
  }

  // EU indicators in text
  const euIndicators = [
    /ε\.ε\.ε\.ε/i,
    /επ[ιί]σημη\s+εφημερ[ιί]δα\s+τ\w+\s+ε\.?ε/i,
    /TED\s/,
    /OJEU/i,
    /ευρωπα[ιϊ]κ/i,
    /european\s+union/i,
  ];
  for (const p of euIndicators) {
    if (p.test(text)) {
      isEU = true;
      detectedKeywords.push('EU publication');
      break;
    }
  }

  // If still unknown, default
  if (type === 'unknown') {
    confidence = 0.3;
  }

  return {
    type,
    estimatedBudget,
    isEU,
    category,
    confidence,
    detectedKeywords,
  };
}
