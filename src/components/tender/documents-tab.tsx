'use client';

import { useState, useCallback, useRef } from 'react';
import { useTranslation } from '@/lib/i18n';
import { EspdWizard } from './espd-wizard';
import { cn, fileSize, formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/tender/status-badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Upload,
  FileText,
  Download,
  FileDown,
  Trash2,
  Eye,
  Pencil,
  Plus,
  Sparkles,
  FileSignature,
  ShieldCheck,
  Table2,
  FileCode,
  FolderOpen,
  CloudUpload,
  Brain,
  AlertTriangle,
  Mail,
  TableProperties,
} from 'lucide-react';

interface DocumentsTabProps {
  tenderId: string;
}

const generatedDocTypes = [
  { type: 'SOLEMN_DECLARATION' as const, label: 'Υπεύθυνη Δήλωση', icon: FileSignature },
  { type: 'NON_EXCLUSION_DECLARATION' as const, label: 'Δήλωση Μη Αποκλεισμού', icon: ShieldCheck },
  { type: 'TECHNICAL_COMPLIANCE' as const, label: 'Πίνακας Τεχνικής Συμμόρφωσης', icon: Table2 },
  { type: 'TECHNICAL_PROPOSAL' as const, label: 'Τεχνική Προσφορά', icon: FileCode },
  { type: 'COVER_LETTER' as const, label: 'Συνοδευτική Επιστολή', icon: Mail },
  { type: 'COMPANY_EXPERIENCE_TABLE' as const, label: 'Πίνακας Εμπειρίας', icon: TableProperties },
  { type: 'ESPD' as const, label: 'ΕΕΕΣ/ESPD', icon: FileText },
];

function ExtractionBadge({ doc }: { doc: any }) {
  const method = doc.extractionMethod;
  const confidence = doc.extractionConfidence;

  if (!method) return null;

  const config: Record<string, { label: string; icon: any; color: string }> = {
    pdf_parse: { label: 'PDF Parse', icon: FileText, color: 'text-blue-400' },
    document_ai: { label: 'Document AI', icon: Brain, color: 'text-emerald-400' },
    gemini_vision: { label: 'Gemini OCR', icon: Sparkles, color: 'text-primary' },
  };

  const c = config[method] || { label: method, icon: FileText, color: 'text-gray-400' };
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center gap-1 text-xs ${c.color}`}>
      <Icon className="h-3 w-3" />
      {c.label}
      {confidence != null && (
        <span className="text-[10px] opacity-70">
          ({(confidence * 100).toFixed(0)}%)
        </span>
      )}
    </span>
  );
}

export function DocumentsTab({ tenderId }: DocumentsTabProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isDragActive, setIsDragActive] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [espdOpen, setEspdOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  // Queries
  const attachedQuery = trpc.document.listAttached.useQuery(
    { tenderId },
    { retry: false }
  );
  const generatedQuery = trpc.document.listGenerated.useQuery(
    { tenderId },
    { retry: false }
  );

  // Mutations
  const deleteAttached = trpc.document.deleteAttached.useMutation({
    onSuccess: () => utils.document.listAttached.invalidate({ tenderId }),
    onError: (err: any) => alert(`Σφάλμα διαγραφής: ${err?.message || 'Άγνωστο σφάλμα'}`),
  });
  const deleteGenerated = trpc.document.deleteGenerated.useMutation({
    onSuccess: () => utils.document.listGenerated.invalidate({ tenderId }),
    onError: (err: any) => alert(`Σφάλμα διαγραφής: ${err?.message || 'Άγνωστο σφάλμα'}`),
  });
  const uploadMutation = trpc.document.createAttached.useMutation({
    onSuccess: () => utils.document.listAttached.invalidate({ tenderId }),
    onError: (err: any) => alert(`Σφάλμα αποθήκευσης εγγράφου: ${err?.message || 'Άγνωστο σφάλμα'}`),
  });
  const generateMutation = trpc.document.createGenerated.useMutation({
    onSuccess: () => utils.document.listGenerated.invalidate({ tenderId }),
    onError: (err: any) => alert(`Σφάλμα δημιουργίας εγγράφου: ${err?.message || 'Άγνωστο σφάλμα'}`),
  });
  const generateCoverLetterMutation = trpc.document.generateCoverLetter.useMutation({
    onSuccess: () => { utils.document.listGenerated.invalidate({ tenderId }); toast({ title: t('common.success') }); },
    onError: (err: any) => { toast({ title: t('common.error'), description: err.message, variant: 'destructive' }); },
  });
  const generateExperienceTableMutation = trpc.document.generateExperienceTable.useMutation({
    onSuccess: () => { utils.document.listGenerated.invalidate({ tenderId }); toast({ title: t('common.success') }); },
    onError: (err: any) => { toast({ title: t('common.error'), description: err.message, variant: 'destructive' }); },
  });
  const exportDocxMutation = trpc.document.exportDocx.useMutation({
    onSuccess: (data) => {
      window.open(data.downloadUrl, '_blank');
      toast({ title: t('common.success'), description: t('documentTemplates.exportReady') });
    },
    onError: (err: any) => {
      const msg = err.message?.includes('Company profile')
        ? t('documentTemplates.noCompanyProfile')
        : t('documentTemplates.exportFailed');
      toast({ title: t('common.error'), description: msg, variant: 'destructive' });
    },
  });
  const [parsingDocId, setParsingDocId] = useState<string | null>(null);

  const deepParseMutation = trpc.document.deepParse.useMutation({
    onSuccess: () => {
      utils.document.listAttached.invalidate({ tenderId });
      setParsingDocId(null);
    },
    onError: (err: any) => {
      alert(`Deep Parse απέτυχε: ${err?.message || 'Άγνωστο σφάλμα'}`);
      setParsingDocId(null);
    },
  });

  const attached = (attachedQuery.data ?? []) as any[];
  const generated = (generatedQuery.data ?? []) as any[];

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const handleFileUpload = useCallback(async (files: File[]) => {
    setUploading(true);
    for (const file of files) {
      try {
        setUploadProgress(`Ανέβασμα: ${file.name}...`);

        // Step 1: Get signed upload URL from our API
        const urlRes = await fetch('/api/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type || 'application/octet-stream',
          }),
        });
        if (!urlRes.ok) {
          const errData = await urlRes.json().catch(() => ({}));
          throw new Error(errData?.error || `Failed to get upload URL (${urlRes.status})`);
        }
        const { uploadUrl, key } = await urlRes.json();

        // Step 2: Upload file directly to Supabase (bypasses Vercel body limit)
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: file,
        });
        if (!uploadRes.ok) {
          const errText = await uploadRes.text().catch(() => '');
          throw new Error(`Direct upload failed (${uploadRes.status}): ${errText}`);
        }

        // Step 3: Create DB record via tRPC
        uploadMutation.mutate({
          tenderId,
          fileName: file.name,
          fileKey: key,
          fileSize: file.size,
          mimeType: file.type,
          category: 'specification',
        });
      } catch (err: any) {
        console.error('Upload failed:', err);
        alert(`Σφάλμα ανεβάσματος αρχείου "${file.name}": ${err?.message || 'Άγνωστο σφάλμα'}`);
      }
    }
    setUploading(false);
    setUploadProgress('');
  }, [tenderId, uploadMutation]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFileUpload(files);
  }, [handleFileUpload]);

  const getCategoryLabel = (cat: string | null) => {
    const map: Record<string, string> = {
      specification: 'Διακήρυξη',
      appendix: 'Παράρτημα',
      clarification: 'Διευκρίνιση',
    };
    return cat ? map[cat] ?? cat : '--';
  };

  return (
    <Tabs defaultValue="attached" className="space-y-4">
      <TabsList>
        <TabsTrigger value="attached" className="gap-1.5">
          <FolderOpen className="h-3.5 w-3.5" />
          Επισυναπτόμενα
        </TabsTrigger>
        <TabsTrigger value="generated" className="gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Παραγόμενα
        </TabsTrigger>
      </TabsList>

      {/* ── Attached Documents ────────────────────────────── */}
      <TabsContent value="attached" className="space-y-4">
        {/* Upload Zone */}
        <BlurFade delay={0.05} inView>
        <GlassCard
          className={cn(
            'border-2 border-dashed transition-all duration-200 cursor-pointer',
            isDragActive
              ? 'border-primary bg-primary/5 scale-[1.01]'
              : 'border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/30'
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <GlassCardContent className="flex flex-col items-center justify-center py-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-3">
              <CloudUpload className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium">
              Σύρετε αρχεία εδώ ή κάντε κλικ για ανέβασμα
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              PDF, DOCX, XLSX - Μέγιστο 50MB
            </p>
            {uploading && (
              <p className="mt-2 text-xs text-primary font-medium animate-pulse">
                {uploadProgress}
              </p>
            )}
          </GlassCardContent>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.xlsx,.xls,.zip"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) handleFileUpload(files);
              e.target.value = '';
            }}
          />
        </GlassCard>
        </BlurFade>

        {/* Files List */}
        {attachedQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <GlassCard key={i}>
                <GlassCardContent className="flex items-center gap-4 p-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </GlassCardContent>
              </GlassCard>
            ))}
          </div>
        ) : attached.length === 0 ? (
          <GlassCard>
            <GlassCardContent className="flex flex-col items-center justify-center py-12">
              <FolderOpen className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Δεν υπάρχουν έγγραφα ακόμα.
              </p>
            </GlassCardContent>
          </GlassCard>
        ) : (
          <BlurFade delay={0.1} inView>
          <div className="space-y-2">
            {attached.map((doc) => (
              <GlassCard
                key={doc.id}
                className={cn(
                  'group transition-all duration-200',
                  'hover:shadow-md hover:border-primary/15'
                )}
              >
                <GlassCardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                    <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc?.fileName ?? 'Χωρίς όνομα'}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span>{doc?.fileSize ? fileSize(doc.fileSize) : '--'}</span>
                      <span>{doc?.createdAt ? formatDate(doc.createdAt) : '--'}</span>
                      <span className="capitalize">{getCategoryLabel(doc?.category ?? null)}</span>
                      <ExtractionBadge doc={doc} />
                      {doc.parsingStatus === 'failed' && (
                        <span className="inline-flex items-center gap-1 text-xs text-red-400">
                          <AlertTriangle className="h-3 w-3" />
                          Αποτυχία
                        </span>
                      )}
                    </div>
                  </div>
                  {doc.docAiRecommended && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
                      onClick={() => {
                        setParsingDocId(doc.id);
                        deepParseMutation.mutate({ documentId: doc.id });
                      }}
                      disabled={parsingDocId === doc.id}
                    >
                      <Brain className="h-3 w-3" />
                      {parsingDocId === doc.id ? 'Ανάλυση...' : 'Deep Parse'}
                    </Button>
                  )}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 cursor-pointer"
                      title="Λήψη"
                      onClick={() => window.open(`/api/download/${encodeURIComponent(doc.fileKey)}`, '_blank')}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 cursor-pointer text-destructive hover:text-destructive"
                      title="Διαγραφή"
                      disabled={deleteAttached.isPending}
                      onClick={() => deleteAttached.mutate({ id: doc.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </GlassCardContent>
              </GlassCard>
            ))}
          </div>
          </BlurFade>
        )}
      </TabsContent>

      {/* ── Generated Documents ───────────────────────────── */}
      <TabsContent value="generated" className="space-y-4">
        {/* Generate New */}
        <div className="flex items-center gap-2">
        <Button
          onClick={() => setEspdOpen(true)}
          variant="outline"
          className="cursor-pointer gap-2"
        >
          <FileText className="h-4 w-4" />
          {t('espd.title')}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              disabled={generateMutation.isPending}
              className={cn(
                'cursor-pointer gap-2',
                'bg-primary text-primary-foreground hover:bg-primary/90',
                'shadow-lg',
                'border-0'
              )}
            >
              <Sparkles className="h-4 w-4" />
              Δημιουργία Εγγράφου
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[280px]">
            {generatedDocTypes.filter((dt) => dt.type !== 'ESPD').map((dt) => (
              <DropdownMenuItem
                key={dt.type}
                className="cursor-pointer gap-2.5 py-2.5"
                disabled={generateMutation.isPending || generateCoverLetterMutation.isPending || generateExperienceTableMutation.isPending}
                onClick={() => {
                  if (dt.type === 'COVER_LETTER') {
                    generateCoverLetterMutation.mutate({ tenderId });
                  } else if (dt.type === 'COMPANY_EXPERIENCE_TABLE') {
                    generateExperienceTableMutation.mutate({ tenderId });
                  } else {
                    generateMutation.mutate({
                      tenderId,
                      type: dt.type,
                      title: dt.label,
                      content: '',
                      status: 'DRAFT',
                    });
                  }
                }}
              >
                <dt.icon className="h-4 w-4 text-muted-foreground" />
                <span>{dt.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        </div>

        {/* Generated List */}
        {generatedQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <GlassCard key={i}>
                <GlassCardContent className="flex items-center gap-4 p-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </GlassCardContent>
              </GlassCard>
            ))}
          </div>
        ) : generated.length === 0 ? (
          <GlassCard>
            <GlassCardContent className="flex flex-col items-center justify-center py-12">
              <Sparkles className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Δεν υπάρχουν έγγραφα ακόμα.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Χρησιμοποιήστε το κουμπί πάνω για AI-powered δημιουργία εγγράφων.
              </p>
            </GlassCardContent>
          </GlassCard>
        ) : (
          <BlurFade delay={0.05} inView>
          <div className="space-y-2">
            {generated.map((doc) => {
              const docType = generatedDocTypes.find((d) => d.type === doc.type);
              const DocIcon = docType?.icon ?? FileText;

              return (
                <GlassCard
                  key={doc.id}
                  className={cn(
                    'group transition-all duration-200',
                    'hover:shadow-md hover:border-primary/15'
                  )}
                >
                  <GlassCardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <DocIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{doc?.title ?? 'Χωρίς τίτλο'}</p>
                        <StatusBadge type="docGenStatus" value={doc?.status} />
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span>{docType?.label ?? doc?.type ?? '--'}</span>
                        <span>Ενημέρωση: {doc?.updatedAt ? formatDate(doc.updatedAt) : '--'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {doc.type !== 'ESPD' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 cursor-pointer"
                          title={t('documentTemplates.exportDocx')}
                          onClick={() => exportDocxMutation.mutate({ generatedDocId: doc.id })}
                          disabled={exportDocxMutation.isPending}
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 cursor-pointer"
                        title="Προεπισκόπηση"
                        onClick={() => {
                          setPreviewDoc(doc);
                          setPreviewOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 cursor-pointer"
                        title="Επεξεργασία"
                        onClick={() => {
                          setPreviewDoc(doc);
                          setPreviewOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 cursor-pointer"
                        title="Λήψη"
                        onClick={() => {
                          const blob = new Blob([doc.content || ''], { type: 'text/plain;charset=utf-8' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${doc.title || 'document'}.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 cursor-pointer text-destructive hover:text-destructive"
                        title="Διαγραφή"
                        disabled={deleteGenerated.isPending}
                        onClick={() => deleteGenerated.mutate({ id: doc.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </GlassCardContent>
                </GlassCard>
              );
            })}
          </div>
          </BlurFade>
        )}
      </TabsContent>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewDoc?.title || 'Προεπισκόπηση'}</DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
            {previewDoc?.content || 'Δεν υπάρχει περιεχόμενο.'}
          </div>
        </DialogContent>
      </Dialog>

      <EspdWizard
        tenderId={tenderId}
        open={espdOpen}
        onOpenChange={setEspdOpen}
      />
    </Tabs>
  );
}
