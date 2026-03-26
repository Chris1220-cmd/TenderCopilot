'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardContent,
} from '@/components/ui/glass-card';
import { Plus, X, RefreshCw, Loader2 } from 'lucide-react';
import type { EspdData, EspdPartII } from '@/lib/espd-types';

interface StepProps {
  data: EspdData;
  onChange: (partial: Partial<EspdData>) => void;
  tenderId: string;
}

export function EspdStepOperator({ data, onChange, tenderId }: StepProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [kadInput, setKadInput] = useState('');

  const prefillQuery = trpc.espd.getEspdPrefill.useQuery(
    { tenderId },
    { enabled: false }
  );

  const updateField = useCallback(
    (field: keyof EspdPartII, value: string | string[]) => {
      onChange({ partII: { ...data.partII, [field]: value } });
    },
    [data.partII, onChange]
  );

  const handleRefreshFromProfile = useCallback(async () => {
    const result = await prefillQuery.refetch();
    if (result.data?.profile) {
      const p = result.data.profile;
      onChange({
        partII: {
          ...data.partII,
          legalName: p.legalName || data.partII.legalName,
          tradeName: p.tradeName || data.partII.tradeName,
          taxId: p.taxId || data.partII.taxId,
          taxOffice: p.taxOffice || data.partII.taxOffice,
          registrationNumber:
            p.registrationNumber || data.partII.registrationNumber,
          address: p.address || data.partII.address,
          city: p.city || data.partII.city,
          postalCode: p.postalCode || data.partII.postalCode,
          country: p.country || data.partII.country,
          phone: p.phone || data.partII.phone,
          email: p.email || data.partII.email,
          website: p.website || data.partII.website,
          legalRepName: p.legalRepName || data.partII.legalRepName,
          legalRepTitle: p.legalRepTitle || data.partII.legalRepTitle,
          legalRepIdNumber:
            p.legalRepIdNumber || data.partII.legalRepIdNumber,
          kadCodes: p.kadCodes || data.partII.kadCodes,
        },
      });
      toast({ title: t('espd.refreshFromProfile') });
    }
  }, [prefillQuery, data.partII, onChange, toast, t]);

  const addKadCode = useCallback(() => {
    const code = kadInput.trim();
    if (code && !data.partII.kadCodes.includes(code)) {
      updateField('kadCodes', [...data.partII.kadCodes, code]);
      setKadInput('');
    }
  }, [kadInput, data.partII.kadCodes, updateField]);

  const removeKadCode = useCallback(
    (code: string) => {
      updateField(
        'kadCodes',
        data.partII.kadCodes.filter((c) => c !== code)
      );
    },
    [data.partII.kadCodes, updateField]
  );

  const handleKadKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addKadCode();
      }
    },
    [addKadCode]
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Refresh from Profile button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={handleRefreshFromProfile}
          disabled={prefillQuery.isFetching}
          className="cursor-pointer gap-2 min-h-[44px]"
        >
          {prefillQuery.isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {prefillQuery.isFetching
            ? t('espd.refreshing')
            : t('espd.refreshFromProfile')}
        </Button>
      </div>

      {/* Section 1: Company Details */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle>{t('espd.companyDetails')}</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="espd-legalName">{t('espd.legalName')}</Label>
              <Input
                id="espd-legalName"
                value={data.partII.legalName}
                onChange={(e) => updateField('legalName', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="espd-tradeName">{t('espd.tradeName')}</Label>
              <Input
                id="espd-tradeName"
                value={data.partII.tradeName}
                onChange={(e) => updateField('tradeName', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="espd-taxId">{t('espd.taxId')}</Label>
              <Input
                id="espd-taxId"
                value={data.partII.taxId}
                onChange={(e) => updateField('taxId', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="espd-taxOffice">{t('espd.taxOffice')}</Label>
              <Input
                id="espd-taxOffice"
                value={data.partII.taxOffice}
                onChange={(e) => updateField('taxOffice', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="espd-regNum">
                {t('espd.registrationNumber')}
              </Label>
              <Input
                id="espd-regNum"
                value={data.partII.registrationNumber}
                onChange={(e) =>
                  updateField('registrationNumber', e.target.value)
                }
              />
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Section 2: Address */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle>{t('espd.addressSection')}</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="espd-address">{t('espd.address')}</Label>
              <Input
                id="espd-address"
                value={data.partII.address}
                onChange={(e) => updateField('address', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="espd-city">{t('espd.city')}</Label>
              <Input
                id="espd-city"
                value={data.partII.city}
                onChange={(e) => updateField('city', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="espd-postalCode">
                {t('espd.postalCode')}
              </Label>
              <Input
                id="espd-postalCode"
                value={data.partII.postalCode}
                onChange={(e) => updateField('postalCode', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="espd-country">{t('espd.country')}</Label>
              <Input
                id="espd-country"
                value={data.partII.country}
                onChange={(e) => updateField('country', e.target.value)}
              />
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Section 3: Contact */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle>{t('espd.contactSection')}</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="espd-phone">{t('espd.phone')}</Label>
              <Input
                id="espd-phone"
                type="tel"
                value={data.partII.phone}
                onChange={(e) => updateField('phone', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="espd-email">{t('espd.email')}</Label>
              <Input
                id="espd-email"
                type="email"
                value={data.partII.email}
                onChange={(e) => updateField('email', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="espd-website">{t('espd.website')}</Label>
              <Input
                id="espd-website"
                type="url"
                value={data.partII.website}
                onChange={(e) => updateField('website', e.target.value)}
              />
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Section 4: Legal Representative */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle>{t('espd.legalRepSection')}</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="espd-legalRepName">
                {t('espd.legalRepName')}
              </Label>
              <Input
                id="espd-legalRepName"
                value={data.partII.legalRepName}
                onChange={(e) =>
                  updateField('legalRepName', e.target.value)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="espd-legalRepTitle">
                {t('espd.legalRepTitle')}
              </Label>
              <Input
                id="espd-legalRepTitle"
                value={data.partII.legalRepTitle}
                onChange={(e) =>
                  updateField('legalRepTitle', e.target.value)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="espd-legalRepId">
                {t('espd.legalRepIdNumber')}
              </Label>
              <Input
                id="espd-legalRepId"
                value={data.partII.legalRepIdNumber}
                onChange={(e) =>
                  updateField('legalRepIdNumber', e.target.value)
                }
              />
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Section 5: Other — Company Size & KAD Codes */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle>{t('espd.otherSection')}</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Company Size */}
            <div className="space-y-1.5">
              <Label>{t('espd.companySize')}</Label>
              <Select
                value={data.partII.companySize}
                onValueChange={(val) =>
                  updateField(
                    'companySize',
                    val as EspdPartII['companySize']
                  )
                }
              >
                <SelectTrigger className="cursor-pointer min-h-[44px]">
                  <SelectValue placeholder={t('espd.selectSize')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MICRO">{t('espd.micro')}</SelectItem>
                  <SelectItem value="SMALL">{t('espd.small')}</SelectItem>
                  <SelectItem value="MEDIUM">{t('espd.medium')}</SelectItem>
                  <SelectItem value="LARGE">{t('espd.large')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* KAD Codes — tag input */}
          <div className="space-y-1.5">
            <Label>{t('espd.kadCodes')}</Label>

            {data.partII.kadCodes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {data.partII.kadCodes.map((code) => (
                  <Badge
                    key={code}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    {code}
                    <button
                      type="button"
                      onClick={() => removeKadCode(code)}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 transition-colors cursor-pointer min-h-[22px] min-w-[22px] flex items-center justify-center"
                      aria-label={`Remove ${code}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                value={kadInput}
                onChange={(e) => setKadInput(e.target.value)}
                onKeyDown={handleKadKeyDown}
                placeholder={t('espd.kadPlaceholder')}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={addKadCode}
                disabled={!kadInput.trim()}
                className="cursor-pointer gap-1 min-h-[44px] min-w-[44px]"
              >
                <Plus className="h-4 w-4" />
                {t('espd.addKad')}
              </Button>
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
