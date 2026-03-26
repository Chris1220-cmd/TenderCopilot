'use client';

import { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardContent,
} from '@/components/ui/glass-card';
import { CloudUpload, FileText, Loader2, ArrowRight } from 'lucide-react';
import type { EspdData } from '@/lib/espd-types';

interface StepProps {
  data: EspdData;
  onChange: (partial: Partial<EspdData>) => void;
  tenderId: string;
}

export function EspdStepImport({ data, onChange, tenderId }: StepProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const importMutation = trpc.espd.importEspdRequest.useMutation({
    onSuccess: (result) => {
      const countText = t('espd.importSuccess').replace(
        '{{count}}',
        String(result.criteriaCount)
      );
      toast({ title: countText });
      onChange(result.espdData);
    },
    onError: () => {
      toast({
        title: t('espd.importError'),
        variant: 'destructive',
      });
    },
  });

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const xmlContent = e.target?.result as string;
        if (xmlContent) {
          importMutation.mutate({ tenderId, xmlContent });
        }
      };
      reader.readAsText(file);
    },
    [tenderId, importMutation]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragActive(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) handleFile(files[0]);
    },
    [handleFile]
  );

  return (
    <div className="grid gap-6 md:grid-cols-2 max-w-3xl mx-auto">
      {/* Option 1: Import ESPD Request */}
      <GlassCard
        className={cn(
          'border-2 border-dashed transition-all duration-200 cursor-pointer',
          isDragActive
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/30'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <GlassCardHeader>
          <GlassCardTitle className="text-base">
            {t('espd.importRequest')}
          </GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="flex flex-col items-center justify-center py-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 mb-4">
            {importMutation.isPending ? (
              <Loader2 className="h-7 w-7 text-primary animate-spin" />
            ) : (
              <CloudUpload className="h-7 w-7 text-primary" />
            )}
          </div>
          <p className="text-sm text-muted-foreground text-center mb-2">
            {t('espd.importDescription')}
          </p>
          <p className="text-xs text-muted-foreground/70 text-center">
            {t('espd.dropXmlHere')}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
        </GlassCardContent>
      </GlassCard>

      {/* Option 2: Create from scratch */}
      <GlassCard className="border border-border/40 hover:border-primary/30 transition-colors duration-200">
        <GlassCardHeader>
          <GlassCardTitle className="text-base">
            {t('espd.createFromScratch')}
          </GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="flex flex-col items-center justify-center py-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted mb-4">
            <FileText className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground text-center mb-4">
            {t('espd.step1')}
          </p>
          <Button
            variant="outline"
            className="cursor-pointer gap-2 min-h-[44px] min-w-[44px]"
            onClick={(e) => {
              e.stopPropagation();
              onChange({ currentStep: 1 });
            }}
          >
            {t('espd.next')}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
