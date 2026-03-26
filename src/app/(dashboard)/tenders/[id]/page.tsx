'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { TenderPhaseSidebar } from '@/components/tender/tender-phase-sidebar';
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
import { FakelosTab } from '@/components/tender/fakelos-tab';
import { CriteriaTab } from '@/components/tender/criteria-tab';
import { TenderIntelligencePanel } from '@/components/tender/intelligence-panel';
import { DeadlinePlannerTab } from '@/components/tender/deadline-planner-tab';
import { useTranslation } from '@/lib/i18n';
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
  FolderCheck,
  CalendarClock,
  MessageSquare,
  Award,
  Menu,
} from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
  },
};

function DeadlineCountdown({ deadline, t }: { deadline: Date | null | undefined; t: (k: string) => string }) {
  if (!deadline) return null;
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  const text = days <= 0
    ? t('tender.deadlineCountdown.expired')
    : days === 1
      ? t('tender.deadlineCountdown.oneDay')
      : t('tender.deadlineCountdown.days').replace('{{count}}', String(days));
  const color = days <= 0 ? 'text-[#ef4444]' : days <= 3 ? 'text-[#ef4444]' : days <= 7 ? 'text-[#f59e0b]' : 'text-emerald-500';
  return (
    <span className={cn('flex items-center gap-1.5 text-sm font-semibold tabular-nums', color)}>
      <CalendarClock className="h-4 w-4" />
      {text}
    </span>
  );
}

export default function TenderDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenderId = params.id as string;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  const [analysisStep, setAnalysisStep] = useState<string | null>(null);
  const [fullAnalysisLangModalOpen, setFullAnalysisLangModalOpen] = useState(false);

  const utils = trpc.useUtils();
  const { toast } = useToast();

  const tenderQuery = trpc.tender.getById.useQuery(
    { id: tenderId },
    { retry: false, refetchOnWindowFocus: false }
  );

  const unreadClarifications = trpc.aiRoles.getUnreadClarificationCount.useQuery(
    { tenderId },
    { retry: false, refetchOnWindowFocus: false }
  );
  const unreadCount = unreadClarifications.data?.count ?? 0;

  const statusesQuery = trpc.tender.getSectionStatuses.useQuery(
    { id: tenderId },
    { retry: false, refetchOnWindowFocus: false }
  );
  const sectionStatuses = statusesQuery.data ?? {};

  const deleteMutation = trpc.tender.delete.useMutation({
    onSuccess: () => router.push('/tenders'),
    onError: (err) => toast({ title: t('tender.deleteError'), description: err.message, variant: 'destructive' }),
  });

  const summarizeMutation = trpc.aiRoles.summarizeTender.useMutation({
    onSuccess: () => {
      utils.aiRoles.getBrief.invalidate({ tenderId });
      utils.tender.getById.invalidate({ id: tenderId });
    },
    onError: (err: any) => {
      const isPrecondition = err?.data?.code === 'PRECONDITION_FAILED';
      toast({
        title: isPrecondition ? t('tender.missingDocs') : t('tender.analysisError'),
        description: isPrecondition ? t('tender.uploadPDFsFirst') : err.message,
        variant: 'destructive',
      });
    },
  });

  // ─── Background document fetch polling ─────────────────────
  // After import, documents load in the background. Poll every 5s
  // until they appear, then show a notification.
  const initialDocCount = useRef<number | null>(null);
  const docPollDone = useRef(false);

  useEffect(() => {
    const tender = tenderQuery.data;
    if (!tender || docPollDone.current) return;

    const currentCount = tender._count?.attachedDocuments ?? 0;

    // First load: save initial count
    if (initialDocCount.current === null) {
      initialDocCount.current = currentCount;
      // If already has documents, no need to poll
      if (currentCount > 0) {
        docPollDone.current = true;
        return;
      }
    }

    // Documents arrived!
    if (currentCount > 0 && initialDocCount.current === 0) {
      docPollDone.current = true;
      toast({
        title: '📄 Τα έγγραφα φορτώθηκαν',
        description: `${currentCount} έγγραφ${currentCount === 1 ? 'ο' : 'α'} βρέθηκαν και είναι έτοιμα για ανάλυση.`,
      });
      return;
    }

    // Still waiting — poll every 5s
    if (currentCount === 0) {
      const timer = setTimeout(() => {
        tenderQuery.refetch();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [tenderQuery.data]);

  const complianceMutation = trpc.aiRoles.updateCompliance.useMutation({
    onSuccess: () => utils.tender.getById.invalidate({ id: tenderId }),
    onError: (err) => toast({ title: t('tender.complianceError'), description: err.message, variant: 'destructive' }),
  });

  const handleAiError = (titleKey: string) => (err: any) => {
    const isPrecondition = err?.data?.code === 'PRECONDITION_FAILED';
    toast({ title: isPrecondition ? t('tender.missingDocs') : t(titleKey), description: isPrecondition ? t('tender.uploadPDFsFirst') : err.message, variant: 'destructive' });
  };

  const extractRequirementsMutation = trpc.aiRoles.extractRequirements.useMutation({ onError: handleAiError('tender.requirementsError') });
  const extractLegalMutation = trpc.aiRoles.extractLegalClauses.useMutation({ onError: handleAiError('tender.legalError') });
  const assessLegalMutation = trpc.aiRoles.assessLegalRisks.useMutation({ onError: handleAiError('tender.riskError') });
  const extractFinancialMutation = trpc.aiRoles.extractFinancials.useMutation({ onError: handleAiError('tender.financialError') });
  const goNoGoMutation = trpc.aiRoles.goNoGo.useMutation({ onError: handleAiError('tender.goNoGoError') });
  const generateDeadlinePlanMutation = trpc.deadlinePlan.generate.useMutation({
    onError: handleAiError('deadline.error'),
  });
  const analyzeSubcontractorsMutation = trpc.aiRoles.analyzeSubcontractorNeeds.useMutation({
    onError: handleAiError('tender.subcontractorError'),
  });

  function handleRunFullAnalysis() {
    setFullAnalysisLangModalOpen(true);
  }

  async function runFullAnalysis(language: AnalysisLanguage) {
    setFullAnalysisLangModalOpen(false);
    try {
      setAnalysisStep(t('tender.readingDocs'));
      await summarizeMutation.mutateAsync({ tenderId, language });
      setAnalysisStep('Εξαγωγή απαιτήσεων & κριτηρίων...');
      await extractRequirementsMutation.mutateAsync({ tenderId });
      setAnalysisStep(t('tender.legalAnalysis'));
      await extractLegalMutation.mutateAsync({ tenderId, language });
      await assessLegalMutation.mutateAsync({ tenderId });
      setAnalysisStep(t('tender.financialAnalysis'));
      await extractFinancialMutation.mutateAsync({ tenderId, language });
      setAnalysisStep(t('tender.subcontractorAnalysis'));
      await analyzeSubcontractorsMutation.mutateAsync({ tenderId, language });
      setAnalysisStep(t('tender.goNoGoAssessment'));
      await goNoGoMutation.mutateAsync({ tenderId, language });
      setAnalysisStep(t('deadline.createTimeline') + '...');
      await generateDeadlinePlanMutation.mutateAsync({ tenderId });
      setAnalysisStep(null);
      utils.aiRoles.getBrief.invalidate({ tenderId });
      utils.aiRoles.getGoNoGo.invalidate({ tenderId });
      utils.aiRoles.getLegalClauses.invalidate({ tenderId });
      utils.tender.getById.invalidate({ id: tenderId });
      utils.fakelos.getReport.invalidate({ tenderId });
      utils.deadlinePlan.listByTender.invalidate({ tenderId });
      toast({ title: t('tender.analysisComplete') });
    } catch (err: any) {
      setAnalysisStep(null);
      toast({ title: t('tender.analysisError'), description: err.message, variant: 'destructive' });
    }
  }

  const tender = (tenderQuery.data as any) ?? null;
  const isLoading = tenderQuery.isLoading;
  const sourceUrl = tender?.notes?.match(/Imported from: (https?:\/\/\S+)/)?.[1] ?? null;
  const tenderPlatform = tender?.platform ?? undefined;

  if (!isLoading && !tender) {
    return (
      <div className="space-y-6">
        <nav className="flex items-center gap-1.5 text-caption">
          <Link href="/tenders" className="hover:text-foreground transition-colors cursor-pointer">{t('tender.breadcrumb')}</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{t('tender.notAvailable')}</span>
        </nav>
        <div className="text-center py-20">
          <p className="text-body text-muted-foreground">{t('tender.notFound')}</p>
          <Button variant="outline" className="mt-4 cursor-pointer" onClick={() => router.push('/tenders')}>
            {t('tender.backToTenders')}
          </Button>
        </div>
      </div>
    );
  }

  const requirementsCount = tender?.requirements?.length ?? 0;
  const tasksCount = tender?._count?.tasks ?? 0;
  const documentsCount = (tender?._count?.attachedDocuments ?? 0) + (tender?._count?.generatedDocuments ?? 0);

  const stats = [
    {
      label: t('tender.complianceScore'),
      value: tender?.complianceScore != null ? `${Math.round(tender.complianceScore)}%` : '--',
      color: (tender?.complianceScore ?? 0) >= 75 ? 'text-emerald-500' : (tender?.complianceScore ?? 0) >= 50 ? 'text-amber-500' : 'text-red-500',
      icon: BarChart3,
    },
    { label: t('tender.requirements'), value: requirementsCount.toString(), color: 'text-foreground', icon: ClipboardList },
    { label: t('tender.tasks'), value: tasksCount.toString(), color: 'text-foreground', icon: ListTodo },
    { label: t('tender.documents'), value: documentsCount.toString(), color: 'text-foreground', icon: FileText },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Breadcrumb + Header */}
      <motion.div variants={itemVariants}>
        <nav className="flex items-center gap-1.5 text-caption mb-4">
          <Link href="/tenders" className="hover:text-foreground transition-colors cursor-pointer">{t('tender.breadcrumb')}</Link>
          <ChevronRight className="h-3 w-3" />
          {isLoading ? (
            <Skeleton className="h-4 w-48" />
          ) : (
            <span className="text-foreground truncate max-w-[400px]">{tender?.title ?? '...'}</span>
          )}
        </nav>

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
              <h1 className="text-headline text-foreground leading-tight">{tender?.title}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <StatusBadge type="tender" value={tender?.status} />
                <StatusBadge type="platform" value={tender?.platform} />
                {tender?.referenceNumber && (
                  <span className="text-xs font-mono text-muted-foreground">{tender.referenceNumber}</span>
                )}
                <DeadlineCountdown deadline={tender?.submissionDeadline} t={t} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-sm"
                disabled={!!analysisStep}
                onClick={handleRunFullAnalysis}
              >
                {analysisStep ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />{analysisStep}</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5" />{t('tender.analyze')}</>
                )}
              </Button>
              <Button variant="outline" size="sm" className="cursor-pointer border-border/60" onClick={() => setActiveTab('overview')}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />{t('tender.edit')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer border-border/60"
                disabled={complianceMutation.isPending}
                onClick={() => { complianceMutation.mutate({ tenderId }); setActiveTab('requirements'); }}
              >
                {complianceMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />}
                {t('tender.complianceCheck')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer text-destructive hover:text-destructive hover:bg-destructive/10 border-border/60"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />{t('tender.delete')}
              </Button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <motion.div key={i} variants={itemVariants}>
                <div className="rounded-xl border border-border/60 bg-card p-5 animate-pulse">
                  <div className="h-3 w-20 bg-muted rounded mb-3" />
                  <div className="h-7 w-14 bg-muted rounded" />
                </div>
              </motion.div>
            ))
          : stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div key={i} variants={itemVariants}>
                  <div className="group rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/20">
                    <div className="flex items-center justify-between">
                      <span className="text-overline">{stat.label}</span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/[0.08] text-primary/70">
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                    <p className={cn('mt-2 text-2xl font-semibold tracking-tight tabular-nums', stat.color)}>
                      {stat.value}
                    </p>
                  </div>
                </motion.div>
              );
            })}
      </div>

      {/* Missing Info + Outcome Panels */}
      <MissingInfoPanel tenderId={tenderId} />
      <OutcomePanel tenderId={tenderId} currentStatus={tender?.status || ''} />

      {/* Sidebar + Content Layout */}
      <motion.div variants={itemVariants} className="flex min-h-[600px] rounded-xl border border-border/40 bg-card/30 overflow-hidden">
        {/* Sidebar - hidden on mobile */}
        <div className="hidden lg:flex">
          <TenderPhaseSidebar
            activeSection={activeTab}
            onSectionChange={setActiveTab}
            statuses={sectionStatuses}
            unreadClarifications={unreadCount}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Mobile section toggle */}
          <div className="lg:hidden border-b border-border/40 px-4 py-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 cursor-pointer">
                  <Menu className="h-4 w-4" />
                  {t('tender.sidebar.toggle')}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[260px] p-0">
                <TenderPhaseSidebar
                  activeSection={activeTab}
                  onSectionChange={setActiveTab}
                  statuses={sectionStatuses}
                  unreadClarifications={unreadCount}
                />
              </SheetContent>
            </Sheet>
          </div>

          {/* Tab content with crossfade */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] as const }}
                >
                <TabsContent value="overview" forceMount={activeTab === 'overview' ? true : undefined}>
                  {isLoading ? (
                    <OverviewTabSkeleton />
                  ) : (
                    <div className="space-y-6">
                      {unreadCount > 0 && (
                        <div
                          onClick={() => setActiveTab('legal')}
                          className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm cursor-pointer hover:bg-amber-500/15 transition-colors"
                        >
                          <MessageSquare className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span className="text-amber-700 dark:text-amber-300">
                            {t('clarifications.newUnread').replace('{{count}}', String(unreadCount))} — {t('clarifications.seeInLegal')}
                          </span>
                        </div>
                      )}
                      <div className="grid gap-4 lg:grid-cols-2">
                        <AIBriefPanel tenderId={tenderId} sourceUrl={sourceUrl} platform={tenderPlatform} />
                        <GoNoGoPanel tenderId={tenderId} sourceUrl={sourceUrl} platform={tenderPlatform} />
                      </div>
                      <TenderIntelligencePanel tenderId={tenderId} />
                      <OverviewTab tender={tender} />
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="requirements" forceMount={activeTab === 'requirements' ? true : undefined}>
                  <RequirementsTab tenderId={tenderId} />
                </TabsContent>
                <TabsContent value="documents" forceMount={activeTab === 'documents' ? true : undefined}>
                  <DocumentsTab tenderId={tenderId} />
                </TabsContent>
                <TabsContent value="criteria" forceMount={activeTab === 'criteria' ? true : undefined}>
                  <CriteriaTab tenderId={tenderId} />
                </TabsContent>
                <TabsContent value="fakelos" forceMount={activeTab === 'fakelos' ? true : undefined}>
                  <FakelosTab tenderId={tenderId} />
                </TabsContent>
                <TabsContent value="deadline" forceMount={activeTab === 'deadline' ? true : undefined}>
                  <div className="p-6">
                    <DeadlinePlannerTab
                      tenderId={tenderId}
                      submissionDeadline={tender?.submissionDeadline}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="tasks" forceMount={activeTab === 'tasks' ? true : undefined}>
                  <TasksTab tenderId={tenderId} />
                </TabsContent>
                <TabsContent value="legal" forceMount={activeTab === 'legal' ? true : undefined}>
                  <LegalTab tenderId={tenderId} sourceUrl={sourceUrl} platform={tenderPlatform} />
                </TabsContent>
                <TabsContent value="financial" forceMount={activeTab === 'financial' ? true : undefined}>
                  <FinancialTab tenderId={tenderId} sourceUrl={sourceUrl} platform={tenderPlatform} />
                </TabsContent>
                <TabsContent value="technical" forceMount={activeTab === 'technical' ? true : undefined}>
                  <TechnicalTabEnhanced tenderId={tenderId} sourceUrl={sourceUrl} platform={tenderPlatform} />
                </TabsContent>
                <TabsContent value="activity" forceMount={activeTab === 'activity' ? true : undefined}>
                  <ActivityTab tenderId={tenderId} />
                </TabsContent>
              </motion.div>
              </AnimatePresence>
            </div>
          </Tabs>
        </div>
      </motion.div>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t('tender.deleteTitle')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('tender.deleteConfirm')}
          </p>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" className="cursor-pointer">{t('tender.cancel')}</Button></DialogClose>
            <Button variant="destructive" className="cursor-pointer" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate({ id: tenderId })}>
              <Trash2 className="h-4 w-4 mr-1.5" />{t('tender.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Assistant */}
      <AIAssistantButton onClick={() => setAssistantOpen(true)} />
      <AIAssistantPanel tenderId={tenderId} open={assistantOpen} onOpenChange={setAssistantOpen} />

      {/* Language Modal */}
      <LanguageModal open={fullAnalysisLangModalOpen} onSelect={runFullAnalysis} onClose={() => setFullAnalysisLangModalOpen(false)} />
    </motion.div>
  );
}
