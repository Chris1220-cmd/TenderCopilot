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
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { BlurFade } from '@/components/ui/blur-fade';

interface OutcomePanelProps {
  tenderId: string;
  currentStatus: string;
}

const outcomes = [
  { value: 'won' as const, label: 'Κερδισαμε', icon: Trophy, color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20' },
  { value: 'lost' as const, label: 'Χασαμε', icon: XCircle, color: 'text-red-600', bg: 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20' },
  { value: 'withdrew' as const, label: 'Αποσυρθηκαμε', icon: LogOut, color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20' },
  { value: 'disqualified' as const, label: 'Αποκλειστηκαμε', icon: Ban, color: 'text-red-700', bg: 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20' },
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
      toast({ title: 'Αποτελεσμα καταγραφηκε', description: 'Ο AI μαθαινει απο αυτη την εμπειρια.' });
      setExpanded(false);
      setSelectedOutcome(null);
      setReason('');
    },
    onError: (err: any) => {
      toast({ title: 'Σφαλμα', description: err.message, variant: 'destructive' });
    },
  });

  const statsQuery = trpc.learning.getOutcomeStats.useQuery(undefined, { enabled: expanded });

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
    <BlurFade delay={0.1} inView>
      <GlassCard className="overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">Αποτελεσμα Διαγωνισμου</span>
            {stats && stats.total > 0 && (
              <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                Win rate: {Math.round(stats.winRate)}%
              </span>
            )}
          </div>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
        </button>

        {expanded && (
          <GlassCardContent className="space-y-3 border-t border-border/30 pt-3">
            {stats && stats.total > 0 && (
              <div className="flex gap-3 text-[11px]">
                <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-emerald-500" />{stats.won} νικες</span>
                <span className="flex items-center gap-1"><TrendingDown className="w-3 h-3 text-red-500" />{stats.lost} ηττες</span>
                <span className="text-muted-foreground">{stats.total} συνολο</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {outcomes.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setSelectedOutcome(o.value)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all cursor-pointer',
                    selectedOutcome === o.value ? `${o.bg} ring-2 ring-offset-1 ring-blue-500/30` : `${o.bg} opacity-70`
                  )}
                >
                  <o.icon className={cn('h-4 w-4', o.color)} />
                  {o.label}
                </button>
              ))}
            </div>

            {selectedOutcome && (
              <div className="space-y-2 pt-1">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={selectedOutcome === 'won' ? 'Γιατι κερδισαμε; (προαιρετικο)' : 'Γιατι χασαμε/αποκλειστηκαμε; (προαιρετικο)'}
                  className="w-full rounded-lg border border-border/50 bg-white/60 dark:bg-white/[0.04] px-3 py-2 text-xs resize-none h-16 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <div className="flex gap-2">
                  <input type="number" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)}
                    placeholder="Δικη μας προσφορα (EUR)"
                    className="flex-1 rounded-lg border border-border/50 bg-white/60 dark:bg-white/[0.04] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                  {selectedOutcome === 'lost' && (
                    <input type="number" value={winAmount} onChange={(e) => setWinAmount(e.target.value)}
                      placeholder="Νικητρια προσφορα (EUR)"
                      className="flex-1 rounded-lg border border-border/50 bg-white/60 dark:bg-white/[0.04] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                  )}
                </div>
                <Button onClick={handleSubmit} disabled={recordMutation.isPending} size="sm"
                  className="w-full cursor-pointer text-xs bg-primary text-primary-foreground hover:bg-primary/90">
                  {recordMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Καταγραφη & Μαθηση'}
                </Button>
              </div>
            )}
          </GlassCardContent>
        )}
      </GlassCard>
    </BlurFade>
  );
}
