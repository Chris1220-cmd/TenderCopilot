'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
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
} from 'lucide-react';


export default function TenderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenderId = params.id as string;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  const utils = trpc.useUtils();

  const tenderQuery = trpc.tender.getById.useQuery(
    { id: tenderId },
    { retry: false, refetchOnWindowFocus: false }
  );

  const deleteMutation = trpc.tender.delete.useMutation({
    onSuccess: () => {
      router.push('/tenders');
    },
  });

  const tender = (tenderQuery.data as any) ?? null;
  const isLoading = tenderQuery.isLoading;

  // Not found / error state
  if (!isLoading && !tender) {
    return (
      <div className="space-y-6">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/tenders" className="hover:text-foreground transition-colors duration-200 cursor-pointer">
            Διαγωνισμοί
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">Μη διαθέσιμο</span>
        </nav>
        <div className="text-center py-20">
          <p className="text-lg font-medium text-muted-foreground">Ο διαγωνισμός δεν βρέθηκε</p>
          <Button variant="outline" className="mt-4 cursor-pointer" onClick={() => router.push('/tenders')}>
            Επιστροφή στους Διαγωνισμούς
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
          ? 'text-emerald-600 dark:text-emerald-400'
          : (tender?.complianceScore ?? 0) >= 50
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-red-600 dark:text-red-400',
      bgColor:
        (tender?.complianceScore ?? 0) >= 75
          ? 'bg-emerald-500/10'
          : (tender?.complianceScore ?? 0) >= 50
            ? 'bg-amber-500/10'
            : 'bg-red-500/10',
      icon: BarChart3,
    },
    {
      label: 'Απαιτήσεις',
      value: requirementsCount.toString(),
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-500/10',
      icon: ClipboardList,
    },
    {
      label: 'Εργασίες',
      value: tasksCount.toString(),
      color: 'text-violet-600 dark:text-violet-400',
      bgColor: 'bg-violet-500/10',
      icon: ListTodo,
    },
    {
      label: 'Έγγραφα',
      value: documentsCount.toString(),
      color: 'text-cyan-600 dark:text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      icon: FileText,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href="/tenders"
          className="hover:text-foreground transition-colors duration-200 cursor-pointer"
        >
          Διαγωνισμοί
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        {isLoading ? (
          <Skeleton className="h-4 w-48" />
        ) : (
          <span className="font-medium text-foreground truncate max-w-[400px]">
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
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight leading-tight">
              {tender?.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge type="tender" value={tender?.status} />
              <StatusBadge type="platform" value={tender?.platform} />
              {tender?.referenceNumber && (
                <span className="text-xs font-mono text-muted-foreground bg-muted rounded-md px-2 py-0.5">
                  {tender.referenceNumber}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer gap-1.5 h-9"
            >
              <Pencil className="h-3.5 w-3.5" />
              Επεξεργασία
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer gap-1.5 h-9"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ανάλυση AI
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer gap-1.5 h-9"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Έλεγχος Συμμόρφωσης
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer gap-1.5 h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Διαγραφή
            </Button>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-6 w-12" />
                  </div>
                </CardContent>
              </Card>
            ))
          : stats.map((stat, i) => (
              <Card
                key={i}
                className={cn(
                  'transition-all duration-200',
                  'hover:shadow-md hover:border-primary/15',
                  'bg-gradient-to-br from-background to-muted/30'
                )}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                      stat.bgColor
                    )}
                  >
                    <stat.icon className={cn('h-5 w-5', stat.color)} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className={cn('text-xl font-bold tabular-nums', stat.color)}>
                      {stat.value}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="overview" className="gap-1.5 cursor-pointer">
            <Eye className="h-3.5 w-3.5" />
            Επισκόπηση
          </TabsTrigger>
          <TabsTrigger value="requirements" className="gap-1.5 cursor-pointer">
            <ClipboardList className="h-3.5 w-3.5" />
            Απαιτήσεις
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5 cursor-pointer">
            <FileText className="h-3.5 w-3.5" />
            Έγγραφα
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5 cursor-pointer">
            <ListTodo className="h-3.5 w-3.5" />
            Εργασίες
          </TabsTrigger>
          <TabsTrigger value="legal" className="gap-1.5 cursor-pointer">
            <Scale className="h-3.5 w-3.5" />
            Νομικά & Σύμβαση
          </TabsTrigger>
          <TabsTrigger value="financial" className="gap-1.5 cursor-pointer">
            <Banknote className="h-3.5 w-3.5" />
            Οικονομικά
          </TabsTrigger>
          <TabsTrigger value="technical" className="gap-1.5 cursor-pointer">
            <Wrench className="h-3.5 w-3.5" />
            Τεχνική Πρόταση
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5 cursor-pointer">
            <Activity className="h-3.5 w-3.5" />
            Δραστηριότητα
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab - Now includes AI Brief + Go/No-Go panels */}
        <TabsContent value="overview">
          {isLoading ? (
            <OverviewTabSkeleton />
          ) : (
            <div className="space-y-6">
              {/* AI Panels Row */}
              <div className="grid gap-4 lg:grid-cols-2">
                <AIBriefPanel tenderId={tenderId} />
                <GoNoGoPanel tenderId={tenderId} />
              </div>

              {/* Existing Overview Content */}
              <OverviewTab tender={tender} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="requirements">
          <RequirementsTab tenderId={tenderId} />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsTab tenderId={tenderId} />
        </TabsContent>

        <TabsContent value="tasks">
          <TasksTab tenderId={tenderId} />
        </TabsContent>

        {/* New: Legal & Contract Tab */}
        <TabsContent value="legal">
          <LegalTab tenderId={tenderId} />
        </TabsContent>

        {/* New: Financial Tab */}
        <TabsContent value="financial">
          <FinancialTab tenderId={tenderId} />
        </TabsContent>

        {/* New: Enhanced Technical Tab */}
        <TabsContent value="technical">
          <TechnicalTabEnhanced tenderId={tenderId} />
        </TabsContent>

        <TabsContent value="activity">
          <ActivityTab tenderId={tenderId} />
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Διαγραφή Διαγωνισμού</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Είστε σίγουροι ότι θέλετε να διαγράψετε αυτόν τον διαγωνισμό; Η ενέργεια
            αυτή είναι μη αναστρέψιμη και θα διαγραφούν όλα τα σχετικά δεδομένα
            (απαιτήσεις, έγγραφα, εργασίες).
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="cursor-pointer">
                Ακύρωση
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              className="cursor-pointer"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate({ id: tenderId })}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Διαγραφή
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
    </div>
  );
}
