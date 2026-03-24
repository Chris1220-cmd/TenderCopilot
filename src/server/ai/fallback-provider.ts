import type { AIProvider, AICompletionOptions, AICompletionResult, AIStreamResult } from './types';

/**
 * Circuit breaker state per provider.
 * After `threshold` consecutive failures within `windowMs`,
 * the provider is "open" (skipped) for `cooldownMs`.
 */
interface CircuitState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
  openedAt: number;
}

const CIRCUIT_DEFAULTS = {
  /** Consecutive failures before circuit opens */
  threshold: 3,
  /** Time window to count failures (5 min) */
  windowMs: 5 * 60 * 1000,
  /** How long circuit stays open before retrying (2 min) */
  cooldownMs: 2 * 60 * 1000,
};

/**
 * FallbackProvider — wraps multiple AI providers with automatic failover.
 *
 * Tries each provider in order. If the primary fails (network error, rate limit,
 * 5xx, timeout), it falls back to the next provider. A circuit breaker prevents
 * wasting time on a provider that's consistently failing.
 *
 * Usage:
 *   new FallbackProvider([geminiProvider, claudeProvider])
 *
 * The first provider in the list is the primary (cheapest/fastest).
 * Subsequent providers are fallbacks in priority order.
 */
export class FallbackProvider implements AIProvider {
  name = 'fallback';
  private providers: AIProvider[];
  private circuits: Map<string, CircuitState> = new Map();

  constructor(providers: AIProvider[]) {
    if (providers.length === 0) {
      throw new Error('FallbackProvider requires at least one provider');
    }
    this.providers = providers;
    this.name = `fallback(${providers.map((p) => p.name).join(' → ')})`;

    // Initialize circuit breakers
    for (const p of providers) {
      this.circuits.set(p.name, {
        failures: 0,
        lastFailure: 0,
        isOpen: false,
        openedAt: 0,
      });
    }
  }

  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    const errors: Array<{ provider: string; error: string }> = [];

    for (const provider of this.providers) {
      if (this.isCircuitOpen(provider.name)) {
        errors.push({ provider: provider.name, error: 'circuit open (cooling down)' });
        continue;
      }

      try {
        const result = await provider.complete(options);
        this.recordSuccess(provider.name);

        // Tag the result with which provider actually served it
        return {
          ...result,
          model: `${provider.name}/${result.model || 'unknown'}`,
        };
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        this.recordFailure(provider.name);
        errors.push({ provider: provider.name, error: errorMsg.slice(0, 200) });

        console.warn(
          `[FallbackProvider] ${provider.name} failed: ${errorMsg.slice(0, 100)}` +
          (this.providers.indexOf(provider) < this.providers.length - 1
            ? ' — trying next provider...'
            : ' — no more providers')
        );
      }
    }

    // All providers failed
    const summary = errors.map((e) => `${e.provider}: ${e.error}`).join('; ');
    throw new Error(`All AI providers failed. ${summary}`);
  }

  async completeStream(options: AICompletionOptions): Promise<AIStreamResult> {
    const errors: Array<{ provider: string; error: string }> = [];

    for (const provider of this.providers) {
      if (this.isCircuitOpen(provider.name)) {
        errors.push({ provider: provider.name, error: 'circuit open (cooling down)' });
        continue;
      }

      // Skip providers that don't support streaming
      if (!provider.completeStream) {
        errors.push({ provider: provider.name, error: 'streaming not supported' });
        continue;
      }

      try {
        const result = await provider.completeStream(options);
        this.recordSuccess(provider.name);
        return result;
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        this.recordFailure(provider.name);
        errors.push({ provider: provider.name, error: errorMsg.slice(0, 200) });

        console.warn(
          `[FallbackProvider] ${provider.name} stream failed: ${errorMsg.slice(0, 100)}` +
          (this.providers.indexOf(provider) < this.providers.length - 1
            ? ' — trying next provider...'
            : ' — no more providers')
        );
      }
    }

    // All providers failed
    const summary = errors.map((e) => `${e.provider}: ${e.error}`).join('; ');
    throw new Error(`All AI providers failed (stream). ${summary}`);
  }

  // ─── Circuit Breaker Logic ─────────────────────────────────

  private isCircuitOpen(providerName: string): boolean {
    const state = this.circuits.get(providerName);
    if (!state || !state.isOpen) return false;

    // Check if cooldown has elapsed → half-open (allow one retry)
    const elapsed = Date.now() - state.openedAt;
    if (elapsed >= CIRCUIT_DEFAULTS.cooldownMs) {
      state.isOpen = false;
      state.failures = 0;
      return false;
    }

    return true;
  }

  private recordSuccess(providerName: string): void {
    const state = this.circuits.get(providerName);
    if (state) {
      state.failures = 0;
      state.isOpen = false;
    }
  }

  private recordFailure(providerName: string): void {
    const state = this.circuits.get(providerName);
    if (!state) return;

    const now = Date.now();

    // Reset failure count if outside the window
    if (now - state.lastFailure > CIRCUIT_DEFAULTS.windowMs) {
      state.failures = 0;
    }

    state.failures++;
    state.lastFailure = now;

    // Open circuit if threshold reached
    if (state.failures >= CIRCUIT_DEFAULTS.threshold) {
      state.isOpen = true;
      state.openedAt = now;
      console.warn(
        `[FallbackProvider] Circuit OPEN for ${providerName} after ${state.failures} failures. ` +
        `Will retry in ${CIRCUIT_DEFAULTS.cooldownMs / 1000}s.`
      );
    }
  }
}
