import type { AIProvider } from './types';
import { MockAIProvider } from './mock-provider';

// TODO: Implement real providers
// import { ClaudeProvider } from './claude-provider';
// import { OpenAIProvider } from './openai-provider';

/**
 * Factory function to get the configured AI provider.
 *
 * To add a new provider:
 * 1. Create a class implementing AIProvider in a new file (e.g. claude-provider.ts)
 * 2. Add a case here
 * 3. Set AI_PROVIDER env var to the provider name
 *
 * For production, implement:
 * - ClaudeProvider: Use Anthropic SDK with claude-sonnet-4-6 or claude-opus-4-6
 * - OpenAIProvider: Use OpenAI SDK with gpt-4o
 */
export function getAIProvider(): AIProvider {
  const providerName = process.env.AI_PROVIDER || 'mock';

  switch (providerName) {
    case 'mock':
      return new MockAIProvider();

    // TODO: Uncomment when implementing real providers
    // case 'claude':
    //   return new ClaudeProvider({
    //     apiKey: process.env.AI_API_KEY!,
    //     model: 'claude-sonnet-4-6',
    //   });
    // case 'openai':
    //   return new OpenAIProvider({
    //     apiKey: process.env.AI_API_KEY!,
    //     model: 'gpt-4o',
    //   });

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
