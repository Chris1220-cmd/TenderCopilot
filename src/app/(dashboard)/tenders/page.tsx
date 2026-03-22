'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn, formatDate, formatCurrency } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { MagicCard } from '@/components/ui/magic-card';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { PremiumEmptyState } from '@/components/ui/premium-empty-state';
import {
  Plus,
  Search,
  FileText,
  Calendar,
  Building2,
  TrendingUp,
  Filter,
  Trash2,
} from 'lucide-react';

const statusConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }
> = {
  DRAFT: { label: 'Πρόχειρο', variant: 'secondary' },
  DISCOVERY: { label: 'Εύρεση', variant: 'default' },
  GO_NO_GO: { label: 'Go/No-Go', variant: 'default' },
  IN_PROGRESS: { label: 'Σε εξέλιξη', variant: 'warning' },
  REVIEW: { label: 'Αξιολόγηση', variant: 'default' },
  SUBMITTED: { label: 'Υποβλήθηκε', variant: 'success' },
  WON: { label: 'Κερδήθηκε', variant: 'success' },
  LOST: { label: 'Χάθηκε', variant: 'destructive' },
};

const platformConfig: Record<string, { label: string; color: string }> = {
  ESIDIS: { label: 'ΕΣΗΔΗΣ', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  KIMDIS: { label: 'ΚΗΜΔΗΣ', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  PROMITHEUS: { label: 'ΠΡΟΜΗΘΕΥΣ', color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400' },
  DIAVGEIA: { label: 'ΔΙΑΥΓΕΙΑ', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  TED: { label: 'TED Europa', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
  COSMOONE: { label: 'cosmoONE', color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  PRIVATE: { label: 'Ιδιωτικός', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  OTHER: { label: 'Άλλο', color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400' },
};


function ComplianceBar({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
      : score >= 60
        ? 'bg-gradient-to-r from-amber-400 to-amber-600'
        : 'bg-gradient-to-r from-red-400 to-red-600';
  const bgColor =
    score >= 80
      ? 'bg-emerald-500/10'
      : score >= 60
        ? 'bg-amber-500/10'
        : 'bg-red-500/10';

  return (
    <div className="flex items-center gap-2.5">
      <div className={cn('h-2 w-20 overflow-hidden rounded-full', bgColor)}>
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums text-muted-foreground">
        {score}%
      </span>
    </div>
  );
}

export default function TendersPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const tendersQuery = trpc.tender.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const deleteMutation = trpc.tender.delete.useMutation({
    onSuccess: () => {
      setDeleteId(null);
      utils.tender.list.invalidate();
    },
  });

  const tenders = (tendersQuery.data ?? []) as any[];
  const tenderToDelete = deleteId ? tenders.find((t: any) => t.id === deleteId) : null;

  // Apply filters
  const filteredTenders = tenders.filter((tender) => {
    if (statusFilter !== 'all' && tender.status !== statusFilter) return false;
    if (platformFilter !== 'all' && tender.platform !== platformFilter)
      return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        tender.title.toLowerCase().includes(q) ||
        tender.referenceNumber.toLowerCase().includes(q) ||
        tender.contractingAuthority.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <BlurFade delay={0} inView>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Διαγωνισμοί</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Διαχειριστείτε τους διαγωνισμούς και τους φακέλους σας
            </p>
          </div>
          <Link href="/tenders/new">
            <ShimmerButton
              shimmerColor="#06B6D4"
              shimmerSize="0.05em"
              background="linear-gradient(135deg, #3B82F6, #06B6D4)"
              className="px-5 py-2.5 text-sm font-semibold cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Νέος Διαγωνισμός
            </ShimmerButton>
          </Link>
        </div>
      </BlurFade>

      {/* Filters */}
      <GlassCard>
        <GlassCardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground" />

            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Αναζήτηση διαγωνισμών..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Κατάσταση" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Όλες οι καταστάσεις</SelectItem>
                {Object.entries(statusConfig).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Πλατφόρμα" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Όλες οι πλατφόρμες</SelectItem>
                {Object.entries(platformConfig).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Tenders Grid */}
      {filteredTenders.length === 0 ? (
        /* Empty state */
        <PremiumEmptyState
          imageSrc="/images/illustrations/empty-tenders.png"
          title="Κανένας διαγωνισμός"
          description={
            searchQuery || statusFilter !== 'all' || platformFilter !== 'all'
              ? 'Δεν βρέθηκαν αποτελέσματα. Δοκιμάστε διαφορετικά φίλτρα.'
              : 'Δημιουργήστε τον πρώτο σας διαγωνισμό για να ξεκινήσετε.'
          }
          action={
            !searchQuery && statusFilter === 'all' && platformFilter === 'all'
              ? { label: 'Νέος Διαγωνισμός', href: '/tenders/new' }
              : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTenders.map((tender, i) => {
            const status = statusConfig[tender.status] || statusConfig.DRAFT;
            const platform = platformConfig[tender.platform] || platformConfig.OTHER;

            return (
              <BlurFade key={tender.id} delay={0.05 + i * 0.06} inView>
                <MagicCard
                  className="h-full rounded-2xl border-white/[0.06]"
                  gradientSize={250}
                  gradientColor="#1a1a2e"
                  gradientFrom="#3B82F6"
                  gradientTo="#06B6D4"
                >
                  <div className="group relative h-full">
                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteId(tender.id);
                      }}
                      className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-red-500/10 hover:bg-red-500/20 text-red-500 cursor-pointer"
                      title="Διαγραφή"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    <Link href={`/tenders/${tender.id}`} className="cursor-pointer">
                      <div className="p-5">
                        <div className="space-y-4">
                          {/* Top row: badges */}
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant={status.variant}>{status.label}</Badge>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                platform.color
                              )}
                            >
                              {platform.label}
                            </span>
                          </div>

                          {/* Title */}
                          <div>
                            <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary transition-colors duration-200">
                              {tender.title}
                            </h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {tender.referenceNumber}
                            </p>
                          </div>

                          {/* Details */}
                          <div className="space-y-2.5 text-xs text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">
                                {tender.contractingAuthority || '--'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3.5 w-3.5 shrink-0" />
                              <span>
                                Υποβολή: {formatDate(tender.submissionDeadline)}
                              </span>
                            </div>
                            {tender.budget != null && (
                              <div className="flex items-center gap-2">
                                <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                                <span>
                                  Π/Υ: {formatCurrency(tender.budget)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Compliance score */}
                          <div className="border-t pt-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">
                                Compliance
                              </span>
                              <ComplianceBar score={tender.complianceScore ?? 0} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </div>
                </MagicCard>
              </BlurFade>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Διαγραφή Διαγωνισμού</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Θέλετε να διαγράψετε τον διαγωνισμό{' '}
            <strong className="text-foreground">{tenderToDelete?.title}</strong>;
            Η ενέργεια είναι μη αναστρέψιμη.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="cursor-pointer">
                Ακύρωση
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              className="cursor-pointer"
              disabled={deleteMutation.isPending}
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Διαγραφή
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
