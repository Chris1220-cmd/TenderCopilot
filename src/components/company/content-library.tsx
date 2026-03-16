'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn, truncate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  Inbox,
  FileText,
  Tag,
} from 'lucide-react';

const contentSchema = z.object({
  category: z.string().min(1, 'Η κατηγορία είναι υποχρεωτική'),
  title: z.string().min(1, 'Ο τίτλος είναι υποχρεωτικός'),
  content: z.string().min(1, 'Το περιεχόμενο είναι υποχρεωτικό'),
  tags: z.string().optional(),
});

type ContentFormValues = z.infer<typeof contentSchema>;

const categories = [
  { value: 'COMPANY_PROFILE', label: 'Προφίλ Εταιρείας' },
  { value: 'METHODOLOGY', label: 'Μεθοδολογία' },
  { value: 'QA_PLAN', label: 'Σχέδιο Ποιότητας' },
  { value: 'HSE_PLAN', label: 'Σχέδιο Υ&Α' },
  { value: 'TEAM_DESCRIPTION', label: 'Περιγραφή Ομάδας' },
  { value: 'RISK_MANAGEMENT', label: 'Διαχείριση Κινδύνων' },
  { value: 'OTHER', label: 'Άλλο' },
];

const categoryColors: Record<string, string> = {
  COMPANY_PROFILE: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  METHODOLOGY: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  QA_PLAN: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  HSE_PLAN: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  TEAM_DESCRIPTION: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  RISK_MANAGEMENT: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  OTHER: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
};

// Mock data
const mockContent = [
  {
    id: '1',
    category: 'COMPANY_PROFILE',
    title: 'Γενική Παρουσίαση Εταιρείας',
    content:
      'Η εταιρεία μας ιδρύθηκε το 2010 και δραστηριοποιείται στον τομέα των υπηρεσιών πληροφορικής και συμβουλευτικής. Με πάνω από 50 εξειδικευμένους συνεργάτες, παρέχουμε ολοκληρωμένες λύσεις ψηφιακού μετασχηματισμού σε φορείς του δημοσίου και ιδιωτικού τομέα.',
    tags: 'εταιρεία, παρουσίαση, γενικά',
  },
  {
    id: '2',
    category: 'METHODOLOGY',
    title: 'Μεθοδολογία Υλοποίησης Έργων IT',
    content:
      'Ακολουθούμε τη μεθοδολογία Agile/Scrum για την υλοποίηση έργων πληροφορικής, με sprints διάρκειας 2 εβδομάδων. Κάθε sprint περιλαμβάνει σχεδιασμό, ανάπτυξη, δοκιμές και αναθεώρηση.',
    tags: 'μεθοδολογία, agile, scrum, IT',
  },
  {
    id: '3',
    category: 'QA_PLAN',
    title: 'Σχέδιο Διασφάλισης Ποιότητας',
    content:
      'Το σύστημα διαχείρισης ποιότητας ISO 9001:2015 εφαρμόζεται σε όλα τα έργα μας. Περιλαμβάνει ελέγχους ποιότητας σε κάθε φάση υλοποίησης, αναφορές προόδου και τεκμηριωμένες διαδικασίες.',
    tags: 'ποιότητα, ISO 9001, QA',
  },
];

export function ContentLibrary() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const contentQuery = trpc.company.getContentLibrary.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const createMutation = trpc.company.createContentItem.useMutation({
    onSuccess: () => {
      toast({ title: 'Επιτυχία', description: 'Το κείμενο αποθηκεύτηκε.' });
      contentQuery.refetch();
      closeDialog();
    },
    onError: () => {
      toast({ title: 'Σφάλμα', description: 'Αποτυχία αποθήκευσης.', variant: 'destructive' });
    },
  });

  const deleteMutation = trpc.company.deleteContentItem.useMutation({
    onSuccess: () => {
      toast({ title: 'Διαγράφηκε', description: 'Το κείμενο διαγράφηκε.' });
      contentQuery.refetch();
      setDeleteConfirmId(null);
    },
    onError: () => {
      toast({ title: 'Σφάλμα', description: 'Αποτυχία διαγραφής.', variant: 'destructive' });
    },
  });

  const items = (contentQuery.data ?? []) as any[];

  // Filter
  const filteredItems = items.filter((item) => {
    if (filterCategory !== 'all' && item.category !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.content.toLowerCase().includes(q) ||
        (item.tags && item.tags.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<ContentFormValues>({
    resolver: zodResolver(contentSchema),
    defaultValues: { category: '', title: '', content: '', tags: '' },
  });

  function openCreate() {
    setEditingId(null);
    reset({ category: '', title: '', content: '', tags: '' });
    setDialogOpen(true);
  }

  function openEdit(item: (typeof items)[0]) {
    setEditingId(item.id);
    reset({
      category: item.category,
      title: item.title,
      content: item.content,
      tags: item.tags || '',
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    reset();
  }

  function onSubmit(data: ContentFormValues) {
    createMutation.mutate(data as any);
  }

  if (contentQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-white/10">
              <CardContent className="p-5 space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-500" />
            Βιβλιοθήκη Κειμένων
          </h2>
          <p className="text-sm text-muted-foreground">
            {items.length} κείμεν{items.length === 1 ? 'ο' : 'α'} αποθηκευμένα
          </p>
        </div>
        <Button
          onClick={openCreate}
          className={cn(
            'cursor-pointer',
            'bg-gradient-to-r from-indigo-600 to-violet-600',
            'hover:from-indigo-500 hover:to-violet-500',
            'shadow-lg shadow-indigo-500/25',
            'border-0 text-white'
          )}
        >
          <Plus className="h-4 w-4" />
          Νέο Κείμενο
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-white/10 bg-gradient-to-br from-card/80 to-card backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Αναζήτηση κειμένων..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px] cursor-pointer">
                <SelectValue placeholder="Κατηγορία" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Όλες οι κατηγορίες</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {filteredItems.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 border-white/10">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Inbox className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">
            {searchQuery || filterCategory !== 'all'
              ? 'Κανένα αποτέλεσμα'
              : 'Κανένα κείμενο'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchQuery || filterCategory !== 'all'
              ? 'Δοκιμάστε διαφορετικά φίλτρα.'
              : 'Προσθέστε κείμενα για επαναχρησιμοποίηση στις προσφορές σας.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const catLabel =
              categories.find((c) => c.value === item.category)?.label || item.category;
            const catColor = categoryColors[item.category] || categoryColors.OTHER;
            const tagsList = Array.isArray(item.tags)
              ? item.tags
              : typeof item.tags === 'string'
                ? (item.tags as string).split(',').map((t: string) => t.trim()).filter(Boolean)
                : [];

            return (
              <Card
                key={item.id}
                className={cn(
                  'group border-white/10 bg-gradient-to-br from-card/80 to-card backdrop-blur-sm',
                  'transition-all duration-200 hover:shadow-md hover:border-primary/20'
                )}
              >
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Icon */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
                      <FileText className="h-5 w-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold">{item.title}</h3>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            catColor
                          )}
                        >
                          {catLabel}
                        </span>
                      </div>

                      {/* Content preview */}
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {item.content}
                      </p>

                      {/* Tags */}
                      {tagsList.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Tag className="h-3 w-3 text-muted-foreground" />
                          {(tagsList as string[]).map((tag, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="text-[10px] px-1.5 py-0"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(item)}
                        className="cursor-pointer h-8 w-8"
                        title="Επεξεργασία"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmId(item.id)}
                        className="cursor-pointer h-8 w-8 text-destructive hover:text-destructive"
                        title="Διαγραφή"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto border-white/10 bg-gradient-to-br from-card to-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Επεξεργασία Κειμένου' : 'Νέο Κείμενο'}
            </DialogTitle>
            <DialogDescription>
              Τα κείμενα χρησιμοποιούνται ως βάση για τη σύνταξη προσφορών.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Κατηγορία *</Label>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue placeholder="Επιλέξτε κατηγορία" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.category && (
                <p className="text-xs text-destructive">{errors.category.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Τίτλος *</Label>
              <Input
                {...register('title')}
                placeholder="π.χ. Γενική Παρουσίαση Εταιρείας"
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Περιεχόμενο *</Label>
              <Textarea
                {...register('content')}
                placeholder="Εισάγετε το κείμενο εδώ..."
                rows={12}
                className="resize-y min-h-[200px] transition-all duration-200 focus:ring-2 focus:ring-indigo-500/20"
              />
              {errors.content && (
                <p className="text-xs text-destructive">{errors.content.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Ετικέτες</Label>
              <Input
                {...register('tags')}
                placeholder="π.χ. εταιρεία, παρουσίαση, γενικά (χωρισμένες με κόμμα)"
              />
              <p className="text-[11px] text-muted-foreground">
                Χωρίστε τις ετικέτες με κόμμα
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                className="cursor-pointer"
              >
                Ακύρωση
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className={cn(
                  'cursor-pointer',
                  'bg-gradient-to-r from-indigo-600 to-violet-600',
                  'hover:from-indigo-500 hover:to-violet-500',
                  'border-0 text-white'
                )}
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? 'Ενημέρωση' : 'Δημιουργία'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <DialogContent className="sm:max-w-[400px] border-white/10 bg-gradient-to-br from-card to-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Επιβεβαίωση Διαγραφής</DialogTitle>
            <DialogDescription>
              Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το κείμενο; Η ενέργεια δεν αναιρείται.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              className="cursor-pointer"
            >
              Ακύρωση
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate({ id: deleteConfirmId })}
              disabled={deleteMutation.isPending}
              className="cursor-pointer"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Διαγραφή
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
