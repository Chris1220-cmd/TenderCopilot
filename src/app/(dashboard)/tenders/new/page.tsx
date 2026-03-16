'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  FileText,
  X,
  Loader2,
  Check,
  ClipboardList,
  FileUp,
} from 'lucide-react';
import Link from 'next/link';

const tenderSchema = z.object({
  title: z.string().min(1, 'Ο τίτλος είναι υποχρεωτικός'),
  referenceNumber: z.string().min(1, 'Ο αριθμός αναφοράς είναι υποχρεωτικός'),
  contractingAuthority: z
    .string()
    .min(1, 'Η αναθέτουσα αρχή είναι υποχρεωτική'),
  platform: z.string().min(1, 'Η πλατφόρμα είναι υποχρεωτική'),
  budget: z.string().optional(),
  submissionDeadline: z
    .string()
    .min(1, 'Η ημερομηνία υποβολής είναι υποχρεωτική'),
  awardCriteria: z.string().optional(),
});

type TenderForm = z.infer<typeof tenderSchema>;

const steps = [
  { id: 1, title: 'Βασικά στοιχεία', icon: ClipboardList },
  { id: 2, title: 'Αρχεία προδιαγραφών', icon: FileUp },
];

export default function NewTenderPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [files, setFiles] = useState<File[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useForm<TenderForm>({
    resolver: zodResolver(tenderSchema),
    defaultValues: {
      platform: '',
      awardCriteria: '',
    },
  });

  const platformValue = watch('platform');
  const awardCriteriaValue = watch('awardCriteria');

  const createMutation = trpc.tender.create.useMutation({
    onSuccess: (data: { id: string }) => {
      router.push(`/tenders/${data.id}`);
    },
    onError: (err) => {
      setSubmitError(err.message || 'Αποτυχία δημιουργίας διαγωνισμού');
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
        '.xlsx',
      ],
    },
  });

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function goToNextStep() {
    const valid = await trigger([
      'title',
      'referenceNumber',
      'contractingAuthority',
      'platform',
      'submissionDeadline',
    ]);
    if (valid) {
      setCurrentStep(2);
    }
  }

  function onSubmit(data: TenderForm) {
    setSubmitError(null);
    createMutation.mutate({
      ...data,
      budget: data.budget ? parseFloat(data.budget) : undefined,
      submissionDeadline: data.submissionDeadline ? new Date(data.submissionDeadline) : undefined,
    } as any);
  }

  const isLoading = createMutation.isPending;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="cursor-pointer"
        >
          <Link href="/tenders">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Νέος Διαγωνισμός
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Δημιουργήστε νέο φάκελο διαγωνισμού σε 2 βήματα
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {steps.map((step, idx) => {
          const StepIcon = step.icon;
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;

          return (
            <div key={step.id} className="flex items-center gap-2">
              {idx > 0 && (
                <div
                  className={cn(
                    'h-px w-12 transition-colors duration-300',
                    isCompleted ? 'bg-primary' : 'bg-border'
                  )}
                />
              )}
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all duration-300',
                    isActive &&
                      'bg-primary text-primary-foreground shadow-md shadow-primary/25',
                    isCompleted && 'bg-primary/10 text-primary',
                    !isActive && !isCompleted && 'bg-muted text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <StepIcon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={cn(
                    'text-sm font-medium transition-colors duration-200',
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {step.title}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error */}
      {submitError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Βασικά στοιχεία διαγωνισμού</CardTitle>
              <CardDescription>
                Συμπληρώστε τις βασικές πληροφορίες του διαγωνισμού
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">
                  Τίτλος <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="π.χ. Προμήθεια Εξοπλισμού Πληροφορικής"
                  className={cn(errors.title && 'border-red-500/50')}
                  {...register('title')}
                />
                {errors.title && (
                  <p className="text-xs text-red-500">{errors.title.message}</p>
                )}
              </div>

              {/* Reference Number */}
              <div className="space-y-2">
                <Label htmlFor="referenceNumber">
                  Αριθμός Αναφοράς <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="referenceNumber"
                  placeholder="π.χ. ΕΣΗΔΗΣ-2024-1234"
                  className={cn(
                    errors.referenceNumber && 'border-red-500/50'
                  )}
                  {...register('referenceNumber')}
                />
                {errors.referenceNumber && (
                  <p className="text-xs text-red-500">
                    {errors.referenceNumber.message}
                  </p>
                )}
              </div>

              {/* Contracting Authority */}
              <div className="space-y-2">
                <Label htmlFor="contractingAuthority">
                  Αναθέτουσα Αρχή <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="contractingAuthority"
                  placeholder="π.χ. Δήμος Αθηναίων"
                  className={cn(
                    errors.contractingAuthority && 'border-red-500/50'
                  )}
                  {...register('contractingAuthority')}
                />
                {errors.contractingAuthority && (
                  <p className="text-xs text-red-500">
                    {errors.contractingAuthority.message}
                  </p>
                )}
              </div>

              {/* Platform & Budget Row */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>
                    Πλατφόρμα <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={platformValue}
                    onValueChange={(val) => setValue('platform', val, { shouldValidate: true })}
                  >
                    <SelectTrigger
                      className={cn(
                        errors.platform && 'border-red-500/50'
                      )}
                    >
                      <SelectValue placeholder="Επιλέξτε..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ESIDIS">ΕΣΗΔΗΣ</SelectItem>
                      <SelectItem value="KIMDIS">ΚΗΜΔΗΣ</SelectItem>
                      <SelectItem value="PROMITHEUS">ΠΡΟΜΗΘΕΥΣ</SelectItem>
                      <SelectItem value="OTHER">Άλλο</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.platform && (
                    <p className="text-xs text-red-500">
                      {errors.platform.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budget">Προϋπολογισμός</Label>
                  <Input
                    id="budget"
                    type="number"
                    step="0.01"
                    placeholder="π.χ. 250000"
                    {...register('budget')}
                  />
                </div>
              </div>

              {/* Deadline & Award Criteria Row */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="submissionDeadline">
                    Ημ/νία Υποβολής <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="submissionDeadline"
                    type="date"
                    className={cn(
                      errors.submissionDeadline && 'border-red-500/50'
                    )}
                    {...register('submissionDeadline')}
                  />
                  {errors.submissionDeadline && (
                    <p className="text-xs text-red-500">
                      {errors.submissionDeadline.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Κριτήρια Ανάθεσης</Label>
                  <Select
                    value={awardCriteriaValue}
                    onValueChange={(val) => setValue('awardCriteria', val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Επιλέξτε..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOWEST_PRICE">
                        Χαμηλότερη τιμή
                      </SelectItem>
                      <SelectItem value="BEST_VALUE">
                        Βέλτιστη σχέση ποιότητας-τιμής
                      </SelectItem>
                      <SelectItem value="TECHNICAL_QUALITY">
                        Τεχνική ποιότητα
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Next Button */}
              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={goToNextStep}
                  className={cn(
                    'cursor-pointer',
                    'bg-gradient-to-r from-indigo-600 to-violet-600',
                    'hover:from-indigo-500 hover:to-violet-500',
                    'border-0 text-white'
                  )}
                >
                  Επόμενο
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: File Upload */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Αρχεία προδιαγραφών</CardTitle>
              <CardDescription>
                Ανεβάστε τα αρχεία της διακήρυξης για AI ανάλυση απαιτήσεων
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Dropzone */}
              <div
                {...getRootProps()}
                className={cn(
                  'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-all duration-200 cursor-pointer',
                  isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/20 hover:border-primary/40 hover:bg-accent/30'
                )}
              >
                <input {...getInputProps()} />
                <div
                  className={cn(
                    'flex h-14 w-14 items-center justify-center rounded-xl transition-colors duration-200',
                    isDragActive
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Upload className="h-7 w-7" />
                </div>
                <p className="mt-4 text-sm font-medium">
                  {isDragActive
                    ? 'Αφήστε τα αρχεία εδώ...'
                    : 'Σύρτε αρχεία ή κάντε κλικ για επιλογή'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PDF, DOC, DOCX, XLS, XLSX
                </p>
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between rounded-lg border bg-card p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(idx)}
                        className="h-8 w-8 shrink-0 cursor-pointer text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Πίσω
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className={cn(
                    'cursor-pointer',
                    'bg-gradient-to-r from-indigo-600 to-violet-600',
                    'hover:from-indigo-500 hover:to-violet-500',
                    'shadow-lg shadow-indigo-500/25',
                    'border-0 text-white'
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Δημιουργία
                      <Check className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  );
}
