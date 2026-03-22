import { db } from '@/lib/db';
import { ai } from '@/server/ai/provider';
import type { AIMessage } from '@/server/ai/types';

const SUMMARY_THRESHOLD = 10;
const RECENT_WINDOW = 6;

export function shouldSummarize(
  totalMessages: number,
  lastSummarizedAt: Date | null,
  newMessagesSinceSummary?: number,
): boolean {
  if (totalMessages < SUMMARY_THRESHOLD) return false;
  if (!lastSummarizedAt) return true;
  const newMsgs = newMessagesSinceSummary ?? totalMessages;
  return newMsgs >= SUMMARY_THRESHOLD;
}

export function buildSummaryPrompt(
  previousSummary: string | null,
  messages: Array<{ role: string; content: string }>,
): string {
  let prompt = 'Summarize this conversation in a concise paragraph (max 200 words).\n';
  prompt += 'Keep: key facts (budget, deadlines, requirements), decisions made, open questions.\n';
  prompt += 'Respond in the same language as the conversation.\n\n';

  if (previousSummary) {
    prompt += `PREVIOUS SUMMARY:\n${previousSummary}\n\n`;
    prompt += 'NEW MESSAGES SINCE LAST SUMMARY:\n';
  } else {
    prompt += 'CONVERSATION:\n';
  }

  for (const msg of messages) {
    prompt += `${msg.role.toUpperCase()}: ${msg.content}\n`;
  }

  return prompt;
}

export async function getSmartHistory(
  tenderId: string,
  tenantId: string,
): Promise<{ summary: string | null; recentMessages: AIMessage[] }> {
  const session = await db.chatSession.findUnique({
    where: { tenderId_tenantId: { tenderId, tenantId } },
  });

  const recent = await db.chatMessage.findMany({
    where: { tenderId, tenantId },
    orderBy: { createdAt: 'desc' },
    take: RECENT_WINDOW,
  });

  let historyMessages = recent
    .reverse()
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.role === 'assistant' && m.metadata
        ? (m.metadata as any).answer || m.content
        : m.content,
    }));

  // Gemini requires first message to be 'user'
  while (historyMessages.length > 0 && historyMessages[0].role === 'assistant') {
    historyMessages.shift();
  }

  return {
    summary: session?.summary || null,
    recentMessages: historyMessages,
  };
}

export async function maybeUpdateSummary(
  tenderId: string,
  tenantId: string,
): Promise<void> {
  const totalMessages = await db.chatMessage.count({
    where: { tenderId, tenantId },
  });

  const session = await db.chatSession.findUnique({
    where: { tenderId_tenantId: { tenderId, tenantId } },
  });

  let newMsgsSinceSummary = totalMessages;
  if (session?.lastSummarizedAt) {
    newMsgsSinceSummary = await db.chatMessage.count({
      where: {
        tenderId,
        tenantId,
        createdAt: { gt: session.lastSummarizedAt },
      },
    });
  }

  if (!shouldSummarize(totalMessages, session?.lastSummarizedAt || null, newMsgsSinceSummary)) {
    return;
  }

  const allMessages = await db.chatMessage.findMany({
    where: { tenderId, tenantId },
    orderBy: { createdAt: 'asc' },
    select: { role: true, content: true, metadata: true },
  });

  const toSummarize = allMessages.slice(0, -RECENT_WINDOW);
  if (toSummarize.length === 0) return;

  const msgs = toSummarize.map((m) => ({
    role: m.role,
    content: m.role === 'assistant' && m.metadata
      ? (m.metadata as any).answer || m.content
      : m.content,
  }));

  const summaryPrompt = buildSummaryPrompt(session?.summary || null, msgs);

  const result = await ai().complete({
    messages: [
      { role: 'system', content: 'You are a conversation summarizer. Be concise and factual.' },
      { role: 'user', content: summaryPrompt },
    ],
    maxTokens: 400,
    temperature: 0.2,
  });

  await db.chatSession.upsert({
    where: { tenderId_tenantId: { tenderId, tenantId } },
    create: {
      tenderId,
      tenantId,
      summary: result.content,
      lastSummarizedAt: new Date(),
    },
    update: {
      summary: result.content,
      lastSummarizedAt: new Date(),
    },
  });
}
