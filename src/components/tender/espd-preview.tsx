'use client';

import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardContent,
} from '@/components/ui/glass-card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Download,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import type { EspdData } from '@/lib/espd-types';
import { EXCLUSION_CRITERIA } from '@/server/knowledge/espd-criteria';

interface PreviewProps {
  data: EspdData;
  onGoToStep: (step: number) => void;
  onExport: () => void;
  isGenerating: boolean;
}

/* ── Validation helpers ─────────────────────────── */

function isPartIComplete(data: EspdData): boolean {
  const p = data.partI;
  return !!(p.contractingAuthority && p.tenderTitle && p.referenceNumber);
}

function isPartIIComplete(data: EspdData): boolean {
  const p = data.partII;
  return !!(p.legalName && p.taxId && p.address && p.city);
}

function isPartIIIComplete(_data: EspdData): boolean {
  // Part III is always considered complete — user answers YES or NO per category
  return true;
}

function isPartIVComplete(data: EspdData): boolean {
  const p = data.partIV;
  return p.financial.length > 0 || p.technical.length > 0 || p.quality.length > 0;
}

function isPartVComplete(_data: EspdData): boolean {
  // Part V is always complete — it is a toggle
  return true;
}

function isPartVIComplete(data: EspdData): boolean {
  const p = data.partVI;
  return p.declarationAccuracy && p.declarationEvidence && p.declarationConsent;
}

/* ── Field pair helper ──────────────────────────── */

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-border/20 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={cn('text-sm text-right truncate', !value && 'text-muted-foreground/50 italic')}>
        {value || '—'}
      </span>
    </div>
  );
}

/* ── Section header ──────────────────────────────── */

function SectionHeader({
  title,
  complete,
  onEdit,
  t,
}: {
  title: string;
  complete: boolean;
  onEdit: () => void;
  t: (key: string) => string;
}) {
  return (
    <GlassCardHeader className="flex-row items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {complete ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-red-400 shrink-0" />
        )}
        <GlassCardTitle className="text-sm">{title}</GlassCardTitle>
      </div>
      <button
        onClick={onEdit}
        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
        title={t('espd.clickToEdit')}
      >
        <Pencil className="h-3 w-3" />
        {t('espd.clickToEdit')}
      </button>
    </GlassCardHeader>
  );
}

/* ── Main Preview Component ──────────────────────── */

export function EspdPreview({ data, onGoToStep, onExport, isGenerating }: PreviewProps) {
  const { t } = useTranslation();

  const sections = [
    { key: 'partI', complete: isPartIComplete(data), step: 1 },
    { key: 'partII', complete: isPartIIComplete(data), step: 2 },
    { key: 'partIII', complete: isPartIIIComplete(data), step: 3 },
    { key: 'partIV', complete: isPartIVComplete(data), step: 4 },
    { key: 'partV', complete: isPartVComplete(data), step: 5 },
    { key: 'partVI', complete: isPartVIComplete(data), step: 6 },
  ];

  const completeCount = sections.filter((s) => s.complete).length;
  const incompleteCount = sections.length - completeCount;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* ── Validation Summary ────────────────────── */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="text-sm">{t('espd.validationSummary')}</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                {completeCount} {t('espd.sectionsComplete')}
              </span>
            </div>
            {incompleteCount > 0 && (
              <div className="flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-red-400" />
                <span className="text-sm font-medium text-red-500 dark:text-red-400">
                  {incompleteCount} {t('espd.sectionsIncomplete')}
                </span>
              </div>
            )}
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* ── Part I: Procedure Information ─────────── */}
      <GlassCard>
        <SectionHeader
          title={t('espd.partI')}
          complete={isPartIComplete(data)}
          onEdit={() => onGoToStep(1)}
          t={t}
        />
        <GlassCardContent>
          <FieldRow label={t('espd.contractingAuthority')} value={data.partI.contractingAuthority} />
          <FieldRow label={t('espd.tenderTitle')} value={data.partI.tenderTitle} />
          <FieldRow label={t('espd.referenceNumber')} value={data.partI.referenceNumber} />
          <FieldRow label={t('espd.platform')} value={data.partI.platform} />
          <FieldRow label={t('espd.cpvCodes')} value={data.partI.cpvCodes.join(', ')} />
          <FieldRow label={t('espd.submissionDeadline')} value={data.partI.submissionDeadline} />
        </GlassCardContent>
      </GlassCard>

      {/* ── Part II: Operator Information ─────────── */}
      <GlassCard>
        <SectionHeader
          title={t('espd.partII')}
          complete={isPartIIComplete(data)}
          onEdit={() => onGoToStep(2)}
          t={t}
        />
        <GlassCardContent>
          <FieldRow label={t('espd.legalName')} value={data.partII.legalName} />
          <FieldRow label={t('espd.tradeName')} value={data.partII.tradeName} />
          <FieldRow label={t('espd.taxId')} value={data.partII.taxId} />
          <FieldRow label={t('espd.taxOffice')} value={data.partII.taxOffice} />
          <FieldRow label={t('espd.registrationNumber')} value={data.partII.registrationNumber} />
          <FieldRow label={t('espd.address')} value={data.partII.address} />
          <FieldRow label={t('espd.city')} value={data.partII.city} />
          <FieldRow label={t('espd.postalCode')} value={data.partII.postalCode} />
          <FieldRow label={t('espd.country')} value={data.partII.country} />
          <FieldRow label={t('espd.phone')} value={data.partII.phone} />
          <FieldRow label={t('espd.email')} value={data.partII.email} />
          <FieldRow label={t('espd.website')} value={data.partII.website} />
          <FieldRow label={t('espd.legalRepName')} value={data.partII.legalRepName} />
          <FieldRow label={t('espd.legalRepTitle')} value={data.partII.legalRepTitle} />
          <FieldRow label={t('espd.companySize')} value={data.partII.companySize || ''} />
          <FieldRow label={t('espd.kadCodes')} value={data.partII.kadCodes.join(', ')} />
        </GlassCardContent>
      </GlassCard>

      {/* ── Part III: Exclusion Grounds ───────────── */}
      <GlassCard>
        <SectionHeader
          title={t('espd.partIII')}
          complete={isPartIIIComplete(data)}
          onEdit={() => onGoToStep(3)}
          t={t}
        />
        <GlassCardContent>
          <div className="space-y-2">
            {EXCLUSION_CRITERIA.map((criterion) => {
              const ground = data.partIII.exclusionGrounds.find(
                (g) => g.category === criterion.category
              );
              const answer = ground?.answer ?? false;

              return (
                <div
                  key={criterion.category}
                  className="flex items-center justify-between gap-3 py-2 border-b border-border/20 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-muted-foreground mr-1.5">
                      {criterion.category}.
                    </span>
                    <span className="text-sm">{criterion.titleEl}</span>
                  </div>
                  <Badge
                    variant={answer ? 'destructive' : 'success'}
                    className="shrink-0"
                  >
                    {answer ? t('espd.exclusionYes') : t('espd.exclusionNo')}
                  </Badge>
                </div>
              );
            })}
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* ── Part IV: Selection Criteria ───────────── */}
      <GlassCard>
        <SectionHeader
          title={t('espd.partIV')}
          complete={isPartIVComplete(data)}
          onEdit={() => onGoToStep(4)}
          t={t}
        />
        <GlassCardContent>
          <div className="space-y-1.5">
            <FieldRow
              label={t('espd.financialCapacity')}
              value={`${data.partIV.financial.length} ${t('espd.entries')}`}
            />
            <FieldRow
              label={t('espd.technicalCapacity')}
              value={`${data.partIV.technical.length} ${t('espd.entries')}`}
            />
            <FieldRow
              label={t('espd.qualitySystems')}
              value={`${data.partIV.quality.length} ${t('espd.entries')}`}
            />
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* ── Part V: Candidate Reduction ──────────── */}
      <GlassCard>
        <SectionHeader
          title={t('espd.partV')}
          complete={isPartVComplete(data)}
          onEdit={() => onGoToStep(5)}
          t={t}
        />
        <GlassCardContent>
          <div className="flex items-center gap-2">
            <Badge variant={data.partV.enabled ? 'success' : 'secondary'}>
              {data.partV.enabled ? t('espd.enabled') : t('espd.disabled')}
            </Badge>
            {data.partV.enabled && data.partV.criteria && (
              <span className="text-sm text-muted-foreground">{data.partV.criteria}</span>
            )}
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* ── Part VI: Declarations ─────────────────── */}
      <GlassCard>
        <SectionHeader
          title={t('espd.partVI')}
          complete={isPartVIComplete(data)}
          onEdit={() => onGoToStep(6)}
          t={t}
        />
        <GlassCardContent>
          <div className="space-y-2">
            {([
              { key: 'declarationAccuracy' as const, checked: data.partVI.declarationAccuracy },
              { key: 'declarationEvidence' as const, checked: data.partVI.declarationEvidence },
              { key: 'declarationConsent' as const, checked: data.partVI.declarationConsent },
            ]).map((decl) => (
              <div key={decl.key} className="flex items-center gap-2 py-1">
                {decl.checked ? (
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <X className="h-4 w-4 text-red-400 shrink-0" />
                )}
                <span className={cn('text-sm', !decl.checked && 'text-muted-foreground')}>
                  {t(`espd.${decl.key}`)}
                </span>
              </div>
            ))}
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* ── Export Buttons ────────────────────────── */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          onClick={onExport}
          disabled={isGenerating}
          className="cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {t('espd.exportXml')}
        </Button>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="outline"
                  disabled
                  className="cursor-not-allowed gap-2 opacity-50"
                >
                  <FileText className="h-4 w-4" />
                  {t('espd.exportPdf')}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('espd.comingSoonPdf')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
