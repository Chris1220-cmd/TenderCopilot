import type { AIProvider } from './types';
import { ClaudeProvider } from './claude-provider';
import { GeminiProvider } from './gemini-provider';
import { db } from '@/lib/db';

/**
 * AI Provider factory.
 * Set AI_PROVIDER=gemini to use Google Gemini, or AI_PROVIDER=claude (default) for Anthropic Claude.
 */
export function getAIProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER || 'claude').toLowerCase();

  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is required when AI_PROVIDER=gemini. ' +
        'Get an API key from https://aistudio.google.com/apikey'
      );
    }
    return new GeminiProvider({
      apiKey,
      model: process.env.AI_MODEL || 'gemini-2.0-flash',
    });
  }

  // Default: Claude
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'AI_API_KEY is required. Set it in your .env file. ' +
      'Get an API key from https://console.anthropic.com/'
    );
  }

  return new ClaudeProvider({
    apiKey,
    model: process.env.AI_MODEL || 'claude-sonnet-4-6',
  });
}

// Singleton instance
let _provider: AIProvider | null = null;

export function ai(): AIProvider {
  if (!_provider) {
    _provider = getAIProvider();
  }
  return _provider;
}

// ─── AI Token Rate Limiting & Cost Controls ─────────────────

const DAILY_TOKEN_LIMIT = parseInt(process.env.AI_DAILY_TOKEN_LIMIT || '999999999');

/**
 * Check if a tenant has exceeded their daily AI token limit.
 * Counts tokens from Activity records with action='ai_usage' for today.
 */
export async function checkTokenBudget(tenantId: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find all tenders belonging to this tenant
  const tenderIds = await db.tender.findMany({
    where: { tenantId },
    select: { id: true },
  });

  if (tenderIds.length === 0) {
    return { allowed: true, used: 0, limit: DAILY_TOKEN_LIMIT };
  }

  const activities = await db.activity.findMany({
    where: {
      tenderId: { in: tenderIds.map(t => t.id) },
      action: 'ai_usage',
      createdAt: { gte: today },
    },
    select: { details: true },
  });

  // Parse token counts from details (format: "AI: operation | tokens: N")
  const used = activities.reduce((sum, a) => {
    const match = a.details?.match(/tokens:\s*(\d+)/);
    return sum + (match ? parseInt(match[1], 10) : 0);
  }, 0);

  return { allowed: used < DAILY_TOKEN_LIMIT, used, limit: DAILY_TOKEN_LIMIT };
}

/**
 * Log AI token usage as an Activity record.
 */
export async function logTokenUsage(
  tenderId: string,
  operation: string,
  tokens: { input: number; output: number; total: number }
): Promise<void> {
  await db.activity.create({
    data: {
      tenderId,
      action: 'ai_usage',
      details: `AI: ${operation} | input: ${tokens.input}, output: ${tokens.output}, tokens: ${tokens.total}`,
    },
  });
}
