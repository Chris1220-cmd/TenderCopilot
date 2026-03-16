'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn, formatDate, formatCurrency } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Building2,
  TrendingUp,
  Loader2,
  Inbox,
  Tag,
} from 'lucide-react';

const projectSchema = z.object({
  title: z.string().min(1, 'Ο τίτλος είναι υποχρεωτικός'),
  client: z.string().min(1, 'Ο πελάτης είναι υποχρεωτικός'),
  contractAmount: z.coerce.number().min(0, 'Μη έγκυρο ποσό'),
  startDate: z.string().min(1, 'Η ημ. έναρξης είναι υποχρεωτική'),
  endDate: z.string().optional(),
  category: z.string().min(1, 'Η κατηγορία είναι υποχρεωτική'),
  description: z.string().optional(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

// Mock data
const mockProjects = [
  {
    id: '1',
    title: 'Ολοκληρωμένο Σύστημα ERP Δήμου Αθηναίων',
    client: 'Δήμος Αθηναίων',
    contractAmount: 450000,
    startDate: '2023-03-01',
    endDate: '2024-09-30',
    category: 'Πληροφορική',
    description: 'Ανάπτυξη ολοκληρωμένου πληροφοριακού συστήματος ERP.',
  },
  {
    id: '2',
    title: 'Υπηρεσίες Συμβουλευτικής Στρατηγικού Σχεδιασμού',
    client: 'Υπουργείο Ψηφιακής Διακυβέρνησης',
    contractAmount: 120000,
    startDate: '2024-01-15',
    endDate: '2024-12-31',
    category: 'Συμβουλευτική',
    description: 'Παροχή υπηρεσιών συμβουλευτικής για ψηφιακό μετασχηματισμό.',
  },
  {
    id: '3',
    title: 'Προμήθεια Δικτυακού Εξοπλισμού',
    client: 'Περιφέρεια Αττικής',
    contractAmount: 85000,
    startDate: '2024-06-01',
    endDate: null,
    category: 'Προμήθειες',
    description: null,
  },
];

const categoryColors: Record<string, string> = {
  'Πληροφορική': 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  'Συμβουλευτική': 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  'Προμήθειες': 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  'Κατασκευές': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'Υπηρεσίες': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

export function ProjectsList() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const projectsQuery = trpc.company.getProjects.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const createMutation = trpc.company.createProject.useMutation({
    onSuccess: () => {
      toast({ title: 'Επιτυχία', description: 'Το έργο δημιουργήθηκε.' });
      projectsQuery.refetch();
      closeDialog();
    },
    onError: () => {
      toast({ title: 'Σφάλμα', description: 'Αποτυχία δημιουργίας.', variant: 'destructive' });
    },
  });

  const deleteMutation = trpc.company.deleteProject.useMutation({
    onSuccess: () => {
      toast({ title: 'Διαγράφηκε', description: 'Το έργο διαγράφηκε.' });
      projectsQuery.refetch();
      setDeleteConfirmId(null);
    },
    onError: () => {
      toast({ title: 'Σφάλμα', description: 'Αποτυχία διαγραφής.', variant: 'destructive' });
    },
  });

  const projects = (projectsQuery.data ?? mockProjects) as any[];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      title: '',
      client: '',
      contractAmount: 0,
      startDate: '',
      endDate: '',
      category: '',
      description: '',
    },
  });

  function openCreate() {
    setEditingId(null);
    reset({
      title: '',
      client: '',
      contractAmount: 0,
      startDate: '',
      endDate: '',
      category: '',
      description: '',
    });
    setDialogOpen(true);
  }

  function openEdit(project: (typeof projects)[0]) {
    setEditingId(project.id);
    reset({
      title: project.title,
      client: project.client,
      contractAmount: project.contractAmount,
      startDate: project.startDate,
      endDate: project.endDate || '',
      category: project.category,
      description: project.description || '',
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    reset();
  }

  function onSubmit(data: ProjectFormValues) {
    createMutation.mutate(data as any);
  }

  // Total contract value
  const totalValue = projects.reduce((acc, p) => acc + (p.contractAmount || 0), 0);

  if (projectsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-white/10">
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-indigo-500" />
            Έργα Εμπειρίας
          </h2>
          <p className="text-sm text-muted-foreground">
            {projects.length} έργ{projects.length === 1 ? 'ο' : 'α'} &middot; Συνολική αξία: {formatCurrency(totalValue)}
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
          Νέο Έργο
        </Button>
      </div>

      {/* Grid */}
      {projects.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 border-white/10">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Inbox className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Κανένα έργο</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Προσθέστε τα έργα εμπειρίας της εταιρείας σας.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const catColor =
              categoryColors[project.category] ||
              'bg-gray-500/10 text-gray-600 dark:text-gray-400';

            return (
              <Card
                key={project.id}
                className={cn(
                  'group border-white/10 bg-gradient-to-br from-card/80 to-card backdrop-blur-sm',
                  'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/20'
                )}
              >
                <CardContent className="p-5">
                  <div className="space-y-4">
                    {/* Category */}
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                          catColor
                        )}
                      >
                        {project.category}
                      </span>
                      {/* Actions */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(project)}
                          className="cursor-pointer h-7 w-7"
                          title="Επεξεργασία"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirmId(project.id)}
                          className="cursor-pointer h-7 w-7 text-destructive hover:text-destructive"
                          title="Διαγραφή"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-semibold leading-snug line-clamp-2">
                      {project.title}
                    </h3>

                    {/* Details */}
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{project.client}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                        <span className="font-medium text-foreground">
                          {formatCurrency(project.contractAmount)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {formatDate(project.startDate)}
                          {project.endDate
                            ? ` — ${formatDate(project.endDate)}`
                            : ' — Σε εξέλιξη'}
                        </span>
                      </div>
                    </div>

                    {/* Description preview */}
                    {project.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 border-t pt-3">
                        {project.description}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[560px] border-white/10 bg-gradient-to-br from-card to-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Επεξεργασία Έργου' : 'Νέο Έργο Εμπειρίας'}
            </DialogTitle>
            <DialogDescription>
              Συμπληρώστε τα στοιχεία του έργου.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Τίτλος Έργου *</Label>
              <Input
                {...register('title')}
                placeholder="π.χ. Ολοκληρωμένο Σύστημα ERP"
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Πελάτης / Αναθέτουσα Αρχή *</Label>
                <Input
                  {...register('client')}
                  placeholder="π.χ. Δήμος Αθηναίων"
                />
                {errors.client && (
                  <p className="text-xs text-destructive">{errors.client.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Κατηγορία *</Label>
                <Input
                  {...register('category')}
                  placeholder="π.χ. Πληροφορική"
                />
                {errors.category && (
                  <p className="text-xs text-destructive">{errors.category.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ποσό Σύμβασης (EUR) *</Label>
              <Input
                type="number"
                step="0.01"
                {...register('contractAmount')}
                placeholder="π.χ. 250000"
              />
              {errors.contractAmount && (
                <p className="text-xs text-destructive">{errors.contractAmount.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ημ. Έναρξης *</Label>
                <Input type="date" {...register('startDate')} className="cursor-pointer" />
                {errors.startDate && (
                  <p className="text-xs text-destructive">{errors.startDate.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Ημ. Λήξης</Label>
                <Input type="date" {...register('endDate')} className="cursor-pointer" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Περιγραφή</Label>
              <Input
                {...register('description')}
                placeholder="Σύντομη περιγραφή του έργου..."
              />
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
              Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το έργο; Η ενέργεια δεν αναιρείται.
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
