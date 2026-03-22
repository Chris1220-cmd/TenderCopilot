import type { AIProvider, AICompletionOptions, AICompletionResult } from './types';

/**
 * Claude AI Provider — Uses Anthropic's Claude API.
 * Supports claude-sonnet-4-6 for fast operations and claude-opus-4-6 for complex analysis.
 */
export class ClaudeProvider implements AIProvider {
  name = 'claude';
  private apiKey: string;
  private model: string;

  constructor(config: { apiKey: string; model?: string }) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'claude-sonnet-4-6';
  }

  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    const systemMessage = options.messages.find((m) => m.role === 'system');
    const nonSystemMessages = options.messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: options.maxTokens || 4096,
      messages: nonSystemMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    let response: Response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(50_000), // 50s timeout to stay within Vercel's 60s limit
      });
    } catch (err: any) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new Error('Η κλήση AI έληξε λόγω χρονικού ορίου (timeout). Δοκιμάστε με μικρότερο έγγραφο ή ξαναπροσπαθήστε.');
      }
      throw err;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Claude] API error:', response.status, errorText);
      throw new Error(`Claude API error: ${response.status} — ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();

    // Extract text from content blocks
    const rawText = data.content
      ?.filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('') || '';

    // Strip markdown code fences if present
    let cleaned = rawText;
    const jsonMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (jsonMatch) {
      cleaned = jsonMatch[1].trim();
    }

    // Try to extract JSON object/array if wrapped in other text
    if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
      const objStart = cleaned.indexOf('{');
      const arrStart = cleaned.indexOf('[');
      const start = objStart >= 0 && arrStart >= 0
        ? Math.min(objStart, arrStart)
        : Math.max(objStart, arrStart);
      if (start >= 0) {
        cleaned = cleaned.slice(start);
      }
    }

    return {
      content: cleaned,
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      model: this.model,
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
      },
    };
  }
}
