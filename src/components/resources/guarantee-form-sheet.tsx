'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from '@/components/ui/sheet';
import { Loader2 } from 'lucide-react';

type GuaranteeFormData = {
  tenderId: string;
  type: 'PARTICIPATION' | 'PERFORMANCE' | 'ADVANCE_PAYMENT';
  amount: number;
  bank: string;
  referenceNumber: string;
  status: 'REQUESTED' | 'ISSUED' | 'ACTIVE' | 'RELEASED' | 'EXPIRED';
  notes: string;
};

const defaultForm: GuaranteeFormData = {
  tenderId: '',
  type: 'PARTICIPATION',
  amount: 0,
  bank: '',
  referenceNumber: '',
  status: 'REQUESTED',
  notes: '',
};

export function GuaranteeFormSheet({
  open,
  onOpenChange,
  onSuccess,
  editData,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editData?: { id: string } & GuaranteeFormData;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const { data: tenders } = trpc.tender.list.useQuery(undefined, {
    enabled: open,
  });
  const activeTenders = (tenders ?? []).filter((tender: any) =>
    ['DISCOVERY', 'GO_NO_GO', 'IN_PROGRESS'].includes(tender.status)
  );

  const [form, setForm] = useState<GuaranteeFormData>(
    editData
      ? {
          tenderId: editData.tenderId,
          type: editData.type,
          amount: editData.amount,
          bank: editData.bank,
          referenceNumber: editData.referenceNumber,
          status: editData.status,
          notes: editData.notes,
        }
      : defaultForm
  );

  useEffect(() => {
    if (editData) {
      setForm({
        tenderId: editData.tenderId,
        type: editData.type,
        amount: editData.amount,
        bank: editData.bank,
        referenceNumber: editData.referenceNumber,
        status: editData.status,
        notes: editData.notes,
      });
    } else {
      setForm(defaultForm);
    }
  }, [editData, open]);

  const createMutation = trpc.resources.createGuarantee.useMutation({
    onSuccess: () => {
      utils.resources.invalidate();
      onSuccess();
      onOpenChange(false);
    },
  });

  const updateMutation = trpc.resources.updateGuarantee.useMutation({
    onSuccess: () => {
      utils.resources.invalidate();
      onSuccess();
      onOpenChange(false);
    },
  });

  const isLoading = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editData?.id) {
      updateMutation.mutate({
        id: editData.id,
        ...form,
        bank: form.bank || undefined,
        referenceNumber: form.referenceNumber || undefined,
        notes: form.notes || undefined,
      });
    } else {
      createMutation.mutate({
        ...form,
        bank: form.bank || undefined,
        referenceNumber: form.referenceNumber || undefined,
        notes: form.notes || undefined,
      });
    }
  }

  function handleTenderChange(tenderId: string) {
    setForm((prev) => {
      const tender = activeTenders.find((t: any) => t.id === tenderId);
      const autoAmount =
        prev.type === 'PARTICIPATION' && tender?.budget
          ? tender.budget * 0.02
          : prev.amount;
      return { ...prev, tenderId, amount: autoAmount };
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('resources.guarantees.form.title')}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-6">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {t('resources.guarantees.form.tender')}
            </label>
            <Select
              value={form.tenderId}
              onValueChange={handleTenderChange}
              disabled={!!editData}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activeTenders.map((tender: any) => (
                  <SelectItem key={tender.id} value={tender.id}>
                    {tender.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {t('resources.guarantees.form.type')}
            </label>
            <Select
              value={form.type}
              onValueChange={(v) =>
                setForm((p) => ({ ...p, type: v as GuaranteeFormData['type'] }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PARTICIPATION">
                  {t('resources.guarantees.type.PARTICIPATION')}
                </SelectItem>
                <SelectItem value="PERFORMANCE">
                  {t('resources.guarantees.type.PERFORMANCE')}
                </SelectItem>
                <SelectItem value="ADVANCE_PAYMENT">
                  {t('resources.guarantees.type.ADVANCE_PAYMENT')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {t('resources.guarantees.form.amount')}
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.amount || ''}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  amount: parseFloat(e.target.value) || 0,
                }))
              }
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {t('resources.guarantees.form.bank')}
            </label>
            <Input
              value={form.bank}
              onChange={(e) =>
                setForm((p) => ({ ...p, bank: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {t('resources.guarantees.form.referenceNumber')}
            </label>
            <Input
              value={form.referenceNumber}
              onChange={(e) =>
                setForm((p) => ({ ...p, referenceNumber: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {t('resources.guarantees.form.status')}
            </label>
            <Select
              value={form.status}
              onValueChange={(v) =>
                setForm((p) => ({
                  ...p,
                  status: v as GuaranteeFormData['status'],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  [
                    'REQUESTED',
                    'ISSUED',
                    'ACTIVE',
                    'RELEASED',
                    'EXPIRED',
                  ] as const
                ).map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`resources.guarantees.status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {t('resources.guarantees.form.notes')}
            </label>
            <Input
              value={form.notes}
              onChange={(e) =>
                setForm((p) => ({ ...p, notes: e.target.value }))
              }
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 cursor-pointer"
              onClick={() => onOpenChange(false)}
            >
              {t('resources.guarantees.form.cancel')}
            </Button>
            <Button
              type="submit"
              className="flex-1 cursor-pointer"
              disabled={isLoading || !form.tenderId || !form.amount}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('resources.guarantees.form.save')}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
