'use client';

import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardContent,
} from '@/components/ui/glass-card';
import { ShieldCheck, ShieldAlert, FileCheck } from 'lucide-react';
import type { EspdData, ExclusionGround } from '@/lib/espd-types';
import { EXCLUSION_CRITERIA } from '@/server/knowledge/espd-criteria';

interface StepProps {
  data: EspdData;
  onChange: (partial: Partial<EspdData>) => void;
  tenderId: string;
}

export function EspdStepExclusion({ data, onChange }: StepProps) {
  const { t } = useTranslation();

  const grounds = data.partIII.exclusionGrounds;

  const updateGround = useCallback(
    (index: number, patch: Partial<ExclusionGround>) => {
      const updated = grounds.map((g, i) =>
        i === index ? { ...g, ...patch } : g
      );
      onChange({ partIII: { exclusionGrounds: updated } });
    },
    [grounds, onChange]
  );

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {EXCLUSION_CRITERIA.map((criterion, idx) => {
        const ground = grounds.find((g) => g.category === criterion.category) ?? {
          category: criterion.category,
          answer: false,
        };
        const groundIndex = grounds.findIndex(
          (g) => g.category === criterion.category
        );
        const effectiveIndex = groundIndex >= 0 ? groundIndex : idx;
        const hasLinkedDoc = !!(
          criterion.linkedDocType && ground.linkedDocumentId
        );

        return (
          <GlassCard key={criterion.category}>
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-sm font-bold shrink-0">
                  {criterion.category}
                </span>
                <span className="text-sm font-semibold leading-snug">
                  {criterion.titleEl}
                </span>
              </GlassCardTitle>

              {/* Subcriteria */}
              {criterion.subcriteria.length > 0 && (
                <GlassCardDescription className="mt-2">
                  <ul className="list-disc list-inside space-y-0.5 text-xs text-muted-foreground">
                    {criterion.subcriteria.map((sub) => (
                      <li key={sub}>{sub}</li>
                    ))}
                  </ul>
                </GlassCardDescription>
              )}
            </GlassCardHeader>

            <GlassCardContent className="space-y-4">
              {/* YES / NO toggle + linked document badge */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* NO button */}
                <button
                  type="button"
                  onClick={() =>
                    updateGround(effectiveIndex, {
                      answer: false,
                      explanation: undefined,
                      selfCleaning: undefined,
                    })
                  }
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ease-out min-h-[44px] min-w-[44px] cursor-pointer',
                    'border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    !ground.answer
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                      : 'bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50'
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    {t('espd.exclusionNo')}
                  </span>
                </button>

                {/* YES button */}
                <button
                  type="button"
                  onClick={() =>
                    updateGround(effectiveIndex, { answer: true })
                  }
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ease-out min-h-[44px] min-w-[44px] cursor-pointer',
                    'border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    ground.answer
                      ? 'bg-red-500/15 border-red-500/40 text-red-400'
                      : 'bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50'
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4" />
                    {t('espd.exclusionYes')}
                  </span>
                </button>

                {/* Linked document badge */}
                {criterion.linkedDocType && (
                  <Badge
                    variant={hasLinkedDoc ? 'default' : 'outline'}
                    className={cn(
                      'gap-1.5 text-xs',
                      hasLinkedDoc
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                        : 'text-muted-foreground border-border/40'
                    )}
                  >
                    <FileCheck className="h-3 w-3" />
                    {hasLinkedDoc
                      ? t('espd.hasDocument')
                      : t('espd.noDocument')}
                  </Badge>
                )}
              </div>

              {/* Explanation + self-cleaning (only when YES) */}
              {ground.answer && (
                <div className="space-y-3 pl-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t('espd.explanation')}
                    </label>
                    <Textarea
                      value={ground.explanation ?? ''}
                      onChange={(e) =>
                        updateGround(effectiveIndex, {
                          explanation: e.target.value,
                        })
                      }
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t('espd.selfCleaning')}
                    </label>
                    <Textarea
                      value={ground.selfCleaning ?? ''}
                      onChange={(e) =>
                        updateGround(effectiveIndex, {
                          selfCleaning: e.target.value,
                        })
                      }
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                </div>
              )}
            </GlassCardContent>
          </GlassCard>
        );
      })}
    </div>
  );
}
