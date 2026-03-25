'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { useTranslation } from '@/lib/i18n';
import { businessDaysBetween } from '@/lib/deadline-calculator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  GlassCard,
  GlassCardContent,
} from '@/components/ui/glass-card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  Lightbulb,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// ─── Types ────────────────────────────────────────────────────
interface DeadlinePlannerTabProps {
  tenderId: string;
  submissionDeadline: string | Date | null;
}

type Urgency = 'OVERDUE' | 'URGENT' | 'PENDING' | 'OBTAINED';

interface PlanItem {
  id: string;
  documentType: string;
  title: string;
  description: string | null;
  envelope: string | null;
  leadTimeDays: number;
  validityDays: number | null;
  latestStartDate: Date | string;
  optimalStartDate: Date | string;
  dueDate: Date | string;
  status: string;
  source: string | null;
  isMandatory: boolean;
  isAiGenerated: boolean;
  legalDocId: string | null;
  certificate?: { id: string; name: string } | null;
  legalDoc?: { id: string; type: string; name: string | null } | null;
}

// ─── Animation Variants ──────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
} as const;

// ─── Helpers ─────────────────────────────────────────────────
const URGENT_THRESHOLD_DAYS = 5;

function getDisplayUrgency(item: PlanItem): Urgency {
  if (item.status === 'OBTAINED') return 'OBTAINED';
  if (item.status === 'OVERDUE' || item.status === 'EXPIRED') return 'OVERDUE';

  const latestStart =
    typeof item.latestStartDate === 'string'
      ? new Date(item.latestStartDate)
      : item.latestStartDate;
  const now = new Date();

  if (latestStart < now) return 'OVERDUE';

  const daysUntilStart = businessDaysBetween(now, latestStart);
  if (daysUntilStart <= URGENT_THRESHOLD_DAYS) return 'URGENT';

  return 'PENDING';
}

const urgencyConfig: Record<
  Urgency,
  { dot: string; bg: string; border: string; text: string }
> = {
  OVERDUE: {
    dot: 'bg-[#ef4444]',
    bg: 'bg-[#ef4444]/8',
    border: 'border-[#ef4444]/20',
    text: 'text-[#ef4444]',
  },
  URGENT: {
    dot: 'bg-[#f59e0b]',
    bg: 'bg-[#f59e0b]/8',
    border: 'border-[#f59e0b]/20',
    text: 'text-[#f59e0b]',
  },
  PENDING: {
    dot: 'bg-[#48A4D6]',
    bg: 'bg-[#48A4D6]/8',
    border: 'border-[#48A4D6]/20',
    text: 'text-[#48A4D6]',
  },
  OBTAINED: {
    dot: 'bg-[#22c55e]',
    bg: 'bg-[#22c55e]/8',
    border: 'border-[#22c55e]/20',
    text: 'text-[#22c55e]',
  },
};

const envelopeKeys: Record<string, string> = {
  A: 'deadline.envelopeA',
  B: 'deadline.envelopeB',
  C: 'deadline.envelopeC',
};

function getActionForUrgency(
  urgency: Urgency,
  t: (key: string) => string,
): { label: string; variant: 'default' | 'outline' | 'ghost' } {
  switch (urgency) {
    case 'OVERDUE':
      return { label: t('deadline.requestNow'), variant: 'default' };
    case 'URGENT':
      return { label: t('deadline.schedule'), variant: 'default' };
    case 'PENDING':
      return { label: t('deadline.schedule'), variant: 'outline' };
    case 'OBTAINED':
      return { label: t('deadline.renew'), variant: 'ghost' };
  }
}

function getTimelineLabel(item: PlanItem, t: (key: string) => string): string {
  const latestStart =
    typeof item.latestStartDate === 'string'
      ? new Date(item.latestStartDate)
      : item.latestStartDate;
  const now = new Date();
  const diff = businessDaysBetween(now, latestStart);

  if (latestStart < now) {
    const overdueDays = businessDaysBetween(latestStart, now);
    return t('deadline.overdueBy').replace('{{days}}', String(overdueDays));
  }
  return t('deadline.inDays').replace('{{days}}', String(diff));
}

// ─── Status Summary Card ─────────────────────────────────────
function StatusCard({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: string;
}) {
  return (
    <div className={cn('bg-card border border-border/60 rounded-xl p-4')}>
      <div className="flex items-center gap-2.5">
        <div
          className={cn('h-2.5 w-2.5 rounded-full', color)}
        />
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold tabular-nums mt-1.5 ml-5">{count}</p>
    </div>
  );
}

// ─── Timeline Item ───────────────────────────────────────────
function TimelineItem({
  item,
  urgency,
  t,
  onUpdateStatus,
  onRemove,
  isUpdating,
}: {
  item: PlanItem;
  urgency: Urgency;
  t: (key: string) => string;
  onUpdateStatus: (itemId: string, status: string) => void;
  onRemove: (itemId: string) => void;
  isUpdating: boolean;
}) {
  const config = urgencyConfig[urgency];
  const action = getActionForUrgency(urgency, t);
  const timelineLabel = getTimelineLabel(item, t);

  return (
    <motion.div variants={itemVariants} className="group">
      <div
        className={cn(
          'bg-card border border-border/60 rounded-xl p-4',
          'transition-colors duration-200',
        )}
      >
        <div className="flex items-start gap-3">
          {/* Status dot */}
          <div className="flex flex-col items-center pt-1.5">
            <div className={cn('h-3 w-3 rounded-full', config.dot)} />
            <div className="w-px h-full bg-border/40 mt-1" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {item.title}
                </p>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {item.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1.5">
                  {item.leadTimeDays > 0 && (
                    <span className="text-[10px] text-muted-foreground/70 tabular-nums">
                      {item.leadTimeDays} {t('deadline.leadTime')}
                    </span>
                  )}
                  {item.validityDays && (
                    <span className="text-[10px] text-muted-foreground/70 tabular-nums">
                      {item.validityDays}d {t('deadline.validity')}
                    </span>
                  )}
                  {item.source && (
                    <span className="text-[10px] text-muted-foreground/50 font-mono">
                      {item.source}
                    </span>
                  )}
                </div>
              </div>

              {/* Timeline badge + action */}
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={cn(
                    'text-[10px] font-medium px-2 py-0.5 rounded-full',
                    config.bg,
                    config.text,
                  )}
                >
                  {timelineLabel}
                </span>

                {urgency !== 'OBTAINED' ? (
                  <Button
                    size="sm"
                    variant={action.variant}
                    className={cn(
                      'cursor-pointer h-7 text-[10px] px-2.5',
                      urgency === 'OVERDUE' &&
                        'bg-[#ef4444] text-white hover:bg-[#ef4444]/90 border-0',
                      urgency === 'URGENT' &&
                        'bg-[#f59e0b] text-white hover:bg-[#f59e0b]/90 border-0',
                    )}
                    disabled={isUpdating}
                    onClick={() => onUpdateStatus(item.id, 'OBTAINED')}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {action.label}
                  </Button>
                ) : (
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#22c55e]" />
                  </div>
                )}

                {/* Delete button for custom items */}
                {!item.isAiGenerated && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="cursor-pointer h-7 w-7 p-0 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    disabled={isUpdating}
                    onClick={() => onRemove(item.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Envelope Section ────────────────────────────────────────
function EnvelopeSection({
  title,
  items,
  t,
  onUpdateStatus,
  onRemove,
  isUpdating,
}: {
  title: string;
  items: PlanItem[];
  t: (key: string) => string;
  onUpdateStatus: (itemId: string, status: string) => void;
  onRemove: (itemId: string) => void;
  isUpdating: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const obtainedCount = items.filter(
    (i) => getDisplayUrgency(i) === 'OBTAINED',
  ).length;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="cursor-pointer flex items-center justify-between w-full group/section"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {obtainedCount}/{items.length}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground transition-transform" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-2"
            >
              {items.map((item) => (
                <TimelineItem
                  key={item.id}
                  item={item}
                  urgency={getDisplayUrgency(item)}
                  t={t}
                  onUpdateStatus={onUpdateStatus}
                  onRemove={onRemove}
                  isUpdating={isUpdating}
                />
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Add Custom Item Dialog ──────────────────────────────────
function AddCustomDialog({
  open,
  onOpenChange,
  onAdd,
  isPending,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (data: {
    title: string;
    documentType: string;
    envelope: 'A' | 'B' | 'C' | null;
    leadTimeDays: number;
  }) => void;
  isPending: boolean;
  t: (key: string) => string;
}) {
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [envelope, setEnvelope] = useState<string>('none');
  const [leadTimeDays, setLeadTimeDays] = useState('0');

  const handleSubmit = () => {
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      documentType: documentType.trim() || title.trim(),
      envelope: envelope === 'none' ? null : (envelope as 'A' | 'B' | 'C'),
      leadTimeDays: parseInt(leadTimeDays, 10) || 0,
    });
    setTitle('');
    setDocumentType('');
    setEnvelope('none');
    setLeadTimeDays('0');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('deadline.addCustom')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="custom-title">{t('deadline.itemTitle')}</Label>
            <Input
              id="custom-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-envelope">{t('deadline.envelopeLabel')}</Label>
            <Select value={envelope} onValueChange={setEnvelope}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="cursor-pointer">--</SelectItem>
                <SelectItem value="A" className="cursor-pointer">{t('deadline.envelopeA')}</SelectItem>
                <SelectItem value="B" className="cursor-pointer">{t('deadline.envelopeB')}</SelectItem>
                <SelectItem value="C" className="cursor-pointer">{t('deadline.envelopeC')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-lead">{t('deadline.leadTimeLabel')}</Label>
            <Input
              id="custom-lead"
              type="number"
              min={0}
              value={leadTimeDays}
              onChange={(e) => setLeadTimeDays(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="cursor-pointer">
              {t('deadline.cancel')}
            </Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !title.trim()}
            className={cn(
              'cursor-pointer',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'border-0',
            )}
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {t('deadline.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ──────────────────────────────────────────
export function DeadlinePlannerTab({
  tenderId,
  submissionDeadline,
}: DeadlinePlannerTabProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const utils = trpc.useUtils();

  // ─── Queries ─────────────────────────────────────────────
  const {
    data: items,
    isLoading,
    refetch,
  } = trpc.deadlinePlan.listByTender.useQuery(
    { tenderId },
    { enabled: !!tenderId },
  );

  // ─── Mutations ───────────────────────────────────────────
  const generateMutation = trpc.deadlinePlan.generate.useMutation({
    onSuccess: (result) => {
      toast({
        title: t('deadline.generated').replace('{{count}}', String(result.created)),
      });
      if (result.critical > 0) {
        toast({
          title: t('deadline.criticalAlert').replace(
            '{{count}}',
            String(result.critical),
          ),
          variant: 'destructive',
        });
      }
      refetch();
    },
    onError: () => {
      toast({ title: t('deadline.error'), variant: 'destructive' });
    },
  });

  const updateStatusMutation = trpc.deadlinePlan.updateStatus.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const addCustomMutation = trpc.deadlinePlan.addCustomItem.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const removeMutation = trpc.deadlinePlan.removeItem.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const isUpdating =
    updateStatusMutation.isPending ||
    removeMutation.isPending;

  // ─── Derived data ────────────────────────────────────────
  const deadline = submissionDeadline
    ? typeof submissionDeadline === 'string'
      ? new Date(submissionDeadline)
      : submissionDeadline
    : null;

  const remainingDays = deadline
    ? businessDaysBetween(new Date(), deadline)
    : null;

  const itemsWithUrgency = useMemo(() => {
    if (!items) return [];
    return items.map((item) => ({
      ...item,
      urgency: getDisplayUrgency(item as unknown as PlanItem),
    }));
  }, [items]);

  const counts = useMemo(() => {
    const c = { overdue: 0, urgent: 0, onTrack: 0, obtained: 0 };
    for (const item of itemsWithUrgency) {
      switch (item.urgency) {
        case 'OVERDUE':
          c.overdue++;
          break;
        case 'URGENT':
          c.urgent++;
          break;
        case 'PENDING':
          c.onTrack++;
          break;
        case 'OBTAINED':
          c.obtained++;
          break;
      }
    }
    return c;
  }, [itemsWithUrgency]);

  const readyPercent =
    itemsWithUrgency.length > 0
      ? Math.round((counts.obtained / itemsWithUrgency.length) * 100)
      : 0;

  // Group by envelope
  const grouped = useMemo(() => {
    const groups: Record<string, PlanItem[]> = { A: [], B: [], C: [], other: [] };
    for (const item of itemsWithUrgency) {
      const env = (item as unknown as PlanItem).envelope;
      if (env && groups[env]) {
        groups[env].push(item as unknown as PlanItem);
      } else {
        groups.other.push(item as unknown as PlanItem);
      }
    }
    return groups;
  }, [itemsWithUrgency]);

  const hasOverdue = counts.overdue > 0;

  // ─── Handlers ────────────────────────────────────────────
  const handleGenerate = () => {
    generateMutation.mutate({ tenderId });
  };

  const handleUpdateStatus = (itemId: string, status: string) => {
    updateStatusMutation.mutate({
      itemId,
      status: status as 'PENDING' | 'IN_PROGRESS' | 'OBTAINED' | 'EXPIRED' | 'OVERDUE',
    });
  };

  const handleRemove = (itemId: string) => {
    removeMutation.mutate({ itemId });
  };

  const handleAddCustom = (data: {
    title: string;
    documentType: string;
    envelope: 'A' | 'B' | 'C' | null;
    leadTimeDays: number;
  }) => {
    addCustomMutation.mutate({
      tenderId,
      documentType: data.documentType,
      title: data.title,
      envelope: data.envelope,
      leadTimeDays: data.leadTimeDays,
    });
  };

  // ─── No deadline state ───────────────────────────────────
  if (!submissionDeadline) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <CalendarClock className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <p className="text-sm text-muted-foreground">{t('deadline.noDeadline')}</p>
      </div>
    );
  }

  // ─── Loading state ──────────────────────────────────────
  if (isLoading) {
    return <DeadlinePlannerTabSkeleton />;
  }

  // ─── Empty state ─────────────────────────────────────────
  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <CalendarClock className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <p className="text-sm font-medium text-foreground mb-1">
          {t('deadline.noTimeline')}
        </p>
        <p className="text-xs text-muted-foreground mb-6 max-w-sm">
          {t('deadline.deadline')}: {formatDate(submissionDeadline)}
        </p>
        <Button
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          className={cn(
            'cursor-pointer gap-2',
            'bg-primary text-primary-foreground hover:bg-primary/90 border-0',
          )}
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CalendarClock className="h-4 w-4" />
          )}
          {t('deadline.createTimeline')}
        </Button>
      </div>
    );
  }

  // ─── Main render ─────────────────────────────────────────
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* ── Header ────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {t('deadline.title')}
            </h3>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {t('deadline.deadline')}: {formatDate(deadline)}
              </span>
              {remainingDays !== null && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t('deadline.remaining')}: {remainingDays} {t('deadline.businessDays')}
                </span>
              )}
              <span className="text-xs font-medium text-[#48A4D6] tabular-nums">
                {readyPercent}% {t('deadline.ready')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer gap-1.5 h-8 text-xs"
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {t('deadline.aiAnalysis')}
            </Button>
            <Button
              size="sm"
              className={cn(
                'cursor-pointer gap-1.5 h-8 text-xs',
                'bg-primary text-primary-foreground hover:bg-primary/90 border-0',
              )}
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              {t('deadline.addCustom')}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ── Status Summary ────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatusCard
            count={counts.overdue}
            label={t('deadline.overdue')}
            color="bg-[#ef4444]"
          />
          <StatusCard
            count={counts.urgent}
            label={t('deadline.urgent')}
            color="bg-[#f59e0b]"
          />
          <StatusCard
            count={counts.onTrack}
            label={t('deadline.onTrack')}
            color="bg-[#48A4D6]"
          />
          <StatusCard
            count={counts.obtained}
            label={t('deadline.obtained')}
            color="bg-[#22c55e]"
          />
        </div>
      </motion.div>

      {/* ── Envelope Sections ─────────────────────────────── */}
      {(['A', 'B', 'C'] as const).map((env) => {
        const envItems = grouped[env];
        if (!envItems || envItems.length === 0) return null;
        return (
          <motion.div key={env} variants={itemVariants}>
            <EnvelopeSection
              title={t(envelopeKeys[env])}
              items={envItems}
              t={t}
              onUpdateStatus={handleUpdateStatus}
              onRemove={handleRemove}
              isUpdating={isUpdating}
            />
          </motion.div>
        );
      })}

      {/* Other items */}
      {grouped.other.length > 0 && (
        <motion.div variants={itemVariants}>
          <EnvelopeSection
            title={t('deadline.other')}
            items={grouped.other}
            t={t}
            onUpdateStatus={handleUpdateStatus}
            onRemove={handleRemove}
            isUpdating={isUpdating}
          />
        </motion.div>
      )}

      {/* ── TEC Insight Panel ─────────────────────────────── */}
      {hasOverdue && (
        <motion.div variants={itemVariants}>
          <div className="bg-[#48A4D6]/8 border border-[#48A4D6]/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#48A4D6]/15">
                <Lightbulb className="h-4 w-4 text-[#48A4D6]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {t('deadline.tecInsight')}
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {counts.overdue} {t('deadline.overdue').toLowerCase()}{' '}
                  — {t('deadline.requestNow').toLowerCase()}.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Add Custom Dialog ─────────────────────────────── */}
      <AddCustomDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddCustom}
        isPending={addCustomMutation.isPending}
        t={t}
      />
    </motion.div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────
export function DeadlinePlannerTabSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>

      {/* Status cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border border-border/60 rounded-xl p-4">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-8 w-10" />
          </div>
        ))}
      </div>

      {/* Items skeleton */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-5 w-48" />
          {Array.from({ length: 3 }).map((_, j) => (
            <div key={j} className="bg-card border border-border/60 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-3 w-3 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2 mt-1" />
                </div>
                <Skeleton className="h-7 w-20" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
