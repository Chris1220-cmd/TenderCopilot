'use client';

import { useState } from 'react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/tender/status-badge';
import {
  Building2,
  Globe,
  Banknote,
  CalendarClock,
  Trophy,
  Tag,
  AlertTriangle,
  Save,
  Pencil,
  Clock,
} from 'lucide-react';

interface OverviewTabProps {
  tender: {
    id: string;
    title: string;
    contractingAuthority: string | null;
    platform: string;
    budget: number | null;
    submissionDeadline: string | Date | null;
    awardCriteria: string | null;
    cpvCodes: string[];
    complianceScore: number | null;
    notes: string | null;
    requirements?: Array<{
      id: string;
      text: string;
      category: string;
      coverageStatus: string;
      mandatory: boolean;
    }>;
  };
}

function getCountdown(deadline: string | Date | null): string {
  if (!deadline) return '--';
  const now = new Date();
  const target = typeof deadline === 'string' ? new Date(deadline) : deadline;
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return 'Εκπνοή';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days} ημέρες, ${hours} ώρες`;
  return `${hours} ώρες`;
}

function ComplianceScoreBar({ score }: { score: number | null }) {
  const value = score ?? 0;
  const color =
    value >= 75
      ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
      : value >= 50
        ? 'bg-gradient-to-r from-amber-400 to-amber-600'
        : 'bg-gradient-to-r from-red-400 to-red-600';
  const bgColor =
    value >= 75
      ? 'bg-emerald-500/10'
      : value >= 50
        ? 'bg-amber-500/10'
        : 'bg-red-500/10';
  const textColor =
    value >= 75
      ? 'text-emerald-600 dark:text-emerald-400'
      : value >= 50
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-muted-foreground">Compliance Score</span>
        <span className={cn('text-2xl font-bold tabular-nums', textColor)}>
          {score != null ? `${Math.round(score)}%` : '--'}
        </span>
      </div>
      <div className={cn('h-3 w-full overflow-hidden rounded-full', bgColor)}>
        <div
          className={cn('h-full rounded-full transition-all duration-700 ease-out', color)}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function OverviewTab({ tender }: OverviewTabProps) {
  const [notes, setNotes] = useState(tender.notes ?? '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState(tender.title);
  const [editAuthority, setEditAuthority] = useState(tender.contractingAuthority ?? '');
  const [editBudget, setEditBudget] = useState(tender.budget?.toString() ?? '');
  const [editAwardCriteria, setEditAwardCriteria] = useState(tender.awardCriteria ?? '');
  const [editCpvCodes, setEditCpvCodes] = useState(tender.cpvCodes.join(', '));

  const utils = trpc.useUtils();

  const updateMutation = trpc.tender.update.useMutation({
    onSuccess: () => {
      utils.tender.getById.invalidate({ id: tender.id });
    },
  });

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      await updateMutation.mutateAsync({ id: tender.id, notes });
    } catch {
      // silent
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleEditSave = async () => {
    try {
      await updateMutation.mutateAsync({
        id: tender.id,
        title: editTitle,
        contractingAuthority: editAuthority || null,
        budget: editBudget ? parseFloat(editBudget) : null,
        awardCriteria: editAwardCriteria || null,
        cpvCodes: editCpvCodes
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
      });
      setEditOpen(false);
    } catch {
      // silent
    }
  };

  // Top gaps: mandatory requirements with UNMAPPED or GAP status
  const topGaps = (tender.requirements ?? [])
    .filter(
      (r) =>
        r.mandatory &&
        (r.coverageStatus === 'UNMAPPED' || r.coverageStatus === 'GAP')
    )
    .slice(0, 5);

  const infoItems = [
    {
      icon: Building2,
      label: 'Αναθέτουσα Αρχή',
      value: tender.contractingAuthority || '--',
    },
    {
      icon: Globe,
      label: 'Πλατφόρμα',
      value: <StatusBadge type="platform" value={tender.platform} />,
    },
    {
      icon: Banknote,
      label: 'Προϋπολογισμός',
      value: formatCurrency(tender.budget),
    },
    {
      icon: CalendarClock,
      label: 'Προθεσμία Υποβολής',
      value: (
        <div className="flex flex-col items-end gap-0.5">
          <span>{formatDate(tender.submissionDeadline)}</span>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {getCountdown(tender.submissionDeadline)}
          </span>
        </div>
      ),
    },
    {
      icon: Trophy,
      label: 'Κριτήρια Ανάθεσης',
      value: tender.awardCriteria || '--',
    },
    {
      icon: Tag,
      label: 'Κωδικοί CPV',
      value:
        tender.cpvCodes.length > 0
          ? tender.cpvCodes.join(', ')
          : '--',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Info Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {infoItems.map((item, i) => (
          <BlurFade key={i} delay={0.05 + i * 0.06} inView>
            <GlassCard>
              <GlassCardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <item.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {item.label}
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-sm font-semibold text-right">
                  {typeof item.value === 'string' ? (
                    <span className="line-clamp-2">{item.value}</span>
                  ) : (
                    item.value
                  )}
                </div>
              </GlassCardContent>
            </GlassCard>
          </BlurFade>
        ))}
      </div>

      {/* Compliance + Top Gaps Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Compliance Score */}
        <GlassCard>
          <GlassCardContent className="p-5">
            <ComplianceScoreBar score={tender.complianceScore} />
          </GlassCardContent>
        </GlassCard>

        {/* Top Gaps */}
        <GlassCard>
          <GlassCardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold">Κύρια Κενά Συμμόρφωσης</span>
            </div>
            {topGaps.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Δεν βρέθηκαν ανοικτές υποχρεωτικές απαιτήσεις.
              </p>
            ) : (
              <ul className="space-y-2">
                {topGaps.map((gap) => (
                  <li
                    key={gap.id}
                    className="flex items-start gap-2 text-xs"
                  >
                    <StatusBadge type="coverage" value={gap.coverageStatus} className="shrink-0 mt-0.5" />
                    <span className="line-clamp-2 text-muted-foreground">
                      {gap.text}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </GlassCardContent>
        </GlassCard>
      </div>

      {/* Notes */}
      <GlassCard>
        <GlassCardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold">Σημειώσεις</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSaveNotes}
              disabled={isSavingNotes || notes === (tender.notes ?? '')}
              className="cursor-pointer h-8 gap-1.5 text-xs"
            >
              <Save className="h-3.5 w-3.5" />
              Αποθήκευση
            </Button>
          </div>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Προσθέστε σημειώσεις..."
            className="min-h-[100px] resize-none"
          />
        </GlassCardContent>
      </GlassCard>

      {/* Edit Basic Info Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="cursor-pointer gap-2"
          >
            <Pencil className="h-4 w-4" />
            Επεξεργασία Βασικών Στοιχείων
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Επεξεργασία Στοιχείων Διαγωνισμού</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Τίτλος</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-authority">Αναθέτουσα Αρχή</Label>
              <Input
                id="edit-authority"
                value={editAuthority}
                onChange={(e) => setEditAuthority(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-budget">Προϋπολογισμός (EUR)</Label>
              <Input
                id="edit-budget"
                type="number"
                value={editBudget}
                onChange={(e) => setEditBudget(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-award">Κριτήρια Ανάθεσης</Label>
              <Input
                id="edit-award"
                value={editAwardCriteria}
                onChange={(e) => setEditAwardCriteria(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cpv">Κωδικοί CPV (διαχωρισμένοι με κόμμα)</Label>
              <Input
                id="edit-cpv"
                value={editCpvCodes}
                onChange={(e) => setEditCpvCodes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="cursor-pointer">
                Ακύρωση
              </Button>
            </DialogClose>
            <Button
              onClick={handleEditSave}
              disabled={updateMutation.isPending}
              className={cn(
                'cursor-pointer',
                'bg-gradient-to-r from-indigo-600 to-violet-600',
                'hover:from-indigo-500 hover:to-violet-500',
                'border-0 text-white'
              )}
            >
              Αποθήκευση
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function OverviewTabSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <GlassCard key={i}>
            <GlassCardContent className="p-4">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-6 w-32 ml-auto" />
            </GlassCardContent>
          </GlassCard>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <GlassCardContent className="p-5">
            <Skeleton className="h-3 w-full" />
          </GlassCardContent>
        </GlassCard>
        <GlassCard>
          <GlassCardContent className="p-5">
            <Skeleton className="h-24 w-full" />
          </GlassCardContent>
        </GlassCard>
      </div>
    </div>
  );
}
