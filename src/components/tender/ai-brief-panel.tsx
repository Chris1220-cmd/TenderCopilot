'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { NoDocumentsAlert } from './no-documents-alert';
import { LanguageModal, type AnalysisLanguage } from './language-modal';
import { BlurFade } from '@/components/ui/blur-fade';
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

// ─── Types ────────────────────────────────────────────────────
interface AIBrief {
  summary: string;
  keyPoints: Array<{ label: string; value: string; icon: any }>;
  generatedAt: string;
}

interface AIBriefPanelProps {
  tenderId: string;
  sourceUrl?: string | null;
  platform?: string;
  className?: string;
}

function transformBriefFromDB(data: any): AIBrief | null {
  if (!data) return null;
  const keyPoints: AIBrief['keyPoints'] = [];
  if (data.sector) keyPoints.push({ label: 'Τομέας', value: data.sector, icon: Layers });
  if (data.awardType) keyPoints.push({ label: 'Τύπος Ανάθεσης', value: data.awardType, icon: Award });
  if (data.duration) keyPoints.push({ label: 'Διάρκεια', value: data.duration, icon: Clock });
  if (Array.isArray(data.keyPoints)) {
    for (const kp of data.keyPoints) {
      if (typeof kp === 'object' && kp.label && kp.value) {
        keyPoints.push({ label: kp.label, value: kp.value, icon: Target });
      }
    }
  }
  return {
    summary: data.summaryText || data.summary || '',
    keyPoints,
    generatedAt: data.createdAt || new Date().toISOString(),
  };
}

export function AIBriefPanel({ tenderId, sourceUrl, platform, className }: AIBriefPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [brief, setBrief] = useState<AIBrief | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noDocs, setNoDocs] = useState(false);
  const [langModalOpen, setLangModalOpen] = useState(false);

  // Load existing brief from DB on mount
  const briefQuery = trpc.aiRoles.getBrief.useQuery(
    { tenderId },
    { retry: false, refetchOnWindowFocus: false }
  );
  useEffect(() => {
    if (briefQuery.data) {
      const existing = transformBriefFromDB(briefQuery.data);
      if (existing) setBrief(existing);
    }
  }, [briefQuery.data]);

  // tRPC mutation
  const summarizeMutation = trpc.aiRoles.summarizeTender.useMutation({
    onSuccess: (data: any) => {
      const transformed = transformBriefFromDB(data);
      if (transformed) setBrief(transformed);
      setError(null);
      setIsGenerating(false);
    },
    onError: (err: any) => {
      if ((err as any).data?.code === 'PRECONDITION_FAILED') {
        setNoDocs(true);
        setIsGenerating(false);
        return;
      }
      setError(err?.message ?? 'Αποτυχία δημιουργίας brief. Δοκιμάστε ξανά.');
      setIsGenerating(false);
    },
  });

  const handleGenerate = () => {
    setLangModalOpen(true);
  };

  const handleAnalyze = (lang: AnalysisLanguage) => {
    setLangModalOpen(false);
    setIsGenerating(true);
    setError(null);
    setNoDocs(false);
    summarizeMutation.mutate({ tenderId, language: lang });
  };

  const displayBrief = brief ?? null;
  const summaryText = displayBrief?.summary ?? '';
  const shouldTruncate = summaryText.length > 200;
  const displayText = expanded || !shouldTruncate ? summaryText : summaryText.slice(0, 200) + '...';

  return (
    <BlurFade delay={0.1} inView>
    <GlassCard className={cn('overflow-hidden', className)}>
      {/* Header Gradient Accent */}
      <div className="absolute inset-x-0 top-0 h-1 bg-primary" />

      <GlassCardHeader className="pt-2">
        <GlassCardTitle className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <span className="text-foreground font-semibold">
            AI Tender Brief
          </span>
        </GlassCardTitle>
      </GlassCardHeader>

      <GlassCardContent>
        {noDocs && (
          <NoDocumentsAlert
            tenderId={tenderId}
            sourceUrl={sourceUrl}
            platform={platform}
          />
        )}
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
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 mb-3">
              <Sparkles className="h-6 w-6 text-red-500/50" />
            </div>
            <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">
              Σφάλμα
            </p>
            <p className="text-xs text-muted-foreground/70">
              {error}
            </p>
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
              {(Array.isArray(displayBrief.keyPoints) ? displayBrief.keyPoints : []).map((point, i) => (
                <div
                  key={i}
                  className={cn(
                    'group flex items-center gap-2 rounded-full px-3 py-1.5',
                    'bg-white/50 dark:bg-white/[0.06]',
                    'border border-white/40 dark:border-white/10',
                    'backdrop-blur-sm',
                    'transition-all duration-200',
                    'hover:bg-blue-50/50 dark:hover:bg-blue-500/10',
                    'hover:border-blue-300/40 dark:hover:border-blue-500/20',
                    'hover:scale-[1.02] transition-transform'
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
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 mb-3">
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
            'bg-primary hover:bg-primary/90',
            'border-0 text-primary-foreground shadow-lg',
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

      <LanguageModal
        open={langModalOpen}
        onSelect={handleAnalyze}
        onClose={() => setLangModalOpen(false)}
      />
    </GlassCard>
    </BlurFade>
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
