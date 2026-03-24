'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { BlurFade } from '@/components/ui/blur-fade';
import { motion } from 'motion/react';
import Image from 'next/image';
import { EmptyStateIllustration } from '@/components/ui/empty-state';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  MessageCircle,
  Send,
  Sparkles,
  Loader2,
  X,
  AlertCircle,
  Clock,
  ArrowRight,
  Bot,
  User,
  Lightbulb,
  Bell,
  ChevronRight,
  HelpCircle,
  CheckSquare,
  ShieldCheck,
  Timer,
  CheckCircle,
  AlertTriangle,
  BookOpen,
  FileText,
  Scale,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    answer?: string;
    confidence?: 'verified' | 'inferred' | 'general';
    sources?: Array<{
      type: 'document' | 'law' | 'knowledge_base';
      reference: string;
      quote?: string;
    }>;
    highlights?: Array<{
      label: string;
      value: string;
      status: 'ok' | 'warning' | 'critical';
    }>;
    caveats?: string[];
  };
}

interface SuggestedAction {
  id: string;
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
}

interface Reminder {
  id: string;
  title: string;
  dueDate: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  completed: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────

/** Extract the answer text from a message, handling raw JSON content */
function getAnswerText(msg: ChatMessage): string {
  // 1. Prefer metadata.answer
  if (msg.role === 'assistant' && msg.metadata?.answer) {
    return String(msg.metadata.answer);
  }
  // 2. Try to parse JSON from content
  if (msg.role === 'assistant' && msg.content) {
    const trimmed = msg.content.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.answer) return String(parsed.answer);
      } catch { /* not JSON */ }
    }
  }
  return msg.content;
}

/** Render markdown-like text as React elements (bold, lists, line breaks) */
function renderMarkdown(text: string) {
  // Split by lines
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Bold: **text** → <strong>text</strong>
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, j) => {
      const boldMatch = part.match(/^\*\*(.+)\*\*$/);
      if (boldMatch) {
        return <strong key={j}>{boldMatch[1]}</strong>;
      }
      return part;
    });

    // Bullet list item: starts with * or - or number.
    const isBullet = /^\s*[*\-]\s+/.test(line);
    const isNumbered = /^\s*\d+\.\s+/.test(line);

    if (isBullet || isNumbered) {
      const content = line.replace(/^\s*[*\-]\s+/, '').replace(/^\s*\d+\.\s+/, '');
      const contentParts = content.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
        const bm = part.match(/^\*\*(.+)\*\*$/);
        return bm ? <strong key={j}>{bm[1]}</strong> : part;
      });
      elements.push(
        <div key={i} className="flex gap-1.5 ml-2">
          <span className="text-muted-foreground/50 shrink-0">{isNumbered ? line.match(/^\s*(\d+\.)/)?.[1] : '\u2022'}</span>
          <span>{contentParts}</span>
        </div>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-1.5" />);
    } else {
      elements.push(<div key={i}>{rendered}</div>);
    }
  }

  return <>{elements}</>;
}

const priorityConfig = {
  HIGH: { label: 'Υψηλή', bg: 'bg-red-500/15', text: 'text-red-700 dark:text-red-400', border: 'border-red-500/20', dot: 'bg-red-500' },
  MEDIUM: { label: 'Μέτρια', bg: 'bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-500' },
  LOW: { label: 'Χαμηλή', bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
};

// ─── Stream Chat Helper ─────────────────────────────────────
async function streamChat(
  tenderId: string,
  question: string,
  locale: string,
  onToken: (text: string) => void,
  onDone: (metadata: any) => void,
  onError: (error: string) => void,
) {
  const res = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenderId, question, locale }),
  });

  if (!res.ok) {
    const text = await res.text();
    onError(text || `Error ${res.status}`);
    return;
  }

  if (!res.body) { onError('Streaming not supported'); return; }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const event = JSON.parse(line.slice(6));
        if (event.type === 'token') onToken(event.text);
        else if (event.type === 'done') onDone(event.metadata);
        else if (event.type === 'error') onError(event.message);
      } catch { /* skip malformed */ }
    }
  }
}

// quickQuestions moved inside component for i18n

// ─── Floating Button ──────────────────────────────────────────
interface AIAssistantButtonProps {
  onClick: () => void;
}

export function AIAssistantButton({ onClick }: AIAssistantButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed bottom-6 right-6 z-50',
        'flex h-14 w-14 items-center justify-center',
        'rounded-2xl shadow-2xl',
        'bg-primary hover:bg-primary/90',
        'text-primary-foreground',
        'transition-all duration-300 ease-out',
        'hover:scale-105',
        'active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        'cursor-pointer',
        'group'
      )}
      aria-label="AI Assistant"
    >
      <Sparkles className="h-6 w-6 group-hover:scale-110 transition-transform duration-200" />

      {/* Pulse Animation */}
      <span className="absolute inset-0 rounded-2xl bg-blue-400/30 animate-ping opacity-30" />

      {/* Badge */}
      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-lg">
        AI
      </span>
    </button>
  );
}

// ─── Assistant Panel ──────────────────────────────────────────
interface AIAssistantPanelProps {
  tenderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIAssistantPanel({ tenderId, open, onOpenChange }: AIAssistantPanelProps) {
  const t = useTranslations('chat');
  const locale = useLocale();
  const quickQuestions = [
    { text: t('quick_q_missing'), icon: HelpCircle },
    { text: t('quick_q_ready'), icon: CheckSquare },
    { text: t('quick_q_delayed'), icon: Timer },
    { text: t('quick_q_compliance'), icon: ShieldCheck },
  ];
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const rawStreamRef = useRef('');
  const [actions, setActions] = useState<SuggestedAction[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'actions' | 'reminders'>('chat');
  const [ratedMessages, setRatedMessages] = useState<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Chat feedback mutation (thumbs up/down)
  const rateMutation = trpc.learning.rateChatMessage.useMutation({
    onSuccess: (_data, variables) => {
      setRatedMessages((prev) => ({ ...prev, [variables.messageId]: variables.rating }));
    },
  });

  // Load persistent chat history
  const historyQuery = trpc.chat.getHistory.useQuery(
    { tenderId },
    { enabled: !!tenderId && open }
  );

  // Merge DB history with optimistic local messages
  const dbMessages: ChatMessage[] = (historyQuery.data || []).map((m: any) => {
    let metadata = m.metadata || undefined;
    // Fallback: if no metadata but content is JSON, extract metadata from content
    if (!metadata && m.role === 'assistant' && m.content?.startsWith('{')) {
      try {
        const parsed = JSON.parse(m.content);
        if (parsed.answer) {
          metadata = parsed;
        }
      } catch { /* not JSON, ignore */ }
    }
    return {
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: new Date(m.createdAt),
      metadata,
    };
  });

  const askMutation = trpc.chat.askSmart.useMutation({
    onSuccess: () => {
      // Refetch history to get the persisted messages
      historyQuery.refetch();
      setLocalMessages([]);
      setIsStreaming(false);
    },
    onError: (err: any) => {
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: err?.message ?? t('error_generic'),
        timestamp: new Date(),
      };
      setLocalMessages((prev) => [...prev, errorMsg]);
      setIsStreaming(false);
    },
  });

  // Combined messages: DB history + optimistic local
  const messages = [...dbMessages, ...localMessages];

  // suggestNextActions and getReminders are queries - use with enabled:false for manual trigger
  const nextActionsQuery = trpc.aiRoles.suggestNextActions.useQuery(
    { tenderId },
    { enabled: false, retry: false }
  );

  const remindersQuery = trpc.aiRoles.getReminders.useQuery(
    { tenderId },
    { enabled: false, retry: false }
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  const handleSend = (text?: string) => {
    const question = text ?? inputValue.trim();
    if (!question) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: question,
      timestamp: new Date(),
    };
    setLocalMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsStreaming(true);
    setStreamingText('');
    rawStreamRef.current = '';

    streamChat(
      tenderId,
      question,
      locale,
      // onToken — accumulate raw JSON and extract answer field for display
      (token) => {
        rawStreamRef.current += token;
        const raw = rawStreamRef.current;
        // Try to extract the "answer" field value from partial JSON
        const answerMatch = raw.match(/"answer"\s*:\s*"([\s\S]*?)(?:"\s*[,}]|$)/);
        if (answerMatch) {
          const extracted = answerMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          setStreamingText(extracted);
        }
      },
      // onDone
      (metadata) => {
        setIsStreaming(false);
        setStreamingText('');
        setLocalMessages([]);
        historyQuery.refetch();
      },
      // onError
      (error) => {
        setIsStreaming(false);
        setStreamingText('');
        const errorMsg: ChatMessage = {
          id: `msg-${Date.now()}-error`,
          role: 'assistant',
          content: error || t('error_generic'),
          timestamp: new Date(),
        };
        setLocalMessages((prev) => [...prev, errorMsg]);
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'sm:max-w-md w-full p-0 flex flex-col',
          'bg-white/80 dark:bg-gray-950/90',
          'backdrop-blur-2xl'
        )}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-border/50">
          <SheetHeader className="space-y-1">
            <SheetTitle className="flex items-center gap-2.5">
              <Image src="/images/tec-mascot.png" alt="TEC" width={36} height={36} className="rounded-xl" />
              <div>
                <span className="text-foreground font-semibold">
                  {t('title')}
                </span>
                <p className="text-[10px] text-muted-foreground font-normal">
                  {t('subtitle')}
                </p>
              </div>
            </SheetTitle>
            <SheetDescription className="sr-only">
              {t('title')}
            </SheetDescription>
          </SheetHeader>

          {/* Tab Bar */}
          <div className="flex gap-1 mt-3 bg-muted/30 rounded-lg p-0.5">
            {[
              { key: 'chat' as const, label: t('tab_chat'), icon: MessageCircle },
              { key: 'actions' as const, label: t('tab_actions'), icon: Lightbulb },
              { key: 'reminders' as const, label: t('tab_reminders'), icon: Bell },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'relative flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer',
                  activeTab === tab.key
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {activeTab === tab.key && (
                  <motion.div
                    layoutId="ai-chat-tab-indicator"
                    className="absolute inset-0 rounded-md bg-background shadow-sm"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    style={{ zIndex: 0 }}
                  />
                )}
                <span className="relative z-10 flex items-center justify-center gap-1.5">
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <>
              <ScrollArea className="flex-1 px-4 py-4">
                <div className="space-y-4">
                  {/* Welcome message */}
                  {messages.length === 0 && (
                    <div className="text-center py-6">
                      <EmptyStateIllustration variant="general" className="mb-3" />
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        {t('welcome')}
                      </p>
                      <p className="text-xs text-muted-foreground/60">
                        {t('welcome_sub')}
                      </p>
                    </div>
                  )}

                  {/* Messages */}
                  {(() => {
                    const recentIds = new Set(messages.slice(-3).map(m => m.id));
                    return messages.map((msg) => {
                      const messageContent = (
                    <div
                      className={cn(
                        'flex gap-2.5',
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      {msg.role === 'assistant' && (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600/20 to-cyan-500/20 mt-0.5">
                          <Bot className="h-4 w-4 text-blue-500" />
                        </div>
                      )}
                      <div
                        className={cn(
                          'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed',
                          msg.role === 'user'
                            ? 'bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-br-md shadow-lg shadow-blue-500/10'
                            : 'bg-white/50 dark:bg-white/[0.04] backdrop-blur-sm border border-white/20 dark:border-white/10 text-foreground rounded-bl-md'
                        )}
                      >
                        <div className="whitespace-pre-wrap">
                          {msg.role === 'assistant'
                            ? renderMarkdown(getAnswerText(msg))
                            : msg.content
                          }
                        </div>

                        {/* Confidence Badge */}
                        {msg.role === 'assistant' && msg.metadata?.confidence && (
                          <span className={cn(
                            "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-1.5",
                            msg.metadata.confidence === 'verified' && "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300",
                            msg.metadata.confidence === 'inferred' && "bg-amber-500/20 text-amber-600 dark:text-amber-300",
                            msg.metadata.confidence === 'general' && "bg-blue-500/20 text-blue-600 dark:text-blue-300",
                          )}>
                            {msg.metadata.confidence === 'verified' && <><CheckCircle className="w-3 h-3" /> {t('confidence_verified')}</>}
                            {msg.metadata.confidence === 'inferred' && <><AlertTriangle className="w-3 h-3" /> {t('confidence_inferred')}</>}
                            {msg.metadata.confidence === 'general' && <><BookOpen className="w-3 h-3" /> {t('confidence_general')}</>}
                          </span>
                        )}

                        {/* Expandable Sources */}
                        {msg.role === 'assistant' && msg.metadata?.sources && msg.metadata.sources.length > 0 && (
                          <details className="mt-1.5">
                            <summary className="text-[10px] text-muted-foreground/60 cursor-pointer hover:text-muted-foreground transition-colors">
                              {t('sources_label')} ({msg.metadata.sources.length})
                            </summary>
                            <div className="mt-1 space-y-1">
                              {msg.metadata.sources.map((source: any, i: number) => (
                                <div key={i} className="text-[10px] text-muted-foreground/50 pl-2 border-l border-border/30 flex items-start gap-1">
                                  {source.type === 'document' && <FileText className="w-3 h-3 mt-0.5 shrink-0" />}
                                  {source.type === 'law' && <Scale className="w-3 h-3 mt-0.5 shrink-0" />}
                                  {source.type === 'knowledge_base' && <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" />}
                                  <div>
                                    {source.reference}
                                    {source.quote && (
                                      <p className="italic mt-0.5 text-muted-foreground/40">&ldquo;{source.quote}&rdquo;</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}

                        {/* Caveats */}
                        {msg.role === 'assistant' && msg.metadata?.caveats && msg.metadata.caveats.length > 0 && (
                          <div className="mt-1.5 space-y-0.5">
                            {msg.metadata.caveats.map((c: string, i: number) => (
                              <p key={i} className="text-[10px] text-amber-600/60 dark:text-amber-300/60 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 shrink-0" /> {c}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Feedback buttons */}
                        {msg.role === 'assistant' && msg.metadata && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <button
                              onClick={() => rateMutation.mutate({ messageId: msg.id, rating: 5 })}
                              disabled={!!ratedMessages[msg.id]}
                              className={cn(
                                'text-[10px] p-0.5 transition-colors cursor-pointer',
                                ratedMessages[msg.id] === 5
                                  ? 'text-emerald-500'
                                  : 'text-muted-foreground/40 hover:text-emerald-500',
                                ratedMessages[msg.id] && ratedMessages[msg.id] !== 5 && 'opacity-30'
                              )}
                              title="Χρήσιμο"
                            >
                              <ThumbsUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => rateMutation.mutate({ messageId: msg.id, rating: 1 })}
                              disabled={!!ratedMessages[msg.id]}
                              className={cn(
                                'text-[10px] p-0.5 transition-colors cursor-pointer',
                                ratedMessages[msg.id] === 1
                                  ? 'text-red-500'
                                  : 'text-muted-foreground/40 hover:text-red-500',
                                ratedMessages[msg.id] && ratedMessages[msg.id] !== 1 && 'opacity-30'
                              )}
                              title="Μη χρήσιμο"
                            >
                              <ThumbsDown className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        <p className={cn(
                          'text-[9px] mt-1.5 tabular-nums',
                          msg.role === 'user' ? 'text-blue-200' : 'text-muted-foreground/50'
                        )}>
                          {msg.timestamp.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {msg.role === 'user' && (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/50 mt-0.5">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                      );
                      return recentIds.has(msg.id)
                        ? <BlurFade key={msg.id} delay={0.03}>{messageContent}</BlurFade>
                        : <div key={msg.id}>{messageContent}</div>;
                    });
                  })()}

                  {/* Streaming message */}
                  {isStreaming && streamingText && (
                    <div className="flex gap-2.5 justify-start">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600/20 to-cyan-500/20 mt-0.5">
                        <Bot className="h-4 w-4 text-blue-500" />
                      </div>
                      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white/50 dark:bg-white/[0.04] backdrop-blur-sm border border-white/20 dark:border-white/10 text-foreground px-3.5 py-2.5 text-xs leading-relaxed">
                        <div className="whitespace-pre-wrap">
                          {renderMarkdown(streamingText)}
                          <span className="inline-block w-1.5 h-4 bg-blue-500/70 animate-pulse ml-0.5 rounded-sm align-middle" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Typing indicator */}
                  {isStreaming && !streamingText && (
                    <div className="flex gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600/20 to-cyan-500/20">
                        <Bot className="h-4 w-4 text-blue-500" />
                      </div>
                      <div className="rounded-2xl rounded-bl-md bg-white/50 dark:bg-white/[0.04] backdrop-blur-sm border border-white/20 dark:border-white/10 px-4 py-3">
                        <div
                          className="h-4 w-24 rounded-full animate-bg-shimmer"
                          style={{
                            backgroundSize: '200% 100%',
                            backgroundImage: 'linear-gradient(90deg, hsl(var(--muted-foreground) / 0.1), hsl(var(--muted-foreground) / 0.3), hsl(var(--muted-foreground) / 0.1))',
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Quick Questions */}
              {messages.length < 3 && (
                <BlurFade delay={0.1} inView>
                  <div className="px-4 py-2 border-t border-border/30">
                    <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">
                      {t('quick_questions_label')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {quickQuestions.map((q) => (
                        <button
                          key={q.text}
                          onClick={() => handleSend(q.text)}
                          disabled={isStreaming}
                          className={cn(
                            'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium',
                            'bg-white/50 dark:bg-white/[0.06]',
                            'border border-white/40 dark:border-white/10',
                            'backdrop-blur-sm',
                            'transition-all duration-200',
                            'hover:bg-blue-50/50 dark:hover:bg-blue-500/10',
                            'hover:border-blue-300/40 dark:hover:border-blue-500/20',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                            'cursor-pointer'
                          )}
                        >
                          <q.icon className="h-3 w-3 text-blue-500/70" />
                          {q.text}
                        </button>
                      ))}
                    </div>
                  </div>
                </BlurFade>
              )}

              {/* Input */}
              <div className="px-4 py-3 border-t border-border/50 bg-background/50">
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t('placeholder')}
                      disabled={isStreaming}
                      className={cn(
                        'w-full rounded-xl border px-4 py-2.5 text-xs',
                        'bg-white/60 dark:bg-white/[0.06]',
                        'border-white/40 dark:border-white/10',
                        'placeholder:text-muted-foreground/50',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 focus:shadow-[0_0_20px_rgba(59,130,246,0.1)]',
                        'transition-all duration-200',
                        'disabled:opacity-50'
                      )}
                    />
                  </div>
                  <Button
                    onClick={() => handleSend()}
                    disabled={!inputValue.trim() || isStreaming}
                    size="icon"
                    className={cn(
                      'h-10 w-10 rounded-xl shrink-0 cursor-pointer',
                      'bg-gradient-to-br from-blue-700 to-blue-500',
                      'hover:from-blue-600 hover:to-blue-400',
                      'border-0 text-white shadow-lg shadow-blue-500/20',
                      'disabled:opacity-50 disabled:shadow-none',
                      'active:scale-95 transition-transform'
                    )}
                  >
                    {isStreaming ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Actions Tab */}
          {activeTab === 'actions' && (
            <ScrollArea className="flex-1 px-4 py-4">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('actions_title')}
                </p>
                {actions.map((action) => {
                  const pCfg = priorityConfig[action.priority];
                  return (
                    <div
                      key={action.id}
                      className={cn(
                        'rounded-xl border p-3.5',
                        'bg-white/40 dark:bg-white/[0.03]',
                        'border-white/30 dark:border-white/10',
                        'transition-all duration-200',
                        'hover:border-blue-300/30 dark:hover:border-blue-500/15',
                        'cursor-pointer group'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span className={cn('mt-1 h-2.5 w-2.5 rounded-full shrink-0', pCfg.dot)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-foreground">
                              {action.title}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn('text-[9px]', pCfg.bg, pCfg.text, pCfg.border)}
                            >
                              {pCfg.label}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            {action.description}
                          </p>
                          <div className="flex items-center gap-1 mt-1.5">
                            <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                              {action.category}
                            </Badge>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors duration-150 shrink-0 mt-0.5" />
                      </div>
                    </div>
                  );
                })}

                {actions.length === 0 && (
                  <div className="text-center py-8">
                    <EmptyStateIllustration variant="actions" className="mb-2" />
                    <p className="text-xs text-muted-foreground">
                      {t('no_actions')}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {/* Reminders Tab */}
          {activeTab === 'reminders' && (
            <ScrollArea className="flex-1 px-4 py-4">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('reminders_title')}
                </p>
                {reminders.map((reminder) => {
                  const pCfg = priorityConfig[reminder.priority];
                  const dueDate = new Date(reminder.dueDate);
                  const now = new Date();
                  const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  const isUrgent = daysUntil <= 3;
                  const isOverdue = daysUntil < 0;

                  return (
                    <div
                      key={reminder.id}
                      className={cn(
                        'rounded-xl border p-3.5',
                        'bg-white/40 dark:bg-white/[0.03]',
                        'border-white/30 dark:border-white/10',
                        'transition-all duration-200',
                        isOverdue && 'border-red-300/30 dark:border-red-500/20 bg-red-50/20 dark:bg-red-500/5',
                        isUrgent && !isOverdue && 'border-amber-300/30 dark:border-amber-500/20'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'mt-0.5 flex h-6 w-6 items-center justify-center rounded-lg shrink-0',
                          isOverdue ? 'bg-red-500/10' :
                          isUrgent ? 'bg-amber-500/10' :
                          'bg-blue-500/10'
                        )}>
                          <Clock className={cn(
                            'h-3.5 w-3.5',
                            isOverdue ? 'text-red-500' :
                            isUrgent ? 'text-amber-500' :
                            'text-blue-500'
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={cn(
                            'text-xs font-semibold',
                            reminder.completed ? 'text-muted-foreground line-through' : 'text-foreground'
                          )}>
                            {reminder.title}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn(
                              'text-[10px] font-medium tabular-nums',
                              isOverdue ? 'text-red-600 dark:text-red-400' :
                              isUrgent ? 'text-amber-600 dark:text-amber-400' :
                              'text-muted-foreground'
                            )}>
                              {dueDate.toLocaleDateString('el-GR')}
                            </span>
                            {isOverdue && (
                              <Badge variant="outline" className="text-[9px] bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20">
                                {t('overdue')}
                              </Badge>
                            )}
                            {isUrgent && !isOverdue && (
                              <Badge variant="outline" className="text-[9px] bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20">
                                {daysUntil} ημέρ{daysUntil === 1 ? 'α' : 'ες'}
                              </Badge>
                            )}
                            {!isUrgent && !isOverdue && (
                              <span className="text-[10px] text-muted-foreground/60">
                                {t('in_days', { count: daysUntil })}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn('text-[9px] shrink-0', pCfg.bg, pCfg.text, pCfg.border)}
                        >
                          {pCfg.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}

                {reminders.length === 0 && (
                  <div className="text-center py-8">
                    <EmptyStateIllustration variant="reminders" className="mb-2" />
                    <p className="text-xs text-muted-foreground">
                      {t('no_reminders')}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
