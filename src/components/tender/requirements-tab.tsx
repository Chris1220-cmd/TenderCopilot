'use client';

import { useState, useMemo } from 'react';
import { cn, truncate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/tender/status-badge';
import {
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Link2,
  ListChecks,
  Save,
  Sparkles,
} from 'lucide-react';

interface RequirementsTabProps {
  tenderId: string;
}

const categoryOptions = [
  { value: 'all', label: 'Όλες οι κατηγορίες' },
  { value: 'PARTICIPATION_CRITERIA', label: 'Κριτήρια Συμμετοχής' },
  { value: 'EXCLUSION_CRITERIA', label: 'Κριτήρια Αποκλεισμού' },
  { value: 'TECHNICAL_REQUIREMENTS', label: 'Τεχνικές Απαιτήσεις' },
  { value: 'FINANCIAL_REQUIREMENTS', label: 'Οικονομικές Απαιτήσεις' },
  { value: 'DOCUMENTATION_REQUIREMENTS', label: 'Δικαιολογητικά' },
  { value: 'CONTRACT_TERMS', label: 'Όροι Σύμβασης' },
];

const coverageOptions = [
  { value: 'all', label: 'Όλες οι καταστάσεις' },
  { value: 'UNMAPPED', label: 'Μη αντιστοιχισμένο' },
  { value: 'COVERED', label: 'Καλύπτεται' },
  { value: 'GAP', label: 'Κενό' },
  { value: 'MANUAL_OVERRIDE', label: 'Χειροκίνητο' },
];

export function RequirementsTab({ tenderId }: RequirementsTabProps) {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [coverageFilter, setCoverageFilter] = useState('all');
  const [mandatoryOnly, setMandatoryOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [sheetNotes, setSheetNotes] = useState('');
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string>('COVERED');

  const utils = trpc.useUtils();

  // Fetch requirements
  const requirementsQuery = trpc.requirement.listByTender.useQuery(
    {
      tenderId,
      ...(categoryFilter !== 'all' ? { category: categoryFilter as any } : {}),
      ...(coverageFilter !== 'all' ? { coverageStatus: coverageFilter as any } : {}),
    },
    { retry: false }
  );

  // Fetch detail
  const detailQuery = trpc.requirement.getById.useQuery(
    { id: detailId! },
    { enabled: !!detailId, retry: false }
  );

  // Mutations
  const updateRequirement = trpc.requirement.update.useMutation({
    onSuccess: () => {
      utils.requirement.listByTender.invalidate({ tenderId });
      if (detailId) utils.requirement.getById.invalidate({ id: detailId });
    },
  });

  const bulkUpdateStatus = trpc.requirement.bulkUpdateStatus.useMutation({
    onSuccess: () => {
      utils.requirement.listByTender.invalidate({ tenderId });
      setSelectedIds(new Set());
      setBulkDialogOpen(false);
    },
  });

  // Mock data for graceful fallback
  const mockRequirements = [
    {
      id: 'req-1',
      text: 'Φορολογική ενημερότητα σε ισχύ κατά την ημερομηνία υποβολής',
      category: 'EXCLUSION_CRITERIA',
      type: 'DOCUMENT',
      mandatory: true,
      coverageStatus: 'COVERED',
      articleReference: 'Άρθρο 73 Ν.4412/2016',
      aiConfidence: 0.95,
      notes: null,
    },
    {
      id: 'req-2',
      text: 'Ασφαλιστική ενημερότητα για κύρια και επικουρική ασφάλιση',
      category: 'EXCLUSION_CRITERIA',
      type: 'DOCUMENT',
      mandatory: true,
      coverageStatus: 'COVERED',
      articleReference: 'Άρθρο 73 Ν.4412/2016',
      aiConfidence: 0.92,
      notes: null,
    },
    {
      id: 'req-3',
      text: 'Πιστοποίηση ISO 9001:2015 - Σύστημα Διαχείρισης Ποιότητας',
      category: 'TECHNICAL_REQUIREMENTS',
      type: 'CERTIFICATE',
      mandatory: true,
      coverageStatus: 'GAP',
      articleReference: 'Παράρτημα Β, 2.1',
      aiConfidence: 0.88,
      notes: null,
    },
    {
      id: 'req-4',
      text: 'Τουλάχιστον 3 ομοειδή έργα τα τελευταία 5 έτη, αξίας > 100.000 EUR',
      category: 'PARTICIPATION_CRITERIA',
      type: 'EXPERIENCE',
      mandatory: true,
      coverageStatus: 'UNMAPPED',
      articleReference: 'Άρθρο 75.2.β',
      aiConfidence: 0.78,
      notes: null,
    },
    {
      id: 'req-5',
      text: 'Υπεύθυνη δήλωση του νόμιμου εκπροσώπου περί μη αποκλεισμού',
      category: 'DOCUMENTATION_REQUIREMENTS',
      type: 'DECLARATION',
      mandatory: true,
      coverageStatus: 'COVERED',
      articleReference: 'Άρθρο 79 Ν.4412/2016',
      aiConfidence: 0.97,
      notes: null,
    },
    {
      id: 'req-6',
      text: 'Κύκλος εργασιών τελευταίας τριετίας > 500.000 EUR ετησίως',
      category: 'FINANCIAL_REQUIREMENTS',
      type: 'FINANCIAL',
      mandatory: false,
      coverageStatus: 'UNMAPPED',
      articleReference: 'Άρθρο 75.1.α',
      aiConfidence: 0.85,
      notes: null,
    },
  ];

  const requirements = (requirementsQuery.data ?? []) as any[];

  // Client-side filtering for search + mandatory
  const filtered = useMemo(() => {
    return requirements.filter((r) => {
      if (mandatoryOnly && !r.mandatory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          r.text.toLowerCase().includes(q) ||
          (r.articleReference ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [requirements, mandatoryOnly, searchQuery]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((r) => r.id)));
    }
  };

  const detail = detailQuery.data as any;

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Αναζήτηση απαιτήσεων..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px] cursor-pointer">
                <SelectValue placeholder="Κατηγορία" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={coverageFilter} onValueChange={setCoverageFilter}>
              <SelectTrigger className="w-[200px] cursor-pointer">
                <SelectValue placeholder="Κάλυψη" />
              </SelectTrigger>
              <SelectContent>
                {coverageOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
              <Checkbox
                checked={mandatoryOnly}
                onCheckedChange={(v) => setMandatoryOnly(!!v)}
                className="cursor-pointer"
              />
              Μόνο υποχρεωτικά
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/20 px-4 py-2.5">
          <span className="text-sm font-medium">
            {selectedIds.size} επιλεγμένα
          </span>
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer h-8 text-xs"
            onClick={() => setBulkDialogOpen(true)}
          >
            <ListChecks className="h-3.5 w-3.5 mr-1.5" />
            Αλλαγή Κατάστασης
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="cursor-pointer h-8 text-xs"
            onClick={() => setSelectedIds(new Set())}
          >
            Αποεπιλογή
          </Button>
        </div>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left w-10">
                  <Checkbox
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onCheckedChange={toggleAll}
                    className="cursor-pointer"
                  />
                </th>
                <th className="p-3 text-left font-medium text-muted-foreground">Απαίτηση</th>
                <th className="p-3 text-left font-medium text-muted-foreground w-[160px]">Κατηγορία</th>
                <th className="p-3 text-left font-medium text-muted-foreground w-[120px]">Τύπος</th>
                <th className="p-3 text-center font-medium text-muted-foreground w-[80px]">Υποχρ.</th>
                <th className="p-3 text-left font-medium text-muted-foreground w-[150px]">Κάλυψη</th>
                <th className="p-3 text-left font-medium text-muted-foreground w-[130px]">Άρθρο</th>
                <th className="p-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {requirementsQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-3"><Skeleton className="h-4 w-4" /></td>
                    <td className="p-3"><Skeleton className="h-4 w-full" /></td>
                    <td className="p-3"><Skeleton className="h-5 w-24" /></td>
                    <td className="p-3"><Skeleton className="h-5 w-16" /></td>
                    <td className="p-3"><Skeleton className="h-4 w-4 mx-auto" /></td>
                    <td className="p-3"><Skeleton className="h-5 w-20" /></td>
                    <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="p-3" />
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Δεν βρέθηκαν απαιτήσεις με τα τρέχοντα φίλτρα.
                  </td>
                </tr>
              ) : (
                filtered.map((req) => (
                  <tr
                    key={req.id}
                    className={cn(
                      'border-b transition-colors duration-150 cursor-pointer',
                      'hover:bg-muted/40',
                      selectedIds.has(req.id) && 'bg-primary/5'
                    )}
                    onClick={() => {
                      setDetailId(req.id);
                      setSheetNotes(req.notes ?? '');
                    }}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(req.id)}
                        onCheckedChange={() => toggleSelect(req.id)}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="p-3">
                      <span className="line-clamp-2 text-xs leading-relaxed">
                        {truncate(req.text, 120)}
                      </span>
                    </td>
                    <td className="p-3">
                      <StatusBadge type="category" value={req.category} />
                    </td>
                    <td className="p-3">
                      <StatusBadge type="reqType" value={req.type} />
                    </td>
                    <td className="p-3 text-center">
                      {req.mandatory ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-400 mx-auto" />
                      )}
                    </td>
                    <td className="p-3">
                      <StatusBadge type="coverage" value={req.coverageStatus} />
                    </td>
                    <td className="p-3">
                      <span className="text-xs text-muted-foreground">
                        {req.articleReference ?? '--'}
                      </span>
                    </td>
                    <td className="p-3">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Λεπτομέρειες Απαίτησης</SheetTitle>
            <SheetDescription>
              Δείτε και διαχειριστείτε τη συγκεκριμένη απαίτηση
            </SheetDescription>
          </SheetHeader>

          {detailQuery.isLoading ? (
            <div className="mt-6 space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : detail ? (
            <div className="mt-6 space-y-5">
              {/* Full text */}
              <div className="rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">
                {detail.text}
              </div>

              {/* Meta info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Κατηγορία</Label>
                  <div className="mt-1">
                    <StatusBadge type="category" value={detail.category} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Τύπος</Label>
                  <div className="mt-1">
                    <StatusBadge type="reqType" value={detail.type} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Υποχρεωτικό</Label>
                  <p className="mt-1 text-sm font-medium">
                    {detail.mandatory ? 'Ναι' : 'Όχι'}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Άρθρο</Label>
                  <p className="mt-1 text-sm font-medium">
                    {detail.articleReference || '--'}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">AI Confidence</Label>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                    <span className="text-sm font-medium tabular-nums">
                      {detail.aiConfidence != null
                        ? `${Math.round(detail.aiConfidence * 100)}%`
                        : '--'}
                    </span>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Κάλυψη</Label>
                  <div className="mt-1">
                    <StatusBadge type="coverage" value={detail.coverageStatus} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Mappings */}
              <div>
                <Label className="text-xs text-muted-foreground">Αντιστοιχίσεις</Label>
                {detail.mappings && detail.mappings.length > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {detail.mappings.map((m: any) => {
                      const asset =
                        m.certificate ??
                        m.legalDocument ??
                        m.project ??
                        m.contentLibraryItem;
                      return (
                        <li
                          key={m.id}
                          className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs"
                        >
                          <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium">{asset?.title ?? 'Άγνωστο'}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Καμία αντιστοίχιση.</p>
                )}
              </div>

              <Separator />

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Select
                  value={detail.coverageStatus}
                  onValueChange={(val) => {
                    updateRequirement.mutate({
                      id: detail.id,
                      coverageStatus: val as any,
                    });
                  }}
                >
                  <SelectTrigger className="w-[180px] cursor-pointer h-9 text-xs">
                    <SelectValue placeholder="Αλλαγή κάλυψης" />
                  </SelectTrigger>
                  <SelectContent>
                    {coverageOptions
                      .filter((o) => o.value !== 'all')
                      .map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Σημειώσεις</Label>
                <Textarea
                  value={sheetNotes}
                  onChange={(e) => setSheetNotes(e.target.value)}
                  placeholder="Προσθέστε σημείωση..."
                  className="min-h-[80px] resize-none text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer h-8 text-xs gap-1.5"
                  disabled={
                    updateRequirement.isPending ||
                    sheetNotes === (detail.notes ?? '')
                  }
                  onClick={() =>
                    updateRequirement.mutate({ id: detail.id, notes: sheetNotes })
                  }
                >
                  <Save className="h-3.5 w-3.5" />
                  Αποθήκευση
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">
              Η απαίτηση δεν βρέθηκε.
            </p>
          )}
        </SheetContent>
      </Sheet>

      {/* Bulk Update Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Μαζική Αλλαγή Κατάστασης</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              {selectedIds.size} απαιτήσεις επιλεγμένες
            </p>
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {coverageOptions
                  .filter((o) => o.value !== 'all')
                  .map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="cursor-pointer">
                Ακύρωση
              </Button>
            </DialogClose>
            <Button
              onClick={() =>
                bulkUpdateStatus.mutate({
                  ids: Array.from(selectedIds),
                  coverageStatus: bulkStatus as any,
                })
              }
              disabled={bulkUpdateStatus.isPending}
              className={cn(
                'cursor-pointer',
                'bg-gradient-to-r from-indigo-600 to-violet-600',
                'hover:from-indigo-500 hover:to-violet-500',
                'border-0 text-white'
              )}
            >
              Εφαρμογή
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
