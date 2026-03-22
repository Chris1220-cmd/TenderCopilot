'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsContent } from '@/components/ui/tabs';
import { BlurFade } from '@/components/ui/blur-fade';
import { AnimatedTabsTrigger } from '@/components/ui/animated-tabs';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { LanguageModal, type AnalysisLanguage } from '@/components/tender/language-modal';
import { StatusBadge } from '@/components/tender/status-badge';
import { OverviewTab, OverviewTabSkeleton } from '@/components/tender/overview-tab';
import { RequirementsTab } from '@/components/tender/requirements-tab';
import { DocumentsTab } from '@/components/tender/documents-tab';
import { TasksTab } from '@/components/tender/tasks-tab';
import { ActivityTab } from '@/components/tender/activity-tab';
import { AIBriefPanel } from '@/components/tender/ai-brief-panel';
import { GoNoGoPanel } from '@/components/tender/go-no-go-panel';
import { LegalTab } from '@/components/tender/legal-tab';
import { FinancialTab } from '@/components/tender/financial-tab';
import { TechnicalTabEnhanced } from '@/components/tender/technical-tab-enhanced';
import { AIAssistantButton, AIAssistantPanel } from '@/components/tender/ai-assistant-panel';
import { OutcomePanel } from '@/components/tender/outcome-panel';
import { MissingInfoPanel } from '@/components/tender/missing-info-panel';
import {
  ChevronRight,
  Pencil,
  Sparkles,
  ShieldCheck,
  Trash2,
  BarChart3,
  ClipboardList,
  FileText,
  ListTodo,
  Activity,
  Eye,
  Scale,
  Banknote,
  Wrench,
  Loader2,
} from 'lucide-react';


export default function TenderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenderId = params.id as string;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [analysisStep, setAnalysisStep] = useState<string | null>(null);
  const [fullAnalysisLangModalOpen, setFullAnalysisLangModalOpen] = useState(false);

  const utils = trpc.useUtils();
  const { toast } = useToast();

  const tenderQuery = trpc.tender.getById.useQuery(
    { id: tenderId },
    { retry: false, refetchOnWindowFocus: false }
  );

  const deleteMutation = trpc.tender.delete.useMutation({
    onSuccess: () => {
      router.push('/tenders');
    },
    onError: (err) => {
      toast({ title: 'Σφαλμα διαγραφης', description: err.message, variant: 'destructive' });
    },
  });

  const summarizeMutation = trpc.aiRoles.summarizeTender.useMutation({
    onSuccess: () => {
      utils.aiRoles.getBrief.invalidate({ tenderId });
      utils.tender.getById.invalidate({ id: tenderId });
    },
    onError: (err: any) => {
      const isPrecondition = err?.data?.code === 'PRECONDITION_FAILED';
      toast({
        title: isPrecondition ? 'Λειπουν εγγραφα' : 'Σφαλμα αναλυσης',
        description: isPrecondition
          ? 'Ανεβαστε πρωτα τα PDF του διαγωνισμου στο tab "Εγγραφα" και δοκιμαστε ξανα.'
          : err.message,
        variant: 'destructive',
      });
    },
  });

  const complianceMutation = trpc.aiRoles.updateCompliance.useMutation({
    onSuccess: () => {
      utils.tender.getById.invalidate({ id: tenderId });
    },
    onError: (err) => {
      toast({ title: 'Σφαλμα ελεγχου', description: err.message, variant: 'destructive' });
    },
  });

  const noDocsMsg = 'Ανεβαστε πρωτα τα PDF του διαγωνισμου στο tab "Εγγραφα" και δοκιμαστε ξανα.';
  const handleAiError = (title: string) => (err: any) => {
    const isPrecondition = err?.data?.code === 'PRECONDITION_FAILED';
    toast({
      title: isPrecondition ? 'Λειπουν εγγραφα' : title,
      description: isPrecondition ? noDocsMsg : err.message,
      variant: 'destructive',
    });
  };

  const extractLegalMutation = trpc.aiRoles.extractLegalClauses.useMutation({
    onError: handleAiError('Σφαλμα νομικης αναλυσης'),
  });

  const assessLegalMutation = trpc.aiRoles.assessLegalRisks.useMutation({
    onError: handleAiError('Σφαλμα αξιολογησης κινδυνων'),
  });

  const extractFinancialMutation = trpc.aiRoles.extractFinancials.useMutation({
    onError: handleAiError('Σφαλμα οικονομικης αναλυσης'),
  });

  const goNoGoMutation = trpc.aiRoles.goNoGo.useMutation({
    onError: handleAiError('Σφαλμα Go/No-Go'),
  });

  function handleRunFullAnalysis() {
    setFullAnalysisLangModalOpen(true);
  }

  async function runFullAnalysis(language: AnalysisLanguage) {
    setFullAnalysisLangModalOpen(false);
    try {
      setAnalysisStep('Αναγνωση εγγραφων & συνοψη...');
      await summarizeMutation.mutateAsync({ tenderId, language });

      setAnalysisStep('Νομικη αναλυση...');
      await extractLegalMutation.mutateAsync({ tenderId, language });
      await assessLegalMutation.mutateAsync({ tenderId });

      setAnalysisStep('Οικονομικη αναλυση...');
      await extractFinancialMutation.mutateAsync({ tenderId, language });

      setAnalysisStep('Αξιολογηση Go/No-Go...');
      await goNoGoMutation.mutateAsync({ tenderId, language });

      setAnalysisStep(null);
      utils.aiRoles.getBrief.invalidate({ tenderId });
      utils.aiRoles.getGoNoGo.invalidate({ tenderId });
      utils.aiRoles.getLegalClauses.invalidate({ tenderId });
      utils.tender.getById.invalidate({ id: tenderId });
      toast({ title: 'Η αναλυση ολοκληρωθηκε!' });
    } catch (err: any) {
      setAnalysisStep(null);
      toast({ title: 'Σφαλμα αναλυσης', description: err.message, variant: 'destructive' });
    }
  }

  const tender = (tenderQuery.data as any) ?? null;
  const isLoading = tenderQuery.isLoading;

  // Extract sourceUrl from tender notes for NoDocumentsAlert
  const sourceUrl = tender?.notes?.match(/Imported from: (https?:\/\/\S+)/)?.[1] ?? null;
  const tenderPlatform = tender?.platform ?? undefined;

  // Not found / error state
  if (!isLoading && !tender) {
    return (
      <div className="space-y-6">
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link href="/tenders" className="hover:text-foreground transition-colors cursor-pointer">
            Διαγωνισμοι
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Μη διαθεσιμο</span>
        </nav>
        <div className="text-center py-20">
          <p className="text-base font-medium text-muted-foreground">
            Ο διαγωνισμος δεν βρεθηκε
          </p>
          <Button
            variant="outline"
            className="mt-4 cursor-pointer"
            onClick={() => router.push('/tenders')}
          >
            Επιστροφη στους Διαγωνισμους
          </Button>
        </div>
      </div>
    );
  }

  // Stats — guard against null tender
  const requirementsCount = tender?.requirements?.length ?? 0;
  const tasksCount = tender?._count?.tasks ?? 0;
  const documentsCount =
    (tender?._count?.attachedDocuments ?? 0) + (tender?._count?.generatedDocuments ?? 0);

  const stats = [
    {
      label: 'Compliance Score',
      value: tender?.complianceScore != null ? `${Math.round(tender.complianceScore)}%` : '--',
      color:
        (tender?.complianceScore ?? 0) >= 75
          ? 'text-emerald-500'
          : (tender?.complianceScore ?? 0) >= 50
            ? 'text-amber-500'
            : 'text-red-500',
      icon: BarChart3,
    },
    {
      label: 'Απαιτησεις',
      value: requirementsCount.toString(),
      color: 'text-foreground',
      icon: ClipboardList,
    },
    {
      label: 'Εργασιες',
      value: tasksCount.toString(),
      color: 'text-foreground',
      icon: ListTodo,
    },
    {
      label: 'Εγγραφα',
      value: documentsCount.toString(),
      color: 'text-foreground',
      icon: FileText,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <BlurFade delay={0} inView>
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
          <Link
            href="/tenders"
            className="hover:text-foreground transition-colors cursor-pointer"
          >
            Διαγωνισμοι
          </Link>
          <ChevronRight className="h-3 w-3" />
          {isLoading ? (
            <Skeleton className="h-4 w-48" />
          ) : (
            <span className="text-foreground truncate max-w-[400px]">
              {tender?.title ?? '...'}
            </span>
          )}
        </nav>

        {/* Header */}
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-32" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight leading-tight">
                {tender?.title}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <StatusBadge type="tender" value={tender?.status} />
                <StatusBadge type="platform" value={tender?.platform} />
                {tender?.referenceNumber && (
                  <span className="text-xs font-mono text-muted-foreground">
                    {tender.referenceNumber}
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                className="cursor-pointer"
                disabled={!!analysisStep}
                onClick={handleRunFullAnalysis}
              >
                {analysisStep ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    {analysisStep}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    Αναλυση
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() => setActiveTab('overview')}
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Επεξεργασια
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                disabled={complianceMutation.isPending}
                onClick={() => {
                  complianceMutation.mutate({ tenderId });
                  setActiveTab('requirements');
                }}
              >
                {complianceMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                )}
                Ελεγχος Συμμορφωσης
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Διαγραφη
              </Button>
            </div>
          </div>
        )}
      </BlurFade>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-8">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <BlurFade key={i} delay={0.05 + i * 0.04} inView>
                <div className="rounded-xl bg-card p-5 shadow-sm ring-1 ring-white/[0.04] animate-pulse">
                  <div className="h-3 w-20 bg-muted rounded mb-3" />
                  <div className="h-7 w-14 bg-muted rounded" />
                </div>
              </BlurFade>
            ))
          : stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <BlurFade key={i} delay={0.05 + i * 0.04} inView>
                  <div className="rounded-xl bg-card p-5 shadow-sm ring-1 ring-white/[0.04]">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                        {stat.label}
                      </span>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p
                      className={cn(
                        'mt-2 text-2xl font-semibold tracking-tight tabular-nums',
                        stat.color
                      )}
                    >
                      {stat.value}
                    </p>
                  </div>
                </BlurFade>
              );
            })}
      </div>

      {/* Missing Info Panel -- always visible above tabs */}
      <MissingInfoPanel tenderId={tenderId} />

      {/* Outcome Panel -- always visible, record win/loss */}
      <OutcomePanel tenderId={tenderId} currentStatus={tender?.status || ''} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
        <TabsList className="border-b border-border/50 bg-transparent p-0 h-auto rounded-none flex-wrap gap-0">
          <AnimatedTabsTrigger value="overview" activeValue={activeTab}>
            <Eye className="h-3.5 w-3.5" />
            Επισκοπηση
          </AnimatedTabsTrigger>
          <AnimatedTabsTrigger value="requirements" activeValue={activeTab}>
            <ClipboardList className="h-3.5 w-3.5" />
            Απαιτησεις
          </AnimatedTabsTrigger>
          <AnimatedTabsTrigger value="documents" activeValue={activeTab}>
            <FileText className="h-3.5 w-3.5" />
            Εγγραφα
          </AnimatedTabsTrigger>
          <AnimatedTabsTrigger value="tasks" activeValue={activeTab}>
            <ListTodo className="h-3.5 w-3.5" />
            Εργασιες
          </AnimatedTabsTrigger>
          <AnimatedTabsTrigger value="legal" activeValue={activeTab}>
            <Scale className="h-3.5 w-3.5" />
            Νομικα & Συμβαση
          </AnimatedTabsTrigger>
          <AnimatedTabsTrigger value="financial" activeValue={activeTab}>
            <Banknote className="h-3.5 w-3.5" />
            Οικονομικα
          </AnimatedTabsTrigger>
          <AnimatedTabsTrigger value="technical" activeValue={activeTab}>
            <Wrench className="h-3.5 w-3.5" />
            Τεχνικη Προταση
          </AnimatedTabsTrigger>
          <AnimatedTabsTrigger value="activity" activeValue={activeTab}>
            <Activity className="h-3.5 w-3.5" />
            Δραστηριοτητα
          </AnimatedTabsTrigger>
        </TabsList>

        <div className="mt-6">
          {/* Overview Tab - Now includes AI Brief + Go/No-Go panels */}
          <TabsContent value="overview">
            <BlurFade delay={0.05} inView>
              {isLoading ? (
                <OverviewTabSkeleton />
              ) : (
                <div className="space-y-6">
                  {/* AI Panels Row */}
                  <div className="grid gap-4 lg:grid-cols-2">
                    <AIBriefPanel tenderId={tenderId} sourceUrl={sourceUrl} platform={tenderPlatform} />
                    <GoNoGoPanel tenderId={tenderId} sourceUrl={sourceUrl} platform={tenderPlatform} />
                  </div>

                  {/* Existing Overview Content */}
                  <OverviewTab tender={tender} />
                </div>
              )}
            </BlurFade>
          </TabsContent>

          <TabsContent value="requirements">
            <BlurFade delay={0.05} inView>
              <RequirementsTab tenderId={tenderId} />
            </BlurFade>
          </TabsContent>

          <TabsContent value="documents">
            <BlurFade delay={0.05} inView>
              <DocumentsTab tenderId={tenderId} />
            </BlurFade>
          </TabsContent>

          <TabsContent value="tasks">
            <BlurFade delay={0.05} inView>
              <TasksTab tenderId={tenderId} />
            </BlurFade>
          </TabsContent>

          {/* Legal & Contract Tab */}
          <TabsContent value="legal">
            <BlurFade delay={0.05} inView>
              <LegalTab tenderId={tenderId} sourceUrl={sourceUrl} platform={tenderPlatform} />
            </BlurFade>
          </TabsContent>

          {/* Financial Tab */}
          <TabsContent value="financial">
            <BlurFade delay={0.05} inView>
              <FinancialTab tenderId={tenderId} sourceUrl={sourceUrl} platform={tenderPlatform} />
            </BlurFade>
          </TabsContent>

          {/* Enhanced Technical Tab */}
          <TabsContent value="technical">
            <BlurFade delay={0.05} inView>
              <TechnicalTabEnhanced tenderId={tenderId} sourceUrl={sourceUrl} platform={tenderPlatform} />
            </BlurFade>
          </TabsContent>

          <TabsContent value="activity">
            <BlurFade delay={0.05} inView>
              <ActivityTab tenderId={tenderId} />
            </BlurFade>
          </TabsContent>
        </div>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Διαγραφη Διαγωνισμου</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ειστε σιγουροι οτι θελετε να διαγραψετε αυτον τον διαγωνισμο; Η ενεργεια
            αυτη ειναι μη αναστρεψιμη και θα διαγραφουν ολα τα σχετικα δεδομενα
            (απαιτησεις, εγγραφα, εργασιες).
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="cursor-pointer">
                Ακυρωση
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              className="cursor-pointer"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate({ id: tenderId })}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Διαγραφη
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating AI Assistant */}
      <AIAssistantButton onClick={() => setAssistantOpen(true)} />
      <AIAssistantPanel
        tenderId={tenderId}
        open={assistantOpen}
        onOpenChange={setAssistantOpen}
      />

      {/* Language Modal for Full Analysis */}
      <LanguageModal
        open={fullAnalysisLangModalOpen}
        onSelect={runFullAnalysis}
        onClose={() => setFullAnalysisLangModalOpen(false)}
      />
    </div>
  );
}
