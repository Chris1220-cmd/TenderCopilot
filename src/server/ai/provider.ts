import type { AIProvider } from './types';
import { MockAIProvider } from './mock-provider';
import { ClaudeProvider } from './claude-provider';

/**
 * AI Provider factory.
 * Set AI_PROVIDER env var to: 'claude' (production) or 'mock' (development).
 */
export function getAIProvider(): AIProvider {
  const providerName = process.env.AI_PROVIDER || 'mock';

  switch (providerName) {
    case 'claude':
      if (!process.env.AI_API_KEY) {
        console.warn('AI_API_KEY not set, falling back to mock');
        return new MockAIProvider();
      }
      return new ClaudeProvider({
        apiKey: process.env.AI_API_KEY,
        model: process.env.AI_MODEL || 'claude-sonnet-4-6',
      });

    case 'mock':
      return new MockAIProvider();

    default:
      console.warn(`Unknown AI provider "${providerName}", falling back to mock`);
      return new MockAIProvider();
  }
}

// Singleton instance
let _provider: AIProvider | null = null;

export function ai(): AIProvider {
  if (!_provider) {
    _provider = getAIProvider();
  }
  return _provider;
}
