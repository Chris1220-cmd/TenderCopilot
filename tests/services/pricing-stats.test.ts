import { describe, it, expect } from 'vitest';
import {
  computePercentiles,
  computeStatsFromValues,
} from '@/server/services/pricing-stats';

describe('computePercentiles', () => {
  it('computes p25, p50, p75 for sorted array', () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const result = computePercentiles(values);
    expect(result.p25).toBe(30);
    expect(result.p50).toBe(55);
    expect(result.p75).toBe(80);
  });

  it('handles single value', () => {
    const result = computePercentiles([42]);
    expect(result.p25).toBe(42);
    expect(result.p50).toBe(42);
    expect(result.p75).toBe(42);
  });

  it('handles two values', () => {
    const result = computePercentiles([10, 20]);
    expect(result.p50).toBe(15);
  });

  it('returns null for empty array', () => {
    const result = computePercentiles([]);
    expect(result.p25).toBeNull();
    expect(result.p50).toBeNull();
    expect(result.p75).toBeNull();
  });
});

describe('computeStatsFromValues', () => {
  it('computes full stats from ratio values', () => {
    const ratios = [0.7, 0.72, 0.75, 0.78, 0.8, 0.82, 0.85, 0.88, 0.9, 0.95];
    const result = computeStatsFromValues(ratios);
    expect(result.count).toBe(10);
    expect(result.mean).toBeCloseTo(0.815, 2);
    expect(result.median).toBeCloseTo(0.81, 1);
    expect(result.p25).toBeCloseTo(0.75, 1);
    expect(result.p75).toBeCloseTo(0.88, 1);
    expect(result.stdDev).toBeGreaterThan(0);
    expect(result.min).toBe(0.7);
    expect(result.max).toBe(0.95);
  });

  it('returns null stdDev for fewer than 3 values', () => {
    const result = computeStatsFromValues([0.75, 0.8]);
    expect(result.count).toBe(2);
    expect(result.mean).toBeCloseTo(0.775, 2);
    expect(result.stdDev).toBeNull();
  });

  it('returns empty stats for no values', () => {
    const result = computeStatsFromValues([]);
    expect(result.count).toBe(0);
    expect(result.mean).toBeNull();
    expect(result.median).toBeNull();
  });
});
