'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn, formatDate, formatCurrency } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  FileText,
  Calendar,
  Building2,
  TrendingUp,
  Inbox,
  Filter,
} from 'lucide-react';

const statusConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }
> = {
  DRAFT: { label: 'Πρόχειρο', variant: 'secondary' },
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
  OTHER: { label: 'Άλλο', color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400' },
};

// Mock data for graceful fallback
const mockTenders = [
  {
    id: '1',
    title: 'Προμήθεια Εξοπλισμού Πληροφορικής Δήμου Αθηναίων',
    referenceNumber: 'ΕΣΗΔΗΣ-2024-1234',
    contractingAuthority: 'Δήμος Αθηναίων',
    platform: 'ESIDIS',
    status: 'IN_PROGRESS',
    complianceScore: 72,
    submissionDeadline: '2026-04-15',
    budget: 250000,
  },
  {
    id: '2',
    title: 'Ανάπτυξη Ολοκληρωμένου Πληροφοριακού Συστήματος ERP',
    referenceNumber: 'ΕΣΗΔΗΣ-2024-5678',
    contractingAuthority: 'Υπουργείο Ψηφιακής Διακυβέρνησης',
    platform: 'ESIDIS',
    status: 'DRAFT',
    complianceScore: 45,
    submissionDeadline: '2026-04-22',
    budget: 1200000,
  },
  {
    id: '3',
    title: 'Υπηρεσίες Συμβούλων Διοίκησης και Στρατηγικού Σχεδιασμού',
    referenceNumber: 'ΚΗΜΔΗΣ-2024-9012',
    contractingAuthority: 'Περιφέρεια Αττικής',
    platform: 'KIMDIS',
    status: 'SUBMITTED',
    complianceScore: 95,
    submissionDeadline: '2026-03-28',
    budget: 180000,
  },
  {
    id: '4',
    title: 'Προμήθεια Οχημάτων για τις Ανάγκες του ΟΤΑ',
    referenceNumber: 'ΕΣΗΔΗΣ-2024-3456',
    contractingAuthority: 'Δήμος Θεσσαλονίκης',
    platform: 'ESIDIS',
    status: 'IN_PROGRESS',
    complianceScore: 60,
    submissionDeadline: '2026-04-10',
    budget: 520000,
  },
  {
    id: '5',
    title: 'Παροχή Υπηρεσιών Καθαρισμού Κτιρίων',
    referenceNumber: 'ΠΡΟΜ-2024-7890',
    contractingAuthority: 'Πανεπιστήμιο Πατρών',
    platform: 'PROMITHEUS',
    status: 'WON',
    complianceScore: 92,
    submissionDeadline: '2026-02-15',
    budget: 85000,
  },
];

function ComplianceBar({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'bg-emerald-500'
      : score >= 60
        ? 'bg-amber-500'
        : 'bg-red-500';
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

  // Try tRPC call, fall back to mock data
  const tendersQuery = trpc.tender.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const tenders = (tendersQuery.data ?? mockTenders) as any[];

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Διαγωνισμοί</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Διαχειριστείτε τους διαγωνισμούς και τους φακέλους σας
          </p>
        </div>
        <Button
          asChild
          className={cn(
            'cursor-pointer',
            'bg-gradient-to-r from-indigo-600 to-violet-600',
            'hover:from-indigo-500 hover:to-violet-500',
            'shadow-lg shadow-indigo-500/25',
            'border-0 text-white'
          )}
        >
          <Link href="/tenders/new">
            <Plus className="h-4 w-4" />
            Νέος Διαγωνισμός
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
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
        </CardContent>
      </Card>

      {/* Tenders Grid */}
      {filteredTenders.length === 0 ? (
        /* Empty state */
        <Card className="flex flex-col items-center justify-center py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Inbox className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Κανένας διαγωνισμός</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchQuery || statusFilter !== 'all' || platformFilter !== 'all'
              ? 'Δεν βρέθηκαν αποτελέσματα. Δοκιμάστε διαφορετικά φίλτρα.'
              : 'Δημιουργήστε τον πρώτο σας διαγωνισμό για να ξεκινήσετε.'}
          </p>
          {!searchQuery && statusFilter === 'all' && platformFilter === 'all' && (
            <Button asChild className="mt-4 cursor-pointer">
              <Link href="/tenders/new">
                <Plus className="h-4 w-4" />
                Νέος Διαγωνισμός
              </Link>
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTenders.map((tender) => {
            const status = statusConfig[tender.status] || statusConfig.DRAFT;
            const platform = platformConfig[tender.platform] || platformConfig.OTHER;

            return (
              <Link key={tender.id} href={`/tenders/${tender.id}`}>
                <Card
                  className={cn(
                    'group h-full transition-all duration-200 cursor-pointer',
                    'hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/20'
                  )}
                >
                  <CardContent className="p-5">
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
                            {tender.contractingAuthority}
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
                          <ComplianceBar score={tender.complianceScore} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
