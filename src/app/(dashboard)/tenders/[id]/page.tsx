'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsContent } from '@/components/ui/tabs';
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
    onSuccess: () => router.push('/tenders'),
    onError: (err) => toast({ title: 'Σφαλμα διαγραφης', description: err.message, variant: 'destructive' }),
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
        description: isPrecondition ? 'Ανεβαστε πρωτα τα PDF του διαγωνισμου στο tab "Εγγραφα" και δοκιμαστε ξανα.' : err.message,
        variant: 'destructive',
      });
    },
  });

  const complianceMutation = trpc.aiRoles.updateCompliance.useMutation({
    onSuccess: () => utils.tender.getById.invalidate({ id: tenderId }),
    onError: (err) => toast({ title: 'Σφαλμα ελεγχου', description: err.message, variant: 'destructive' }),
  });

  const noDocsMsg = 'Ανεβαστε πρωτα τα PDF του διαγωνισμου στο tab "Εγγραφα" και δοκιμαστε ξανα.';
  const handleAiError = (title: string) => (err: any) => {
    const isPrecondition = err?.data?.code === 'PRECONDITION_FAILED';
    toast({ title: isPrecondition ? 'Λειπουν εγγραφα' : title, description: isPrecondition ? noDocsMsg : err.message, variant: 'destructive' });
  };

  const extractLegalMutation = trpc.aiRoles.extractLegalClauses.useMutation({ onError: handleAiError('Σφαλμα νομικης αναλυσης') });
  const assessLegalMutation = trpc.aiRoles.assessLegalRisks.useMutation({ onError: handleAiError('Σφαλμα αξιολογησης κινδυνων') });
  const extractFinancialMutation = trpc.aiRoles.extractFinancials.useMutation({ onError: handleAiError('Σφαλμα οικονομικης αναλυσης') });
  const goNoGoMutation = trpc.aiRoles.goNoGo.useMutation({ onError: handleAiError('Σφαλμα Go/No-Go') });

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
  const sourceUrl = tender?.notes?.match(/Imported from: (https?:\/\/\S+)/)?.[1] ?? null;
  const tenderPlatform = tender?.platform ?? undefined;

  if (!isLoading && !tender) {
    return (
      <div className="space-y-6">
        <nav className="flex items-center gap-1.5 text-caption">
          <Link href="/tenders" className="hover:text-foreground transition-colors cursor-pointer">Διαγωνισμοι</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Μη διαθεσιμο</span>
        </nav>
        <div className="text-center py-20">
          <p className="text-body text-muted-foreground">Ο διαγωνισμος δεν βρεθηκε</p>
          <Button variant="outline" className="mt-4 cursor-pointer" onClick={() => router.push('/tenders')}>
            Επιστροφη στους Διαγωνισμους
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
      label: 'Compliance Score',
      value: tender?.complianceScore != null ? `${Math.round(tender.complianceScore)}%` : '--',
      color: (tender?.complianceScore ?? 0) >= 75 ? 'text-emerald-500' : (tender?.complianceScore ?? 0) >= 50 ? 'text-amber-500' : 'text-red-500',
      icon: BarChart3,
    },
    { label: 'Απαιτησεις', value: requirementsCount.toString(), color: 'text-foreground', icon: ClipboardList },
    { label: 'Εργασιες', value: tasksCount.toString(), color: 'text-foreground', icon: ListTodo },
    { label: 'Εγγραφα', value: documentsCount.toString(), color: 'text-foreground', icon: FileText },
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
          <Link href="/tenders" className="hover:text-foreground transition-colors cursor-pointer">Διαγωνισμοι</Link>
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
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                className="gap-2 bg-gradient-to-r from-primary to-accent text-white hover:opacity-90 cursor-pointer shadow-sm"
                disabled={!!analysisStep}
                onClick={handleRunFullAnalysis}
              >
                {analysisStep ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />{analysisStep}</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5" />Αναλυση</>
                )}
              </Button>
              <Button variant="outline" size="sm" className="cursor-pointer border-border/60" onClick={() => setActiveTab('overview')}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />Επεξεργασια
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer border-border/60"
                disabled={complianceMutation.isPending}
                onClick={() => { complianceMutation.mutate({ tenderId }); setActiveTab('requirements'); }}
              >
                {complianceMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />}
                Ελεγχος Συμμορφωσης
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer text-destructive hover:text-destructive hover:bg-destructive/10 border-border/60"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />Διαγραφη
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

      {/* Tabs */}
      <motion.div variants={itemVariants}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="border-b border-border/50 bg-transparent p-0 h-auto rounded-none flex-wrap gap-0">
            <AnimatedTabsTrigger value="overview" activeValue={activeTab}><Eye className="h-3.5 w-3.5" />Επισκοπηση</AnimatedTabsTrigger>
            <AnimatedTabsTrigger value="requirements" activeValue={activeTab}><ClipboardList className="h-3.5 w-3.5" />Απαιτησεις</AnimatedTabsTrigger>
            <AnimatedTabsTrigger value="documents" activeValue={activeTab}><FileText className="h-3.5 w-3.5" />Εγγραφα</AnimatedTabsTrigger>
            <AnimatedTabsTrigger value="tasks" activeValue={activeTab}><ListTodo className="h-3.5 w-3.5" />Εργασιες</AnimatedTabsTrigger>
            <AnimatedTabsTrigger value="legal" activeValue={activeTab}><Scale className="h-3.5 w-3.5" />Νομικα & Συμβαση</AnimatedTabsTrigger>
            <AnimatedTabsTrigger value="financial" activeValue={activeTab}><Banknote className="h-3.5 w-3.5" />Οικονομικα</AnimatedTabsTrigger>
            <AnimatedTabsTrigger value="technical" activeValue={activeTab}><Wrench className="h-3.5 w-3.5" />Τεχνικη Προταση</AnimatedTabsTrigger>
            <AnimatedTabsTrigger value="activity" activeValue={activeTab}><Activity className="h-3.5 w-3.5" />Δραστηριοτητα</AnimatedTabsTrigger>
          </TabsList>

          {/* Tab content with crossfade */}
          <div className="mt-6">
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
                      <div className="grid gap-4 lg:grid-cols-2">
                        <AIBriefPanel tenderId={tenderId} sourceUrl={sourceUrl} platform={tenderPlatform} />
                        <GoNoGoPanel tenderId={tenderId} sourceUrl={sourceUrl} platform={tenderPlatform} />
                      </div>
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
      </motion.div>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Διαγραφη Διαγωνισμου</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ειστε σιγουροι οτι θελετε να διαγραψετε αυτον τον διαγωνισμο; Η ενεργεια αυτη ειναι μη αναστρεψιμη.
          </p>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" className="cursor-pointer">Ακυρωση</Button></DialogClose>
            <Button variant="destructive" className="cursor-pointer" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate({ id: tenderId })}>
              <Trash2 className="h-4 w-4 mr-1.5" />Διαγραφη
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
