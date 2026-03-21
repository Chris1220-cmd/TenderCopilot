'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  Trophy,
  XCircle,
  LogOut,
  Ban,
  ChevronDown,
  Loader2,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

interface OutcomePanelProps {
  tenderId: string;
  currentStatus: string;
}

const outcomes = [
  { value: 'won' as const, label: 'Κερδίσαμε', icon: Trophy, color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20' },
  { value: 'lost' as const, label: 'Χάσαμε', icon: XCircle, color: 'text-red-600', bg: 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20' },
  { value: 'withdrew' as const, label: 'Αποσυρθήκαμε', icon: LogOut, color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20' },
  { value: 'disqualified' as const, label: 'Αποκλειστήκαμε', icon: Ban, color: 'text-red-700', bg: 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20' },
] as const;

export function OutcomePanel({ tenderId, currentStatus }: OutcomePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [winAmount, setWinAmount] = useState('');
  const { toast } = useToast();

  const recordMutation = trpc.learning.recordOutcome.useMutation({
    onSuccess: () => {
      toast({ title: 'Αποτέλεσμα καταγράφηκε', description: 'Ο AI μαθαίνει από αυτή την εμπειρία.' });
      setExpanded(false);
      setSelectedOutcome(null);
      setReason('');
    },
    onError: (err: any) => {
      toast({ title: 'Σφάλμα', description: err.message, variant: 'destructive' });
    },
  });

  const statsQuery = trpc.learning.getOutcomeStats.useQuery(undefined, {
    enabled: expanded,
  });

  // Only show for SUBMITTED or later statuses
  if (!['SUBMITTED', 'IN_PROGRESS', 'GO_NO_GO'].includes(currentStatus)) return null;

  const handleSubmit = () => {
    if (!selectedOutcome) return;
    recordMutation.mutate({
      tenderId,
      outcome: selectedOutcome as any,
      reason: reason || undefined,
      bidAmount: bidAmount ? parseFloat(bidAmount) : undefined,
      winAmount: winAmount ? parseFloat(winAmount) : undefined,
    });
  };

  const stats = statsQuery.data;

  return (
    <div className="rounded-xl border border-border/50 bg-white/40 dark:bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">Αποτέλεσμα Διαγωνισμού</span>
          {stats && stats.total > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
              Win rate: {Math.round(stats.winRate)}%
            </span>
          )}
        </div>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
          {/* Stats summary */}
          {stats && stats.total > 0 && (
            <div className="flex gap-3 text-[11px]">
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-500" />
                {stats.won} νίκες
              </span>
              <span className="flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-red-500" />
                {stats.lost} ήττες
              </span>
              <span className="text-muted-foreground">
                {stats.total} σύνολο
              </span>
            </div>
          )}

          {/* Outcome buttons */}
          <div className="grid grid-cols-2 gap-2">
            {outcomes.map((o) => (
              <button
                key={o.value}
                onClick={() => setSelectedOutcome(o.value)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all cursor-pointer',
                  selectedOutcome === o.value
                    ? `${o.bg} ring-2 ring-offset-1 ring-blue-500/30`
                    : `${o.bg} opacity-70`
                )}
              >
                <o.icon className={cn('h-4 w-4', o.color)} />
                {o.label}
              </button>
            ))}
          </div>

          {/* Details form */}
          {selectedOutcome && (
            <div className="space-y-2 pt-1">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={selectedOutcome === 'won' ? 'Γιατί κερδίσαμε; (προαιρετικό)' : 'Γιατί χάσαμε/αποκλειστήκαμε; (προαιρετικό)'}
                className="w-full rounded-lg border border-border/50 bg-white/60 dark:bg-white/[0.04] px-3 py-2 text-xs resize-none h-16 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder="Δική μας προσφορά (€)"
                  className="flex-1 rounded-lg border border-border/50 bg-white/60 dark:bg-white/[0.04] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                {(selectedOutcome === 'lost') && (
                  <input
                    type="number"
                    value={winAmount}
                    onChange={(e) => setWinAmount(e.target.value)}
                    placeholder="Νικήτρια προσφορά (€)"
                    className="flex-1 rounded-lg border border-border/50 bg-white/60 dark:bg-white/[0.04] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                )}
              </div>
              <Button
                onClick={handleSubmit}
                disabled={recordMutation.isPending}
                size="sm"
                className="w-full cursor-pointer text-xs bg-gradient-to-r from-blue-600 to-blue-500 text-white"
              >
                {recordMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  'Καταγραφή & Μάθηση'
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
