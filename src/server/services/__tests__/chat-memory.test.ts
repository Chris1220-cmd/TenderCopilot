import { describe, it, expect } from 'vitest';
import { shouldSummarize, buildSummaryPrompt } from '@/server/services/chat-memory';

describe('chat-memory', () => {
  describe('shouldSummarize', () => {
    it('returns false when messageCount < threshold', () => {
      expect(shouldSummarize(5, null)).toBe(false);
      expect(shouldSummarize(9, null)).toBe(false);
    });

    it('returns true when messageCount >= threshold and no prior summary', () => {
      expect(shouldSummarize(10, null)).toBe(true);
      expect(shouldSummarize(15, null)).toBe(true);
    });

    it('returns true when 10+ new messages since last summary', () => {
      expect(shouldSummarize(20, new Date('2026-03-22T10:00:00Z'), 10)).toBe(true);
    });

    it('returns false when fewer than 10 new messages since last summary', () => {
      expect(shouldSummarize(14, new Date('2026-03-22T10:00:00Z'), 5)).toBe(false);
    });
  });

  describe('buildSummaryPrompt', () => {
    it('includes previous summary when provided', () => {
      const prompt = buildSummaryPrompt('Previous summary here', [
        { role: 'user', content: 'What is the budget?' },
        { role: 'assistant', content: 'The budget is €500,000.' },
      ]);
      expect(prompt).toContain('Previous summary here');
      expect(prompt).toContain('What is the budget?');
    });

    it('works without previous summary', () => {
      const prompt = buildSummaryPrompt(null, [
        { role: 'user', content: 'Hello' },
      ]);
      expect(prompt).not.toContain('PREVIOUS SUMMARY');
      expect(prompt).toContain('Hello');
    });
  });
});
