import { describe, it, expect } from 'vitest';
import {
  normalizeCompanyName,
  normalizeAuthority,
  computeAwardRatio,
} from '@/server/services/award-normalizer';

describe('normalizeCompanyName', () => {
  it('lowercases and strips legal suffixes', () => {
    expect(normalizeCompanyName('ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ Α.Ε.')).toBe('κατασκευαστικη');
  });

  it('handles ΙΚΕ suffix', () => {
    expect(normalizeCompanyName('Ηλεκτρολογική Παπαδόπουλος ΙΚΕ')).toBe('ηλεκτρολογικη παπαδοπουλος');
  });

  it('handles ΕΠΕ with dots', () => {
    expect(normalizeCompanyName('ΤΕΧΝΙΚΗ Ε.Π.Ε.')).toBe('τεχνικη');
  });

  it('handles OE suffix', () => {
    expect(normalizeCompanyName('ΑΔΕΛΦΟΙ ΓΕΩΡΓΙΟΥ Ο.Ε.')).toBe('αδελφοι γεωργιου');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeCompanyName('  MEGA   CONSTRUCTION   AE  ')).toBe('mega construction');
  });

  it('strips diacritics', () => {
    expect(normalizeCompanyName('Ένωση Εταιρειών')).toBe('ενωση εταιρειων');
  });

  it('handles empty string', () => {
    expect(normalizeCompanyName('')).toBe('');
  });

  it('handles SA and LTD English suffixes', () => {
    expect(normalizeCompanyName('TERNA SA')).toBe('terna');
  });

  it('strips standalone ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ', () => {
    expect(normalizeCompanyName('ΕΛΛΑΚΤΩΡ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ')).toBe('ελλακτωρ');
  });

  it('strips ΕΤΑΙΡΕΙΑ ΠΕΡΙΟΡΙΣΜΕΝΗΣ ΕΥΘΥΝΗΣ', () => {
    expect(normalizeCompanyName('ΔΟΜΗ ΕΤΑΙΡΕΙΑ ΠΕΡΙΟΡΙΣΜΕΝΗΣ ΕΥΘΥΝΗΣ')).toBe('δομη');
  });
});

describe('normalizeAuthority', () => {
  it('lowercases and strips diacritics but keeps entity type', () => {
    expect(normalizeAuthority('ΔΗΜΟΣ ΑΘΗΝΑΙΩΝ')).toBe('δημος αθηναιων');
  });

  it('handles ΥΠΟΥΡΓΕΙΟ prefix', () => {
    expect(normalizeAuthority('ΥΠΟΥΡΓΕΙΟ ΠΑΙΔΕΙΑΣ')).toBe('υπουργειο παιδειας');
  });

  it('collapses whitespace', () => {
    expect(normalizeAuthority('  ΔΗΜΟΣ   ΘΕΣΣΑΛΟΝΙΚΗΣ  ')).toBe('δημος θεσσαλονικης');
  });

  it('handles empty string', () => {
    expect(normalizeAuthority('')).toBe('');
  });
});

describe('computeAwardRatio', () => {
  it('returns ratio when both values present', () => {
    expect(computeAwardRatio(80000, 100000)).toBe(0.8);
  });

  it('returns null when award is null', () => {
    expect(computeAwardRatio(null, 100000)).toBeNull();
  });

  it('returns null when budget is null', () => {
    expect(computeAwardRatio(80000, null)).toBeNull();
  });

  it('returns null when budget is 0', () => {
    expect(computeAwardRatio(80000, 0)).toBeNull();
  });

  it('clamps ratio above 2.0 to null (bad data)', () => {
    expect(computeAwardRatio(300000, 100000)).toBeNull();
  });

  it('handles both null', () => {
    expect(computeAwardRatio(null, null)).toBeNull();
  });

  it('rounds to 4 decimal places', () => {
    expect(computeAwardRatio(75321, 100000)).toBe(0.7532);
  });
});
