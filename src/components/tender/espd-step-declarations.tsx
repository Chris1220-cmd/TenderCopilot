'use client';

import { useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Checkbox } from '@/components/ui/checkbox';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardContent,
} from '@/components/ui/glass-card';
import type { EspdData, EspdPartVI } from '@/lib/espd-types';

interface StepProps {
  data: EspdData;
  onChange: (partial: Partial<EspdData>) => void;
  tenderId: string;
}

const DECLARATION_KEYS: (keyof EspdPartVI)[] = [
  'declarationAccuracy',
  'declarationEvidence',
  'declarationConsent',
];

export function EspdStepDeclarations({ data, onChange }: StepProps) {
  const { t } = useTranslation();

  const toggle = useCallback(
    (field: keyof EspdPartVI) => {
      onChange({
        partVI: { ...data.partVI, [field]: !data.partVI[field] },
      });
    },
    [data.partVI, onChange]
  );

  return (
    <div className="max-w-3xl mx-auto">
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle>{t('espd.step6')}</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="space-y-5">
          {DECLARATION_KEYS.map((key) => (
            <label
              key={key}
              className="flex items-start gap-3 cursor-pointer group"
            >
              <Checkbox
                checked={data.partVI[key]}
                onCheckedChange={() => toggle(key)}
                className="mt-0.5"
              />
              <span className="text-sm leading-relaxed text-foreground group-hover:text-foreground/80 transition-colors duration-150">
                {t(`espd.${key}`)}
              </span>
            </label>
          ))}
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
