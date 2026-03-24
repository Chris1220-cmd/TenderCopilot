'use client';

import { useState } from 'react';
import Link from 'next/link';
import { EmptyStateIllustration } from '@/components/ui/empty-state';
import { useRouter } from 'next/navigation';
import { cn, formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { motion } from 'motion/react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { BlurFade } from '@/components/ui/blur-fade';
import { Ripple } from '@/components/ui/ripple';
import {
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

const statusVariants: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  DRAFT: 'secondary',
  DISCOVERY: 'default',
  GO_NO_GO: 'default',
  IN_PROGRESS: 'warning',
  REVIEW: 'default',
  SUBMITTED: 'success',
  WON: 'success',
  LOST: 'destructive',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export default function TendersPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const statusLabels: Record<string, string> = {
    DRAFT: t('tenders.statusDraft'),
    DISCOVERY: t('tenders.statusDiscovery'),
    GO_NO_GO: t('tenders.statusGoNoGo'),
    IN_PROGRESS: t('tenders.statusInProgress'),
    REVIEW: t('tenders.statusReview'),
    SUBMITTED: t('tenders.statusSubmitted'),
    WON: t('tenders.statusWon'),
    LOST: t('tenders.statusLost'),
  };

  const platformLabels: Record<string, string> = {
    ESIDIS: t('platforms.ESIDIS'),
    KIMDIS: t('platforms.KIMDIS'),
    PROMITHEUS: t('platforms.PROMITHEUS'),
    DIAVGEIA: t('platforms.DIAVGEIA'),
    TED: t('platforms.TED'),
    COSMOONE: t('platforms.COSMOONE'),
    PRIVATE: t('platforms.PRIVATE'),
    OTHER: t('platforms.OTHER'),
  };

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

  const filteredTenders = tenders.filter((tender) => {
    if (statusFilter !== 'all' && tender.status !== statusFilter) return false;
    if (platformFilter !== 'all' && tender.platform !== platformFilter) return false;
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
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <BlurFade delay={0.1}>
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <div>
            <h1 className="text-display text-foreground">{t('tenders.title')}</h1>
            <p className="mt-1 text-body text-muted-foreground">
              {t('tenders.subtitle')}
            </p>
          </div>
          <Button
            asChild
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-5 cursor-pointer shadow-sm"
          >
            <Link href="/tenders/new">
              <Plus className="h-4 w-4" />
              {t('tenders.newTender')}
            </Link>
          </Button>
        </motion.div>
      </BlurFade>

      {/* Filters */}
      <BlurFade delay={0.15}>
        <motion.div variants={itemVariants} className="bg-card rounded-xl border border-border/60 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('tenders.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-card border-border/60 focus-visible:ring-primary/30 focus-visible:border-primary/40"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] cursor-pointer bg-card border-border/60">
                <SelectValue placeholder={t('tenders.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('tenders.allStatuses')}</SelectItem>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-[160px] cursor-pointer bg-card border-border/60">
                <SelectValue placeholder={t('tenders.platform')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('tenders.allPlatforms')}</SelectItem>
                {Object.entries(platformLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.div>
      </BlurFade>

      {/* Table */}
      <BlurFade delay={0.2}>
        <motion.div variants={itemVariants}>
          {tendersQuery.isLoading ? (
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
              <div className="space-y-0">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-6 py-3 border-b border-border/30 last:border-0">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </div>
          ) : filteredTenders.length === 0 ? (
            <div className="relative py-16 text-center overflow-hidden">
              <Ripple mainCircleSize={100} mainCircleOpacity={0.06} numCircles={5} />
              <div className="relative z-10">
              <EmptyStateIllustration variant="tenders" className="mb-5" />
              <h3 className="text-title text-foreground">{t('tenders.noTenders')}</h3>
              <p className="text-body text-muted-foreground mt-1">
                {searchQuery || statusFilter !== 'all' || platformFilter !== 'all'
                  ? t('tenders.noResultsFilters')
                  : t('tenders.createFirst')}
              </p>
              {!searchQuery && statusFilter === 'all' && platformFilter === 'all' && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="mt-4 cursor-pointer rounded-full"
                >
                  <Link href="/tenders/new">{t('tenders.newTender')}</Link>
                </Button>
              )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden transition-colors hover:border-primary/20">
              {/* Table Header */}
              <div className="flex items-center gap-4 px-6 py-2.5 border-b border-border/40 bg-muted/30">
                <span className="text-overline w-24 shrink-0">{t('tenders.tableStatus')}</span>
                <span className="text-overline flex-1">{t('tenders.tableTitle')}</span>
                <span className="text-overline w-28 shrink-0 hidden md:block">{t('tenders.tablePlatform')}</span>
                <span className="text-overline w-28 shrink-0 hidden lg:block">{t('tenders.tableDeadline')}</span>
                <span className="text-overline w-20 shrink-0 text-right">{t('tenders.tableScore')}</span>
                <span className="w-8 shrink-0" />
              </div>

              {/* Table Rows */}
              {filteredTenders.map((tender, i) => {
                const statusVariant = statusVariants[tender.status] || 'secondary';
                const statusLabel = statusLabels[tender.status] || tender.status;
                const platformLabel = platformLabels[tender.platform] || tender.platform;
                const score = tender.complianceScore ?? 0;
                const complianceColor =
                  score >= 80
                    ? 'text-emerald-500'
                    : score >= 60
                      ? 'text-amber-500'
                      : 'text-red-500';

                return (
                  <motion.div
                    key={tender.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ x: 2, transition: { duration: 0.15 } }}
                    transition={{
                      delay: i * 0.03,
                      duration: 0.25,
                      ease: [0.16, 1, 0.3, 1] as const,
                    }}
                    className="group flex items-center gap-4 px-6 py-3 min-h-[48px] border-b border-border/30 last:border-0 transition-colors duration-150 cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/tenders/${tender.id}`)}
                  >
                    {/* Status */}
                    <div className="w-24 shrink-0">
                      <Badge variant={statusVariant} className="text-[10px]">
                        {statusLabel}
                      </Badge>
                    </div>

                    {/* Title + Reference */}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-body font-medium text-foreground group-hover:text-primary transition-colors">
                        {tender.title}
                      </p>
                      <p className="text-caption truncate">{tender.referenceNumber}</p>
                    </div>

                    {/* Platform */}
                    <span className="text-caption w-28 shrink-0 hidden md:block">
                      {platformLabel}
                    </span>

                    {/* Deadline */}
                    <span className="text-caption w-28 shrink-0 hidden lg:block">
                      {tender.submissionDeadline ? formatDate(tender.submissionDeadline) : '—'}
                    </span>

                    {/* Score */}
                    <span className={cn('text-body font-semibold tabular-nums w-20 shrink-0 text-right', complianceColor)}>
                      {score}%
                    </span>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteId(tender.id);
                      }}
                      className="w-8 shrink-0 flex items-center justify-center h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-destructive/10 text-destructive cursor-pointer"
                      title={t('tenders.delete')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </BlurFade>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('tenders.deleteTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('tenders.deleteConfirm')}{' '}
            <strong className="text-foreground">{tenderToDelete?.title}</strong>;{' '}
            {t('tenders.deleteIrreversible')}
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="cursor-pointer">
                {t('tenders.cancel')}
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              className="cursor-pointer"
              disabled={deleteMutation.isPending}
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              {t('tenders.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
