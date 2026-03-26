'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  Package,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertTriangle,
  Download,
  FileText,
  Folder,
  ArrowLeft,
  Loader2,
  XCircle,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

const STEPS = [
  { id: 1, titleKey: 'step1Title', descKey: 'step1Desc' },
  { id: 2, titleKey: 'step2Title', descKey: 'step2Desc' },
  { id: 3, titleKey: 'step3Title', descKey: 'step3Desc' },
] as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PackagePage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const tenderId = params.id as string;
  const [currentStep, setCurrentStep] = useState(1);

  const { data: tender, isLoading: tenderLoading } =
    trpc.tender.getById.useQuery({ id: tenderId });

  // Step 1: Run validation
  const validateMutation = trpc.package.validate.useMutation();
  const assembleMutation = trpc.package.assemble.useMutation();

  // Auto-validate on mount
  const [hasValidated, setHasValidated] = useState(false);
  if (!hasValidated && tender && !validateMutation.isPending && !validateMutation.data) {
    setHasValidated(true);
    validateMutation.mutate({ tenderId });
  }

  const validation = validateMutation.data;

  const handleAssemble = async () => {
    assembleMutation.mutate(
      { tenderId },
      {
        onSuccess: (data) => {
          // Trigger download
          const byteArray = Uint8Array.from(atob(data.zipBase64), (c) => c.charCodeAt(0));
          const blob = new Blob([byteArray], { type: 'application/zip' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${tender?.title || 'package'}_${new Date().toISOString().slice(0, 10)}.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          setCurrentStep(3);
        },
      }
    );
  };

  if (tenderLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/tenders/${tenderId}`}>
          <Button variant="ghost" size="icon" className="cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-[#48A4D6]" />
            {t('package.title')}
          </h1>
          <p className="text-muted-foreground">
            {tender?.title} — {tender?.platform}
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center gap-2 flex-1">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 font-semibold transition-all duration-200',
                currentStep === step.id
                  ? 'border-[#48A4D6] bg-[#48A4D6] text-white'
                  : currentStep > step.id
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-border text-muted-foreground'
              )}
            >
              {currentStep > step.id ? (
                <Check className="h-5 w-5" />
              ) : (
                step.id
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium">{t(`package.${step.titleKey}`)}</div>
              <div className="text-xs text-muted-foreground truncate">
                {t(`package.${step.descKey}`)}
              </div>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  'h-0.5 flex-1 mx-2 transition-colors duration-200',
                  currentStep > step.id ? 'bg-emerald-500' : 'bg-border'
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Validation */}
      {currentStep === 1 && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {t('package.step1Title')}
              {validation && (
                <div className="flex gap-2">
                  {validation.blockers.length > 0 && (
                    <Badge variant="destructive">
                      {validation.blockers.length} {t('package.blockers')}
                    </Badge>
                  )}
                  {validation.warnings.length > 0 && (
                    <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">
                      {validation.warnings.length} {t('package.warnings')}
                    </Badge>
                  )}
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {validateMutation.isPending && (
              <div className="flex items-center gap-3 py-8 justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                {t('package.validating')}
              </div>
            )}

            {validation && (
              <>
                {/* Blockers */}
                {validation.blockers.length > 0 && (
                  <div className="space-y-2">
                    {validation.blockers.map((issue, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.04] p-3.5"
                      >
                        <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{issue.message}</p>
                          {issue.action && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              → {issue.action}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {issue.envelope}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {/* Warnings */}
                {validation.warnings.length > 0 && (
                  <div className="space-y-2">
                    {validation.warnings.map((issue, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3.5"
                      >
                        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{issue.message}</p>
                          {issue.action && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              → {issue.action}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {issue.envelope}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {/* Infos */}
                {validation.infos.length > 0 && (
                  <div className="space-y-2">
                    {validation.infos.map((issue, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-xl border border-border/60 p-3.5"
                      >
                        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-sm text-muted-foreground flex-1">{issue.message}</p>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {issue.envelope}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {/* Success state */}
                {validation.canProceed && (
                  <div className="flex items-center gap-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 p-4">
                    <Check className="h-5 w-5 text-emerald-500" />
                    <div>
                      <p className="font-medium text-emerald-700 dark:text-emerald-400">
                        {t('package.noBlockers')}
                      </p>
                      <p className="text-sm text-emerald-600/80 dark:text-emerald-500/80">
                        {t('package.readyToProceed')}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <Button
                    variant="ghost"
                    onClick={() => validateMutation.mutate({ tenderId })}
                    className="cursor-pointer gap-2"
                  >
                    <Loader2 className={cn('h-4 w-4', validateMutation.isPending && 'animate-spin')} />
                    {t('package.step1Title')}
                  </Button>
                  <Button
                    onClick={() => setCurrentStep(2)}
                    disabled={!validation.canProceed}
                    className="cursor-pointer"
                  >
                    {t('package.proceed')}
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Assembly Preview */}
      {currentStep === 2 && validation && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>{t('package.step2Title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {validation.envelopes
              .filter((env) => env.documents.length > 0)
              .map((envelope) => (
                <div key={envelope.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <Folder className="h-5 w-5 text-[#48A4D6]" />
                    <h3 className="font-semibold">{envelope.title}</h3>
                    <Badge variant="secondary">
                      {envelope.documentCount} {t('package.files')}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 ml-7">
                    {envelope.documents.map((doc, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5 transition-colors hover:bg-muted/50"
                      >
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="flex-1 text-sm font-mono text-xs truncate">
                          {doc.name}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] shrink-0',
                            doc.source === 'generated'
                              ? 'border-[#48A4D6]/30 text-[#48A4D6]'
                              : doc.source === 'company'
                                ? 'border-emerald-500/30 text-emerald-600'
                                : 'border-border'
                          )}
                        >
                          {doc.source === 'generated'
                            ? 'AI Generated'
                            : doc.source === 'company'
                              ? 'Εταιρεία'
                              : 'Επισυναπτόμενο'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <Separator className="mt-4" />
                </div>
              ))}

            {/* Summary */}
            <div className="rounded-xl bg-muted/50 border border-border/60 p-4">
              <h3 className="font-medium mb-2">{t('package.summary')}</h3>
              <div className="grid gap-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('package.totalFiles')}:</span>
                  <span className="font-medium">
                    {validation.envelopes.reduce((sum, e) => sum + e.documentCount, 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('package.envelopes')}:</span>
                  <span className="font-medium">
                    {validation.envelopes.filter(e => e.documentCount > 0).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('package.platform')}:</span>
                  <span className="font-medium">{tender?.platform}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('package.readiness')}:</span>
                  <span className="font-medium">{validation.readinessScore}%</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="cursor-pointer"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                {t('package.back')}
              </Button>
              <Button
                onClick={handleAssemble}
                disabled={assembleMutation.isPending}
                className="cursor-pointer"
              >
                {assembleMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('package.building')}
                  </>
                ) : (
                  <>
                    <Package className="mr-2 h-4 w-4" />
                    {t('package.buildZip')}
                  </>
                )}
              </Button>
            </div>

            {assembleMutation.error && (
              <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.04] p-3.5">
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-sm">{assembleMutation.error.message}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Download */}
      {currentStep === 3 && assembleMutation.data && (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-6">
            <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Check className="h-10 w-10 text-emerald-500" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold">{t('package.readyTitle')}</h2>
              <p className="text-muted-foreground mt-2">
                {t('package.readyDesc')}{' '}
                <span className="font-medium">{tender?.platform}</span>
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-2xl font-bold">{assembleMutation.data.documentCount}</div>
                <div className="text-xs text-muted-foreground">{t('package.totalFiles')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{assembleMutation.data.envelopeCount}</div>
                <div className="text-xs text-muted-foreground">{t('package.envelopes')}</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {formatBytes(assembleMutation.data.fileSize)}
                </div>
                <div className="text-xs text-muted-foreground">{t('package.zipSize')}</div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                size="lg"
                className="cursor-pointer"
                onClick={() => {
                  // Re-trigger download
                  const byteArray = Uint8Array.from(
                    atob(assembleMutation.data!.zipBase64),
                    (c) => c.charCodeAt(0)
                  );
                  const blob = new Blob([byteArray], { type: 'application/zip' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${tender?.title || 'package'}_${new Date().toISOString().slice(0, 10)}.zip`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="mr-2 h-5 w-5" />
                {t('package.download')}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => router.push(`/tenders/${tenderId}`)}
                className="cursor-pointer"
              >
                {t('package.backToTender')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
