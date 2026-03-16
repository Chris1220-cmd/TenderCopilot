'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardContent,
  GlassCardFooter,
} from '@/components/ui/glass-card';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  Clock,
  Target,
  Award,
  Layers,
} from 'lucide-react';

// ─── Mock Data ────────────────────────────────────────────────
const mockBrief = {
  summary:
    'Ο διαγωνισμός αφορά την προμήθεια και εγκατάσταση εξοπλισμού πληροφορικής για τον Δήμο Αθηναίων. Περιλαμβάνει σταθμούς εργασίας, servers, δικτυακό εξοπλισμό και λογισμικό. Η αξιολόγηση γίνεται με κριτήριο τη βέλτιστη σχέση ποιότητας-τιμής, με βαρύτητα 60% τεχνική πρόταση και 40% οικονομική προσφορά. Απαιτούνται πιστοποιήσεις ISO 9001 και ISO 27001, καθώς και τουλάχιστον 3 συναφή έργα σε δημόσιο τομέα.',
  keyPoints: [
    { label: 'Τομέας', value: 'Πληροφορική & Τεχνολογία', icon: Layers },
    { label: 'Τύπος Ανάθεσης', value: 'Ποιότητα-Τιμή (60/40)', icon: Award },
    { label: 'Διάρκεια', value: '12 μήνες + 24 μ. εγγύηση', icon: Clock },
    { label: 'Βασικά Κριτήρια', value: 'ISO 9001, ISO 27001, 3 έργα', icon: Target },
  ],
  generatedAt: new Date().toISOString(),
};

interface AIBriefPanelProps {
  tenderId: string;
  className?: string;
}

export function AIBriefPanel({ tenderId, className }: AIBriefPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [brief, setBrief] = useState<typeof mockBrief | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Try tRPC mutation with mock fallback
  const summarizeMutation = trpc.aiRoles?.summarizeTender?.useMutation?.({
    onSuccess: (data: any) => {
      setBrief(data);
      setIsGenerating(false);
    },
    onError: () => {
      // Fallback to mock
      setBrief(mockBrief);
      setIsGenerating(false);
    },
  }) ?? null;

  const handleGenerate = () => {
    setIsGenerating(true);
    if (summarizeMutation) {
      summarizeMutation.mutate({ tenderId });
    } else {
      // Mock fallback
      setTimeout(() => {
        setBrief(mockBrief);
        setIsGenerating(false);
      }, 1500);
    }
  };

  const displayBrief = brief ?? null;
  const summaryText = displayBrief?.summary ?? '';
  const shouldTruncate = summaryText.length > 200;
  const displayText = expanded || !shouldTruncate ? summaryText : summaryText.slice(0, 200) + '...';

  return (
    <GlassCard className={cn('overflow-hidden', className)}>
      {/* Header Gradient Accent */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400" />

      <GlassCardHeader className="pt-2">
        <GlassCardTitle className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600/20 to-cyan-500/20 ring-1 ring-blue-500/20">
            <Sparkles className="h-4 w-4 text-blue-500" />
          </div>
          <span className="bg-gradient-to-r from-blue-700 to-cyan-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-cyan-300">
            AI Tender Brief
          </span>
        </GlassCardTitle>
      </GlassCardHeader>

      <GlassCardContent>
        {isGenerating ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-7 w-32 rounded-full" />
              <Skeleton className="h-7 w-28 rounded-full" />
              <Skeleton className="h-7 w-36 rounded-full" />
            </div>
          </div>
        ) : displayBrief ? (
          <div className="space-y-4">
            {/* Summary Text */}
            <div className="relative">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {displayText}
              </p>
              {shouldTruncate && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200 cursor-pointer"
                >
                  {expanded ? (
                    <>
                      Σύμπτυξη <ChevronUp className="h-3 w-3" />
                    </>
                  ) : (
                    <>
                      Περισσότερα <ChevronDown className="h-3 w-3" />
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Key Points Pills */}
            <div className="flex flex-wrap gap-2">
              {displayBrief.keyPoints.map((point, i) => (
                <div
                  key={i}
                  className={cn(
                    'group flex items-center gap-2 rounded-full px-3 py-1.5',
                    'bg-white/50 dark:bg-white/[0.06]',
                    'border border-white/40 dark:border-white/10',
                    'backdrop-blur-sm',
                    'transition-all duration-200',
                    'hover:bg-blue-50/50 dark:hover:bg-blue-500/10',
                    'hover:border-blue-300/40 dark:hover:border-blue-500/20'
                  )}
                >
                  <point.icon className="h-3.5 w-3.5 text-blue-500/70 group-hover:text-blue-500 transition-colors duration-200" />
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {point.label}:
                  </span>
                  <span className="text-[11px] font-semibold text-foreground">
                    {point.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Generated timestamp */}
            {displayBrief.generatedAt && (
              <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Δημιουργήθηκε: {new Date(displayBrief.generatedAt).toLocaleString('el-GR')}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 mb-3">
              <Sparkles className="h-6 w-6 text-blue-500/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Δεν έχει δημιουργηθεί brief
            </p>
            <p className="text-xs text-muted-foreground/70">
              Πατήστε το κουμπί για AI ανάλυση του διαγωνισμού
            </p>
          </div>
        )}
      </GlassCardContent>

      <GlassCardFooter className="justify-end">
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          className={cn(
            'cursor-pointer gap-2 h-9',
            'bg-gradient-to-r from-blue-700 to-blue-500',
            'hover:from-blue-600 hover:to-blue-400',
            'border-0 text-white shadow-lg shadow-blue-500/25',
            'transition-all duration-300'
          )}
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isGenerating ? 'Ανάλυση...' : displayBrief ? 'Ανανέωση Brief' : 'Δημιουργία AI Brief'}
        </Button>
      </GlassCardFooter>
    </GlassCard>
  );
}

export function AIBriefPanelSkeleton() {
  return (
    <GlassCard>
      <GlassCardHeader>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-5 w-36" />
        </div>
      </GlassCardHeader>
      <GlassCardContent>
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-3/6" />
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}
