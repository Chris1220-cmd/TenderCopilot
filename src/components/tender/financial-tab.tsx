'use client';

import { useState, useEffect, useRef } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { NoDocumentsAlert } from './no-documents-alert';
import { LanguageModal, type AnalysisLanguage } from './language-modal';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardContent,
  GlassCardAction,
  GlassCardFooter,
} from '@/components/ui/glass-card';
import { BlurFade } from '@/components/ui/blur-fade';
import {
  Banknote,
  TrendingUp,
  Calculator,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Loader2,
  Shield,
  Target,
  Percent,
  DollarSign,
  Zap,
  Scale,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────
interface EligibilityCheck {
  criterion: string;
  required: string;
  actual: string;
  pass: boolean;
}

interface EligibilityResult {
  status: 'ELIGIBLE' | 'BORDERLINE' | 'NOT_ELIGIBLE';
  checks: EligibilityCheck[];
}

interface PricingScenario {
  id?: string; // DB id — present when loaded from backend
  name: string;
  type: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';
  totalPrice: number;
  margin: number; // percentage
  winProbability: number; // percentage
  breakdown?: { item: string; amount: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────

/** Maps Greek scenario name (as stored in DB) to the type enum */
function nameToType(name: string): 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' {
  if (name === 'Συντηρητικό') return 'CONSERVATIVE';
  if (name === 'Ισορροπημένο') return 'BALANCED';
  if (name === 'Επιθετικό') return 'AGGRESSIVE';
  // Fallback: try English names too
  const upper = name.toUpperCase();
  if (upper.includes('CONSERV')) return 'CONSERVATIVE';
  if (upper.includes('AGGRESS')) return 'AGGRESSIVE';
  return 'BALANCED';
}

/** Normalises server-side EligibilityResult (uses `passed`) to client shape (uses `pass`) */
function normalizeEligibility(raw: any): EligibilityResult | null {
  if (!raw?.status) return null;
  return {
    status: raw.status,
    checks: (raw.checks ?? []).map((c: any) => ({
      criterion: c.criterion,
      required: c.required,
      actual: c.actual,
      pass: c.pass ?? c.passed ?? false,
    })),
  };
}

const eligibilityConfig = {
  ELIGIBLE: {
    label: 'Επιλέξιμοι',
    icon: CheckCircle2,
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  BORDERLINE: {
    label: 'Οριακά',
    icon: MinusCircle,
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    text: 'text-amber-700 dark:text-amber-400',
  },
  NOT_ELIGIBLE: {
    label: 'Μη Επιλέξιμοι',
    icon: XCircle,
    bg: 'bg-red-500/15',
    border: 'border-red-500/30',
    text: 'text-red-700 dark:text-red-400',
  },
};

const scenarioConfig = {
  CONSERVATIVE: {
    gradient: 'from-emerald-600/10 to-teal-600/10',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
    icon: Shield,
    iconColor: 'text-emerald-500',
    accent: 'bg-emerald-500',
  },
  BALANCED: {
    gradient: 'from-blue-600/10 to-indigo-600/10',
    border: 'border-blue-500/20 hover:border-blue-500/40',
    icon: Scale,
    iconColor: 'text-blue-500',
    accent: 'bg-blue-500',
  },
  AGGRESSIVE: {
    gradient: 'from-amber-600/10 to-orange-600/10',
    border: 'border-amber-500/20 hover:border-amber-500/40',
    icon: Zap,
    iconColor: 'text-amber-500',
    accent: 'bg-amber-500',
  },
};

// ─── Component ────────────────────────────────────────────────
interface FinancialTabProps {
  tenderId: string;
  sourceUrl?: string | null;
  platform?: string;
}

export function FinancialTab({ tenderId, sourceUrl, platform }: FinancialTabProps) {
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [noDocs, setNoDocs] = useState(false);
  const [langModalOpen, setLangModalOpen] = useState(false);

  // Single query — loads scenarios + eligibility + flags on mount
  const summaryQuery = trpc.aiRoles.getFinancialSummary.useQuery(
    { tenderId },
    { retry: false, refetchOnWindowFocus: false }
  );

  // Derive display data from query result
  const summaryData = summaryQuery.data;
  const dbScenarios = (summaryData?.scenarios ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    type: nameToType(s.name),
    totalPrice: s.totalPrice,
    margin: s.margin,
    winProbability: s.winProbability ?? 0,
  }));
  const eligibility = summaryData?.eligibility
    ? normalizeEligibility(summaryData.eligibility)
    : null;
  const hasFinancialProfile = summaryData?.hasFinancialProfile ?? false;
  const hasExtractedRequirements = summaryData?.hasExtractedRequirements ?? false;

  // Initialize selectedScenario from DB — MUST be in useEffect to avoid React 18 render warnings
  const hasInitializedScenario = useRef(false);

  useEffect(() => {
    if (summaryQuery.isSuccess && !hasInitializedScenario.current && summaryData?.scenarios) {
      const selected = summaryData.scenarios.find((s: any) => s.isSelected);
      if (selected) {
        setSelectedScenario(nameToType(selected.name));
        hasInitializedScenario.current = true;
      }
    }
  }, [summaryQuery.isSuccess, summaryData?.scenarios]);

  // tRPC mutations
  const selectScenarioMutation = trpc.aiRoles.selectPricingScenario.useMutation({
    onSuccess: () => {
      // selectedScenario state already updated optimistically
    },
    onError: (err: any) => { setError(err?.message || 'Σφάλμα αποθήκευσης σεναρίου'); },
  });

  const extractMutation = trpc.aiRoles.extractFinancials.useMutation({
    onSuccess: (data: any) => {
      summaryQuery.refetch();
      setLoadingAction(null);
      setError(null);
      const count = Array.isArray(data) ? data.length : 0;
      setSuccessMsg(`Ανάλυση ολοκληρώθηκε: ${count} οικονομικές απαιτήσεις εξήχθησαν.`);
    },
    onError: (err: any) => {
      if ((err as any).data?.code === 'PRECONDITION_FAILED') { setNoDocs(true); setLoadingAction(null); return; }
      setError(err?.message || 'Σφάλμα ανάλυσης οικονομικών'); setLoadingAction(null);
    },
  });

  const pricingMutation = trpc.aiRoles.suggestPricing.useMutation({
    onSuccess: () => {
      summaryQuery.refetch();
      setLoadingAction(null);
      setError(null);
    },
    onError: (err: any) => {
      if ((err as any).data?.code === 'PRECONDITION_FAILED') { setNoDocs(true); setLoadingAction(null); return; }
      setError(err?.message || 'Σφάλμα πρότασης τιμολόγησης'); setLoadingAction(null);
    },
  });

  const handleAnalyze = () => {
    setLangModalOpen(true);
  };

  const handleAnalyzeWithLang = (lang: AnalysisLanguage) => {
    setLangModalOpen(false);
    setLoadingAction('analyze');
    setError(null);
    setSuccessMsg(null);
    extractMutation.mutate({ tenderId, language: lang });
  };

  const handleEligibility = async () => {
    setLoadingAction('eligibility');
    setError(null);
    setSuccessMsg(null);
    const result = await summaryQuery.refetch();
    if (result.status === 'error') {
      setError((result.error as any)?.message || 'Σφάλμα ελέγχου επιλεξιμότητας');
    } else {
      const elig = result.data?.eligibility;
      if (elig && elig.checks?.length > 0) {
        const passed = elig.checks.filter((c: any) => c.pass || c.passed).length;
        setSuccessMsg(`Έλεγχος επιλεξιμότητας: ${passed}/${elig.checks.length} κριτήρια πληρούνται.`);
      } else if (!result.data?.hasExtractedRequirements) {
        setError('Εκτελέστε πρώτα "Ανάλυση Οικονομικών" για να εξαχθούν οι οικονομικές απαιτήσεις.');
      } else if (!result.data?.hasFinancialProfile) {
        setSuccessMsg('Οριακά — Συμπληρώστε τα οικονομικά στοιχεία εταιρείας στις Ρυθμίσεις → Οικονομικό Προφίλ.');
      } else {
        setSuccessMsg('Έλεγχος ολοκληρώθηκε.');
      }
    }
    setLoadingAction(null);
  };

  const handlePricing = () => {
    setLoadingAction('pricing');
    setError(null);
    pricingMutation.mutate({ tenderId });
  };

  const eligCfg = eligibility?.status ? eligibilityConfig[eligibility.status] : null;
  const EligIcon = eligCfg?.icon ?? null;

  return (
    <div className="space-y-6">
      {/* No Documents Alert */}
      {noDocs && (
        <NoDocumentsAlert
          tenderId={tenderId}
          sourceUrl={sourceUrl}
          platform={platform}
        />
      )}
      {/* Error Banner */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          <strong>Σφάλμα:</strong> {error}
          <button onClick={() => setError(null)} className="ml-2 underline cursor-pointer">Κλείσιμο</button>
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          {successMsg}
          <button onClick={() => setSuccessMsg(null)} className="ml-2 underline cursor-pointer">Κλείσιμο</button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={handleAnalyze}
          disabled={loadingAction !== null}
          variant="outline"
          className="cursor-pointer gap-2 h-9"
        >
          {loadingAction === 'analyze' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
          Ανάλυση Οικονομικών
        </Button>
        <Button
          onClick={handleEligibility}
          disabled={loadingAction !== null}
          variant="outline"
          className="cursor-pointer gap-2 h-9"
        >
          {loadingAction === 'eligibility' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Έλεγχος Επιλεξιμότητας
        </Button>
        <Button
          onClick={handlePricing}
          disabled={loadingAction !== null}
          variant="outline"
          className="cursor-pointer gap-2 h-9"
        >
          {loadingAction === 'pricing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
          Πρόταση Τιμολόγησης
        </Button>
      </div>

      {/* Eligibility Card */}
      <BlurFade delay={0.05} inView>
      <GlassCard>
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-600 via-blue-500 to-amber-400" />
        <GlassCardHeader className="pt-2">
          <GlassCardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-500" />
            Οικονομική Επιλεξιμότητα
          </GlassCardTitle>
          {eligCfg && EligIcon && (
            <GlassCardAction>
              <div className={cn('flex items-center gap-2 rounded-xl px-3 py-2', eligCfg.bg, 'border', eligCfg.border)}>
                <EligIcon className={cn('h-5 w-5', eligCfg.text)} />
                <span className={cn('text-sm font-bold', eligCfg.text)}>
                  {eligCfg.label}
                </span>
              </div>
            </GlassCardAction>
          )}
        </GlassCardHeader>
        <GlassCardContent className="px-0">
          {summaryQuery.isError ? (
            <div className="px-5 py-4 text-sm text-red-600 dark:text-red-400">
              Σφάλμα φόρτωσης δεδομένων.{' '}
              <button onClick={() => summaryQuery.refetch()} className="underline cursor-pointer">
                Επανάληψη
              </button>
            </div>
          ) : summaryQuery.isLoading ? (
            <div className="space-y-2 px-5 py-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-4/5" />
            </div>
          ) : !hasExtractedRequirements ? (
            <p className="text-xs text-muted-foreground text-center py-6 px-5">
              Εκτελέστε πρώτα <strong>AI Ανάλυση Οικονομικών</strong> για να φορτωθούν τα κριτήρια επιλεξιμότητας.
            </p>
          ) : !hasFinancialProfile ? (
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <MinusCircle className="h-5 w-5 text-amber-500 shrink-0" />
                <span className="text-sm font-bold text-amber-700 dark:text-amber-400">Οριακά</span>
                <span className="text-xs text-muted-foreground">— Λείπουν οικονομικά στοιχεία εταιρείας</span>
              </div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                <strong>Συμπληρώστε τα οικονομικά στοιχεία εταιρείας</strong> για πλήρη ανάλυση επιλεξιμότητας.
                <br />
                <span className="text-xs opacity-80">Μεταβείτε στις Ρυθμίσεις → Οικονομικό Προφίλ.</span>
              </div>
            </div>
          ) : eligibility && eligibility.checks.length > 0 ? (
            <>
              {(() => {
                const total = eligibility.checks.length;
                const passed = eligibility.checks.filter((c) => c.pass).length;
                const failed = total - passed;
                const color =
                  failed === 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : failed < total / 2
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400';
                return (
                  <p className={`text-xs font-semibold px-5 pt-3 pb-1 ${color}`}>
                    {passed} / {total} κριτήρια πληρούνται
                  </p>
                );
              })()}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left px-5 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Κριτήριο</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Απαίτηση</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Πραγματικό</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-16">Αποτέλεσμα</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eligibility.checks.map((check, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="px-5 py-2.5 text-xs font-medium text-foreground">{check.criterion}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">{check.required}</td>
                        <td className="px-3 py-2.5 text-xs text-foreground font-mono font-semibold">{check.actual}</td>
                        <td className="px-3 py-2.5 text-center">
                          {check.pass ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-6 px-5">
              Δεν βρέθηκαν κριτήρια επιλεξιμότητας. Εκτελέστε εκ νέου ανάλυση.
            </p>
          )}
        </GlassCardContent>
      </GlassCard>
      </BlurFade>

      {/* Pricing Scenarios */}
      <BlurFade delay={0.1} inView>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          Σενάρια Τιμολόγησης
        </h3>
        {dbScenarios && dbScenarios.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {dbScenarios.map((scenario) => {
              const cfg = scenarioConfig[scenario.type];
              const ScenarioIcon = cfg.icon;
              const isSelected = selectedScenario === scenario.type;

              return (
                <GlassCard
                  key={scenario.type}
                  className={cn(
                    'relative overflow-hidden transition-all duration-300',
                    isSelected && 'ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/10',
                    !isSelected && 'hover:shadow-lg'
                  )}
                >
                  {/* Gradient Background */}
                  <div className={cn('absolute inset-0 bg-gradient-to-br opacity-40', cfg.gradient)} />

                  <GlassCardContent className="relative space-y-4">
                    {/* Title */}
                    <div className="flex items-center gap-2.5">
                      <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', cfg.gradient.replace('from-', 'bg-').split(' ')[0])}>
                        <ScenarioIcon className={cn('h-4.5 w-4.5', cfg.iconColor)} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{scenario.name}</p>
                        <p className="text-[10px] text-muted-foreground">Σενάριο</p>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="text-center py-2">
                      <p className="text-2xl font-bold tabular-nums text-foreground">
                        {formatCurrency(scenario.totalPrice)}
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="space-y-2.5">
                      {/* Margin */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Percent className="h-3 w-3" />
                          Περιθώριο
                        </span>
                        <span className="font-bold tabular-nums text-foreground">{scenario.margin}%</span>
                      </div>

                      {/* Win Probability */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            Πιθανότητα Κέρδους
                          </span>
                          <span className="font-bold tabular-nums text-foreground">{scenario.winProbability}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all duration-700 ease-out', cfg.accent)}
                            style={{ width: `${scenario.winProbability}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Select Button */}
                    <Button
                      onClick={() => {
                        const newSelected = isSelected ? null : scenario.type;
                        setSelectedScenario(newSelected);
                        if (!isSelected && scenario.id) {
                          selectScenarioMutation.mutate({ tenderId, scenarioId: scenario.id });
                        }
                      }}
                      disabled={selectScenarioMutation.isPending}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      className={cn(
                        'w-full cursor-pointer h-8 text-xs',
                        isSelected && 'bg-gradient-to-r from-blue-700 to-blue-500 border-0 text-white'
                      )}
                    >
                      {isSelected ? 'Επιλεγμένο' : 'Επιλογή'}
                    </Button>
                  </GlassCardContent>
                </GlassCard>
              );
            })}
          </div>
        ) : (
          <GlassCard>
            <GlassCardContent>
              <p className="text-xs text-muted-foreground text-center py-6">
                Δεν υπάρχουν δεδομένα ακόμα. Εκτελέστε ανάλυση AI.
              </p>
            </GlassCardContent>
          </GlassCard>
        )}
      </div>
      </BlurFade>

      <LanguageModal
        open={langModalOpen}
        onSelect={handleAnalyzeWithLang}
        onClose={() => setLangModalOpen(false)}
      />
    </div>
  );
}

export function FinancialTabSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-40" />
      </div>
      <GlassCard>
        <GlassCardContent>
          <Skeleton className="h-6 w-48 mb-3" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4 py-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </GlassCardContent>
      </GlassCard>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <GlassCard key={i}>
            <GlassCardContent>
              <Skeleton className="h-8 w-32 mb-3" />
              <Skeleton className="h-10 w-40 mx-auto mb-3" />
              <Skeleton className="h-3 w-full rounded-full" />
            </GlassCardContent>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
