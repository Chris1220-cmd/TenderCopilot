'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { BlurFade } from '@/components/ui/blur-fade';
import {
  GlassCard,
  GlassCardContent,
} from '@/components/ui/glass-card';
import Link from 'next/link';
import {
  FolderCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Package,
  ExternalLink,
  Upload,
  Timer,
  ShieldAlert,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────
interface FakelosItem {
  requirementId: string;
  title: string;
  status: 'GAP' | 'COVERED' | 'EXPIRING' | 'IN_PROGRESS';
  mandatory: boolean;
  guidance?: string;
  articleRef?: string;
  expiryDate?: string;
  aiConfidence?: number;
}

interface EnvelopeSection {
  id: string;
  title: string;
  items: FakelosItem[];
  coveredCount: number;
  totalCount: number;
}

interface FakelosReport {
  score: number;
  status: string;
  statusMessage: string;
  lastRunAt: string;
  deadline?: string;
  vaultEmpty: boolean;
  envelopes: EnvelopeSection[];
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
function getScoreColor(score: number) {
  if (score >= 95) return { stroke: 'stroke-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', glow: '#10b981' };
  if (score >= 80) return { stroke: 'stroke-amber-500', text: 'text-amber-600 dark:text-amber-400', glow: '#f59e0b' };
  return { stroke: 'stroke-red-500', text: 'text-red-600 dark:text-red-400', glow: '#ef4444' };
}

function getScoreBadge(score: number) {
  if (score >= 95) return { label: 'Έτοιμος', variant: 'default' as const, className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' };
  if (score >= 80) return { label: 'Σχεδόν Έτοιμος', variant: 'default' as const, className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' };
  return { label: 'Ελλιπής', variant: 'default' as const, className: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30' };
}

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'μόλις τώρα';
  if (mins < 60) return `${mins} λεπτά πριν`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ώρες πριν`;
  const days = Math.floor(hours / 24);
  return `${days} ημέρες πριν`;
}

function formatDeadlineCountdown(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Έληξε';
  const days = Math.floor(diff / 86400000);
  if (days > 30) return `${Math.floor(days / 30)} μήνες`;
  if (days > 0) return `${days} ημέρες`;
  const hours = Math.floor(diff / 3600000);
  return `${hours} ώρες`;
}

const envelopeConfig: Record<string, { letter: string; gradient: string; ring: string }> = {
  A: { letter: 'Α', gradient: 'bg-primary', ring: 'ring-primary/30' },
  B: { letter: 'Β', gradient: 'from-blue-600 to-cyan-500', ring: 'ring-blue-500/30' },
  C: { letter: 'Γ', gradient: 'from-emerald-600 to-green-500', ring: 'ring-emerald-500/30' },
};

function getItemPriority(item: FakelosItem): number {
  if (item.status === 'GAP' && item.mandatory) return 0;
  if (item.status === 'EXPIRING') return 1;
  if (item.status === 'GAP' && !item.mandatory) return 2;
  if (item.status === 'IN_PROGRESS') return 3;
  return 4;
}

// ─── Circular Score ──────────────────────────────────────────
function ReadinessRing({ score, size = 120 }: { score: number; size?: number }) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const colors = getScoreColor(score);

  const [animatedOffset, setAnimatedOffset] = useState(circumference);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedOffset(offset), 100);
    return () => clearTimeout(timer);
  }, [offset]);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={animatedOffset}
          strokeLinecap="round"
          className={cn(colors.stroke, 'transition-all duration-1000 ease-out')}
          style={{
            filter: `drop-shadow(0 0 8px ${colors.glow}50)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-3xl font-bold tabular-nums', colors.text)}>
          {score}%
        </span>
        <span className="text-[10px] text-muted-foreground font-medium tracking-wide">
          ΠΛΗΡΟΤΗΤΑ
        </span>
      </div>
    </div>
  );
}

// ─── Item Renderers ──────────────────────────────────────────
function CriticalItem({ item, onMarkStatus, isPending }: {
  item: FakelosItem;
  onMarkStatus: (reqId: string, status: string) => void;
  isPending: boolean;
}) {
  return (
    <div className="bg-destructive/[0.04] border border-destructive/15 rounded-xl p-4 space-y-2">
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/15 mt-0.5">
          <XCircle className="h-4 w-4 text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{item.title}</p>
          {item.guidance && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.guidance}</p>
          )}
          {item.articleRef && (
            <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono">{item.articleRef}</p>
          )}
          {item.aiConfidence != null && item.aiConfidence < 0.7 && (
            <Badge variant="outline" className="mt-1.5 text-[9px] h-4 px-1.5 border-amber-500/30 text-amber-600 dark:text-amber-400">
              Ελέγξτε χειροκίνητα
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 pl-10">
        <Button
          size="sm"
          className="cursor-pointer gap-1.5 h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg border-0"
          disabled={isPending}
          onClick={() => onMarkStatus(item.requirementId, 'IN_PROGRESS')}
        >
          <Upload className="h-3 w-3" />
          Ανέβασε Αρχείο
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="cursor-pointer gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground"
          disabled={isPending}
          onClick={() => onMarkStatus(item.requirementId, 'IN_PROGRESS')}
        >
          <Timer className="h-3 w-3" />
          Σε Εξέλιξη
        </Button>
      </div>
    </div>
  );
}

function WarningItem({ item, onMarkStatus, isPending }: {
  item: FakelosItem;
  onMarkStatus: (reqId: string, status: string) => void;
  isPending: boolean;
}) {
  return (
    <div className="bg-warning/[0.04] border border-warning/12 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 mt-0.5">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground">{item.title}</p>
            {item.expiryDate && (
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-amber-500/20 text-amber-600 dark:text-amber-400">
                <Clock className="h-2.5 w-2.5 mr-0.5" />
                Λήγει {formatDeadlineCountdown(item.expiryDate)}
              </Badge>
            )}
          </div>
          {item.guidance && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.guidance}</p>
          )}
          {item.articleRef && (
            <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono">{item.articleRef}</p>
          )}
          {item.aiConfidence != null && item.aiConfidence < 0.7 && (
            <Badge variant="outline" className="mt-1.5 text-[9px] h-4 px-1.5 border-amber-500/30 text-amber-600 dark:text-amber-400">
              Ελέγξτε χειροκίνητα
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="cursor-pointer h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground shrink-0"
          disabled={isPending}
          onClick={() => onMarkStatus(item.requirementId, 'IN_PROGRESS')}
        >
          <Timer className="h-3 w-3 mr-1" />
          Σε Εξέλιξη
        </Button>
      </div>
    </div>
  );
}

function OkItem({ item }: { item: FakelosItem }) {
  return (
    <div className="bg-card border border-border/60 rounded-xl px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        </div>
        <p className="text-sm text-foreground/80 flex-1 min-w-0 truncate">{item.title}</p>
        {item.expiryDate && (
          <span className="text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">
            Λήξη: {new Date(item.expiryDate).toLocaleDateString('el-GR')}
          </span>
        )}
        {item.aiConfidence != null && item.aiConfidence < 0.7 && (
          <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-amber-500/30 text-amber-600 dark:text-amber-400 shrink-0">
            Ελέγξτε χειροκίνητα
          </Badge>
        )}
      </div>
    </div>
  );
}

function InProgressItem({ item }: { item: FakelosItem }) {
  return (
    <div className="bg-blue-500/[0.04] border border-blue-500/12 rounded-xl px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/15">
          <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
        </div>
        <p className="text-sm text-foreground/80 flex-1 min-w-0 truncate">{item.title}</p>
        {item.aiConfidence != null && item.aiConfidence < 0.7 && (
          <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-amber-500/30 text-amber-600 dark:text-amber-400 shrink-0">
            Ελέγξτε χειροκίνητα
          </Badge>
        )}
      </div>
    </div>
  );
}

// ─── Envelope Section ────────────────────────────────────────
function EnvelopeBlock({
  envelope,
  isOpen,
  onToggle,
  onMarkStatus,
  isPending,
}: {
  envelope: EnvelopeSection;
  isOpen: boolean;
  onToggle: () => void;
  onMarkStatus: (reqId: string, status: string) => void;
  isPending: boolean;
}) {
  const config = envelopeConfig[envelope.id] ?? envelopeConfig.A;
  const pct = envelope.totalCount > 0 ? Math.round((envelope.coveredCount / envelope.totalCount) * 100) : 0;
  const sortedItems = useMemo(
    () => [...envelope.items].sort((a, b) => getItemPriority(a) - getItemPriority(b)),
    [envelope.items],
  );

  return (
    <motion.div variants={itemVariants} className="overflow-hidden">
      <GlassCard className="overflow-hidden">
        {/* Envelope Header */}
        <button
          onClick={onToggle}
          className="cursor-pointer w-full flex items-center gap-3.5 px-5 py-4 hover:bg-muted/30 transition-colors duration-200"
        >
          <div className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            'bg-gradient-to-br', config.gradient,
            'text-white font-bold text-sm shadow-lg',
            'ring-2', config.ring,
          )}>
            {config.letter}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold text-foreground">{envelope.title}</p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Badge variant="outline" className="tabular-nums text-xs h-6 px-2.5 border-border/60">
              {envelope.coveredCount}/{envelope.totalCount}
            </Badge>
            <span className={cn(
              'text-xs font-bold tabular-nums',
              pct >= 95 ? 'text-emerald-600 dark:text-emerald-400' :
              pct >= 80 ? 'text-amber-600 dark:text-amber-400' :
              'text-red-600 dark:text-red-400',
            )}>
              {pct}%
            </span>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Envelope Body */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as const }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-4 space-y-2">
                {sortedItems.map((item, i) => (
                  <BlurFade key={item.requirementId} delay={0.05 + i * 0.04} inView>
                    {item.status === 'GAP' && item.mandatory ? (
                      <CriticalItem item={item} onMarkStatus={onMarkStatus} isPending={isPending} />
                    ) : item.status === 'EXPIRING' || (item.status === 'GAP' && !item.mandatory) ? (
                      <WarningItem item={item} onMarkStatus={onMarkStatus} isPending={isPending} />
                    ) : item.status === 'IN_PROGRESS' ? (
                      <InProgressItem item={item} />
                    ) : (
                      <OkItem item={item} />
                    )}
                  </BlurFade>
                ))}
                {sortedItems.length === 0 && (
                  <p className="text-xs text-muted-foreground/60 text-center py-4">
                    Δεν υπάρχουν απαιτήσεις σε αυτόν τον φάκελο.
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────
export function FakelosTab({ tenderId }: { tenderId: string }) {
  const utils = trpc.useUtils();
  const [openEnvelopes, setOpenEnvelopes] = useState<Set<string>>(new Set(['A', 'B', 'C']));

  const reportQuery = trpc.fakelos.getReport.useQuery({ tenderId });
  const runCheckMutation = trpc.fakelos.runCheck.useMutation({
    onSuccess: () => { utils.fakelos.getReport.invalidate({ tenderId }); },
  });
  const markStatusMutation = trpc.fakelos.markItemStatus.useMutation({
    onSuccess: () => { utils.fakelos.getReport.invalidate({ tenderId }); },
  });

  const handleToggleEnvelope = (id: string) => {
    setOpenEnvelopes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMarkStatus = (requirementId: string, status: string) => {
    markStatusMutation.mutate({ requirementId, status: status as 'IN_PROGRESS' });
  };

  const report = reportQuery.data as FakelosReport | null | undefined;

  // ── Loading State ────────────────────────────────────────
  if (reportQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-8">
          <Skeleton className="h-[120px] w-[120px] rounded-full shrink-0" />
          <div className="space-y-3 flex-1">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  // ── No Report / CTA State ──────────────────────────────
  if (report === null || report === undefined) {
    return (
      <BlurFade delay={0.1} inView>
        <GlassCard className="overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
          <GlassCardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4 ring-1 ring-primary/20">
                <FolderCheck className="h-8 w-8 text-primary/60" />
              </div>
              <p className="text-base font-semibold text-foreground mb-1.5">
                Έλεγχος Πληρότητας Φακέλου
              </p>
              <p className="text-sm text-muted-foreground/70 mb-6 max-w-md">
                Εκτελέστε έλεγχο πληρότητας φακέλου για να εντοπίσετε ελλείψεις και να
                βεβαιωθείτε ότι ο φάκελος είναι πλήρης πριν την υποβολή.
              </p>
              <ShimmerButton
                className="cursor-pointer gap-2 h-10 px-6"
                onClick={() => runCheckMutation.mutate({ tenderId })}
                disabled={runCheckMutation.isPending}
              >
                {runCheckMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FolderCheck className="h-4 w-4" />
                )}
                {runCheckMutation.isPending ? 'Εκτέλεση...' : 'Τρέξε Έλεγχο'}
              </ShimmerButton>
            </div>
          </GlassCardContent>
        </GlassCard>
      </BlurFade>
    );
  }

  // ── Report View ────────────────────────────────────────
  const scoreBadge = getScoreBadge(report.score);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5"
    >
      {/* ── Top Section: Score + Status + Actions ── */}
      <motion.div variants={itemVariants}>
        <GlassCard className="overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
          <GlassCardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start gap-6 sm:gap-8">
              {/* Circular Score */}
              <ReadinessRing score={report.score} />

              {/* Status Info */}
              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Badge
                    variant="outline"
                    className={cn('text-xs h-6 px-2.5 font-semibold', scoreBadge.className)}
                  >
                    {scoreBadge.label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {report.statusMessage}
                </p>
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground/70">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Τελευταίος έλεγχος: {formatTimeAgo(report.lastRunAt)}
                  </span>
                  {report.deadline && (
                    <span className="flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" />
                      Προθεσμία: {formatDeadlineCountdown(report.deadline)}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 shrink-0">
                <ShimmerButton
                  className="cursor-pointer gap-2 h-9 px-4 text-sm"
                  onClick={() => runCheckMutation.mutate({ tenderId })}
                  disabled={runCheckMutation.isPending}
                >
                  {runCheckMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Τρέξε Έλεγχο Ξανά
                </ShimmerButton>
                <Button
                  variant="outline"
                  disabled
                  className="cursor-not-allowed gap-2 h-9 px-4 text-sm opacity-50"
                >
                  <Package className="h-3.5 w-3.5" />
                  Δημιουργία Πακέτου
                </Button>
              </div>
            </div>
          </GlassCardContent>
        </GlassCard>
      </motion.div>

      {/* ── Vault Empty Banner ── */}
      {report.vaultEmpty && (
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/20 px-4 py-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Δεν βρέθηκαν εταιρικά έγγραφα
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ανεβάστε τα εταιρικά σας έγγραφα στο Θησαυροφυλάκιο για αυτόματη αντιστοίχιση.
              </p>
            </div>
            <Link
              href="/company"
              className="cursor-pointer flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300 transition-colors duration-200 shrink-0"
            >
              Μετάβαση
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </motion.div>
      )}

      {/* ── Envelope Sections ── */}
      {report.envelopes.map((envelope) => (
        <EnvelopeBlock
          key={envelope.id}
          envelope={envelope}
          isOpen={openEnvelopes.has(envelope.id)}
          onToggle={() => handleToggleEnvelope(envelope.id)}
          onMarkStatus={handleMarkStatus}
          isPending={markStatusMutation.isPending}
        />
      ))}
    </motion.div>
  );
}
