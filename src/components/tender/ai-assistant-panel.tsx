'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardContent,
} from '@/components/ui/glass-card';
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
const priorityConfig = {
  HIGH: { label: 'Υψηλή', bg: 'bg-red-500/15', text: 'text-red-700 dark:text-red-400', border: 'border-red-500/20', dot: 'bg-red-500' },
  MEDIUM: { label: 'Μέτρια', bg: 'bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-500' },
  LOW: { label: 'Χαμηλή', bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
};

const quickQuestions = [
  { text: 'Τι λείπει;', icon: HelpCircle },
  { text: 'Είμαστε έτοιμοι;', icon: CheckSquare },
  { text: 'Ποιες εργασίες καθυστερούν;', icon: Timer },
  { text: 'Πόσο compliance έχουμε;', icon: ShieldCheck },
];

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
        'bg-gradient-to-br from-blue-700 to-blue-500',
        'hover:from-blue-600 hover:to-blue-400',
        'text-white',
        'transition-all duration-300 ease-out',
        'hover:scale-105 hover:shadow-blue-500/30',
        'active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        'cursor-pointer',
        'group'
      )}
      aria-label="AI Βοηθός"
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
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [actions, setActions] = useState<SuggestedAction[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'actions' | 'reminders'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      setIsTyping(false);
    },
    onError: (err: any) => {
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: err?.message ?? 'Σφάλμα κατά την επεξεργασία. Δοκιμάστε ξανά.',
        timestamp: new Date(),
      };
      setLocalMessages((prev) => [...prev, errorMsg]);
      setIsTyping(false);
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
    setIsTyping(true);

    askMutation.mutate({ tenderId, question });
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
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600/20 to-cyan-500/20 ring-1 ring-blue-500/20">
                <Bot className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <span className="bg-gradient-to-r from-blue-700 to-cyan-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-cyan-300">
                  AI Βοηθός
                </span>
                <p className="text-[10px] text-muted-foreground font-normal">
                  Tender Copilot Assistant
                </p>
              </div>
            </SheetTitle>
            <SheetDescription className="sr-only">
              AI Βοηθός για τον διαγωνισμό
            </SheetDescription>
          </SheetHeader>

          {/* Tab Bar */}
          <div className="flex gap-1 mt-3 bg-muted/30 rounded-lg p-0.5">
            {[
              { key: 'chat' as const, label: 'Συνομιλία', icon: MessageCircle },
              { key: 'actions' as const, label: 'Ενέργειες', icon: Lightbulb },
              { key: 'reminders' as const, label: 'Υπενθυμίσεις', icon: Bell },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer',
                  activeTab === tab.key
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
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
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 mx-auto mb-3">
                        <Sparkles className="h-7 w-7 text-blue-500/50" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Ρωτήστε οτιδήποτε για τον διαγωνισμό
                      </p>
                      <p className="text-xs text-muted-foreground/60">
                        Χρησιμοποιήστε τα γρήγορα ερωτήματα ή γράψτε δικά σας
                      </p>
                    </div>
                  )}

                  {/* Messages */}
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
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
                            ? 'bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-br-md'
                            : 'bg-muted/50 border border-border/50 text-foreground rounded-bl-md'
                        )}
                      >
                        <div className="whitespace-pre-wrap">
                          {msg.role === 'assistant' && msg.metadata?.answer
                            ? msg.metadata.answer
                            : (() => {
                                // Fallback: try to extract answer from JSON content
                                if (msg.role === 'assistant' && msg.content.startsWith('{')) {
                                  try {
                                    const parsed = JSON.parse(msg.content);
                                    if (parsed.answer) return parsed.answer;
                                  } catch { /* show raw */ }
                                }
                                return msg.content;
                              })()
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
                            {msg.metadata.confidence === 'verified' && <><CheckCircle className="w-3 h-3" /> Verified</>}
                            {msg.metadata.confidence === 'inferred' && <><AlertTriangle className="w-3 h-3" /> Inferred</>}
                            {msg.metadata.confidence === 'general' && <><BookOpen className="w-3 h-3" /> General</>}
                          </span>
                        )}

                        {/* Expandable Sources */}
                        {msg.role === 'assistant' && msg.metadata?.sources && msg.metadata.sources.length > 0 && (
                          <details className="mt-1.5">
                            <summary className="text-[10px] text-muted-foreground/60 cursor-pointer hover:text-muted-foreground transition-colors">
                              Πηγές ({msg.metadata.sources.length})
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
                  ))}

                  {/* Typing indicator */}
                  {isTyping && (
                    <div className="flex gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600/20 to-cyan-500/20">
                        <Bot className="h-4 w-4 text-blue-500" />
                      </div>
                      <div className="rounded-2xl rounded-bl-md bg-muted/50 border border-border/50 px-4 py-3">
                        <div className="flex gap-1">
                          <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                          <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                          <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Quick Questions */}
              {messages.length < 3 && (
                <div className="px-4 py-2 border-t border-border/30">
                  <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">
                    Γρήγορα Ερωτήματα
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {quickQuestions.map((q) => (
                      <button
                        key={q.text}
                        onClick={() => handleSend(q.text)}
                        disabled={isTyping}
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
                      placeholder="Γράψτε μια ερώτηση..."
                      disabled={isTyping}
                      className={cn(
                        'w-full rounded-xl border px-4 py-2.5 text-xs',
                        'bg-white/60 dark:bg-white/[0.06]',
                        'border-white/40 dark:border-white/10',
                        'placeholder:text-muted-foreground/50',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30',
                        'transition-all duration-200',
                        'disabled:opacity-50'
                      )}
                    />
                  </div>
                  <Button
                    onClick={() => handleSend()}
                    disabled={!inputValue.trim() || isTyping}
                    size="icon"
                    className={cn(
                      'h-10 w-10 rounded-xl shrink-0 cursor-pointer',
                      'bg-gradient-to-br from-blue-700 to-blue-500',
                      'hover:from-blue-600 hover:to-blue-400',
                      'border-0 text-white shadow-lg shadow-blue-500/20',
                      'disabled:opacity-50 disabled:shadow-none'
                    )}
                  >
                    {isTyping ? (
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
                  Προτεινόμενες Ενέργειες
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
                    <Lightbulb className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      Δεν υπάρχουν εκκρεμείς ενέργειες
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
                  Υπενθυμίσεις & Προθεσμίες
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
                                Εκπρόθεσμο
                              </Badge>
                            )}
                            {isUrgent && !isOverdue && (
                              <Badge variant="outline" className="text-[9px] bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20">
                                {daysUntil} ημέρ{daysUntil === 1 ? 'α' : 'ες'}
                              </Badge>
                            )}
                            {!isUrgent && !isOverdue && (
                              <span className="text-[10px] text-muted-foreground/60">
                                σε {daysUntil} ημέρες
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
                    <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      Δεν υπάρχουν υπενθυμίσεις
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
