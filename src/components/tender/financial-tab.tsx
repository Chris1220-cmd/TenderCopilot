'use client';

import { useState } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardContent,
  GlassCardAction,
  GlassCardFooter,
} from '@/components/ui/glass-card';
import {
  Banknote,
  TrendingUp,
  TrendingDown,
  Calculator,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Loader2,
  Shield,
  Target,
  Percent,
  DollarSign,
  BarChart3,
  AlertTriangle,
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
  name: string;
  type: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';
  totalPrice: number;
  margin: number; // percentage
  winProbability: number; // percentage
  breakdown?: { item: string; amount: number }[];
}

interface FinancialRiskFactor {
  name: string;
  score: number;
  description: string;
}

interface FinancialData {
  eligibility: EligibilityResult;
  scenarios: PricingScenario[];
  riskScore: number;
  riskFactors: FinancialRiskFactor[];
}

// ─── Helpers ──────────────────────────────────────────────────
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

function getScoreColor(score: number) {
  if (score <= 30) return 'text-emerald-600 dark:text-emerald-400';
  if (score <= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function getBarColor(score: number) {
  if (score <= 30) return 'bg-emerald-500';
  if (score <= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

function getBarBg(score: number) {
  if (score <= 30) return 'bg-emerald-500/10';
  if (score <= 60) return 'bg-amber-500/10';
  return 'bg-red-500/10';
}

// ─── Component ────────────────────────────────────────────────
interface FinancialTabProps {
  tenderId: string;
}

export function FinancialTab({ tenderId }: FinancialTabProps) {
  const [data, setData] = useState<FinancialData | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // tRPC mutations
  const extractMutation = trpc.aiRoles.extractFinancials.useMutation({
    onSuccess: (result: any) => {
      if (result) setData((prev) => prev ? { ...prev, ...result } : result);
      setLoadingAction(null);
    },
    onError: () => setLoadingAction(null),
  });

  // checkFinancialEligibility is a query, so we use useQuery with enabled flag
  const eligibilityQuery = trpc.aiRoles.checkFinancialEligibility.useQuery(
    { tenderId },
    {
      enabled: false, // manually triggered via refetch
      retry: false,
    }
  );

  const pricingMutation = trpc.aiRoles.suggestPricing.useMutation({
    onSuccess: (result: any) => {
      if (result?.scenarios) setData((prev) => prev ? { ...prev, scenarios: result.scenarios } : null);
      setLoadingAction(null);
    },
    onError: () => setLoadingAction(null),
  });

  const handleAnalyze = () => {
    setLoadingAction('analyze');
    extractMutation.mutate({ tenderId });
  };

  const handleEligibility = async () => {
    setLoadingAction('eligibility');
    try {
      const res = await eligibilityQuery.refetch();
      if (res.data) {
        setData((prev) => prev ? { ...prev, eligibility: res.data as any } : null);
      }
    } catch {
      // show error — no fallback
    }
    setLoadingAction(null);
  };

  const handlePricing = () => {
    setLoadingAction('pricing');
    pricingMutation.mutate({ tenderId });
  };

  const eligCfg = data ? eligibilityConfig[data.eligibility.status] : null;
  const EligIcon = eligCfg?.icon ?? null;

  return (
    <div className="space-y-6">
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
          {data?.eligibility?.checks && data.eligibility.checks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left px-5 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Κριτήριο
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Απαίτηση
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Πραγματικό
                    </th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-16">
                      Αποτέλεσμα
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.eligibility.checks.map((check, i) => (
                    <tr key={i} className="border-b border-border/30">
                      <td className="px-5 py-2.5 text-xs font-medium text-foreground">
                        {check.criterion}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">
                        {check.required}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-foreground font-mono font-semibold">
                        {check.actual}
                      </td>
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
          ) : (
            <p className="text-xs text-muted-foreground text-center py-6 px-5">
              Δεν υπάρχουν δεδομένα ακόμα. Εκτελέστε ανάλυση AI.
            </p>
          )}
        </GlassCardContent>
      </GlassCard>

      {/* Pricing Scenarios */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          Σενάρια Τιμολόγησης
        </h3>
        {data?.scenarios && data.scenarios.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {data.scenarios.map((scenario) => {
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
                      onClick={() => setSelectedScenario(isSelected ? null : scenario.type)}
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

      {/* Financial Risk Score */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            Οικονομικός Κίνδυνος
          </GlassCardTitle>
          {data && (
            <GlassCardAction>
              <div className="flex items-baseline gap-1.5">
                <span className={cn('text-3xl font-bold tabular-nums', getScoreColor(data.riskScore))}>
                  {data.riskScore}
                </span>
                <span className="text-xs text-muted-foreground">/ 100</span>
              </div>
            </GlassCardAction>
          )}
        </GlassCardHeader>
        <GlassCardContent>
          {data?.riskFactors && data.riskFactors.length > 0 ? (
            <div className="space-y-3">
              {/* Overall Risk Bar */}
              <div className={cn('h-2.5 w-full rounded-full overflow-hidden', getBarBg(data.riskScore))}>
                <div
                  className={cn('h-full rounded-full transition-all duration-700 ease-out', getBarColor(data.riskScore))}
                  style={{ width: `${data.riskScore}%` }}
                />
              </div>

              {/* Factor Breakdown */}
              <div className="space-y-2.5 mt-4">
                {data.riskFactors.map((factor, i) => (
                  <div key={i} className="group">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-foreground w-44 shrink-0 truncate">
                        {factor.name}
                      </span>
                      <div className="flex-1">
                        <div className={cn('h-2 w-full rounded-full overflow-hidden', getBarBg(factor.score))}>
                          <div
                            className={cn('h-full rounded-full transition-all duration-500 ease-out', getBarColor(factor.score))}
                            style={{ width: `${factor.score}%` }}
                          />
                        </div>
                      </div>
                      <span className={cn('text-xs font-bold tabular-nums w-8 text-right', getScoreColor(factor.score))}>
                        {factor.score}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5 pl-44 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {factor.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-6">
              Δεν υπάρχουν δεδομένα ακόμα. Εκτελέστε ανάλυση AI.
            </p>
          )}
        </GlassCardContent>
      </GlassCard>
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
