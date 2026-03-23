'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { cn, formatCurrency, fileSize } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { DiscoveryResults } from '@/components/tender/discovery-results';
import {
  Sparkles,
  Radar,
  Link as LinkIcon,
  Upload,
  ClipboardPaste,
  FileText,
  X,
  Loader2,
  Check,
  ArrowLeft,
  Globe,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

// ─── Types ──────────────────────────────────────────────────────────────────

type IntakeMode = 'discover' | 'link' | 'upload' | null;

interface ProgressStep {
  label: string;
  status: 'pending' | 'active' | 'done';
}

// ─── Platform detection for URL import ──────────────────────────────────────

const platformPatterns: { pattern: RegExp; label: string; key: string; color: string }[] = [
  { pattern: /promitheas\.gov\.gr/i, label: 'ΠΡΟΜΗΘΕΥΣ', key: 'PROMITHEUS', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' },
  { pattern: /esidis|isupplies\.gr/i, label: 'ΕΣΗΔΗΣ', key: 'ESIDIS', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20' },
  { pattern: /cosmo-one\.gr|cosmoone/i, label: 'cosmoONE', key: 'COSMOONE', color: 'bg-primary/15 text-primary border-primary/20' },
  { pattern: /diavgeia\.gov\.gr/i, label: 'ΔΙΑΥΓΕΙΑ', key: 'DIAVGEIA', color: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20' },
  { pattern: /ted\.europa\.eu/i, label: 'TED Europa', key: 'TED', color: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/20' },
];

function detectPlatform(url: string) {
  for (const p of platformPatterns) {
    if (p.pattern.test(url)) return p;
  }
  return null;
}

// ─── Mode card definitions ──────────────────────────────────────────────────

const modes: { id: IntakeMode; icon: typeof Radar; title: string; subtitle: string }[] = [
  {
    id: 'discover',
    icon: Radar,
    title: 'Αυτόματη Εύρεση',
    subtitle: 'Βρείτε διαγωνισμούς που ταιριάζουν στην εταιρεία σας',
  },
  {
    id: 'link',
    icon: LinkIcon,
    title: 'Εισαγωγή από Link',
    subtitle: 'Επικολλήστε σύνδεσμο από ΕΣΗΔΗΣ, cosmoONE, κ.λπ.',
  },
  {
    id: 'upload',
    icon: Upload,
    title: 'Μεταφόρτωση Αρχείων',
    subtitle: 'Σύρετε αρχεία διακήρυξης (PDF, DOCX, ZIP)',
  },
];

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function NewTenderPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [activeMode, setActiveMode] = useState<IntakeMode>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // URL import state
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlImporting, setUrlImporting] = useState(false);
  const [urlSteps, setUrlSteps] = useState<ProgressStep[]>([]);

  // File upload state
  const [files, setFiles] = useState<File[]>([]);
  const [fileImporting, setFileImporting] = useState(false);
  const [fileSteps, setFileSteps] = useState<ProgressStep[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  const detectedPlatform = url.trim() ? detectPlatform(url) : null;

  // tRPC mutations
  const importFromUrl = trpc.discovery.importFromUrl.useMutation();
  const importFromFiles = trpc.discovery.importFromFiles.useMutation();
  const createTender = trpc.tender.create.useMutation();

  // Scroll to content when mode changes
  useEffect(() => {
    if (activeMode && contentRef.current) {
      setTimeout(() => {
        contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    }
  }, [activeMode]);

  // ─── URL Import Logic ─────────────────────────────────────────────────────

  async function handleUrlImport() {
    if (!url.trim()) {
      setUrlError('Εισαγάγετε ένα σύνδεσμο');
      return;
    }
    try {
      new URL(url);
    } catch {
      setUrlError('Μη έγκυρος σύνδεσμος');
      return;
    }

    setUrlError(null);
    setUrlImporting(true);
    const steps: ProgressStep[] = [
      { label: 'Λήψη σελίδας...', status: 'active' },
      { label: 'Εξαγωγή στοιχείων...', status: 'pending' },
      { label: 'Λήψη εγγράφων...', status: 'pending' },
      { label: 'Ανάλυση...', status: 'pending' },
    ];
    setUrlSteps([...steps]);

    // Simulate step progression
    for (let i = 0; i < steps.length; i++) {
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));
      steps[i].status = 'done';
      if (i + 1 < steps.length) steps[i + 1].status = 'active';
      setUrlSteps([...steps]);
    }

    try {
      const result = await importFromUrl.mutateAsync({ url });
      toast({ title: 'Επιτυχής εισαγωγή', description: 'Ο διαγωνισμός δημιουργήθηκε.' });
      router.push(`/tenders/${result.tenderId}`);
    } catch (err: any) {
      setUrlImporting(false);
      setUrlError(err.message || 'Αποτυχία εισαγωγής');
      setUrlSteps([]);
    }
  }

  // ─── File Upload Logic ────────────────────────────────────────────────────

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles]);
    setFileError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/zip': ['.zip'],
    },
  });

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleFileImport() {
    if (files.length === 0) {
      setFileError('Προσθέστε τουλάχιστον ένα αρχείο');
      return;
    }

    setFileError(null);
    setFileImporting(true);
    const steps: ProgressStep[] = [
      { label: 'Μεταφόρτωση αρχείων...', status: 'active' },
      { label: 'Εξαγωγή κειμένου...', status: 'pending' },
      { label: 'Ανάλυση απαιτήσεων...', status: 'pending' },
      { label: 'Δημιουργία φακέλου...', status: 'pending' },
    ];
    setFileSteps([...steps]);

    try {
      // Upload files ONE BY ONE
      const uploadedFiles: Array<{ key: string; name: string; mimeType: string }> = [];
      const VERCEL_LIMIT = 4 * 1024 * 1024; // 4MB

      for (const file of files) {
        if (file.size > VERCEL_LIMIT) {
          // Large files: get signed URL from server, then upload directly to Supabase
          const urlRes = await fetch('/api/upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: file.name, contentType: file.type }),
          });

          if (!urlRes.ok) throw new Error(`Αποτυχία δημιουργίας URL: ${file.name}`);
          const { uploadUrl, key } = await urlRes.json();

          const directRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': file.type || 'application/octet-stream',
            },
            body: file,
          });

          if (!directRes.ok) {
            throw new Error(`Αποτυχία μεταφόρτωσης: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
          }
          uploadedFiles.push({ key, name: file.name, mimeType: file.type });
        } else {
          // Small files: via API route
          const formData = new FormData();
          formData.append('files', file);

          const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          if (!uploadRes.ok) {
            console.error(`Upload failed for ${file.name}: HTTP ${uploadRes.status}`);
            throw new Error(`Αποτυχία μεταφόρτωσης: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
          }

          const uploadData = await uploadRes.json();
          for (const f of uploadData.files || []) {
            uploadedFiles.push({ key: f.fileKey, name: f.fileName, mimeType: f.mimeType });
          }
        }
      }

      steps[0].status = 'done';
      steps[1].status = 'active';
      setFileSteps([...steps]);

      // Step through remaining progress
      for (let i = 1; i < steps.length; i++) {
        await new Promise((r) => setTimeout(r, 500));
        steps[i].status = 'done';
        if (i + 1 < steps.length) steps[i + 1].status = 'active';
        setFileSteps([...steps]);
      }

      const result = await importFromFiles.mutateAsync({
        files: uploadedFiles,
      });
      toast({ title: 'Επιτυχής εισαγωγή', description: 'Ο διαγωνισμός δημιουργήθηκε.' });
      router.push(`/tenders/${result.tenderId}`);
    } catch (err: any) {
      setFileImporting(false);
      setFileError(err.message || 'Αποτυχία επεξεργασίας αρχείων');
      setFileSteps([]);
    }
  }

  // ─── Discovery import handler ─────────────────────────────────────────────

  const fetchDocsMutation = trpc.discovery.fetchDocumentsFromSource.useMutation();

  async function handleDiscoveryImport(tender: any) {
    try {
      const result = await createTender.mutateAsync({
        title: tender.title,
        referenceNumber: tender.referenceNumber || null,
        contractingAuthority: tender.contractingAuthority || null,
        platform: tender.platform || 'OTHER',
        cpvCodes: tender.cpvCodes || [],
        budget: tender.budget || null,
        submissionDeadline: tender.submissionDeadline || null,
        notes: tender.summary || null,
      });

      // After creating the tender, fetch documents from the source URL (await before redirect)
      if (tender.sourceUrl) {
        await fetchDocsMutation.mutateAsync({
          tenderId: result.id,
          sourceUrl: tender.sourceUrl,
          platform: tender.platform || 'OTHER',
        });
      }

      toast({ title: 'Επιτυχής εισαγωγή', description: 'Ο διαγωνισμός δημιουργήθηκε.' });
      router.push(`/tenders/${result.id}`);
    } catch (err: any) {
      console.error('Import failed:', err);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
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
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 shadow-md shadow-blue-500/25">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Νέος Διαγωνισμός
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground ml-[46px]">
            Επιλέξτε πώς θέλετε να προσθέσετε τον διαγωνισμό
          </p>
        </div>
      </div>

      {/* Mode selector cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isActive = activeMode === mode.id;

          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => setActiveMode(isActive ? null : mode.id)}
              className={cn(
                'group relative flex flex-col items-center text-center rounded-2xl border p-6 cursor-pointer',
                'bg-white/60 dark:bg-white/[0.06] backdrop-blur-xl',
                'transition-all duration-300 ease-out',
                'hover:shadow-lg hover:scale-[1.01]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
                isActive
                  ? 'border-blue-500/50 shadow-xl shadow-blue-500/10 scale-[1.02] bg-white/80 dark:bg-white/[0.1]'
                  : 'border-white/30 dark:border-white/10 hover:border-blue-500/20'
              )}
            >
              {/* Glow effect when active */}
              {isActive && (
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/5 via-transparent to-blue-500/5 pointer-events-none" />
              )}

              <div
                className={cn(
                  'relative flex h-14 w-14 items-center justify-center rounded-xl transition-all duration-300',
                  isActive
                    ? 'bg-gradient-to-br from-blue-600 to-blue-500 shadow-lg shadow-blue-500/25'
                    : 'bg-blue-500/10 group-hover:bg-blue-500/15'
                )}
              >
                <Icon
                  className={cn(
                    'h-6 w-6 transition-colors duration-300',
                    isActive ? 'text-white' : 'text-blue-600 dark:text-blue-400'
                  )}
                />
              </div>

              <h3
                className={cn(
                  'mt-4 text-sm font-semibold transition-colors duration-200',
                  isActive ? 'text-blue-700 dark:text-blue-300' : 'text-foreground'
                )}
              >
                {mode.title}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {mode.subtitle}
              </p>

              {/* Active indicator dot */}
              {isActive && (
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-1 w-8 rounded-full bg-gradient-to-r from-blue-600 to-blue-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Active mode content */}
      {activeMode && (
        <div
          ref={contentRef}
          className={cn(
            'rounded-2xl border p-6',
            'bg-white/60 dark:bg-white/[0.06] backdrop-blur-xl',
            'border-white/30 dark:border-white/10',
            'shadow-lg',
            'animate-in fade-in slide-in-from-bottom-4 duration-300'
          )}
        >
          {/* ─── Discover Mode ───────────────────────────────────────────── */}
          {activeMode === 'discover' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Radar className="h-5 w-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-foreground">
                  Προτεινόμενοι Διαγωνισμοί
                </h2>
              </div>
              <p className="text-sm text-muted-foreground -mt-2">
                Βασισμένοι στο προφίλ και τους κωδικούς CPV/ΚΑΔ της εταιρείας σας.
              </p>
              <Separator className="opacity-50" />
              <DiscoveryResults onImport={handleDiscoveryImport} />
            </div>
          )}

          {/* ─── Link Import Mode ────────────────────────────────────────── */}
          {activeMode === 'link' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="h-5 w-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-foreground">
                  Εισαγωγή από Σύνδεσμο
                </h2>
              </div>
              <p className="text-sm text-muted-foreground -mt-3">
                Υποστηριζόμενες πλατφόρμες: ΕΣΗΔΗΣ, ΠΡΟΜΗΘΕΥΣ, cosmoONE, ΔΙΑΥΓΕΙΑ, TED Europa
              </p>

              <Separator className="opacity-50" />

              {/* URL input */}
              <div className="space-y-3">
                <div className="relative">
                  <ClipboardPaste className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="https://promitheas.gov.gr/..."
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setUrlError(null);
                    }}
                    disabled={urlImporting}
                    className={cn(
                      'pl-10 pr-4 h-11',
                      'bg-white/50 dark:bg-white/[0.04] backdrop-blur-sm',
                      'border-white/30 dark:border-white/10',
                      urlError && 'border-red-500/50 focus-visible:ring-red-500'
                    )}
                  />
                </div>

                {/* Platform badge */}
                {detectedPlatform && !urlImporting && (
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(
                        'text-[11px] font-semibold border animate-in fade-in zoom-in-95 duration-200',
                        detectedPlatform.color
                      )}
                    >
                      {detectedPlatform.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Αναγνωρίστηκε πλατφόρμα
                    </span>
                  </div>
                )}

                {/* Error */}
                {urlError && (
                  <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {urlError}
                  </div>
                )}

                {/* Progress steps */}
                {urlImporting && urlSteps.length > 0 && (
                  <div className="space-y-2.5 rounded-xl bg-muted/30 backdrop-blur-sm p-4 border border-white/10">
                    {urlSteps.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        {step.status === 'done' && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
                            <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                          </div>
                        )}
                        {step.status === 'active' && (
                          <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                        )}
                        {step.status === 'pending' && (
                          <div className="h-5 w-5 rounded-full border border-muted-foreground/20" />
                        )}
                        <span
                          className={cn(
                            'text-sm transition-colors',
                            step.status === 'done' && 'text-muted-foreground line-through',
                            step.status === 'active' && 'text-foreground font-medium',
                            step.status === 'pending' && 'text-muted-foreground/60'
                          )}
                        >
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Submit */}
                {!urlImporting && (
                  <Button
                    onClick={handleUrlImport}
                    disabled={!url.trim()}
                    className={cn(
                      'w-full h-11 cursor-pointer',
                      'bg-gradient-to-r from-blue-700 to-blue-500',
                      'hover:from-blue-600 hover:to-blue-400',
                      'shadow-lg shadow-blue-500/20',
                      'border-0 text-white font-medium',
                      'disabled:opacity-40 disabled:cursor-not-allowed'
                    )}
                  >
                    <ArrowRight className="h-4 w-4" />
                    Εισαγωγή & Ανάλυση
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ─── File Upload Mode ────────────────────────────────────────── */}
          {activeMode === 'upload' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <Upload className="h-5 w-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-foreground">
                  Μεταφόρτωση Αρχείων
                </h2>
              </div>
              <p className="text-sm text-muted-foreground -mt-3">
                Ανεβάστε αρχεία διακήρυξης για AI ανάλυση και αυτόματη εξαγωγή στοιχείων.
              </p>

              <Separator className="opacity-50" />

              {!fileImporting && (
                <>
                  {/* Dropzone */}
                  <div
                    {...getRootProps()}
                    className={cn(
                      'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-all duration-200 cursor-pointer',
                      isDragActive
                        ? 'border-blue-500 bg-blue-500/5 shadow-inner'
                        : 'border-muted-foreground/20 hover:border-blue-500/40 hover:bg-blue-500/[0.02]'
                    )}
                  >
                    <input {...getInputProps()} />
                    <div
                      className={cn(
                        'flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-200',
                        isDragActive
                          ? 'bg-blue-500/15 text-blue-600 scale-110'
                          : 'bg-muted/60 text-muted-foreground'
                      )}
                    >
                      <Upload className="h-7 w-7" />
                    </div>
                    <p className="mt-4 text-sm font-medium text-foreground">
                      {isDragActive
                        ? 'Αφήστε τα αρχεία εδώ...'
                        : 'Σύρετε αρχεία ή κάντε κλικ για επιλογή'}
                    </p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      PDF, DOC, DOCX, XLS, XLSX, ZIP
                    </p>
                  </div>

                  {/* File list */}
                  {files.length > 0 && (
                    <div className="space-y-2">
                      {files.map((file, idx) => (
                        <div
                          key={`${file.name}-${idx}`}
                          className={cn(
                            'flex items-center justify-between rounded-xl border p-3',
                            'bg-white/40 dark:bg-white/[0.04] backdrop-blur-sm',
                            'border-white/30 dark:border-white/10'
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                              <FileText className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {file.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {fileSize(file.size)}
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFile(idx)}
                            className="h-8 w-8 shrink-0 cursor-pointer text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Error */}
              {fileError && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {fileError}
                </div>
              )}

              {/* Progress steps */}
              {fileImporting && fileSteps.length > 0 && (
                <div className="space-y-2.5 rounded-xl bg-muted/30 backdrop-blur-sm p-4 border border-white/10">
                  {fileSteps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      {step.status === 'done' && (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
                          <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        </div>
                      )}
                      {step.status === 'active' && (
                        <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                      )}
                      {step.status === 'pending' && (
                        <div className="h-5 w-5 rounded-full border border-muted-foreground/20" />
                      )}
                      <span
                        className={cn(
                          'text-sm transition-colors',
                          step.status === 'done' && 'text-muted-foreground line-through',
                          step.status === 'active' && 'text-foreground font-medium',
                          step.status === 'pending' && 'text-muted-foreground/60'
                        )}
                      >
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Submit */}
              {!fileImporting && (
                <Button
                  onClick={handleFileImport}
                  disabled={files.length === 0}
                  className={cn(
                    'w-full h-11 cursor-pointer',
                    'bg-gradient-to-r from-blue-700 to-blue-500',
                    'hover:from-blue-600 hover:to-blue-400',
                    'shadow-lg shadow-blue-500/20',
                    'border-0 text-white font-medium',
                    'disabled:opacity-40 disabled:cursor-not-allowed'
                  )}
                >
                  <Sparkles className="h-4 w-4" />
                  Ανάλυση & Δημιουργία
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
