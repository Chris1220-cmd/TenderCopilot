'use client';

import { useState, useMemo } from 'react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Search,
  Import,
  ExternalLink,
  Building2,
  Calendar,
  Coins,
  Radar,
  Loader2,
} from 'lucide-react';

interface DiscoveredTender {
  title: string;
  referenceNumber: string;
  contractingAuthority: string;
  platform: string;
  budget?: number;
  submissionDeadline: string | null;
  publishedAt: string;
  relevanceScore: number;
  cpvCodes: string[];
  sourceUrl: string;
  summary?: string;
}

interface DiscoveryResultsProps {
  onImport: (tender: any) => void;
}

const platformColors: Record<string, string> = {
  ESIDIS: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20',
  PROMITHEUS: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  COSMOONE: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20',
  DIAVGEIA: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20',
  TED: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
  KIMDIS: 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/20',
  PRIVATE: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20',
};

const platformLabels: Record<string, string> = {
  ESIDIS: 'ΕΣΗΔΗΣ',
  PROMITHEUS: 'ΠΡΟΜΗΘΕΥΣ',
  COSMOONE: 'cosmoONE',
  DIAVGEIA: 'ΔΙΑΥΓΕΙΑ',
  TED: 'TED Europa',
  KIMDIS: 'ΚΗΜΔΗΣ',
  PRIVATE: 'Ιδιωτικός Τομέας',
};

function getRelevanceColor(score: number) {
  if (score > 70) return 'bg-emerald-500';
  if (score > 40) return 'bg-amber-500';
  return 'bg-red-500';
}

function getRelevanceTextColor(score: number) {
  if (score > 70) return 'text-emerald-600 dark:text-emerald-400';
  if (score > 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border bg-white/40 dark:bg-white/[0.04] backdrop-blur-md p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-6 w-16 rounded-md" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-4 w-10" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
    </div>
  );
}

export function DiscoveryResults({ onImport }: DiscoveryResultsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [importingId, setImportingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const { data: tenders, isLoading, error } = trpc.discovery.search.useQuery(
    showAll ? { showAll: true } : undefined
  );

  const filteredTenders = useMemo(() => {
    if (!tenders) return [];
    if (!searchQuery.trim()) return tenders;
    const q = searchQuery.toLowerCase();
    return tenders.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.contractingAuthority.toLowerCase().includes(q) ||
        t.platform.toLowerCase().includes(q) ||
        t.cpvCodes.some((c) => c.toLowerCase().includes(q))
    );
  }, [tenders, searchQuery]);

  function handleImport(tender: DiscoveredTender) {
    setImportingId(tender.referenceNumber);
    onImport(tender);
  }

  return (
    <div className="space-y-4">
      {/* Search + Show All Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Αναζήτηση σε αποτελέσματα..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/50 dark:bg-white/[0.04] backdrop-blur-sm border-white/30 dark:border-white/10"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch
            checked={showAll}
            onCheckedChange={setShowAll}
            id="show-all"
          />
          <Label htmlFor="show-all" className="text-xs text-muted-foreground cursor-pointer">
            Εμφάνιση όλων (χωρίς φίλτρο KAD)
          </Label>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 backdrop-blur-sm px-5 py-4 text-sm text-red-600 dark:text-red-400">
          Σφάλμα φόρτωσης: {error.message}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && filteredTenders.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-muted-foreground/20 bg-white/30 dark:bg-white/[0.02] backdrop-blur-sm py-16 px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-500/10 mb-4">
            <Radar className="h-7 w-7 text-blue-500" />
          </div>
          <p className="text-sm font-medium text-foreground">
            Δεν βρέθηκαν διαγωνισμοί
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground max-w-sm">
            Ενημερώστε τους κωδικούς ΚΑΔ/CPV της εταιρείας σας στις ρυθμίσεις για πιο στοχευμένα αποτελέσματα.
          </p>
        </div>
      )}

      {/* Results */}
      {!isLoading && filteredTenders.length > 0 && (
        <div className="space-y-3">
          {filteredTenders.map((tender) => (
            <div
              key={tender.referenceNumber}
              className={cn(
                'group rounded-xl border p-5 space-y-3',
                'bg-white/50 dark:bg-white/[0.04] backdrop-blur-md',
                'border-white/30 dark:border-white/10',
                'hover:border-blue-500/30 hover:shadow-md hover:shadow-blue-500/5',
                'transition-all duration-300 ease-out'
              )}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                    {tender.title}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">
                      {tender.contractingAuthority}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <Badge
                    className={cn(
                      'text-[10px] font-semibold border',
                      platformColors[tender.platform] || 'bg-gray-500/15 text-gray-600 border-gray-500/20'
                    )}
                  >
                    {platformLabels[tender.platform] || tender.platform}
                  </Badge>
                  {tender.relevanceScore > 0 ? (
                    <Badge className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                      Σχετικός με KAD
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      Γενικός
                    </Badge>
                  )}
                </div>
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {tender.budget != null && (
                  <div className="flex items-center gap-1.5">
                    <Coins className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-medium text-foreground">
                      {formatCurrency(tender.budget)}
                    </span>
                  </div>
                )}
                {tender.submissionDeadline && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-xs text-muted-foreground">
                      {formatDate(tender.submissionDeadline)}
                    </span>
                  </div>
                )}
              </div>

              {/* CPV codes */}
              {tender.cpvCodes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tender.cpvCodes.slice(0, 4).map((code) => (
                    <span
                      key={code}
                      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono bg-muted/60 text-muted-foreground"
                    >
                      {code}
                    </span>
                  ))}
                  {tender.cpvCodes.length > 4 && (
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      +{tender.cpvCodes.length - 4}
                    </span>
                  )}
                </div>
              )}

              {/* Relevance bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500 ease-out',
                      getRelevanceColor(tender.relevanceScore)
                    )}
                    style={{ width: `${tender.relevanceScore}%` }}
                  />
                </div>
                <span
                  className={cn(
                    'text-xs font-semibold tabular-nums',
                    getRelevanceTextColor(tender.relevanceScore)
                  )}
                >
                  {tender.relevanceScore}%
                </span>
              </div>

              <Separator className="opacity-50" />

              {/* Actions */}
              <div className="flex items-center justify-between">
                {tender.sourceUrl && (
                  <a
                    href={tender.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-blue-500 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Πηγή
                  </a>
                )}
                {!tender.sourceUrl && <span />}
                <Button
                  size="sm"
                  onClick={() => handleImport(tender)}
                  disabled={importingId === tender.referenceNumber}
                  className={cn(
                    'cursor-pointer text-xs h-8',
                    'bg-gradient-to-r from-blue-600 to-blue-500',
                    'hover:from-blue-500 hover:to-blue-400',
                    'shadow-sm shadow-blue-500/20',
                    'border-0 text-white'
                  )}
                >
                  {importingId === tender.referenceNumber ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Import className="h-3.5 w-3.5" />
                  )}
                  Εισαγωγή
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
