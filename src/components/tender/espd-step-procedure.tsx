'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardContent,
} from '@/components/ui/glass-card';
import { Plus, X } from 'lucide-react';
import type { EspdData } from '@/lib/espd-types';

interface StepProps {
  data: EspdData;
  onChange: (partial: Partial<EspdData>) => void;
  tenderId: string;
}

export function EspdStepProcedure({ data, onChange }: StepProps) {
  const { t } = useTranslation();
  const [cpvInput, setCpvInput] = useState('');

  const updateField = useCallback(
    (field: keyof EspdData['partI'], value: string | string[]) => {
      onChange({ partI: { ...data.partI, [field]: value } });
    },
    [data.partI, onChange]
  );

  const addCpvCode = useCallback(() => {
    const code = cpvInput.trim();
    if (code && !data.partI.cpvCodes.includes(code)) {
      updateField('cpvCodes', [...data.partI.cpvCodes, code]);
      setCpvInput('');
    }
  }, [cpvInput, data.partI.cpvCodes, updateField]);

  const removeCpvCode = useCallback(
    (code: string) => {
      updateField(
        'cpvCodes',
        data.partI.cpvCodes.filter((c) => c !== code)
      );
    },
    [data.partI.cpvCodes, updateField]
  );

  const handleCpvKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addCpvCode();
      }
    },
    [addCpvCode]
  );

  return (
    <div className="max-w-3xl mx-auto">
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle>{t('espd.step1')}</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="space-y-5">
          {/* 2-column grid for text fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Contracting Authority */}
            <div className="space-y-1.5">
              <Label htmlFor="espd-ca">{t('espd.contractingAuthority')}</Label>
              <Input
                id="espd-ca"
                value={data.partI.contractingAuthority}
                onChange={(e) =>
                  updateField('contractingAuthority', e.target.value)
                }
              />
            </div>

            {/* Tender Title */}
            <div className="space-y-1.5">
              <Label htmlFor="espd-title">{t('espd.tenderTitle')}</Label>
              <Input
                id="espd-title"
                value={data.partI.tenderTitle}
                onChange={(e) => updateField('tenderTitle', e.target.value)}
              />
            </div>

            {/* Reference Number */}
            <div className="space-y-1.5">
              <Label htmlFor="espd-ref">{t('espd.referenceNumber')}</Label>
              <Input
                id="espd-ref"
                value={data.partI.referenceNumber}
                onChange={(e) =>
                  updateField('referenceNumber', e.target.value)
                }
              />
            </div>

            {/* Platform (readonly) */}
            <div className="space-y-1.5">
              <Label htmlFor="espd-platform">{t('espd.platform')}</Label>
              <Input
                id="espd-platform"
                value={data.partI.platform}
                readOnly
                className="bg-muted/30 cursor-default"
              />
            </div>

            {/* Submission Deadline */}
            <div className="space-y-1.5">
              <Label htmlFor="espd-deadline">
                {t('espd.submissionDeadline')}
              </Label>
              <Input
                id="espd-deadline"
                type="date"
                value={data.partI.submissionDeadline}
                onChange={(e) =>
                  updateField('submissionDeadline', e.target.value)
                }
                className="cursor-pointer"
              />
            </div>
          </div>

          {/* CPV Codes — tag input spanning full width */}
          <div className="space-y-1.5">
            <Label>{t('espd.cpvCodes')}</Label>

            {/* Existing tags */}
            {data.partI.cpvCodes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {data.partI.cpvCodes.map((code) => (
                  <Badge
                    key={code}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    {code}
                    <button
                      type="button"
                      onClick={() => removeCpvCode(code)}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 transition-colors cursor-pointer min-h-[22px] min-w-[22px] flex items-center justify-center"
                      aria-label={`Remove ${code}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Add input */}
            <div className="flex gap-2">
              <Input
                value={cpvInput}
                onChange={(e) => setCpvInput(e.target.value)}
                onKeyDown={handleCpvKeyDown}
                placeholder={t('espd.cpvPlaceholder')}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={addCpvCode}
                disabled={!cpvInput.trim()}
                className="cursor-pointer gap-1 min-h-[44px] min-w-[44px]"
              >
                <Plus className="h-4 w-4" />
                {t('espd.addCpv')}
              </Button>
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
