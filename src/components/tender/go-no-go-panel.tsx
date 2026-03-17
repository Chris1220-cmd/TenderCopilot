'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardContent,
  GlassCardFooter,
} from '@/components/ui/glass-card';
import {
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Play,
  User,
  Calendar,
  Scale,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────
interface GoNoGoFactor {
  name: string;
  score: number; // 0-100
  weight: number; // 0-1
  explanation: string;
}

interface GoNoGoResult {
  decision: 'GO' | 'NO_GO' | 'BORDERLINE';
  overallScore: number;
  factors: GoNoGoFactor[];
  reasons: string[];
  approvedBy?: string | null;
  approvedAt?: string | null;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
}

// ─── Helpers ──────────────────────────────────────────────────
const decisionConfig = {
  GO: {
    label: 'GO',
    labelGr: 'Συμμετοχή',
    icon: CheckCircle2,
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    glow: 'shadow-emerald-500/20',
    ring: 'ring-emerald-500/30',
  },
  NO_GO: {
    label: 'NO-GO',
    labelGr: 'Μη Συμμετοχή',
    icon: XCircle,
    bg: 'bg-red-500/15',
    border: 'border-red-500/30',
    text: 'text-red-700 dark:text-red-400',
    glow: 'shadow-red-500/20',
    ring: 'ring-red-500/30',
  },
  BORDERLINE: {
    label: 'BORDERLINE',
    labelGr: 'Οριακά',
    icon: MinusCircle,
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    text: 'text-amber-700 dark:text-amber-400',
    glow: 'shadow-amber-500/20',
    ring: 'ring-amber-500/30',
  },
};

function getScoreColor(score: number) {
  if (score >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function getBarColor(score: number) {
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function getBarBg(score: number) {
  if (score >= 75) return 'bg-emerald-500/10';
  if (score >= 50) return 'bg-amber-500/10';
  return 'bg-red-500/10';
}

// ─── Circular Progress ───────────────────────────────────────
function CircularProgress({ score, size = 100 }: { score: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 75 ? 'stroke-emerald-500' : score >= 50 ? 'stroke-amber-500' : 'stroke-red-500';
  const glowColor =
    score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative" style={{ width: size, height: size }}>
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
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(color, 'transition-all duration-1000 ease-out')}
          style={{
            filter: `drop-shadow(0 0 6px ${glowColor}40)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-2xl font-bold tabular-nums', getScoreColor(score))}>
          {score}
        </span>
        <span className="text-[10px] text-muted-foreground font-medium">/ 100</span>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────
interface GoNoGoPanelProps {
  tenderId: string;
  className?: string;
}

export function GoNoGoPanel({ tenderId, className }: GoNoGoPanelProps) {
  const [result, setResult] = useState<GoNoGoResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showReasons, setShowReasons] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // tRPC mutations — no mock fallback
  const goNoGoMutation = trpc.aiRoles?.goNoGo?.useMutation?.({
    onSuccess: (data: any) => {
      setResult(data);
      setError(null);
      setIsAnalyzing(false);
    },
    onError: (err: any) => {
      setError(err?.message ?? 'Αποτυχία ανάλυσης. Δοκιμάστε ξανά.');
      setIsAnalyzing(false);
    },
  }) ?? null;

  const approveMutation = trpc.aiRoles?.approveGoNoGo?.useMutation?.({
    onSuccess: (data: any) => {
      setResult((prev) =>
        prev ? { ...prev, approvalStatus: data.approvedById ? 'APPROVED' : 'REJECTED', approvedBy: data.approvedById, approvedAt: data.approvedAt } : prev
      );
      setIsApproving(false);
    },
    onError: () => {
      setIsApproving(false);
    },
  }) ?? null;

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setError(null);
    if (goNoGoMutation) {
      goNoGoMutation.mutate({ tenderId });
    } else {
      setError('Η υπηρεσία AI δεν είναι διαθέσιμη αυτή τη στιγμή.');
      setIsAnalyzing(false);
    }
  };

  const handleApproval = (approved: boolean) => {
    setIsApproving(true);
    if (approveMutation && result) {
      approveMutation.mutate({ decisionId: (result as any).id ?? tenderId, approved });
    } else {
      setIsApproving(false);
    }
  };

  const displayResult = result;
  const config = displayResult ? decisionConfig[displayResult.decision] : null;

  return (
    <GlassCard className={cn('overflow-hidden', className)}>
      {/* Header Gradient Accent */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-400" />

      <GlassCardHeader className="pt-2">
        <GlassCardTitle className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600/20 to-purple-500/20 ring-1 ring-purple-500/20">
            <Scale className="h-4 w-4 text-purple-500" />
          </div>
          <span className="bg-gradient-to-r from-violet-700 to-purple-600 bg-clip-text text-transparent dark:from-violet-400 dark:to-purple-300">
            Go / No-Go Ανάλυση
          </span>
        </GlassCardTitle>
      </GlassCardHeader>

      <GlassCardContent>
        {isAnalyzing ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center py-4">
              <Skeleton className="h-[100px] w-[100px] rounded-full" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 flex-1 rounded-full" />
                  <Skeleton className="h-4 w-10" />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 mb-3">
              <Scale className="h-6 w-6 text-red-500/50" />
            </div>
            <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">
              Σφάλμα
            </p>
            <p className="text-xs text-muted-foreground/70">
              {error}
            </p>
          </div>
        ) : displayResult && config ? (
          <div className="space-y-5">
            {/* Decision Badge + Score */}
            <div className="flex items-center justify-between">
              {/* Decision Badge */}
              <div
                className={cn(
                  'flex items-center gap-2.5 rounded-xl px-4 py-2.5',
                  config.bg,
                  'border',
                  config.border,
                  'shadow-lg',
                  config.glow
                )}
              >
                <config.icon className={cn('h-6 w-6', config.text)} />
                <div>
                  <p className={cn('text-lg font-bold', config.text)}>
                    {config.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {config.labelGr}
                  </p>
                </div>
              </div>

              {/* Circular Score */}
              <CircularProgress score={displayResult.overallScore ?? 0} />
            </div>

            {/* Factor Breakdown */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Ανάλυση Παραγόντων
              </p>
              <div className="space-y-2.5">
                {(displayResult.factors ?? []).map((factor, i) => (
                  <div key={i} className="group">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-foreground w-32 shrink-0 truncate">
                        {factor.name}
                      </span>
                      <div className="flex-1 relative">
                        <div className={cn('h-2.5 w-full rounded-full overflow-hidden', getBarBg(factor.score))}>
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-700 ease-out',
                              getBarColor(factor.score)
                            )}
                            style={{ width: `${factor.score}%` }}
                          />
                        </div>
                      </div>
                      <span className={cn('text-xs font-bold tabular-nums w-8 text-right', getScoreColor(factor.score))}>
                        {factor.score}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0 h-4 tabular-nums text-muted-foreground border-muted-foreground/20"
                      >
                        x{factor.weight}
                      </Badge>
                    </div>
                    {/* Explanation on hover */}
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5 pl-[8.5rem] opacity-0 group-hover:opacity-100 transition-opacity duration-200 line-clamp-1">
                      {factor.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Reasons Expandable */}
            <div>
              <button
                onClick={() => setShowReasons(!showReasons)}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200 cursor-pointer"
              >
                {showReasons ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {showReasons ? 'Απόκρυψη Αιτιολογίας' : 'Εμφάνιση Αιτιολογίας'}
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                  {(displayResult.reasons ?? []).length}
                </Badge>
              </button>
              {showReasons && (
                <ul className="mt-2.5 space-y-1.5 pl-1">
                  {(displayResult.reasons ?? []).map((reason, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500/60 shrink-0" />
                      {reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Approval Status */}
            {displayResult.approvalStatus === 'APPROVED' && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <div className="text-xs">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">Εγκρίθηκε</span>
                  {displayResult.approvedBy && (
                    <span className="text-muted-foreground ml-1.5 flex items-center gap-1 inline-flex">
                      <User className="h-3 w-3" /> {displayResult.approvedBy}
                    </span>
                  )}
                  {displayResult.approvedAt && (
                    <span className="text-muted-foreground/60 ml-1.5 flex items-center gap-1 inline-flex">
                      <Calendar className="h-3 w-3" /> {new Date(displayResult.approvedAt).toLocaleDateString('el-GR')}
                    </span>
                  )}
                </div>
              </div>
            )}
            {displayResult.approvalStatus === 'REJECTED' && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <div className="text-xs">
                  <span className="font-semibold text-red-700 dark:text-red-400">Απορρίφθηκε</span>
                  {displayResult.approvedBy && (
                    <span className="text-muted-foreground ml-1.5">
                      απo {displayResult.approvedBy}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 mb-3">
              <Scale className="h-6 w-6 text-purple-500/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Δεν έχει εκτελεστεί ανάλυση
            </p>
            <p className="text-xs text-muted-foreground/70">
              Αξιολογήστε αν αξίζει η συμμετοχή στον διαγωνισμό
            </p>
          </div>
        )}
      </GlassCardContent>

      <GlassCardFooter className="justify-between flex-wrap gap-2">
        <Button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          variant="outline"
          className="cursor-pointer gap-2 h-9"
        >
          {isAnalyzing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {isAnalyzing ? 'Ανάλυση...' : 'Εκτέλεση Ανάλυσης'}
        </Button>

        {displayResult && displayResult.approvalStatus === 'PENDING' && (
          <div className="flex gap-2">
            <Button
              onClick={() => handleApproval(true)}
              disabled={isApproving}
              className={cn(
                'cursor-pointer gap-1.5 h-9',
                'bg-gradient-to-r from-emerald-600 to-emerald-500',
                'hover:from-emerald-500 hover:to-emerald-400',
                'border-0 text-white shadow-lg shadow-emerald-500/20'
              )}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              Αποδοχή
            </Button>
            <Button
              onClick={() => handleApproval(false)}
              disabled={isApproving}
              variant="outline"
              className="cursor-pointer gap-1.5 h-9 text-red-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 border-red-200 dark:border-red-500/20"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
              Απόρριψη
            </Button>
          </div>
        )}
      </GlassCardFooter>
    </GlassCard>
  );
}

export function GoNoGoPanelSkeleton() {
  return (
    <GlassCard>
      <GlassCardHeader>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-5 w-40" />
        </div>
      </GlassCardHeader>
      <GlassCardContent>
        <div className="flex items-center justify-between">
          <Skeleton className="h-16 w-28 rounded-xl" />
          <Skeleton className="h-[100px] w-[100px] rounded-full" />
        </div>
        <div className="space-y-3 mt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full rounded-full" />
          ))}
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}
