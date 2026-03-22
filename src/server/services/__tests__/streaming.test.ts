import { describe, it, expect } from 'vitest';
import { encodeSSE } from '@/server/ai/streaming';

describe('encodeSSE', () => {
  it('encodes a token event', () => {
    const result = encodeSSE({ type: 'token', text: 'hello' });
    expect(result).toBe('data: {"type":"token","text":"hello"}\n\n');
  });

  it('encodes a done event with metadata', () => {
    const meta = { confidence: 'verified', sources: [], highlights: [], caveats: [] };
    const result = encodeSSE({ type: 'done', metadata: meta });
    expect(result).toContain('"type":"done"');
    expect(result).toContain('"confidence":"verified"');
    expect(result).toMatch(/\n\n$/);
  });

  it('encodes an error event', () => {
    const result = encodeSSE({ type: 'error', message: 'timeout' });
    expect(result).toBe('data: {"type":"error","message":"timeout"}\n\n');
  });
});
