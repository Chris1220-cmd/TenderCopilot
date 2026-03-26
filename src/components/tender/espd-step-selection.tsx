'use client';

import { useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardContent,
} from '@/components/ui/glass-card';
import { Plus, Trash2 } from 'lucide-react';
import type { EspdData, SelectionEntry, QualityEntry } from '@/lib/espd-types';

interface StepProps {
  data: EspdData;
  onChange: (partial: Partial<EspdData>) => void;
  tenderId: string;
}

export function EspdStepSelection({ data, onChange }: StepProps) {
  const { t } = useTranslation();

  // ----- Financial -----
  const updateFinancial = useCallback(
    (index: number, patch: Partial<SelectionEntry>) => {
      const updated = data.partIV.financial.map((e, i) =>
        i === index ? { ...e, ...patch } : e
      );
      onChange({ partIV: { ...data.partIV, financial: updated } });
    },
    [data.partIV, onChange]
  );

  const addFinancial = useCallback(() => {
    onChange({
      partIV: {
        ...data.partIV,
        financial: [...data.partIV.financial, { description: '', value: '' }],
      },
    });
  }, [data.partIV, onChange]);

  const removeFinancial = useCallback(
    (index: number) => {
      onChange({
        partIV: {
          ...data.partIV,
          financial: data.partIV.financial.filter((_, i) => i !== index),
        },
      });
    },
    [data.partIV, onChange]
  );

  // ----- Technical -----
  const updateTechnical = useCallback(
    (index: number, patch: Partial<SelectionEntry>) => {
      const updated = data.partIV.technical.map((e, i) =>
        i === index ? { ...e, ...patch } : e
      );
      onChange({ partIV: { ...data.partIV, technical: updated } });
    },
    [data.partIV, onChange]
  );

  const addTechnical = useCallback(() => {
    onChange({
      partIV: {
        ...data.partIV,
        technical: [...data.partIV.technical, { description: '', value: '' }],
      },
    });
  }, [data.partIV, onChange]);

  const removeTechnical = useCallback(
    (index: number) => {
      onChange({
        partIV: {
          ...data.partIV,
          technical: data.partIV.technical.filter((_, i) => i !== index),
        },
      });
    },
    [data.partIV, onChange]
  );

  // ----- Quality -----
  const updateQuality = useCallback(
    (index: number, patch: Partial<QualityEntry>) => {
      const updated = data.partIV.quality.map((e, i) =>
        i === index ? { ...e, ...patch } : e
      );
      onChange({ partIV: { ...data.partIV, quality: updated } });
    },
    [data.partIV, onChange]
  );

  const addQuality = useCallback(() => {
    onChange({
      partIV: {
        ...data.partIV,
        quality: [
          ...data.partIV.quality,
          { certificateType: '', description: '' },
        ],
      },
    });
  }, [data.partIV, onChange]);

  const removeQuality = useCallback(
    (index: number) => {
      onChange({
        partIV: {
          ...data.partIV,
          quality: data.partIV.quality.filter((_, i) => i !== index),
        },
      });
    },
    [data.partIV, onChange]
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* A. Financial Capacity */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle>{t('espd.financialCapacity')}</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="space-y-3">
          {data.partIV.financial.map((entry, idx) => (
            <div
              key={idx}
              className="flex items-end gap-3"
            >
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t('espd.explanation')}
                </Label>
                <Input
                  value={entry.description}
                  onChange={(e) =>
                    updateFinancial(idx, { description: e.target.value })
                  }
                />
              </div>
              <div className="w-40 space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t('espd.financialCapacity')}
                </Label>
                <Input
                  value={entry.value}
                  onChange={(e) =>
                    updateFinancial(idx, { value: e.target.value })
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeFinancial(idx)}
                className="cursor-pointer shrink-0 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-destructive"
                aria-label={t('espd.removeCriterion')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={addFinancial}
            className="cursor-pointer gap-1.5 min-h-[44px]"
          >
            <Plus className="h-4 w-4" />
            {t('espd.addCriterion')}
          </Button>
        </GlassCardContent>
      </GlassCard>

      {/* B. Technical Capacity */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle>{t('espd.technicalCapacity')}</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="space-y-3">
          {data.partIV.technical.map((entry, idx) => (
            <div
              key={idx}
              className="flex items-end gap-3"
            >
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t('espd.explanation')}
                </Label>
                <Input
                  value={entry.description}
                  onChange={(e) =>
                    updateTechnical(idx, { description: e.target.value })
                  }
                />
              </div>
              <div className="w-40 space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t('espd.technicalCapacity')}
                </Label>
                <Input
                  value={entry.value}
                  onChange={(e) =>
                    updateTechnical(idx, { value: e.target.value })
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeTechnical(idx)}
                className="cursor-pointer shrink-0 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-destructive"
                aria-label={t('espd.removeCriterion')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={addTechnical}
            className="cursor-pointer gap-1.5 min-h-[44px]"
          >
            <Plus className="h-4 w-4" />
            {t('espd.addCriterion')}
          </Button>
        </GlassCardContent>
      </GlassCard>

      {/* C. Quality Systems */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle>{t('espd.qualitySystems')}</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="space-y-3">
          {data.partIV.quality.map((entry, idx) => (
            <div
              key={idx}
              className="flex items-end gap-3"
            >
              <div className="w-48 space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t('espd.qualitySystems')}
                </Label>
                <Input
                  value={entry.certificateType}
                  onChange={(e) =>
                    updateQuality(idx, { certificateType: e.target.value })
                  }
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t('espd.explanation')}
                </Label>
                <Input
                  value={entry.description}
                  onChange={(e) =>
                    updateQuality(idx, { description: e.target.value })
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeQuality(idx)}
                className="cursor-pointer shrink-0 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-destructive"
                aria-label={t('espd.removeCriterion')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={addQuality}
            className="cursor-pointer gap-1.5 min-h-[44px]"
          >
            <Plus className="h-4 w-4" />
            {t('espd.addCriterion')}
          </Button>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
