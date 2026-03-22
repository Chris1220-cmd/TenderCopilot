import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIProvider, AICompletionOptions, AICompletionResult, AIStreamResult } from './types';

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

    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: options.maxTokens || 8192,
      temperature: options.temperature,
    };

    // Enforce JSON output when requested — critical for structured extraction
    if (options.responseFormat === 'json') {
      generationConfig.responseMimeType = 'application/json';
    }

    const generativeModel = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: systemMessage?.content || undefined,
      generationConfig,
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
    let result;
    try {
      result = await chat.sendMessage(lastMessage.content);
    } catch (err: any) {
      // Gemini API errors (rate limit, safety, etc.) — throw with details
      const msg = err?.message || String(err);
      console.error('[Gemini] API error:', msg);
      throw new Error(`Gemini API error: ${msg.slice(0, 200)}`);
    }
    const response = result.response;

    // Check for blocked/empty responses
    const candidates = response.candidates || [];
    if (candidates.length === 0 || candidates[0]?.finishReason === 'SAFETY') {
      throw new Error('Gemini blocked the response (safety filter). Try again or rephrase.');
    }

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

  async completeStream(options: AICompletionOptions): Promise<AIStreamResult> {
    const systemMessage = options.messages.find((m) => m.role === 'system');
    const nonSystemMessages = options.messages.filter((m) => m.role !== 'system');

    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: options.maxTokens || 8192,
      temperature: options.temperature,
    };

    if (options.responseFormat === 'json') {
      generationConfig.responseMimeType = 'application/json';
    }

    const generativeModel = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: systemMessage?.content || undefined,
      generationConfig,
    });

    const history = nonSystemMessages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: m.content }],
    }));

    const lastMessage = nonSystemMessages[nonSystemMessages.length - 1];
    if (!lastMessage) throw new Error('At least one user message is required');

    const chat = generativeModel.startChat({ history });
    const streamResult = await chat.sendMessageStream(lastMessage.content);

    const modelName = this.model;
    let fullText = '';
    const encoder = new TextEncoder();
    let resultResolve: (value: AICompletionResult) => void;
    const resultPromise = new Promise<AICompletionResult>((resolve) => {
      resultResolve = resolve;
    });

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of streamResult.stream) {
            const text = chunk.text();
            if (text) {
              fullText += text;
              controller.enqueue(encoder.encode(text));
            }
          }

          const response = await streamResult.response;
          const usage = response.usageMetadata;
          const inputTokens = usage?.promptTokenCount || 0;
          const outputTokens = usage?.candidatesTokenCount || 0;

          resultResolve!({
            content: fullText,
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            model: modelName,
            usage: { inputTokens, outputTokens },
          });

          controller.close();
        } catch (err: any) {
          controller.error(err);
          resultResolve!({
            content: fullText,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            model: modelName,
            usage: { inputTokens: 0, outputTokens: 0 },
          });
        }
      },
    });

    return {
      stream: readable,
      getResult: () => resultPromise,
    };
  }
}
