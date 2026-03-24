import type { AIProvider } from './types';
import { ClaudeProvider } from './claude-provider';
import { GeminiProvider } from './gemini-provider';
import { FallbackProvider } from './fallback-provider';
import { db } from '@/lib/db';

/**
 * Create a single AI provider instance from name + env vars.
 */
function createProvider(name: string): AIProvider | null {
  if (name === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    return new GeminiProvider({
      apiKey,
      model: process.env.AI_MODEL || 'gemini-2.0-flash',
    });
  }

  if (name === 'claude') {
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) return null;
    return new ClaudeProvider({
      apiKey,
      model: process.env.AI_MODEL || 'claude-sonnet-4-6',
    });
  }

  return null;
}

/**
 * AI Provider factory with automatic fallback.
 *
 * Config via env vars:
 *   AI_PROVIDER=gemini            — primary provider
 *   AI_FALLBACK_PROVIDERS=claude  — comma-separated fallback list (optional)
 *
 * If fallback providers are configured AND their API keys exist,
 * returns a FallbackProvider that tries primary first, then fallbacks.
 * Otherwise returns the primary provider directly (no overhead).
 */
export function getAIProvider(): AIProvider {
  const primaryName = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  const primary = createProvider(primaryName);

  if (!primary) {
    throw new Error(
      `AI provider "${primaryName}" is not configured. ` +
      'Check your API key environment variables (AI_API_KEY for Claude, GEMINI_API_KEY for Gemini).'
    );
  }

  // Check for fallback providers
  const fallbackStr = (process.env.AI_FALLBACK_PROVIDERS || '').trim();
  if (!fallbackStr) {
    return primary;
  }

  const fallbackNames = fallbackStr.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const fallbacks: AIProvider[] = [];

  for (const name of fallbackNames) {
    if (name === primaryName) continue; // skip duplicate
    const provider = createProvider(name);
    if (provider) {
      fallbacks.push(provider);
    } else {
      console.warn(`[AI] Fallback provider "${name}" skipped — API key not set.`);
    }
  }

  if (fallbacks.length === 0) {
    return primary;
  }

  console.log(
    `[AI] Fallback chain: ${primary.name} → ${fallbacks.map((p) => p.name).join(' → ')}`
  );
  return new FallbackProvider([primary, ...fallbacks]);
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
