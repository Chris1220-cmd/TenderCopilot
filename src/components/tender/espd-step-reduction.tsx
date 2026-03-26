'use client';

import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { Textarea } from '@/components/ui/textarea';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardContent,
} from '@/components/ui/glass-card';
import { ToggleLeft, ToggleRight } from 'lucide-react';
import type { EspdData } from '@/lib/espd-types';

interface StepProps {
  data: EspdData;
  onChange: (partial: Partial<EspdData>) => void;
  tenderId: string;
}

export function EspdStepReduction({ data, onChange }: StepProps) {
  const { t } = useTranslation();

  const toggleEnabled = useCallback(() => {
    onChange({
      partV: {
        ...data.partV,
        enabled: !data.partV.enabled,
        criteria: !data.partV.enabled ? data.partV.criteria : undefined,
      },
    });
  }, [data.partV, onChange]);

  const updateCriteria = useCallback(
    (value: string) => {
      onChange({
        partV: { ...data.partV, criteria: value },
      });
    },
    [data.partV, onChange]
  );

  return (
    <div className="max-w-3xl mx-auto">
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle>{t('espd.step5')}</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="space-y-4">
          {/* Toggle */}
          <button
            type="button"
            onClick={toggleEnabled}
            className={cn(
              'flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ease-out cursor-pointer',
              'border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              data.partV.enabled
                ? 'bg-[#48A4D6]/10 border-[#48A4D6]/40 text-[#48A4D6]'
                : 'bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50'
            )}
          >
            {data.partV.enabled ? (
              <ToggleRight className="h-6 w-6 shrink-0" />
            ) : (
              <ToggleLeft className="h-6 w-6 shrink-0" />
            )}
            <span className="text-left">{t('espd.reductionToggle')}</span>
          </button>

          {/* Criteria textarea */}
          {data.partV.enabled && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t('espd.reductionCriteria')}
              </label>
              <Textarea
                value={data.partV.criteria ?? ''}
                onChange={(e) => updateCriteria(e.target.value)}
                rows={4}
                className="text-sm"
              />
            </div>
          )}
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
