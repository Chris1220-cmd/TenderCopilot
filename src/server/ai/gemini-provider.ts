import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIProvider, AICompletionOptions, AICompletionResult } from './types';

/**
 * Gemini AI Provider — Uses Google's Gemini API.
 * Supports gemini-2.0-flash for fast, cost-effective operations.
 */
export class GeminiProvider implements AIProvider {
  name = 'gemini';
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(config: { apiKey: string; model?: string }) {
    this.client = new GoogleGenerativeAI(config.apiKey);
    this.model = config.model || 'gemini-2.0-flash';
  }

  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    const systemMessage = options.messages.find((m) => m.role === 'system');
    const nonSystemMessages = options.messages.filter((m) => m.role !== 'system');

    const generativeModel = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: systemMessage?.content || undefined,
      generationConfig: {
        maxOutputTokens: options.maxTokens || 4096,
        temperature: options.temperature,
      },
    });

    // Build Gemini chat history from messages (all except the last user message)
    const history = nonSystemMessages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: m.content }],
    }));

    const lastMessage = nonSystemMessages[nonSystemMessages.length - 1];
    if (!lastMessage) {
      throw new Error('At least one user message is required');
    }

    const chat = generativeModel.startChat({ history });
    const result = await chat.sendMessage(lastMessage.content);
    const response = result.response;

    const rawText = response.text() || '';
    const usageMetadata = response.usageMetadata;

    // Strip markdown code fences if present (same logic as Claude provider)
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

    const inputTokens = usageMetadata?.promptTokenCount || 0;
    const outputTokens = usageMetadata?.candidatesTokenCount || 0;

    return {
      content: cleaned,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      model: this.model,
      usage: {
        inputTokens,
        outputTokens,
      },
    };
  }
}
