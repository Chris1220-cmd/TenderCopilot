'use client';

import { useState, useCallback } from 'react';
import { cn, fileSize, formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusBadge } from '@/components/tender/status-badge';
import {
  Upload,
  FileText,
  Download,
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
} from 'lucide-react';

interface DocumentsTabProps {
  tenderId: string;
}

const generatedDocTypes = [
  { type: 'SOLEMN_DECLARATION', label: 'Υπεύθυνη Δήλωση', icon: FileSignature },
  { type: 'NON_EXCLUSION_DECLARATION', label: 'Δήλωση Μη Αποκλεισμού', icon: ShieldCheck },
  { type: 'TECHNICAL_COMPLIANCE', label: 'Πίνακας Τεχνικής Συμμόρφωσης', icon: Table2 },
  { type: 'TECHNICAL_PROPOSAL', label: 'Τεχνική Προσφορά', icon: FileCode },
];

// Mock data for graceful fallback
const mockAttached = [
  {
    id: 'att-1',
    fileName: 'Διακήρυξη_2024-1234.pdf',
    fileKey: 'docs/diakirixi.pdf',
    fileSize: 2450000,
    mimeType: 'application/pdf',
    category: 'specification',
    createdAt: '2026-03-10',
  },
  {
    id: 'att-2',
    fileName: 'Παράρτημα_Β_Τεχνικές_Προδιαγραφές.pdf',
    fileKey: 'docs/parartima-b.pdf',
    fileSize: 1280000,
    mimeType: 'application/pdf',
    category: 'appendix',
    createdAt: '2026-03-10',
  },
  {
    id: 'att-3',
    fileName: 'Διευκρινίσεις_01.pdf',
    fileKey: 'docs/dieykriniseis.pdf',
    fileSize: 450000,
    mimeType: 'application/pdf',
    category: 'clarification',
    createdAt: '2026-03-14',
  },
];

const mockGenerated = [
  {
    id: 'gen-1',
    type: 'SOLEMN_DECLARATION',
    title: 'Υπεύθυνη Δήλωση - Ν.1599/1986',
    status: 'DRAFT',
    content: '',
    createdAt: '2026-03-12',
    updatedAt: '2026-03-12',
  },
  {
    id: 'gen-2',
    type: 'TECHNICAL_COMPLIANCE',
    title: 'Πίνακας Τεχνικής Συμμόρφωσης',
    status: 'REVIEWED',
    content: '',
    createdAt: '2026-03-13',
    updatedAt: '2026-03-15',
  },
];

export function DocumentsTab({ tenderId }: DocumentsTabProps) {
  const [isDragActive, setIsDragActive] = useState(false);

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
  });
  const deleteGenerated = trpc.document.deleteGenerated.useMutation({
    onSuccess: () => utils.document.listGenerated.invalidate({ tenderId }),
  });

  const attached = (attachedQuery.data ?? mockAttached) as any[];
  const generated = (generatedQuery.data ?? mockGenerated) as any[];

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
    // File upload would be implemented with S3 presigned URLs
    // const files = Array.from(e.dataTransfer.files);
  }, []);

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
        <Card
          className={cn(
            'border-2 border-dashed transition-all duration-200 cursor-pointer',
            isDragActive
              ? 'border-primary bg-primary/5 scale-[1.01]'
              : 'border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/30'
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <CardContent className="flex flex-col items-center justify-center py-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-3">
              <CloudUpload className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium">
              Σύρετε αρχεία εδώ ή κάντε κλικ για ανέβασμα
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              PDF, DOCX, XLSX - Μέγιστο 50MB
            </p>
          </CardContent>
        </Card>

        {/* Files List */}
        {attachedQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="flex items-center gap-4 p-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : attached.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderOpen className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Δεν υπάρχουν επισυναπτόμενα αρχεία.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {attached.map((doc) => (
              <Card
                key={doc.id}
                className={cn(
                  'group transition-all duration-200',
                  'hover:shadow-md hover:border-primary/15'
                )}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                    <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.fileName}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span>{doc.fileSize ? fileSize(doc.fileSize) : '--'}</span>
                      <span>{formatDate(doc.createdAt)}</span>
                      <span className="capitalize">{getCategoryLabel(doc.category)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 cursor-pointer"
                      title="Λήψη"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 cursor-pointer text-destructive hover:text-destructive"
                      title="Διαγραφή"
                      onClick={() => deleteAttached.mutate({ id: doc.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      {/* ── Generated Documents ───────────────────────────── */}
      <TabsContent value="generated" className="space-y-4">
        {/* Generate New */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className={cn(
                'cursor-pointer gap-2',
                'bg-gradient-to-r from-indigo-600 to-violet-600',
                'hover:from-indigo-500 hover:to-violet-500',
                'shadow-lg shadow-indigo-500/25',
                'border-0 text-white'
              )}
            >
              <Sparkles className="h-4 w-4" />
              Δημιουργία Εγγράφου
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[280px]">
            {generatedDocTypes.map((dt) => (
              <DropdownMenuItem
                key={dt.type}
                className="cursor-pointer gap-2.5 py-2.5"
              >
                <dt.icon className="h-4 w-4 text-muted-foreground" />
                <span>{dt.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Generated List */}
        {generatedQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="flex items-center gap-4 p-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : generated.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Sparkles className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Δεν υπάρχουν παραγόμενα έγγραφα.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Χρησιμοποιήστε το κουμπί πάνω για AI-powered δημιουργία εγγράφων.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {generated.map((doc) => {
              const docType = generatedDocTypes.find((d) => d.type === doc.type);
              const DocIcon = docType?.icon ?? FileText;

              return (
                <Card
                  key={doc.id}
                  className={cn(
                    'group transition-all duration-200',
                    'hover:shadow-md hover:border-primary/15'
                  )}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                      <DocIcon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{doc.title}</p>
                        <StatusBadge type="docGenStatus" value={doc.status} />
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span>{docType?.label ?? doc.type}</span>
                        <span>Ενημέρωση: {formatDate(doc.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 cursor-pointer"
                        title="Προεπισκόπηση"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 cursor-pointer"
                        title="Επεξεργασία"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 cursor-pointer"
                        title="Λήψη"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 cursor-pointer text-destructive hover:text-destructive"
                        title="Διαγραφή"
                        onClick={() => deleteGenerated.mutate({ id: doc.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
