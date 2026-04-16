'use client';

import { trpc } from '@/lib/trpc';
import { TrendingUp, TrendingDown, Minus, BarChart3, Loader2 } from 'lucide-react';

interface PricingInsightCardProps {
  tenderId: string;
  onViewDetails?: () => void;
}

export function PricingInsightCard({ tenderId, onViewDetails }: PricingInsightCardProps) {
  const { data, isLoading, error } = trpc.pricingIntelligence.pricingAdvice.useQuery(
    { tenderId, language: 'el' },
    { staleTime: 5 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Pricing Intelligence</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return null; // Don't show card if no data available
  }

  const { stats, aiAdvice } = data;

  if (stats.confidence === 'insufficient') {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-6">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Pricing Intelligence</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Δεν υπάρχουν αρκετά ιστορικά δεδομένα για αυτή την κατηγορία.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-card p-6 hover:border-primary/40 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Pricing Intelligence</h3>
            <span className="text-xs text-muted-foreground">{stats.sampleSize} ιστορικές κατακυρώσεις</span>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          stats.confidence === 'high' ? 'bg-emerald-500/10 text-emerald-600' :
          stats.confidence === 'medium' ? 'bg-amber-500/10 text-amber-600' :
          'bg-red-500/10 text-red-600'
        }`}>
          {stats.confidence === 'high' ? 'Υψηλή εμπιστοσύνη' :
           stats.confidence === 'medium' ? 'Μέτρια εμπιστοσύνη' : 'Χαμηλή εμπιστοσύνη'}
        </span>
      </div>

      {/* Price Range */}
      {stats.recommendedRange && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <TrendingDown className="h-3 w-3 mx-auto mb-1 text-emerald-500" />
            <p className="text-xs text-muted-foreground">Χαμηλή</p>
            <p className="text-sm font-semibold">€{stats.recommendedRange.low.toLocaleString()}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-primary/5 border border-primary/20">
            <Minus className="h-3 w-3 mx-auto mb-1 text-primary" />
            <p className="text-xs text-muted-foreground">Πρόταση</p>
            <p className="text-sm font-bold text-primary">€{stats.recommendedRange.mid.toLocaleString()}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <TrendingUp className="h-3 w-3 mx-auto mb-1 text-amber-500" />
            <p className="text-xs text-muted-foreground">Υψηλή</p>
            <p className="text-sm font-semibold">€{stats.recommendedRange.high.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* AI Summary */}
      {aiAdvice?.summary && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{aiAdvice.summary}</p>
      )}

      {/* CTA */}
      {onViewDetails && (
        <button
          type="button"
          onClick={onViewDetails}
          className="w-full text-center text-xs font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer"
        >
          Δες πλήρη ανάλυση →
        </button>
      )}
    </div>
  );
}
