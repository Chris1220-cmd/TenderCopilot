'use client';

import { trpc } from '@/lib/trpc';
import { BarChart3, Users, Building2, TrendingUp, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

interface PricingIntelligenceTabProps {
  tenderId: string;
}

export function PricingIntelligenceTab({ tenderId }: PricingIntelligenceTabProps) {
  const { data, isLoading } = trpc.pricingIntelligence.pricingAdvice.useQuery(
    { tenderId, language: 'el' },
    { staleTime: 5 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Ανάλυση τιμολόγησης...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p>Δεν υπάρχουν διαθέσιμα δεδομένα τιμολόγησης.</p>
      </div>
    );
  }

  const { stats, aiAdvice } = data;

  return (
    <div className="space-y-6">
      {/* AI Recommendation Banner */}
      {aiAdvice && (
        <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold mb-1">Σύσταση AI</h2>
              <p className="text-sm text-muted-foreground mb-3">{aiAdvice.summary}</p>
              <div className="rounded-lg bg-card/80 border border-border/40 p-4 mb-3">
                <p className="font-medium">{aiAdvice.recommendation}</p>
              </div>
              {aiAdvice.reasoning.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Αιτιολόγηση</p>
                  <ul className="space-y-1">
                    {aiAdvice.reasoning.map((r: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-500 shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {aiAdvice.risks.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Κίνδυνοι</p>
                  <ul className="space-y-1">
                    {aiAdvice.risks.map((r: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-500 shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Price Range */}
        {stats.recommendedRange && (
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Εύρος Τιμών
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Επιθετική (p25)</span>
                <span className="font-semibold">€{stats.recommendedRange.low.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-primary">Προτεινόμενη (μέση)</span>
                <span className="font-bold text-primary text-lg">€{stats.recommendedRange.mid.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Συντηρητική (p75)</span>
                <span className="font-semibold">€{stats.recommendedRange.high.toLocaleString()}</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border/40">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Εμπιστοσύνη: {stats.confidence}</span>
                <span>{stats.sampleSize} δείγματα</span>
              </div>
            </div>
          </div>
        )}

        {/* Ratio Statistics */}
        {stats.ratioStats.count > 0 && (
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Στατιστικά Αναλογίας Τιμής/Προϋπολογισμού
            </h3>
            <div className="space-y-2">
              {[
                ['Μέσος όρος', stats.ratioStats.mean ? `${(stats.ratioStats.mean * 100).toFixed(1)}%` : 'N/A'],
                ['Διάμεσος', stats.ratioStats.median ? `${(stats.ratioStats.median * 100).toFixed(1)}%` : 'N/A'],
                ['Εύρος', stats.ratioStats.min != null && stats.ratioStats.max != null ? `${(stats.ratioStats.min * 100).toFixed(1)}% — ${(stats.ratioStats.max * 100).toFixed(1)}%` : 'N/A'],
                ['Τυπ. Απόκλιση', stats.ratioStats.stdDev ? `${(stats.ratioStats.stdDev * 100).toFixed(2)}%` : 'N/A'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Competitors */}
        {stats.topCompetitors.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Κορυφαίοι Ανταγωνιστές
            </h3>
            <div className="space-y-2">
              {stats.topCompetitors.slice(0, 5).map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold shrink-0">
                      {i + 1}
                    </span>
                    <span className="truncate">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-muted-foreground">{c.wins} νίκες</span>
                    {c.avgAmount && (
                      <span className="font-medium">€{c.avgAmount.toLocaleString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Authority Profile */}
        {stats.authority && stats.authority.totalAwards > 0 && (
          <div className="rounded-xl border border-border/60 bg-card p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Προφίλ Αναθέτουσας Αρχής
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Συνολικές κατακυρώσεις</span>
                <span className="font-medium">{stats.authority.totalAwards}</span>
              </div>
              {stats.authority.avgAmount && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Μέσο ποσό</span>
                  <span className="font-medium">€{stats.authority.avgAmount.toLocaleString()}</span>
                </div>
              )}
              {stats.authority.avgRatio && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Μέση αναλογία</span>
                  <span className="font-medium">{(stats.authority.avgRatio * 100).toFixed(1)}%</span>
                </div>
              )}
              {stats.authority.topWinners.length > 0 && (
                <div className="pt-2 border-t border-border/40">
                  <p className="text-xs text-muted-foreground mb-1">Top νικητές:</p>
                  {stats.authority.topWinners.slice(0, 3).map((w: any, i: number) => (
                    <p key={i} className="text-xs">
                      {w.name} ({w.wins} νίκες)
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
