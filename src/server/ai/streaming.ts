export type SSEEvent =
  | { type: 'token'; text: string }
  | { type: 'done'; metadata: Record<string, unknown> }
  | { type: 'error'; message: string };

export function encodeSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

const encoder = new TextEncoder();

export function encodeSSEBytes(event: SSEEvent): Uint8Array {
  return encoder.encode(encodeSSE(event));
}
