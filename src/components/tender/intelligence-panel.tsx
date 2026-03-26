'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { trpc } from '@/lib/trpc';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { LanguageModal, type AnalysisLanguage } from '@/components/tender/language-modal';
import { BlurFade } from '@/components/ui/blur-fade';
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Loader2,
  Play,
  RefreshCw,
  Users,
  Building2,
  Repeat,
  Clock,
  Sparkles,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface IntelligencePanelProps {
  tenderId: string;
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return `€${n.toLocaleString('el-GR')}`;
}

export function TenderIntelligencePanel({ tenderId }: IntelligencePanelProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [langModalOpen, setLangModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const cachedQuery = trpc.aiRoles.getIntelligence.useQuery({ tenderId });
  const generateMutation = trpc.aiRoles.generateIntelligence.useMutation({
    onSuccess: () => {
      setIsAnalyzing(false);
      utils.aiRoles.getIntelligence.invalidate({ tenderId });
    },
    onError: (err) => {
      setIsAnalyzing(false);
      toast({ title: t('intelligence.errorAnalysis'), description: err.message, variant: 'destructive' });
    },
  });

  const handleAnalyze = () => setLangModalOpen(true);
  const handleAnalyzeWithLang = (lang: AnalysisLanguage) => {
    setLangModalOpen(false);
    setIsAnalyzing(true);
    generateMutation.mutate({ tenderId, language: lang });
  };

  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const data = cachedQuery.data;
  const isLoading = cachedQuery.isLoading;
  const hasData = !!data;

  const similarAwards = (data?.similarAwards as any[]) ?? [];
  const competitors = (data?.competitors as any[]) ?? [];
  const authority = (data?.authorityProfile as any) ?? {};
  const repeat = (data?.repeatTender as any) ?? { found: false };
  const prepTime = (data?.prepTimeEstimate as any) ?? {};
  const advisory = (data?.aiAdvisory as any) ?? { bullets: [] };

  const amounts = similarAwards.filter((a: any) => a.amount).map((a: any) => a.amount as number);
  const avgPrice = amounts.length > 0 ? Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length) : null;
  const minPrice = amounts.length > 0 ? Math.min(...amounts) : null;
  const maxPrice = amounts.length > 0 ? Math.max(...amounts) : null;

  return (
    <BlurFade delay={0.15}>
      <div className="group rounded-xl border border-border/60 bg-card transition-colors hover:border-primary/20">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4.5 w-4.5 text-primary" />
            <h3 className="font-semibold text-foreground">{t('intelligence.title')}</h3>
            {hasData && (
              <Badge variant="outline" className="text-xs tabular-nums">
                {t('intelligence.similarFound').replace('{{count}}', String(similarAwards.length))}
              </Badge>
            )}
          </div>
          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            variant="outline"
            size="sm"
            className="gap-2 cursor-pointer h-8"
          >
            {isAnalyzing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : hasData ? (
              <RefreshCw className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {isAnalyzing ? t('intelligence.analyzing') : hasData ? t('intelligence.refresh') : t('intelligence.analyze')}
          </Button>
        </div>

        <div className="border-t border-border/40">
          {isLoading ? (
            <div className="p-5 space-y-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-52" />
            </div>
          ) : !hasData ? (
            <div className="p-5 text-center text-sm text-muted-foreground">
              {t('intelligence.noData')}
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {/* Repeat Alert */}
              {repeat.found && (
                <div className="px-5 py-3 bg-amber-500/10">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                    <Repeat className="h-4 w-4" />
                    {t('intelligence.repeatAlert')}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {t('intelligence.previousWinner')}: <strong className="text-foreground">{repeat.previousWinner}</strong>
                    {repeat.previousAmount && <> — {fmt(repeat.previousAmount)}</>}
                    {repeat.previousDate && <> ({repeat.previousDate})</>}
                  </div>
                </div>
              )}

              {/* Market Overview */}
              {amounts.length > 0 && (
                <div className="px-5 py-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    {t('intelligence.marketOverview')}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('intelligence.avgAwardPrice')}:</span>
                      <div className="font-semibold text-foreground tabular-nums">{fmt(avgPrice)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('intelligence.priceRange')}:</span>
                      <div className="font-semibold text-foreground tabular-nums">{fmt(minPrice)} — {fmt(maxPrice)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Competitors */}
              {competitors.length > 0 && (
                <div>
                  <button
                    onClick={() => toggle('comp')}
                    className="flex w-full items-center justify-between px-5 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Users className="h-4 w-4 text-primary" />
                      {t('intelligence.competitors')} ({competitors.length})
                    </div>
                    {expanded.comp ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  </button>
                  <AnimatePresence>
                    {expanded.comp && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-3 space-y-1.5">
                          {competitors.map((c: any, i: number) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="text-foreground truncate">{c.name}</span>
                              <div className="flex items-center gap-3 shrink-0 ml-3 text-muted-foreground tabular-nums">
                                <span>{c.wins} {t('intelligence.wins')}</span>
                                {c.avgAmount && <span>{fmt(c.avgAmount)}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Authority Profile */}
              {authority.totalTenders > 0 && (
                <div>
                  <button
                    onClick={() => toggle('auth')}
                    className="flex w-full items-center justify-between px-5 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Building2 className="h-4 w-4 text-primary" />
                      {t('intelligence.authorityProfile')}
                    </div>
                    {expanded.auth ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  </button>
                  <AnimatePresence>
                    {expanded.auth && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-3 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('intelligence.totalTenders')}:</span>
                            <span className="text-foreground font-medium">{authority.totalTenders}</span>
                          </div>
                          {authority.avgDiscount != null && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t('intelligence.avgDiscount')}:</span>
                              <span className="text-foreground font-medium">{authority.avgDiscount}%</span>
                            </div>
                          )}
                          {authority.avgBidders != null && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t('intelligence.avgBidders')}:</span>
                              <span className="text-foreground font-medium">{authority.avgBidders}</span>
                            </div>
                          )}
                          {authority.topWinners?.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border/30">
                              {authority.topWinners.map((w: any, i: number) => (
                                <div key={i} className="flex justify-between text-sm">
                                  <span className="text-foreground truncate">{w.name}</span>
                                  <span className="text-muted-foreground tabular-nums shrink-0 ml-2">{w.wins} {t('intelligence.wins')}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Prep Time */}
              {prepTime.avgDays != null && (
                <div className="px-5 py-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-1">
                    <Clock className="h-4 w-4 text-primary" />
                    {t('intelligence.prepTime')}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">{t('intelligence.avgPrepDays')}: <strong className="text-foreground">{prepTime.avgDays}d</strong></span>
                    <span className="text-muted-foreground">{t('intelligence.daysAvailable')}: <strong className={cn('text-foreground', prepTime.isTight && 'text-destructive')}>{prepTime.currentDaysLeft}d</strong></span>
                    {prepTime.isTight && (
                      <Badge variant="destructive" className="text-xs gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {t('intelligence.tight')}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* AI Advisory */}
              {advisory.bullets?.length > 0 && (
                <div className="px-5 py-3 bg-primary/5">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {t('intelligence.aiAdvisory')}
                  </div>
                  <ul className="space-y-1.5">
                    {advisory.bullets.map((bullet: string, i: number) => (
                      <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                        <span className="text-primary mt-0.5 shrink-0">&#8226;</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Cache timestamp */}
              {data?.fetchedAt && (
                <div className="px-5 py-2 text-[11px] text-muted-foreground/60">
                  {t('intelligence.cachedAt')}: {new Date(data.fetchedAt).toLocaleString('el-GR')}
                </div>
              )}
            </div>
          )}
        </div>

        <LanguageModal
          open={langModalOpen}
          onSelect={handleAnalyzeWithLang}
          onClose={() => setLangModalOpen(false)}
        />
      </div>
    </BlurFade>
  );
}
