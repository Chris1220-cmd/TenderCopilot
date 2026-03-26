'use client';

import { useEffect, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { teamMemberCreateSchema, type TeamMemberFormValues } from '@/lib/team-member-schemas';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from '@/lib/i18n';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  GraduationCap,
  Briefcase,
  Award,
  Plus,
  Trash2,
  FileText,
  Upload,
  Loader2,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamMemberSheetProps {
  open: boolean;
  memberId: string | null; // null = create, string = edit
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

function SectionHeader({
  icon: Icon,
  label,
  onAdd,
  addLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-[#48A4D6]" />
        {label}
      </h3>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onAdd}
        className="h-7 gap-1 text-xs text-[#48A4D6] hover:text-[#48A4D6]/80 hover:bg-[#48A4D6]/10 cursor-pointer"
      >
        <Plus className="h-3.5 w-3.5" />
        {addLabel}
      </Button>
    </div>
  );
}

// ─── Default values ───────────────────────────────────────────────────────────

const defaultValues: TeamMemberFormValues = {
  fullName: '',
  title: '',
  email: '',
  phone: '',
  totalExperience: 0,
  bio: '',
  cvFileKey: '',
  cvFileName: '',
  education: [],
  experience: [],
  certifications: [],
};

const emptyEducation = { degree: '', institution: '', year: undefined } as const;
const emptyExperience = {
  projectName: '',
  client: '',
  role: '',
  category: '',
  budget: undefined,
  startYear: new Date().getFullYear(),
  endYear: undefined,
  description: '',
} as const;
const emptyCertification = {
  name: '',
  issuer: '',
  issueDate: undefined,
  expiryDate: undefined,
} as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function TeamMemberSheet({ open, memberId, onClose }: TeamMemberSheetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isEdit = memberId !== null;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Single form instance ──────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TeamMemberFormValues>({
    resolver: zodResolver(teamMemberCreateSchema),
    defaultValues,
  });

  const cvFileName = watch('cvFileName');
  const cvFileKey = watch('cvFileKey');

  // ── Field arrays ──────────────────────────────────────────────────────────
  const {
    fields: eduFields,
    append: appendEdu,
    remove: removeEdu,
  } = useFieldArray({ control, name: 'education' });

  const {
    fields: expFields,
    append: appendExp,
    remove: removeExp,
  } = useFieldArray({ control, name: 'experience' });

  const {
    fields: certFields,
    append: appendCert,
    remove: removeCert,
  } = useFieldArray({ control, name: 'certifications' });

  // ── Remote data ───────────────────────────────────────────────────────────
  const memberQuery = trpc.teamMember.getById.useQuery(
    { id: memberId! },
    { enabled: isEdit && open }
  );

  // ── Populate form when editing ────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    if (!isEdit) {
      reset(defaultValues);
      return;
    }

    if (memberQuery.data) {
      const d = memberQuery.data;
      reset({
        fullName: d.fullName,
        title: d.title,
        email: d.email ?? '',
        phone: d.phone ?? '',
        totalExperience: d.totalExperience ?? 0,
        bio: d.bio ?? '',
        cvFileKey: d.cvFileKey ?? '',
        cvFileName: d.cvFileName ?? '',
        education: d.education.map((e) => ({
          id: e.id,
          degree: e.degree,
          institution: e.institution,
          year: e.year ?? undefined,
        })),
        experience: d.experience.map((e) => ({
          id: e.id,
          projectName: e.projectName,
          client: e.client,
          role: e.role,
          category: e.category ?? '',
          budget: e.budget != null ? Number(e.budget) : undefined,
          startYear: e.startYear,
          endYear: e.endYear ?? undefined,
          description: e.description ?? '',
        })),
        certifications: d.certifications.map((c) => ({
          id: c.id,
          name: c.name,
          issuer: c.issuer,
          issueDate: c.issueDate ? new Date(c.issueDate) : undefined,
          expiryDate: c.expiryDate ? new Date(c.expiryDate) : undefined,
        })),
      });
    }
  }, [open, isEdit, memberQuery.data, reset]);

  // ── tRPC utils for cache invalidation ────────────────────────────────────
  const utils = trpc.useUtils();

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = trpc.teamMember.create.useMutation({
    onSuccess: () => {
      toast({ title: t('teamMembers.memberCreated') });
      utils.teamMember.list.invalidate();
      onClose();
    },
    onError: (err) => {
      toast({
        title: t('common.error'),
        description: err.message || t('common.saveFailed'),
        variant: 'destructive',
      });
    },
  });

  const updateMutation = trpc.teamMember.update.useMutation({
    onSuccess: () => {
      toast({ title: t('teamMembers.memberUpdated') });
      utils.teamMember.list.invalidate();
      if (memberId) utils.teamMember.getById.invalidate({ id: memberId });
      onClose();
    },
    onError: (err) => {
      toast({
        title: t('common.error'),
        description: err.message || t('common.saveFailed'),
        variant: 'destructive',
      });
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── CV parse ────────────────────────────────────────────────────────────────
  const parseCvMutation = trpc.teamMember.parseCv.useMutation({
    onSuccess: (data) => {
      // Auto-fill form from parsed data
      if (data.fullName) setValue('fullName', data.fullName);
      if (data.title) setValue('title', data.title);
      if (data.totalExperience) setValue('totalExperience', data.totalExperience);
      if (data.education?.length) {
        // Clear existing and add parsed
        while (eduFields.length > 0) removeEdu(0);
        data.education.forEach((e) => appendEdu({ degree: e.degree, institution: e.institution, year: e.year }));
      }
      if (data.experience?.length) {
        while (expFields.length > 0) removeExp(0);
        data.experience.forEach((e) => appendExp({
          projectName: e.projectName, client: e.client, role: e.role,
          budget: e.budget, startYear: e.startYear, endYear: e.endYear,
          description: e.description, category: e.category,
        }));
      }
      if (data.certifications?.length) {
        while (certFields.length > 0) removeCert(0);
        data.certifications.forEach((c) => appendCert({
          name: c.name, issuer: c.issuer,
          issueDate: c.issueDate ? new Date(c.issueDate) : null,
          expiryDate: c.expiryDate ? new Date(c.expiryDate) : null,
        }));
      }
      toast({ title: t('common.success'), description: t('teamMembers.parseSuccess') });
    },
    onError: (err) => {
      const msg = err.message.includes('No extractable text')
        ? t('teamMembers.parseError')
        : t('teamMembers.parseFailed');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    },
  });

  // ── CV file upload ─────────────────────────────────────────────────────────
  const handleFileUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('files', file);
    formData.append('type', 'cv');
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = (await res.json()) as {
        files?: Array<{ fileKey: string; fileName: string }>;
      };
      if (data.files?.[0]) {
        setValue('cvFileKey', data.files[0].fileKey);
        setValue('cvFileName', data.files[0].fileName);
      }
    } catch {
      toast({
        title: t('common.error'),
        description: t('common.saveFailed'),
        variant: 'destructive',
      });
    }
  };

  // ── Form submit ───────────────────────────────────────────────────────────
  const onSubmit = (data: TeamMemberFormValues) => {
    if (isEdit && memberId) {
      updateMutation.mutate({ id: memberId, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  // ── Date helper ───────────────────────────────────────────────────────────
  const toDateInput = (val: Date | null | undefined): string => {
    if (!val) return '';
    try {
      return new Date(val).toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        className="sm:max-w-[640px] w-full p-0 flex flex-col gap-0 border-l border-border/60"
      >
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <SheetHeader className="shrink-0 px-6 py-4 border-b border-border/60">
          <SheetTitle className="flex items-center gap-2 text-base font-semibold">
            <User className="h-4 w-4 text-[#48A4D6]" />
            {isEdit ? t('teamMembers.editMember') : t('teamMembers.newMember')}
          </SheetTitle>
        </SheetHeader>

        {/* ── Scrollable body ───────────────────────────────────────────────── */}
        <ScrollArea className="flex-1 h-[calc(100vh-140px)]">
          <form
            id="team-member-form"
            onSubmit={handleSubmit(onSubmit)}
            className="px-6 py-5 space-y-6"
          >
            {/* ═══════════════ BASIC INFO ═══════════════════════════════════ */}
            <div className="space-y-4">
              {/* Row 1: fullName + title */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-sm font-medium">
                    {t('teamMembers.fullName')}
                  </Label>
                  <Input
                    id="fullName"
                    {...register('fullName')}
                    placeholder={t('teamMembers.fullNamePlaceholder')}
                    className={cn(
                      'transition-colors duration-150 focus:ring-2 focus:ring-[#48A4D6]/20',
                      errors.fullName && 'border-destructive focus:ring-destructive/20'
                    )}
                  />
                  <FieldError message={errors.fullName?.message} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="title" className="text-sm font-medium">
                    {t('teamMembers.memberTitle')}
                  </Label>
                  <Input
                    id="title"
                    {...register('title')}
                    placeholder={t('teamMembers.memberTitlePlaceholder')}
                    className={cn(
                      'transition-colors duration-150 focus:ring-2 focus:ring-[#48A4D6]/20',
                      errors.title && 'border-destructive focus:ring-destructive/20'
                    )}
                  />
                  <FieldError message={errors.title?.message} />
                </div>
              </div>

              {/* Row 2: email + phone */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium">
                    {t('teamMembers.email')}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    className={cn(
                      'transition-colors duration-150 focus:ring-2 focus:ring-[#48A4D6]/20',
                      errors.email && 'border-destructive focus:ring-destructive/20'
                    )}
                  />
                  <FieldError message={errors.email?.message} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-sm font-medium">
                    {t('teamMembers.phone')}
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    {...register('phone')}
                    className="transition-colors duration-150 focus:ring-2 focus:ring-[#48A4D6]/20"
                  />
                </div>
              </div>

              {/* Row 3: totalExperience */}
              <div className="space-y-1.5">
                <Label htmlFor="totalExperience" className="text-sm font-medium">
                  {t('teamMembers.totalExperience')}
                </Label>
                <Input
                  id="totalExperience"
                  type="number"
                  min={0}
                  max={60}
                  {...register('totalExperience')}
                  className={cn(
                    'w-32 transition-colors duration-150 focus:ring-2 focus:ring-[#48A4D6]/20',
                    errors.totalExperience && 'border-destructive focus:ring-destructive/20'
                  )}
                />
                <FieldError message={errors.totalExperience?.message} />
              </div>

              {/* Row 4: bio */}
              <div className="space-y-1.5">
                <Label htmlFor="bio" className="text-sm font-medium">
                  {t('teamMembers.bio')}
                </Label>
                <Textarea
                  id="bio"
                  {...register('bio')}
                  placeholder={t('teamMembers.bioPlaceholder')}
                  rows={3}
                  className="resize-none transition-colors duration-150 focus:ring-2 focus:ring-[#48A4D6]/20"
                />
              </div>
            </div>

            {/* ═══════════════ CV UPLOAD ════════════════════════════════════ */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-[#48A4D6]" />
                {t('teamMembers.uploadCv')}
              </Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5 cursor-pointer text-xs h-8 border-border/60 hover:border-[#48A4D6]/40 hover:text-[#48A4D6] transition-colors duration-150"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {t('common.upload')}
                </Button>
                {cvFileKey && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => parseCvMutation.mutate({ fileKey: cvFileKey })}
                    disabled={parseCvMutation.isPending}
                    className="gap-1.5 cursor-pointer text-xs h-8 border-[#48A4D6]/40 text-[#48A4D6] hover:bg-[#48A4D6]/10 transition-colors duration-150"
                  >
                    {parseCvMutation.isPending ? t('teamMembers.parsing') : t('teamMembers.parseCv')}
                  </Button>
                )}
                {cvFileName && (
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {cvFileName}
                  </span>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFileUpload(file);
                  }}
                />
              </div>
            </div>

            <Separator className="bg-border/60" />

            {/* ═══════════════ EDUCATION ════════════════════════════════════ */}
            <div>
              <SectionHeader
                icon={GraduationCap}
                label={t('teamMembers.education')}
                onAdd={() => appendEdu({ ...emptyEducation })}
                addLabel={t('teamMembers.addEducation')}
              />

              <div className="space-y-4">
                {eduFields.length === 0 && (
                  <p className="text-xs text-muted-foreground py-1">
                    {t('common.noResults')}
                  </p>
                )}

                {eduFields.map((field, index) => (
                  <div
                    key={field.id}
                    className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">
                          {t('teamMembers.degree')}
                        </Label>
                        <Input
                          {...register(`education.${index}.degree`)}
                          placeholder={t('teamMembers.degreePlaceholder')}
                          className={cn(
                            'h-8 text-sm transition-colors duration-150 focus:ring-2 focus:ring-[#48A4D6]/20',
                            errors.education?.[index]?.degree && 'border-destructive'
                          )}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">
                          {t('teamMembers.institution')}
                        </Label>
                        <Input
                          {...register(`education.${index}.institution`)}
                          placeholder={t('teamMembers.institutionPlaceholder')}
                          className={cn(
                            'h-8 text-sm transition-colors duration-150 focus:ring-2 focus:ring-[#48A4D6]/20',
                            errors.education?.[index]?.institution && 'border-destructive'
                          )}
                        />
                      </div>
                    </div>

                    <div className="flex items-end gap-3">
                      <div className="space-y-1.5 w-28">
                        <Label className="text-xs font-medium text-muted-foreground">
                          {t('teamMembers.year')}
                        </Label>
                        <Input
                          type="number"
                          min={1950}
                          max={2030}
                          {...register(`education.${index}.year`)}
                          className="h-8 text-sm transition-colors duration-150 focus:ring-2 focus:ring-[#48A4D6]/20"
                        />
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEdu(index)}
                        className="h-8 w-8 p-0 ml-auto text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Remove</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator className="bg-border/60" />

            {/* ═══════════════ EXPERIENCE ═══════════════════════════════════ */}
            <div>
              <SectionHeader
                icon={Briefcase}
                label={t('teamMembers.experience')}
                onAdd={() => appendExp({ ...emptyExperience })}
                addLabel={t('teamMembers.addExperience')}
              />

              <div className="space-y-4">
                {expFields.length === 0 && (
                  <p className="text-xs text-muted-foreground py-1">
                    {t('common.noResults')}
                  </p>
                )}

                {expFields.map((field, index) => (
                  <div
                    key={field.id}
                    className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3"
                  >
                    {/* projectName + client */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">
                          {t('teamMembers.projectName')}
                        </Label>
                        <Input
                          {...register(`experience.${index}.projectName`)}
                          placeholder={t('teamMembers.projectNamePlaceholder')}
                          className={cn(
                            'h-8 text-sm transition-colors duration-150 focus:ring-2 focus:ring-[#48A4D6]/20',
                            errors.experience?.[index]?.projectName && 'border-destructive'
                          )}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">
                          {t('teamMembers.client')}
                        </Label>
                        <Input
                          {...register(`experience.${index}.client`)}
                          placeholder={t('teamMembers.clientPlaceholder')}
                          className={cn(
                            'h-8 text-sm transition-colors duration-150 focus:ring-2 focus:ring-[#48A4D6]/20',
                            errors.experience?.[index]?.client && 'border-destructive'
                          )}
                        />
                      </div>
                    </div>

                    {/* role + category */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">
                          {t('teamMembers.role')}
                        </Label>
                        <Input
                          {...register(`experience.${index}.role`)}
                          placeholder={t('teamMembers.rolePlaceholder')}
                          className={cn(
                            'h-8 text-sm transition-colors duration-150 focus:ring-2 focus:ring-[#48A4D6]/20',
                            errors.experience?.[index]?.role && 'border-destructive'
                          )}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">
                          {t('teamMembers.category')}
                        </Label>
                        <Input
                          {...register(`experience.${index}.category`)}
                          placeholder={t('teamMembers.categoryPlaceholder')}
                          className="h-8 text-sm transition-colors duration-150 focus:ring-2 focus:ring-[#48A4D6]/20"
                        />
                      </div>
                    </div>

                    {/* budget + startYear + endYear */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">
                          {t('teamMembers.budget')}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          step={1000}
                          {...register(`experience.${index}.budget`)}
                          className="h-8 text-sm transition-colors duration-150 focus:ring-2 focus:ring-[#48A4D6]/20"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">
                          {t('teamMembers.startYear')}
                        </Label>
                        <Input
                          type="number"
                          min={1950}
                          max={2030}
                          {...register(`experience.${index}.startYear`)}
                          className={cn(
                            'h-8 text-sm transition-colors duration-150 focus:ring-2 focus:ring-[#48A4D6]/20',
                            errors.experience?.[index]?.startYear && 'border-destructive'
                          )}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">
                          {t('teamMembers.endYear')}
                        </Label>
                        <Input
                          type="number"
                          min={1950}
                          max={2030}
                          {...register(`experience.${index}.endYear`)}
                          className="h-8 text-sm transition-colors duration-150 focus:ring-2 focus:ring-[#48A4D6]/20"
                        />
                      </div>
                    </div>

                    {/* description */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">
                        {t('teamMembers.description')}
                      </Label>
                      <Textarea
                        {...register(`experience.${index}.description`)}
                        rows={2}
                        className="resize-none text-sm transition-colors duration-150 focus:ring-2 focus:ring-[#48A4D6]/20"
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeExp(index)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Remove</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator className="bg-border/60" />

            {/* ═══════════════ CERTIFICATIONS ═══════════════════════════════ */}
            <div>
              <SectionHeader
                icon={Award}
                label={t('teamMembers.certifications')}
                onAdd={() => appendCert({ ...emptyCertification })}
                addLabel={t('teamMembers.addCertification')}
              />

              <div className="space-y-4">
                {certFields.length === 0 && (
                  <p className="text-xs text-muted-foreground py-1">
                    {t('common.noResults')}
                  </p>
                )}

                {certFields.map((field, index) => (
                  <div
                    key={field.id}
                    className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3"
                  >
                    {/* name + issuer */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">
                          {t('teamMembers.certName')}
                        </Label>
                        <Input
                          {...register(`certifications.${index}.name`)}
                          placeholder={t('teamMembers.certNamePlaceholder')}
                          className={cn(
                            'h-8 text-sm transition-colors duration-150 focus:ring-2 focus:ring-[#48A4D6]/20',
                            errors.certifications?.[index]?.name && 'border-destructive'
                          )}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">
                          {t('teamMembers.certIssuer')}
                        </Label>
                        <Input
                          {...register(`certifications.${index}.issuer`)}
                          placeholder={t('teamMembers.certIssuerPlaceholder')}
                          className={cn(
                            'h-8 text-sm transition-colors duration-150 focus:ring-2 focus:ring-[#48A4D6]/20',
                            errors.certifications?.[index]?.issuer && 'border-destructive'
                          )}
                        />
                      </div>
                    </div>

                    {/* issueDate + expiryDate */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">
                          {t('teamMembers.certIssueDate')}
                        </Label>
                        <Input
                          type="date"
                          defaultValue={toDateInput(field.issueDate as Date | undefined)}
                          {...register(`certifications.${index}.issueDate`)}
                          className="h-8 text-sm transition-colors duration-150 focus:ring-2 focus:ring-[#48A4D6]/20"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">
                          {t('teamMembers.certExpiryDate')}
                        </Label>
                        <Input
                          type="date"
                          defaultValue={toDateInput(field.expiryDate as Date | undefined)}
                          {...register(`certifications.${index}.expiryDate`)}
                          className="h-8 text-sm transition-colors duration-150 focus:ring-2 focus:ring-[#48A4D6]/20"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCert(index)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Remove</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ═══════════════ PROPOSED IN (read-only, edit only) ══════════ */}
            {isEdit && memberQuery.data && (
              <>
                <Separator className="bg-border/60" />

                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                    <Briefcase className="h-4 w-4 text-[#48A4D6]" />
                    {t('teamMembers.proposedIn')}
                  </h3>

                  {memberQuery.data.assignments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t('teamMembers.noAssignments')}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {memberQuery.data.assignments.map((assignment) => (
                        <li
                          key={assignment.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-muted/10 px-3 py-2"
                        >
                          <span className="text-sm text-foreground truncate">
                            {assignment.tender.title}
                          </span>
                          <Badge
                            variant="secondary"
                            className="shrink-0 text-xs bg-[#48A4D6]/10 text-[#48A4D6] border border-[#48A4D6]/20"
                          >
                            {(assignment as { role?: string }).role ??
                              assignment.tender.status}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}

            {/* Spacer so last item clears the sticky footer */}
            <div className="h-2" />
          </form>
        </ScrollArea>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-border/60 bg-background">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            {t('common.cancel')}
          </Button>

          <Button
            type="submit"
            form="team-member-form"
            size="sm"
            disabled={isSaving || isSubmitting}
            className={cn(
              'cursor-pointer gap-1.5',
              'bg-[#48A4D6] text-white hover:bg-[#3a93c5]',
              'shadow-sm shadow-[#48A4D6]/25 border-0',
              'transition-colors duration-150',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('common.save')}
              </>
            ) : (
              t(isEdit ? 'common.update' : 'common.save')
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
