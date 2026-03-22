'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { cn, formatDate } from '@/lib/utils';
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
import { BlurFade } from '@/components/ui/blur-fade';
import {
  Plus,
  Search,
  Trash2,
} from 'lucide-react';

const statusConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }
> = {
  DRAFT: { label: 'Προχειρο', variant: 'secondary' },
  DISCOVERY: { label: 'Ευρεση', variant: 'default' },
  GO_NO_GO: { label: 'Go/No-Go', variant: 'default' },
  IN_PROGRESS: { label: 'Σε εξελιξη', variant: 'warning' },
  REVIEW: { label: 'Αξιολογηση', variant: 'default' },
  SUBMITTED: { label: 'Υποβληθηκε', variant: 'success' },
  WON: { label: 'Κερδηθηκε', variant: 'success' },
  LOST: { label: 'Χαθηκε', variant: 'destructive' },
};

const platformConfig: Record<string, { label: string }> = {
  ESIDIS: { label: 'ΕΣΗΔΗΣ' },
  KIMDIS: { label: 'ΚΗΜΔΗΣ' },
  PROMITHEUS: { label: 'ΠΡΟΜΗΘΕΥΣ' },
  DIAVGEIA: { label: 'ΔΙΑΥΓΕΙΑ' },
  TED: { label: 'TED Europa' },
  COSMOONE: { label: 'cosmoONE' },
  PRIVATE: { label: 'Ιδιωτικος' },
  OTHER: { label: 'Αλλο' },
};

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
    <div className="space-y-6">
      {/* Header */}
      <BlurFade delay={0} inView>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Διαγωνισμοι
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Διαχειριστειτε τους διαγωνισμους σας
            </p>
          </div>
          <Button asChild className="cursor-pointer">
            <Link href="/tenders/new">
              <Plus className="h-4 w-4 mr-1.5" />
              Νεος Διαγωνισμος
            </Link>
          </Button>
        </div>
      </BlurFade>

      {/* Filters — simple row, no card wrapper */}
      <div className="flex flex-wrap items-center gap-3 mt-8">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Αναζητηση..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] cursor-pointer">
            <SelectValue placeholder="Κατασταση" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Ολες οι καταστασεις</SelectItem>
            {Object.entries(statusConfig).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[160px] cursor-pointer">
            <SelectValue placeholder="Πλατφορμα" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Ολες οι πλατφορμες</SelectItem>
            {Object.entries(platformConfig).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tender Cards */}
      {filteredTenders.length === 0 ? (
        <div className="py-16 text-center">
          <div className="relative mx-auto mb-4 h-[140px] w-[180px]">
            <Image
              src="/images/illustrations/empty-tenders.png"
              alt=""
              fill
              className="object-contain opacity-50"
            />
          </div>
          <h3 className="text-base font-medium">Κανενας διαγωνισμος</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {searchQuery || statusFilter !== 'all' || platformFilter !== 'all'
              ? 'Δεν βρεθηκαν αποτελεσματα. Δοκιμαστε διαφορετικα φιλτρα.'
              : 'Δημιουργηστε τον πρωτο σας διαγωνισμο για να ξεκινησετε.'}
          </p>
          {!searchQuery && statusFilter === 'all' && platformFilter === 'all' && (
            <Button asChild variant="outline" size="sm" className="mt-4 cursor-pointer">
              <Link href="/tenders/new">Νεος Διαγωνισμος</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mt-6">
          {filteredTenders.map((tender, i) => {
            const status = statusConfig[tender.status] || statusConfig.DRAFT;
            const platform = platformConfig[tender.platform] || platformConfig.OTHER;
            const score = tender.complianceScore ?? 0;
            const complianceColor =
              score >= 80
                ? 'text-emerald-500'
                : score >= 60
                  ? 'text-amber-500'
                  : 'text-red-500';

            return (
              <BlurFade key={tender.id} delay={0.03 + i * 0.03} inView>
                <div className="group relative rounded-xl bg-card shadow-sm ring-1 ring-white/[0.04] transition-colors hover:bg-card/80">
                  {/* Delete button on hover */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteId(tender.id);
                    }}
                    className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-destructive/10 text-destructive cursor-pointer"
                    title="Διαγραφη"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                  <Link
                    href={`/tenders/${tender.id}`}
                    className="block p-5 cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {platform.label}
                      </span>
                    </div>

                    <h3 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                      {tender.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tender.referenceNumber}
                    </p>

                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDate(tender.submissionDeadline)}</span>
                      <span className={cn('font-semibold', complianceColor)}>
                        {score}%
                      </span>
                    </div>
                  </Link>
                </div>
              </BlurFade>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Διαγραφη Διαγωνισμου</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Θελετε να διαγραψετε τον διαγωνισμο{' '}
            <strong className="text-foreground">{tenderToDelete?.title}</strong>;
            Η ενεργεια ειναι μη αναστρεψιμη.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="cursor-pointer">
                Ακυρωση
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              className="cursor-pointer"
              disabled={deleteMutation.isPending}
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Διαγραφη
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
