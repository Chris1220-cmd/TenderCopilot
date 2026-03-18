import type { AIProvider } from './types';
import { ClaudeProvider } from './claude-provider';

/**
 * AI Provider factory.
 * REQUIRES AI_API_KEY to be set. No mock fallback — if AI is unavailable, errors are surfaced.
 */
export function getAIProvider(): AIProvider {
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
