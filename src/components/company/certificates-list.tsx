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

const certificateTypesBase = [
  { value: 'ISO_9001', label: 'ISO 9001' },
  { value: 'ISO_14001', label: 'ISO 14001' },
  { value: 'ISO_27001', label: 'ISO 27001' },
  { value: 'ISO_45001', label: 'ISO 45001' },
  { value: 'EMAS', label: 'EMAS' },
  { value: 'MEEV', label: 'ΜΕΕΠ / Πτυχίο' },
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
  const { t } = useTranslation();

  const certificateTypes = [...certificateTypesBase, { value: 'OTHER', label: t('certificates.typeOther') }];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const certsQuery = trpc.company.getCertificates.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const createMutation = trpc.company.createCertificate.useMutation({
    onSuccess: () => {
      toast({ title: t('common.success'), description: t('certificates.certificateCreated') });
      certsQuery.refetch();
      closeDialog();
    },
    onError: (err) => {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = trpc.company.updateCertificate.useMutation({
    onSuccess: () => {
      toast({ title: t('common.success'), description: t('certificates.certificateUpdated') });
      certsQuery.refetch();
      closeDialog();
    },
    onError: (err) => {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = trpc.company.deleteCertificate.useMutation({
    onSuccess: () => {
      toast({ title: t('common.deleted'), description: t('certificates.certificateDeleted') });
      certsQuery.refetch();
      setDeleteConfirmId(null);
    },
    onError: (err) => {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    },
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data } as any);
    } else {
      createMutation.mutate(data as any);
    }
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
            <ShieldCheck className="h-5 w-5 text-primary" />
            {t('certificates.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {certs.length} {certs.length === 1 ? t('certificates.countSingular') : t('certificates.countPlural')}
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
          {t('certificates.newCertificate')}
        </Button>
      </div>

      {/* List */}
      {certs.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 border-white/10">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Inbox className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">{t('certificates.noCertificates')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('certificates.noCertificatesSub')}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {certs.map((cert) => {
            const expired = isExpired(cert.expiryDate);
            const expiringSoon = isExpiringSoon(cert.expiryDate);
            const typeLabel =
              certificateTypes.find((ct) => ct.value === cert.type)?.label || cert.type;

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
                          : 'bg-primary/10 text-primary'
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
                        {cert._count?.deadlinePlanItems > 0 && (
                          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {t('certs.usedInTenders').replace('{{count}}', String(cert._count.deadlinePlanItems))}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status badge */}
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
                            toast({ title: 'Upload', description: t('certificates.uploadComingSoon') });
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
                        onClick={() => openEdit(cert)}
                        className="cursor-pointer h-8 w-8"
                        title={t('common.edit')}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmId(cert.id)}
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
              {editingId ? t('certificates.editCertificate') : t('certificates.newCertificate')}
            </DialogTitle>
            <DialogDescription>
              {t('certificates.fillDetails')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('certificates.type')}</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue placeholder={t('certificates.selectType')} />
                    </SelectTrigger>
                    <SelectContent>
                      {certificateTypes.map((ct) => (
                        <SelectItem key={ct.value} value={ct.value}>
                          {ct.label}
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
              <Label>{t('certificates.certTitle')}</Label>
              <Input
                {...register('title')}
                placeholder={t('certificates.certTitlePlaceholder')}
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('certificates.issuer')}</Label>
              <Input
                {...register('issuer')}
                placeholder={t('certificates.issuerPlaceholder')}
              />
              {errors.issuer && (
                <p className="text-xs text-destructive">{errors.issuer.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('certificates.issueDate')}</Label>
                <Input type="date" {...register('issueDate')} className="cursor-pointer" />
                {errors.issueDate && (
                  <p className="text-xs text-destructive">{errors.issueDate.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t('certificates.expiryDate')}</Label>
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

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <DialogContent className="sm:max-w-[400px] border-white/10 bg-gradient-to-br from-card to-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>{t('common.deleteConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('certificates.deleteConfirm')}
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
