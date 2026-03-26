'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Loader2, ChevronLeft, ChevronRight, Save, Check, Download } from 'lucide-react';
import type { EspdData } from '@/lib/espd-types';
import { EMPTY_ESPD_DATA } from '@/lib/espd-types';
import { EspdStepImport } from '@/components/tender/espd-step-import';
import { EspdStepProcedure } from '@/components/tender/espd-step-procedure';
import { EspdStepOperator } from '@/components/tender/espd-step-operator';
import { EspdStepExclusion } from '@/components/tender/espd-step-exclusion';
import { EspdStepSelection } from '@/components/tender/espd-step-selection';
import { EspdStepReduction } from '@/components/tender/espd-step-reduction';
import { EspdStepDeclarations } from '@/components/tender/espd-step-declarations';
import { EspdPreview } from '@/components/tender/espd-preview';

const STEPS = [
  { key: 'import', labelKey: 'espd.step0' },
  { key: 'procedure', labelKey: 'espd.step1' },
  { key: 'operator', labelKey: 'espd.step2' },
  { key: 'exclusion', labelKey: 'espd.step3' },
  { key: 'selection', labelKey: 'espd.step4' },
  { key: 'reduction', labelKey: 'espd.step5' },
  { key: 'declarations', labelKey: 'espd.step6' },
  { key: 'preview', labelKey: 'espd.preview' },
];

interface EspdWizardProps {
  tenderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EspdWizard({ tenderId, open, onOpenChange }: EspdWizardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [espdData, setEspdData] = useState<EspdData>(EMPTY_ESPD_DATA);
  const [saved, setSaved] = useState(false);

  const dataQuery = trpc.espd.getEspdData.useQuery(
    { tenderId },
    { enabled: open, retry: false, refetchOnWindowFocus: false }
  );

  const saveMutation = trpc.espd.saveEspdData.useMutation({
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const generateMutation = trpc.espd.generateEspdXml.useMutation({
    onSuccess: (result) => {
      // Download XML
      const blob = new Blob([result.xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ESPD_${tenderId}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: t('espd.downloadReady') });
    },
    onError: (err) => {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    },
  });

  // Load data on open
  useEffect(() => {
    if (dataQuery.data) {
      setEspdData(dataQuery.data as EspdData);
      setCurrentStep((dataQuery.data as EspdData).currentStep || 0);
    }
  }, [dataQuery.data]);

  // Auto-save helper
  const autoSave = useCallback((data: EspdData, step: number) => {
    const updated = { ...data, currentStep: step };
    saveMutation.mutate({ tenderId, espdData: updated as any });
  }, [tenderId, saveMutation]);

  function updateData(partial: Partial<EspdData>) {
    setEspdData((prev) => ({ ...prev, ...partial }));
  }

  function goNext() {
    if (currentStep < STEPS.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      autoSave(espdData, nextStep);
    }
  }

  function goBack() {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      autoSave(espdData, prevStep);
    }
  }

  function goToStep(step: number) {
    setCurrentStep(step);
    autoSave(espdData, step);
  }

  function handleSave() {
    autoSave(espdData, currentStep);
  }

  function handleExport() {
    // Save first, then generate
    saveMutation.mutate({ tenderId, espdData: { ...espdData, currentStep } as any }, {
      onSuccess: () => {
        generateMutation.mutate({ tenderId });
      },
    });
  }

  const isPreview = currentStep === STEPS.length - 1;
  const isImport = currentStep === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-full p-0 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border/40">
          <SheetHeader className="px-6 py-4">
            <SheetTitle className="text-lg font-semibold">{t('espd.title')}</SheetTitle>
          </SheetHeader>

          {/* Stepper */}
          <div className="px-6 pb-4">
            <div className="flex items-center gap-1">
              {STEPS.map((step, i) => (
                <button
                  key={step.key}
                  onClick={() => goToStep(i)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer',
                    i === currentStep
                      ? 'bg-primary text-primary-foreground'
                      : i < currentStep
                        ? 'bg-primary/10 text-primary hover:bg-primary/20'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  <span className="w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold border border-current">
                    {i < currentStep ? <Check className="h-2.5 w-2.5" /> : i}
                  </span>
                  <span className="hidden sm:inline">{t(step.labelKey)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="px-6 py-6 min-h-[60vh]">
          {dataQuery.isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <StepContent
              step={currentStep}
              data={espdData}
              onChange={updateData}
              tenderId={tenderId}
              onGoToStep={goToStep}
              onExport={handleExport}
              isGenerating={generateMutation.isPending}
            />
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-card/95 backdrop-blur-sm border-t border-border/40 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={goBack}
              disabled={isImport}
              className="cursor-pointer gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              {t('espd.back')}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {saved && (
              <span className="text-xs text-emerald-500 flex items-center gap-1">
                <Check className="h-3 w-3" /> {t('espd.saved')}
              </span>
            )}
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="cursor-pointer gap-1"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('espd.save')}
            </Button>
            {isPreview ? (
              <Button
                onClick={handleExport}
                disabled={generateMutation.isPending}
                className="cursor-pointer gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {t('espd.exportXml')}
              </Button>
            ) : (
              <Button
                onClick={goNext}
                className="cursor-pointer gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {t('espd.next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Renders the active step component.
 * Steps 0-2 use dedicated components; remaining steps are placeholders for Tasks 9-10.
 */
function StepContent({
  step,
  data,
  onChange,
  tenderId,
  onGoToStep,
  onExport,
  isGenerating,
}: {
  step: number;
  data: EspdData;
  onChange: (partial: Partial<EspdData>) => void;
  tenderId: string;
  onGoToStep: (step: number) => void;
  onExport: () => void;
  isGenerating: boolean;
}) {
  const { t } = useTranslation();

  switch (step) {
    case 0:
      return <EspdStepImport data={data} onChange={onChange} tenderId={tenderId} />;
    case 1:
      return <EspdStepProcedure data={data} onChange={onChange} tenderId={tenderId} />;
    case 2:
      return <EspdStepOperator data={data} onChange={onChange} tenderId={tenderId} />;
    case 3:
      return <EspdStepExclusion data={data} onChange={onChange} tenderId={tenderId} />;
    case 4:
      return <EspdStepSelection data={data} onChange={onChange} tenderId={tenderId} />;
    case 5:
      return <EspdStepReduction data={data} onChange={onChange} tenderId={tenderId} />;
    case 6:
      return <EspdStepDeclarations data={data} onChange={onChange} tenderId={tenderId} />;
    case 7:
      return (
        <EspdPreview
          data={data}
          onGoToStep={onGoToStep}
          onExport={onExport}
          isGenerating={isGenerating}
        />
      );
    default:
      return null;
  }
}
