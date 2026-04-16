import { describe, it, expect } from 'vitest';
import { mapAwardToRecord } from '@/server/services/award-ingester';

describe('mapAwardToRecord', () => {
  it('maps AwardResult to AwardRecord with normalized fields', () => {
    const input = {
      title: 'Προμήθεια ηλεκτρολογικού υλικού',
      winner: 'ΗΛΕΚΤΡΟΛΟΓΙΚΗ Α.Ε.',
      amount: 85000,
      authority: 'ΔΗΜΟΣ ΑΘΗΝΑΙΩΝ',
      date: new Date('2025-06-15'),
      cpvCodes: ['31500000-1', '31600000-2'],
      source: 'DIAVGEIA' as const,
      sourceUrl: 'https://diavgeia.gov.gr/decision/view/ABC123',
      budgetAmount: 100000,
      numberOfBids: 4,
    };

    const result = mapAwardToRecord(input);

    expect(result.title).toBe('Προμήθεια ηλεκτρολογικού υλικού');
    expect(result.winner).toBe('ΗΛΕΚΤΡΟΛΟΓΙΚΗ Α.Ε.');
    expect(result.winnerNormalized).toMatch(/ηλεκτρολογικη/);
    expect(result.authority).toBe('ΔΗΜΟΣ ΑΘΗΝΑΙΩΝ');
    expect(result.authorityNormalized).toBe('δημος αθηναιων');
    expect(result.awardAmount).toBe(85000);
    expect(result.budgetAmount).toBe(100000);
    expect(result.awardRatio).toBe(0.85);
    expect(result.cpvPrimary).toBe('31500000');
    expect(result.cpvCodes).toEqual(['31500000-1', '31600000-2']);
    expect(result.source).toBe('DIAVGEIA');
    expect(result.sourceUrl).toBe('https://diavgeia.gov.gr/decision/view/ABC123');
    expect(result.numberOfBids).toBe(4);
    expect(result.awardDate).toEqual(new Date('2025-06-15'));
  });

  it('handles null amount and budget gracefully', () => {
    const input = {
      title: 'Test',
      winner: 'Test Co',
      amount: null,
      authority: 'Test Authority',
      date: new Date('2025-01-01'),
      cpvCodes: [],
      source: 'KIMDIS' as const,
      sourceUrl: 'https://example.com/1',
      budgetAmount: null,
      numberOfBids: null,
    };

    const result = mapAwardToRecord(input);
    expect(result.awardAmount).toBeNull();
    expect(result.budgetAmount).toBeNull();
    expect(result.awardRatio).toBeNull();
    expect(result.cpvPrimary).toBeNull();
  });

  it('extracts cpvPrimary without check digit', () => {
    const input = {
      title: 'Test',
      winner: 'X',
      amount: null,
      authority: 'Y',
      date: new Date(),
      cpvCodes: ['45233120-6', '45233000-9'],
      source: 'DIAVGEIA' as const,
      sourceUrl: 'https://example.com/2',
      budgetAmount: null,
      numberOfBids: null,
    };

    const result = mapAwardToRecord(input);
    expect(result.cpvPrimary).toBe('45233120');
  });
});
