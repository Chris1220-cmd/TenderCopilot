'use client';

import { useState, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn, formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from '@/lib/i18n';
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
  FileCheck,
  Plus,
  Pencil,
  Trash2,
  Upload,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Inbox,
  FileText,
} from 'lucide-react';

const legalDocSchema = z.object({
  type: z.string().min(1, 'Ο τύπος είναι υποχρεωτικός'),
  title: z.string().min(1, 'Ο τίτλος είναι υποχρεωτικός'),
  issueDate: z.string().min(1, 'Η ημ. έκδοσης είναι υποχρεωτική'),
  expiryDate: z.string().optional(),
});

type LegalDocFormValues = z.infer<typeof legalDocSchema>;

const docTypes = [
  { value: 'TAX_CLEARANCE', label: 'Φορολογική Ενημερότητα' },
  { value: 'SOCIAL_SECURITY_CLEARANCE', label: 'Ασφαλιστική Ενημερότητα' },
  { value: 'GEMI_CERTIFICATE', label: 'Πιστοποιητικό ΓΕΜΗ' },
  { value: 'CRIMINAL_RECORD', label: 'Ποινικό Μητρώο' },
  { value: 'JUDICIAL_CERTIFICATE', label: 'Δικαστικό Πιστοποιητικό' },
  { value: 'OTHER', label: 'Άλλο' },
];

const docTypeColors: Record<string, string> = {
  TAX_CLEARANCE: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  SOCIAL_SECURITY_CLEARANCE: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  GEMI_CERTIFICATE: 'bg-primary/10 text-primary',
  CRIMINAL_RECORD: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  JUDICIAL_CERTIFICATE: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  OTHER: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
};

function isExpired(dateStr?: string | null) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function isExpiringSoon(dateStr?: string | null) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000; // 30 days
}

export function LegalDocsList() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const docsQuery = trpc.company.getLegalDocs.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const createMutation = trpc.company.createLegalDoc.useMutation({
    onSuccess: () => {
      toast({ title: t('common.success'), description: t('legalDocs.documentCreated') });
      docsQuery.refetch();
      closeDialog();
    },
    onError: (err) => {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = trpc.company.updateLegalDoc.useMutation({
    onSuccess: () => {
      toast({ title: t('common.success'), description: t('legalDocs.documentUpdated') });
      docsQuery.refetch();
      closeDialog();
    },
    onError: (err) => {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = trpc.company.deleteLegalDoc.useMutation({
    onSuccess: () => {
      toast({ title: t('common.deleted'), description: t('legalDocs.documentDeleted') });
      docsQuery.refetch();
      setDeleteConfirmId(null);
    },
    onError: (err) => {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    },
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const docs = (docsQuery.data ?? []) as any[];

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<LegalDocFormValues>({
    resolver: zodResolver(legalDocSchema),
    defaultValues: { type: '', title: '', issueDate: '', expiryDate: '' },
  });

  function openCreate() {
    setEditingId(null);
    reset({ type: '', title: '', issueDate: '', expiryDate: '' });
    setDialogOpen(true);
  }

  function openEdit(doc: (typeof docs)[0]) {
    setEditingId(doc.id);
    reset({
      type: doc.type,
      title: doc.title,
      issueDate: doc.issueDate,
      expiryDate: doc.expiryDate || '',
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    reset();
  }

  function onSubmit(data: LegalDocFormValues) {
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data } as any);
    } else {
      createMutation.mutate(data as any);
    }
  }

  if (docsQuery.isLoading) {
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
                <Skeleton className="h-6 w-20" />
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
            <FileCheck className="h-5 w-5 text-primary" />
            {t('legalDocs.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {docs.length} {docs.length === 1 ? t('legalDocs.countSingular') : t('legalDocs.countPlural')}
          </p>
        </div>
        <Button
          onClick={openCreate}
          className={cn(
            'cursor-pointer',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            'shadow-lg shadow-primary/25',
            'border-0'
          )}
        >
          <Plus className="h-4 w-4" />
          {t('legalDocs.newDocument')}
        </Button>
      </div>

      {/* List */}
      {docs.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 border-white/10">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Inbox className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">{t('legalDocs.noDocuments')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('legalDocs.noDocumentsSub')}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => {
            const expired = isExpired(doc.expiryDate);
            const expiringSoon = isExpiringSoon(doc.expiryDate);
            const typeLabel =
              docTypes.find((t) => t.value === doc.type)?.label || doc.type;
            const typeColor = docTypeColors[doc.type] || docTypeColors.OTHER;

            return (
              <Card
                key={doc.id}
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
                          : 'bg-primary/10 text-primary'
                      )}
                    >
                      <FileText className="h-5 w-5" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold truncate">{doc.title}</h3>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            typeColor
                          )}
                        >
                          {typeLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(doc.issueDate)}
                          {doc.expiryDate && ` — ${formatDate(doc.expiryDate)}`}
                        </span>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2">
                      {expired ? (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {t('common.expired')}
                        </Badge>
                      ) : expiringSoon ? (
                        <Badge variant="warning" className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {t('common.expiringSoon')}
                        </Badge>
                      ) : (
                        <Badge variant="success" className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          {t('common.active')}
                        </Badge>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".pdf,.jpg,.png,.doc,.docx"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            toast({ title: 'Upload', description: t('legalDocs.uploadComingSoon') });
                          }
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        className="cursor-pointer h-8 w-8"
                        title={t('common.upload')}
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(doc)}
                        className="cursor-pointer h-8 w-8"
                        title={t('common.edit')}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmId(doc.id)}
                        className="cursor-pointer h-8 w-8 text-destructive hover:text-destructive"
                        title={t('common.delete')}
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
              {editingId ? t('legalDocs.editDocument') : t('legalDocs.newLegalDocument')}
            </DialogTitle>
            <DialogDescription>
              {t('legalDocs.fillDetails')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('legalDocs.type')}</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue placeholder={t('legalDocs.selectType')} />
                    </SelectTrigger>
                    <SelectContent>
                      {docTypes.map((t) => (
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
              <Label>{t('legalDocs.docTitle')}</Label>
              <Input
                {...register('title')}
                placeholder={t('legalDocs.docTitlePlaceholder')}
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('legalDocs.issueDate')}</Label>
                <Input type="date" {...register('issueDate')} className="cursor-pointer" />
                {errors.issueDate && (
                  <p className="text-xs text-destructive">{errors.issueDate.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t('legalDocs.expiryDate')}</Label>
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
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className={cn(
                  'cursor-pointer',
                  'bg-primary text-primary-foreground hover:bg-primary/90',
                  'border-0'
                )}
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? t('common.update') : t('common.create')}
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
            <DialogTitle>{t('common.deleteConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('legalDocs.deleteConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              className="cursor-pointer"
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate({ id: deleteConfirmId })}
              disabled={deleteMutation.isPending}
              className="cursor-pointer"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
