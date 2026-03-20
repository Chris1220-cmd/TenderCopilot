/**
 * Quality Gate for Document Extraction Pipeline
 *
 * Evaluates whether pdf-parse output is trustworthy enough to skip
 * Document AI processing. Uses 3 criteria + a docAiRecommended heuristic.
 */

import { stripAccents } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────

export interface QualityGateInput {
  text: string;
  fileSizeBytes: number;
  pageCount: number;
}

export interface QualityGateResult {
  passed: boolean;
  charsPerKB: number;
  keywordHits: number;
  charsPerPage: number;
  docAiRecommended: boolean;
  reasons: string[];
}

// ─── Constants ──────────────────────────────────────────────

const MIN_CHARS_PER_KB = 3;
const MIN_KEYWORD_HITS = 4;
const MIN_CHARS_PER_PAGE = 200;
const LARGE_DOC_THRESHOLD = 30;

const TENDER_KEYWORDS = [
  'διακήρυξη', 'προκήρυξη', 'δημοπρασία',
  'αναθέτουσα', 'αναθέτων', 'φορέας',
  'προϋπολογισμός', 'μίσθωμα', 'δαπάνη',
  'προθεσμία', 'υποβολή', 'κατάθεση',
  'cpv', 'κωδικ',
  'τεχνικ', 'προδιαγραφ',
  'σύμβαση', 'σύμβασ',
];

// ─── Quality Gate ───────────────────────────────────────────

export function evaluateQualityGate(input: QualityGateInput): QualityGateResult {
  const { text, fileSizeBytes, pageCount } = input;
  const trimmed = text.trim();
  const reasons: string[] = [];

  const charsPerKB = fileSizeBytes > 0
    ? trimmed.length / (fileSizeBytes / 1024)
    : 0;
  if (charsPerKB < MIN_CHARS_PER_KB) {
    reasons.push('charsPerKB');
  }

  const normalizedText = stripAccents(trimmed);
  const keywordHits = TENDER_KEYWORDS.filter(kw =>
    normalizedText.includes(stripAccents(kw))
  ).length;
  if (keywordHits < MIN_KEYWORD_HITS) {
    reasons.push('keywordCoverage');
  }

  const effectivePages = Math.max(pageCount, 1);
  const charsPerPage = trimmed.length / effectivePages;
  if (charsPerPage < MIN_CHARS_PER_PAGE) {
    reasons.push('charsPerPage');
  }

  const docAiRecommended = detectDocAiRecommended(trimmed, pageCount);

  return {
    passed: reasons.length === 0,
    charsPerKB: Math.round(charsPerKB * 100) / 100,
    keywordHits,
    charsPerPage: Math.round(charsPerPage),
    docAiRecommended,
    reasons,
  };
}

function detectDocAiRecommended(text: string, pageCount: number): boolean {
  if (pageCount > LARGE_DOC_THRESHOLD) return true;

  const lines = text.split('\n');
  let tableLineCount = 0;
  for (const line of lines) {
    const pipeCount = (line.match(/\|/g) || []).length;
    const tabCount = (line.match(/\t/g) || []).length;
    if (pipeCount >= 3 || tabCount >= 3) {
      tableLineCount++;
    }
  }
  if (tableLineCount >= 5) return true;

  const financialPatterns = text.match(/[\d.,]+\s*€|€\s*[\d.,]+|ευρώ|EUR/gi) || [];
  if (financialPatterns.length >= 10) return true;

  return false;
}
