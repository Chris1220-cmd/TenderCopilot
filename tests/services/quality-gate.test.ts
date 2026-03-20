import { describe, it, expect } from 'vitest';
import { evaluateQualityGate } from '@/server/services/quality-gate';

describe('Quality Gate', () => {
  it('passes for good text-based PDF', () => {
    const result = evaluateQualityGate({
      text: 'ΔΙΑΚΗΡΥΞΗ μειοδοτικής δημοπρασίας μίσθωσης ακινήτου. Αναθέτουσα αρχή: Κτηματική Υπηρεσία. Προϋπολογισμός 5000 ευρώ. Προθεσμία υποβολής 27/3/2026. Σύμβαση διάρκειας 12 ετών. Τεχνικές προδιαγραφές οικοδομικών εργασιών.' + ' lorem ipsum'.repeat(150),
      fileSizeBytes: 100_000,
      pageCount: 5,
    });
    expect(result.passed).toBe(true);
    expect(result.charsPerKB).toBeGreaterThanOrEqual(3);
    expect(result.keywordHits).toBeGreaterThanOrEqual(4);
    expect(result.charsPerPage).toBeGreaterThanOrEqual(200);
  });

  it('fails for scanned PDF (very low chars)', () => {
    const result = evaluateQualityGate({
      text: 'abc',
      fileSizeBytes: 500_000,
      pageCount: 10,
    });
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('charsPerKB');
  });

  it('fails when no procurement keywords found', () => {
    const result = evaluateQualityGate({
      text: 'The quick brown fox jumps over the lazy dog. '.repeat(100),
      fileSizeBytes: 5_000,
      pageCount: 2,
    });
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('keywordCoverage');
  });

  it('fails for hybrid PDF with low chars per page', () => {
    const result = evaluateQualityGate({
      text: 'Διακήρυξη μειοδοτικής δημοπρασίας. Αναθέτουσα αρχή. Προϋπολογισμός. Προθεσμία. Σύμβαση.' + 'x'.repeat(1900),
      fileSizeBytes: 10_000,
      pageCount: 50,
    });
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('charsPerPage');
  });

  it('sets docAiRecommended when tables detected', () => {
    const textWithTables = 'Διακήρυξη. Αναθέτουσα αρχή. Προϋπολογισμός 5000. Προθεσμία 2026.\n'
      + '| Α/Α | Περιγραφή | Ποσότητα | Τιμή |\n'.repeat(10)
      + ' more text '.repeat(200);
    const result = evaluateQualityGate({
      text: textWithTables,
      fileSizeBytes: 5_000,
      pageCount: 3,
    });
    expect(result.passed).toBe(true);
    expect(result.docAiRecommended).toBe(true);
  });

  it('sets docAiRecommended for large documents', () => {
    const longText = 'Διακήρυξη μειοδοτικής δημοπρασίας. Αναθέτουσα αρχή Χίου. Προϋπολογισμός 5000 ευρώ. Προθεσμία υποβολής. Σύμβαση. Τεχνικές προδιαγραφές. '.repeat(500);
    const result = evaluateQualityGate({
      text: longText,
      fileSizeBytes: 50_000,
      pageCount: 35,
    });
    expect(result.docAiRecommended).toBe(true);
  });
});
