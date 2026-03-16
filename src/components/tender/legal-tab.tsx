'use client';

import { useState } from 'react';
import { cn, truncate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardContent,
  GlassCardAction,
} from '@/components/ui/glass-card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Scale,
  FileSearch,
  ShieldAlert,
  MessageSquareWarning,
  Loader2,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Pencil,
  Check,
  BookOpen,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────
interface LegalClause {
  id: string;
  clauseText: string;
  category: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  articleRef: string;
  recommendation: string;
  details?: string;
  linkedClarifications?: string[];
}

interface Clarification {
  id: string;
  question: string;
  status: 'DRAFT' | 'APPROVED' | 'SENT';
  relatedClauseId?: string;
}

interface LegalSummary {
  overallRiskScore: number;
  clauseCountByRisk: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    CRITICAL: number;
  };
}

// ─── Mock Data ────────────────────────────────────────────────
const mockClauses: LegalClause[] = [
  {
    id: 'lc-1',
    clauseText: 'Ο ανάδοχος υποχρεούται να καταθέσει εγγυητική επιστολή καλής εκτέλεσης ίση με το 4% της συνολικής αξίας της σύμβασης εντός 10 ημερών από την υπογραφή.',
    category: 'Εγγυητική Επιστολή',
    riskLevel: 'LOW',
    articleRef: 'Άρθρο 7.2',
    recommendation: 'Τυπική ρήτρα. Βεβαιωθείτε ότι η τράπεζα μπορεί να εκδώσει εγκαίρως.',
    details: 'Η εγγυητική επιστολή πρέπει να εκδοθεί από αναγνωρισμένο τραπεζικό ίδρυμα και να έχει διάρκεια ισχύος τουλάχιστον 30 ημέρες μετά τη λήξη της σύμβασης. Σε περίπτωση κοινοπραξίας, κάθε μέλος παρέχει εγγυητική ανάλογη του ποσοστού συμμετοχής.',
  },
  {
    id: 'lc-2',
    clauseText: 'Σε περίπτωση καθυστέρησης παράδοσης πέραν των 30 ημερών, η αναθέτουσα αρχή δικαιούται να κηρύξει τον ανάδοχο έκπτωτο χωρίς προηγούμενη ειδοποίηση.',
    category: 'Ρήτρες Καθυστέρησης',
    riskLevel: 'HIGH',
    articleRef: 'Άρθρο 12.4',
    recommendation: 'Ρήτρα υψηλού κινδύνου. Ζητήστε διευκρίνιση για τη δυνατότητα παράτασης λόγω ανωτέρας βίας.',
    details: 'Η ρήτρα δεν προβλέπει μηχανισμό ειδοποίησης ή θεραπείας πριν την κήρυξη εκπτώσεως. Αυτό αποτελεί σημαντικό κίνδυνο καθώς ακόμη και μικρές καθυστερήσεις μπορούν να οδηγήσουν σε ακύρωση σύμβασης. Συστήνεται αίτημα διευκρίνισης.',
    linkedClarifications: ['cl-1'],
  },
  {
    id: 'lc-3',
    clauseText: 'Ο ανάδοχος αποδέχεται αλληλέγγυα και εις ολόκληρον ευθύνη για ζημίες τρίτων χωρίς ανώτατο όριο αποζημίωσης.',
    category: 'Ευθύνη & Αποζημίωση',
    riskLevel: 'CRITICAL',
    articleRef: 'Άρθρο 15.1',
    recommendation: 'Κρίσιμη ρήτρα! Η απεριόριστη ευθύνη αποτελεί σοβαρό κίνδυνο. Ζητήστε ανώτατο όριο (π.χ. 100% αξίας σύμβασης).',
    details: 'Η απεριόριστη ευθύνη μπορεί να εκθέσει την εταιρεία σε δυσανάλογους κινδύνους. Τα περισσότερα αντίστοιχα τεύχη δημοπράτησης προβλέπουν ανώτατο όριο ίσο με τη συνολική αξία της σύμβασης. Η απουσία πλαφόν θεωρείται μη τυπική πρακτική.',
    linkedClarifications: ['cl-2'],
  },
  {
    id: 'lc-4',
    clauseText: 'Η πνευματική ιδιοκτησία όλων των παραδοτέων μεταφέρεται αυτόματα στην αναθέτουσα αρχή κατά την παράδοση.',
    category: 'Πνευματική Ιδιοκτησία',
    riskLevel: 'MEDIUM',
    articleRef: 'Άρθρο 18.3',
    recommendation: 'Τυπική ρήτρα για δημόσια έργα. Βεβαιωθείτε ότι δεν αφορά pre-existing IP.',
    details: 'Η ρήτρα αφορά μόνο τα νέα παραδοτέα. Ωστόσο, η διατύπωση είναι ευρεία και θα μπορούσε να ερμηνευθεί ότι καλύπτει και τυχόν προϋπάρχοντα εργαλεία ή βιβλιοθήκες. Συστήνεται προσθήκη εξαίρεσης για pre-existing IP.',
  },
  {
    id: 'lc-5',
    clauseText: 'Ποινική ρήτρα 0.5% ανά ημέρα καθυστέρησης με ανώτατο όριο 10% της αξίας της σύμβασης.',
    category: 'Ρήτρες Καθυστέρησης',
    riskLevel: 'MEDIUM',
    articleRef: 'Άρθρο 12.2',
    recommendation: 'Αποδεκτή ρήτρα με τυπικό ανώτατο όριο. Προσοχή στους ορισμούς "καθυστέρησης".',
  },
];

const mockClarifications: Clarification[] = [
  {
    id: 'cl-1',
    question: 'Παρακαλούμε διευκρινίστε εάν η ρήτρα εκπτώσεως του Άρθρου 12.4 εφαρμόζεται σε περιπτώσεις ανωτέρας βίας ή αν προβλέπεται μηχανισμός παράτασης.',
    status: 'DRAFT',
    relatedClauseId: 'lc-2',
  },
  {
    id: 'cl-2',
    question: 'Σχετικά με το Άρθρο 15.1, είναι δυνατόν να τεθεί ανώτατο όριο ευθύνης ίσο με τη συνολική αξία της σύμβασης;',
    status: 'DRAFT',
    relatedClauseId: 'lc-3',
  },
  {
    id: 'cl-3',
    question: 'Παρακαλούμε επιβεβαιώστε ότι η μεταφορά πνευματικής ιδιοκτησίας (Άρθρο 18.3) δεν καλύπτει pre-existing εργαλεία και βιβλιοθήκες του αναδόχου.',
    status: 'DRAFT',
    relatedClauseId: 'lc-4',
  },
];

const mockSummary: LegalSummary = {
  overallRiskScore: 62,
  clauseCountByRisk: {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 1,
    CRITICAL: 1,
  },
};

// ─── Risk Level Config ────────────────────────────────────────
const riskConfig = {
  LOW: {
    label: 'Χαμηλό',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  MEDIUM: {
    label: 'Μέτριο',
    bg: 'bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-500/20',
    dot: 'bg-amber-500',
  },
  HIGH: {
    label: 'Υψηλό',
    bg: 'bg-orange-500/15',
    text: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-500/20',
    dot: 'bg-orange-500',
  },
  CRITICAL: {
    label: 'Κρίσιμο',
    bg: 'bg-red-500/15',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-500/20',
    dot: 'bg-red-500',
  },
};

const clarificationStatusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: {
    label: 'Πρόχειρο',
    className: 'bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-500/20',
  },
  APPROVED: {
    label: 'Εγκρίθηκε',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  },
  SENT: {
    label: 'Εστάλη',
    className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20',
  },
};

// ─── Component ────────────────────────────────────────────────
interface LegalTabProps {
  tenderId: string;
}

export function LegalTab({ tenderId }: LegalTabProps) {
  const [clauses, setClauses] = useState<LegalClause[]>(mockClauses);
  const [clarifications, setClarifications] = useState<Clarification[]>(mockClarifications);
  const [summary, setSummary] = useState<LegalSummary>(mockSummary);
  const [selectedClause, setSelectedClause] = useState<LegalClause | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [editingClarification, setEditingClarification] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // tRPC mutations (with null safety for when router doesn't exist yet)
  const extractMutation = trpc.aiRoles?.extractLegalClauses?.useMutation?.({
    onSuccess: (data: any) => {
      if (data?.clauses) setClauses(data.clauses);
      if (data?.summary) setSummary(data.summary);
      setLoadingAction(null);
    },
    onError: () => setLoadingAction(null),
  }) ?? null;

  const assessMutation = trpc.aiRoles?.assessLegalRisks?.useMutation?.({
    onSuccess: (data: any) => {
      if (data?.clauses) setClauses(data.clauses);
      if (data?.summary) setSummary(data.summary);
      setLoadingAction(null);
    },
    onError: () => setLoadingAction(null),
  }) ?? null;

  const clarifyMutation = trpc.aiRoles?.proposeClarifications?.useMutation?.({
    onSuccess: (data: any) => {
      if (data?.clarifications) setClarifications(data.clarifications);
      setLoadingAction(null);
    },
    onError: () => setLoadingAction(null),
  }) ?? null;

  const handleExtract = () => {
    setLoadingAction('extract');
    if (extractMutation) {
      extractMutation.mutate({ tenderId });
    } else {
      setTimeout(() => {
        setClauses(mockClauses);
        setSummary(mockSummary);
        setLoadingAction(null);
      }, 1500);
    }
  };

  const handleAssess = () => {
    setLoadingAction('assess');
    if (assessMutation) {
      assessMutation.mutate({ tenderId });
    } else {
      setTimeout(() => setLoadingAction(null), 1500);
    }
  };

  const handleClarify = () => {
    setLoadingAction('clarify');
    if (clarifyMutation) {
      clarifyMutation.mutate({ tenderId });
    } else {
      setTimeout(() => setLoadingAction(null), 1500);
    }
  };

  const handleClauseClick = (clause: LegalClause) => {
    setSelectedClause(clause);
    setSheetOpen(true);
  };

  const handleEditClarification = (id: string, text: string) => {
    setEditingClarification(id);
    setEditText(text);
  };

  const handleSaveClarification = (id: string) => {
    setClarifications((prev) =>
      prev.map((c) => (c.id === id ? { ...c, question: editText } : c))
    );
    setEditingClarification(null);
  };

  const handleApproveClarification = (id: string) => {
    setClarifications((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'APPROVED' as const } : c))
    );
  };

  function getRiskScoreColor(score: number) {
    if (score <= 30) return 'text-emerald-600 dark:text-emerald-400';
    if (score <= 60) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  }

  function getRiskBarColor(score: number) {
    if (score <= 30) return 'bg-emerald-500';
    if (score <= 60) return 'bg-amber-500';
    return 'bg-red-500';
  }

  const linkedClarifications = selectedClause
    ? clarifications.filter((c) => c.relatedClauseId === selectedClause.id)
    : [];

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={handleExtract}
          disabled={loadingAction !== null}
          variant="outline"
          className="cursor-pointer gap-2 h-9"
        >
          {loadingAction === 'extract' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileSearch className="h-4 w-4" />
          )}
          Εξαγωγή Ρητρών
        </Button>
        <Button
          onClick={handleAssess}
          disabled={loadingAction !== null}
          variant="outline"
          className="cursor-pointer gap-2 h-9"
        >
          {loadingAction === 'assess' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldAlert className="h-4 w-4" />
          )}
          Αξιολόγηση Κινδύνων
        </Button>
        <Button
          onClick={handleClarify}
          disabled={loadingAction !== null}
          variant="outline"
          className="cursor-pointer gap-2 h-9"
        >
          {loadingAction === 'clarify' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageSquareWarning className="h-4 w-4" />
          )}
          Πρόταση Διευκρινίσεων
        </Button>
      </div>

      {/* Legal Risk Summary */}
      <GlassCard>
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-700 via-blue-500 to-amber-400" />
        <GlassCardHeader className="pt-2">
          <GlassCardTitle className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-blue-500" />
            Σύνοψη Νομικού Κινδύνου
          </GlassCardTitle>
          <GlassCardAction>
            <div className="flex items-baseline gap-1.5">
              <span className={cn('text-3xl font-bold tabular-nums', getRiskScoreColor(summary.overallRiskScore))}>
                {summary.overallRiskScore}
              </span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
          </GlassCardAction>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="space-y-3">
            {/* Risk Bar */}
            <div className="h-2.5 w-full rounded-full bg-muted/50 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700 ease-out', getRiskBarColor(summary.overallRiskScore))}
                style={{ width: `${summary.overallRiskScore}%` }}
              />
            </div>

            {/* Risk Count Badges */}
            <div className="flex flex-wrap gap-2">
              {(Object.entries(summary.clauseCountByRisk) as [keyof typeof riskConfig, number][]).map(
                ([level, count]) => {
                  const cfg = riskConfig[level];
                  return (
                    <div
                      key={level}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-1.5',
                        cfg.bg,
                        'border',
                        cfg.border
                      )}
                    >
                      <span className={cn('h-2 w-2 rounded-full', cfg.dot)} />
                      <span className={cn('text-xs font-semibold', cfg.text)}>
                        {cfg.label}
                      </span>
                      <span className={cn('text-sm font-bold tabular-nums', cfg.text)}>
                        {count}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Clauses Table */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-500" />
            Ρήτρες Σύμβασης
          </GlassCardTitle>
          <GlassCardDescription>
            {clauses.length} ρήτρες εντοπίστηκαν
          </GlassCardDescription>
        </GlassCardHeader>
        <GlassCardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Κείμενο Ρήτρας
                  </th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Κατηγορία
                  </th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Κίνδυνος
                  </th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Άρθρο
                  </th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                    Σύσταση
                  </th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {clauses.map((clause) => {
                  const cfg = riskConfig[clause.riskLevel];
                  return (
                    <tr
                      key={clause.id}
                      onClick={() => handleClauseClick(clause)}
                      className="border-b border-border/30 hover:bg-blue-50/30 dark:hover:bg-blue-500/5 transition-colors duration-150 cursor-pointer group"
                    >
                      <td className="px-5 py-3 max-w-[280px]">
                        <span className="text-xs text-foreground line-clamp-2">
                          {truncate(clause.clauseText, 100)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
                        >
                          {clause.category}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] font-semibold', cfg.bg, cfg.text, cfg.border)}
                        >
                          {cfg.label}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs text-muted-foreground font-mono">
                          {clause.articleRef}
                        </span>
                      </td>
                      <td className="px-3 py-3 max-w-[200px] hidden lg:table-cell">
                        <span className="text-[11px] text-muted-foreground line-clamp-2">
                          {truncate(clause.recommendation, 80)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors duration-150" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Clarifications Section */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center gap-2">
            <MessageSquareWarning className="h-4 w-4 text-amber-500" />
            Προτεινόμενες Διευκρινίσεις
          </GlassCardTitle>
          <GlassCardDescription>
            {clarifications.length} ερωτήματα προετοιμασμένα
          </GlassCardDescription>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="space-y-3">
            {clarifications.map((cl) => {
              const statusCfg = clarificationStatusConfig[cl.status];
              const isEditing = editingClarification === cl.id;

              return (
                <div
                  key={cl.id}
                  className={cn(
                    'rounded-xl border p-4',
                    'bg-white/40 dark:bg-white/[0.03]',
                    'border-white/30 dark:border-white/10',
                    'transition-all duration-200',
                    'hover:border-blue-300/30 dark:hover:border-blue-500/15'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="min-h-[80px] text-xs"
                        />
                      ) : (
                        <p className="text-xs text-foreground leading-relaxed">
                          {cl.question}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn('text-[10px] shrink-0', statusCfg.className)}
                    >
                      {statusCfg.label}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    {isEditing ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSaveClarification(cl.id)}
                          className="cursor-pointer h-7 text-xs gap-1"
                        >
                          <Check className="h-3 w-3" />
                          Αποθήκευση
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingClarification(null)}
                          className="cursor-pointer h-7 text-xs"
                        >
                          Ακύρωση
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditClarification(cl.id, cl.question)}
                          className="cursor-pointer h-7 text-xs gap-1"
                        >
                          <Pencil className="h-3 w-3" />
                          Επεξεργασία
                        </Button>
                        {cl.status === 'DRAFT' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleApproveClarification(cl.id)}
                            className="cursor-pointer h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-500"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Έγκριση
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {clarifications.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Δεν υπάρχουν διευκρινίσεις. Πατήστε &ldquo;Πρόταση Διευκρινίσεων&rdquo; για AI δημιουργία.
              </p>
            )}
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Clause Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          {selectedClause && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5 text-blue-500" />
                  Λεπτομέρειες Ρήτρας
                </SheetTitle>
                <SheetDescription>
                  {selectedClause.articleRef} - {selectedClause.category}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                {/* Risk Badge */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Επίπεδο Κινδύνου:</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs font-semibold',
                      riskConfig[selectedClause.riskLevel].bg,
                      riskConfig[selectedClause.riskLevel].text,
                      riskConfig[selectedClause.riskLevel].border
                    )}
                  >
                    {riskConfig[selectedClause.riskLevel].label}
                  </Badge>
                </div>

                <Separator />

                {/* Full Clause Text */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Κείμενο Ρήτρας
                  </p>
                  <div className="rounded-lg bg-muted/30 p-4 border border-border/50">
                    <p className="text-sm leading-relaxed text-foreground">
                      {selectedClause.clauseText}
                    </p>
                  </div>
                </div>

                {/* Details */}
                {selectedClause.details && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5" />
                      Ανάλυση
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {selectedClause.details}
                    </p>
                  </div>
                )}

                {/* Recommendation */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    Σύσταση
                  </p>
                  <div className="rounded-lg bg-amber-500/5 border border-amber-500/15 p-3">
                    <p className="text-sm text-foreground leading-relaxed">
                      {selectedClause.recommendation}
                    </p>
                  </div>
                </div>

                {/* Linked Clarifications */}
                {linkedClarifications.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquareWarning className="h-3.5 w-3.5 text-blue-500" />
                      Σχετικές Διευκρινίσεις
                    </p>
                    <div className="space-y-2">
                      {linkedClarifications.map((cl) => (
                        <div
                          key={cl.id}
                          className="rounded-lg bg-blue-500/5 border border-blue-500/15 p-3"
                        >
                          <p className="text-xs text-foreground leading-relaxed">
                            {cl.question}
                          </p>
                          <Badge
                            variant="outline"
                            className={cn(
                              'mt-2 text-[9px]',
                              clarificationStatusConfig[cl.status].className
                            )}
                          >
                            {clarificationStatusConfig[cl.status].label}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function LegalTabSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-44" />
      </div>
      <GlassCard>
        <GlassCardContent>
          <Skeleton className="h-8 w-48 mb-3" />
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="flex gap-2 mt-3">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </GlassCardContent>
      </GlassCard>
      <GlassCard>
        <GlassCardContent>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-border/30">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
