'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { trpc } from '@/lib/trpc';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { LanguageModal, type AnalysisLanguage } from '@/components/tender/language-modal';
import { EmptyStateIllustration } from '@/components/ui/empty-state';
import { Ripple } from '@/components/ui/ripple';
import { BlurFade } from '@/components/ui/blur-fade';
import {
  Award,
  ChevronDown,
  ChevronRight,
  Loader2,
  Play,
  RefreshCw,
  Copy,
  Check,
  FileText,
  Lightbulb,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CriteriaTabProps {
  tenderId: string;
}

type CriterionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DRAFT_READY' | 'FINAL';

const STATUS_VARIANTS: Record<CriterionStatus, 'secondary' | 'warning' | 'default' | 'success'> = {
  NOT_STARTED: 'secondary',
  IN_PROGRESS: 'warning',
  DRAFT_READY: 'default',
  FINAL: 'success',
};

const STATUS_KEYS: Record<CriterionStatus, string> = {
  NOT_STARTED: 'criteria.statusNotStarted',
  IN_PROGRESS: 'criteria.statusInProgress',
  DRAFT_READY: 'criteria.statusDraftReady',
  FINAL: 'criteria.statusFinal',
};

const STATUS_ORDER: CriterionStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'DRAFT_READY', 'FINAL'];

/* ------------------------------------------------------------------ */
/*  Simple markdown renderer                                           */
/* ------------------------------------------------------------------ */

function boldify(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground font-medium">$1</strong>')
    .replace(/`(.+?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs">$1</code>');
}

function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-1 text-sm text-muted-foreground leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;
        if (trimmed.startsWith('### '))
          return <h4 key={i} className="font-semibold text-foreground mt-3 mb-1 text-sm">{trimmed.slice(4)}</h4>;
        if (trimmed.startsWith('## '))
          return <h3 key={i} className="font-semibold text-foreground mt-3 mb-1">{trimmed.slice(3)}</h3>;
        if (trimmed.startsWith('# '))
          return <h3 key={i} className="font-bold text-foreground mt-3 mb-1">{trimmed.slice(2)}</h3>;
        if (trimmed.startsWith('- ') || trimmed.startsWith('* '))
          return (
            <div key={i} className="flex gap-2 pl-2">
              <span className="text-primary mt-0.5 shrink-0">&#8226;</span>
              <span dangerouslySetInnerHTML={{ __html: boldify(trimmed.slice(2)) }} />
            </div>
          );
        const numMatch = trimmed.match(/^(\d+)\.\s(.*)$/);
        if (numMatch)
          return (
            <div key={i} className="flex gap-2 pl-2">
              <span className="text-primary font-medium shrink-0">{numMatch[1]}.</span>
              <span dangerouslySetInnerHTML={{ __html: boldify(numMatch[2]) }} />
            </div>
          );
        return <p key={i} dangerouslySetInnerHTML={{ __html: boldify(trimmed) }} />;
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section block                                                      */
/* ------------------------------------------------------------------ */

function Section({
  icon,
  title,
  content,
  copyable,
  onCopy,
  copied,
  copyLabel,
  copiedLabel,
  highlight,
}: {
  icon: React.ReactNode;
  title: string;
  content: string;
  copyable?: boolean;
  onCopy?: () => void;
  copied?: boolean;
  copyLabel?: string;
  copiedLabel?: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-lg p-4',
      highlight ? 'bg-primary/5 border border-primary/10' : 'bg-muted/30',
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-foreground font-medium text-sm">
          {icon}
          {title}
        </div>
        {copyable && onCopy && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopy}
            className="h-7 gap-1.5 text-xs cursor-pointer"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? copiedLabel : copyLabel}
          </Button>
        )}
      </div>
      <SimpleMarkdown content={content} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Criterion Card                                                     */
/* ------------------------------------------------------------------ */

function CriterionCard({
  criterion,
  onStatusChange,
}: {
  criterion: any;
  onStatusChange: (id: string, status: CriterionStatus) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const cycleStatus = () => {
    const currentIdx = STATUS_ORDER.indexOf(criterion.status);
    const nextStatus = STATUS_ORDER[(currentIdx + 1) % STATUS_ORDER.length];
    onStatusChange(criterion.id, nextStatus);
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card transition-colors hover:border-primary/20">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-4 cursor-pointer text-left"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {expanded
            ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          }
          <span className="font-medium text-foreground truncate">{criterion.name}</span>
          {criterion.weight != null && (
            <Badge variant="outline" className="shrink-0 tabular-nums">
              {criterion.weight}%
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 ml-3 shrink-0">
          <Badge
            variant={STATUS_VARIANTS[criterion.status as CriterionStatus]}
            className="cursor-pointer"
            onClick={(e) => { e.stopPropagation(); cycleStatus(); }}
          >
            {t(STATUS_KEYS[criterion.status as CriterionStatus] ?? 'criteria.statusNotStarted')}
          </Badge>
        </div>
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/40 px-5 py-4 space-y-5">
              {criterion.description && (
                <Section
                  icon={<FileText className="h-4 w-4" />}
                  title={t('criteria.whatTenderAsks')}
                  content={criterion.description}
                />
              )}

              {criterion.guidance && (
                <Section
                  icon={<BookOpen className="h-4 w-4" />}
                  title={t('criteria.proposedOutline')}
                  content={criterion.guidance}
                  copyable
                  onCopy={() => handleCopy(criterion.guidance!, 'guidance')}
                  copied={copiedField === 'guidance'}
                  copyLabel={t('criteria.copyOutline')}
                  copiedLabel={t('criteria.copied')}
                />
              )}

              {criterion.evidence && (
                <Section
                  icon={<Award className="h-4 w-4" />}
                  title={t('criteria.evidenceNeeded')}
                  content={criterion.evidence}
                />
              )}

              {criterion.suggestions && (
                <Section
                  icon={<Lightbulb className="h-4 w-4" />}
                  title={t('criteria.tips')}
                  content={criterion.suggestions}
                  highlight
                />
              )}

              {criterion.children && criterion.children.length > 0 && (
                <div className="space-y-3 pl-4 border-l-2 border-primary/20">
                  {criterion.children.map((child: any) => (
                    <CriterionCard
                      key={child.id}
                      criterion={child}
                      onStatusChange={onStatusChange}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Award type badge                                                   */
/* ------------------------------------------------------------------ */

function AwardTypeBadge({ criteria }: { criteria: any[] }) {
  const { t } = useTranslation();
  const hasWeights = criteria.some((c) => c.weight != null);
  if (!hasWeights) return null;

  const totalWeight = criteria
    .filter((c) => !c.parentId && c.weight != null)
    .reduce((sum: number, c: any) => sum + (c.weight ?? 0), 0);

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Sparkles className="h-3.5 w-3.5 text-primary" />
      <span>{t('criteria.awardType')}: <strong className="text-foreground">{t('criteria.bestValue')}</strong></span>
      {totalWeight > 0 && (
        <Badge variant="outline" className="text-xs tabular-nums">{Math.round(totalWeight)}%</Badge>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function CriteriaTab({ tenderId }: CriteriaTabProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [langModalOpen, setLangModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const criteriaQuery = trpc.aiRoles.getCriteria.useQuery({ tenderId });
  const analyzeMutation = trpc.aiRoles.analyzeCriteria.useMutation({
    onSuccess: (data) => {
      setIsAnalyzing(false);
      utils.aiRoles.getCriteria.invalidate({ tenderId });
      toast({
        title: t('criteria.tab'),
        description: t('criteria.criteriaCount').replace('{{count}}', String(data.count)),
      });
    },
    onError: (err) => {
      setIsAnalyzing(false);
      toast({
        title: t('criteria.errorAnalysis'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const statusMutation = trpc.aiRoles.updateCriterionStatus.useMutation({
    onSuccess: () => {
      utils.aiRoles.getCriteria.invalidate({ tenderId });
    },
  });

  const handleAnalyze = () => setLangModalOpen(true);

  const handleAnalyzeWithLang = (lang: AnalysisLanguage) => {
    setLangModalOpen(false);
    setIsAnalyzing(true);
    analyzeMutation.mutate({ tenderId, language: lang });
  };

  const handleStatusChange = (criterionId: string, status: CriterionStatus) => {
    statusMutation.mutate({ criterionId, status });
  };

  const criteria = criteriaQuery.data ?? [];
  const isLoading = criteriaQuery.isLoading;
  const hasCriteria = criteria.length > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Award className="h-5 w-5 text-primary" />
          <h2 className="text-title text-foreground">{t('criteria.tab')}</h2>
          {hasCriteria && <AwardTypeBadge criteria={criteria} />}
        </div>
        <Button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          variant={hasCriteria ? 'outline' : 'default'}
          size="sm"
          className="gap-2 cursor-pointer"
        >
          {isAnalyzing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : hasCriteria ? (
            <RefreshCw className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {isAnalyzing
            ? t('criteria.analyzing')
            : hasCriteria
              ? t('criteria.reanalyze')
              : t('criteria.analyze')
          }
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : !hasCriteria ? (
        <BlurFade delay={0.1}>
          <div className="relative rounded-xl border border-border/60 bg-card py-16 text-center overflow-hidden">
            <Ripple mainCircleSize={120} mainCircleOpacity={0.06} numCircles={5} />
            <div className="relative z-10">
              <EmptyStateIllustration variant="general" className="mb-4" />
              <p className="text-body text-muted-foreground">{t('criteria.noCriteria')}</p>
              <p className="text-caption text-muted-foreground/70 mt-1 max-w-md mx-auto">
                {t('criteria.noCriteriaDesc')}
              </p>
            </div>
          </div>
        </BlurFade>
      ) : (
        <BlurFade delay={0.1}>
          <div className="space-y-3">
            {criteria.map((criterion: any, i: number) => (
              <motion.div
                key={criterion.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <CriterionCard
                  criterion={criterion}
                  onStatusChange={handleStatusChange}
                />
              </motion.div>
            ))}
          </div>
        </BlurFade>
      )}

      {/* Language Modal */}
      <LanguageModal
        open={langModalOpen}
        onSelect={handleAnalyzeWithLang}
        onClose={() => setLangModalOpen(false)}
      />
    </div>
  );
}
