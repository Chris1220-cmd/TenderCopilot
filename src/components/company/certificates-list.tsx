'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn, formatDate } from '@/lib/utils';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  Upload,
  Calendar,
  Building2,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Inbox,
} from 'lucide-react';

const certificateSchema = z.object({
  type: z.string().min(1, 'Ο τύπος είναι υποχρεωτικός'),
  title: z.string().min(1, 'Ο τίτλος είναι υποχρεωτικός'),
  issuer: z.string().min(1, 'Ο εκδότης είναι υποχρεωτικός'),
  issueDate: z.string().min(1, 'Η ημ. έκδοσης είναι υποχρεωτική'),
  expiryDate: z.string().optional(),
});

type CertificateFormValues = z.infer<typeof certificateSchema>;

const certificateTypes = [
  { value: 'ISO_9001', label: 'ISO 9001' },
  { value: 'ISO_14001', label: 'ISO 14001' },
  { value: 'ISO_27001', label: 'ISO 27001' },
  { value: 'ISO_45001', label: 'ISO 45001' },
  { value: 'EMAS', label: 'EMAS' },
  { value: 'MEEV', label: 'ΜΕΕΠ / Πτυχίο' },
  { value: 'OTHER', label: 'Άλλο' },
];

// Mock data
const mockCertificates = [
  {
    id: '1',
    type: 'ISO_9001',
    title: 'ISO 9001:2015 Σύστημα Διαχείρισης Ποιότητας',
    issuer: 'TUV Hellas',
    issueDate: '2024-01-15',
    expiryDate: '2027-01-14',
    fileUrl: null,
  },
  {
    id: '2',
    type: 'ISO_14001',
    title: 'ISO 14001:2015 Περιβαλλοντική Διαχείριση',
    issuer: 'Bureau Veritas',
    issueDate: '2023-06-01',
    expiryDate: '2025-05-31',
    fileUrl: null,
  },
];

function isExpired(dateStr?: string | null) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function isExpiringSoon(dateStr?: string | null) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  return diff > 0 && diff < 90 * 24 * 60 * 60 * 1000; // 90 days
}

export function CertificatesList() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const certsQuery = trpc.company.getCertificates.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const createMutation = trpc.company.createCertificate.useMutation({
    onSuccess: () => {
      toast({ title: 'Επιτυχία', description: 'Το πιστοποιητικό δημιουργήθηκε.' });
      certsQuery.refetch();
      closeDialog();
    },
    onError: () => {
      toast({ title: 'Σφάλμα', description: 'Αποτυχία δημιουργίας.', variant: 'destructive' });
    },
  });

  const deleteMutation = trpc.company.deleteCertificate.useMutation({
    onSuccess: () => {
      toast({ title: 'Διαγράφηκε', description: 'Το πιστοποιητικό διαγράφηκε.' });
      certsQuery.refetch();
      setDeleteConfirmId(null);
    },
    onError: () => {
      toast({ title: 'Σφάλμα', description: 'Αποτυχία διαγραφής.', variant: 'destructive' });
    },
  });

  const certs = (certsQuery.data ?? []) as any[];

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CertificateFormValues>({
    resolver: zodResolver(certificateSchema),
    defaultValues: { type: '', title: '', issuer: '', issueDate: '', expiryDate: '' },
  });

  function openCreate() {
    setEditingId(null);
    reset({ type: '', title: '', issuer: '', issueDate: '', expiryDate: '' });
    setDialogOpen(true);
  }

  function openEdit(cert: (typeof certs)[0]) {
    setEditingId(cert.id);
    reset({
      type: cert.type,
      title: cert.title,
      issuer: cert.issuer,
      issueDate: cert.issueDate,
      expiryDate: cert.expiryDate || '',
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    reset();
  }

  function onSubmit(data: CertificateFormValues) {
    createMutation.mutate(data as any);
  }

  if (certsQuery.isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="border-white/10 bg-gradient-to-br from-card/80 to-card backdrop-blur-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-500" />
            Πιστοποιητικά
          </h2>
          <p className="text-sm text-muted-foreground">
            {certs.length} πιστοποιητικ{certs.length === 1 ? 'ό' : 'ά'} στο αρχείο
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
          Νέο Πιστοποιητικό
        </Button>
      </div>

      {/* List */}
      {certs.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 border-white/10">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Inbox className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Κανένα πιστοποιητικό</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Προσθέστε τα πιστοποιητικά της εταιρείας σας.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {certs.map((cert) => {
            const expired = isExpired(cert.expiryDate);
            const expiringSoon = isExpiringSoon(cert.expiryDate);
            const typeLabel =
              certificateTypes.find((t) => t.value === cert.type)?.label || cert.type;

            return (
              <Card
                key={cert.id}
                className={cn(
                  'group border-white/10 bg-gradient-to-br from-card/80 to-card backdrop-blur-sm',
                  'transition-all duration-200 hover:shadow-md hover:border-primary/20',
                  expired && 'border-destructive/30'
                )}
              >
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Icon */}
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                        expired
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-indigo-500/10 text-indigo-500'
                      )}
                    >
                      <ShieldCheck className="h-5 w-5" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold truncate">{cert.title}</h3>
                        <Badge variant="secondary" className="text-[10px]">
                          {typeLabel}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {cert.issuer}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(cert.issueDate)}
                          {cert.expiryDate && ` — ${formatDate(cert.expiryDate)}`}
                        </span>
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="flex items-center gap-2">
                      {expired ? (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Ληγμένο
                        </Badge>
                      ) : expiringSoon ? (
                        <Badge variant="warning" className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Λήγει σύντομα
                        </Badge>
                      ) : (
                        <Badge variant="success" className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Ενεργό
                        </Badge>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {}}
                        className="cursor-pointer h-8 w-8"
                        title="Μεταφόρτωση αρχείου"
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(cert)}
                        className="cursor-pointer h-8 w-8"
                        title="Επεξεργασία"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmId(cert.id)}
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
        <DialogContent className="sm:max-w-[520px] border-white/10 bg-gradient-to-br from-card to-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Επεξεργασία Πιστοποιητικού' : 'Νέο Πιστοποιητικό'}
            </DialogTitle>
            <DialogDescription>
              Συμπληρώστε τα στοιχεία του πιστοποιητικού.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Τύπος *</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue placeholder="Επιλέξτε τύπο" />
                    </SelectTrigger>
                    <SelectContent>
                      {certificateTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.type && (
                <p className="text-xs text-destructive">{errors.type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Τίτλος *</Label>
              <Input
                {...register('title')}
                placeholder="π.χ. ISO 9001:2015 Σύστημα Διαχείρισης Ποιότητας"
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Εκδότης *</Label>
              <Input
                {...register('issuer')}
                placeholder="π.χ. TUV Hellas"
              />
              {errors.issuer && (
                <p className="text-xs text-destructive">{errors.issuer.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ημ. Έκδοσης *</Label>
                <Input type="date" {...register('issueDate')} className="cursor-pointer" />
                {errors.issueDate && (
                  <p className="text-xs text-destructive">{errors.issueDate.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Ημ. Λήξης</Label>
                <Input type="date" {...register('expiryDate')} className="cursor-pointer" />
              </div>
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

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <DialogContent className="sm:max-w-[400px] border-white/10 bg-gradient-to-br from-card to-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Επιβεβαίωση Διαγραφής</DialogTitle>
            <DialogDescription>
              Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το πιστοποιητικό; Η ενέργεια δεν αναιρείται.
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
