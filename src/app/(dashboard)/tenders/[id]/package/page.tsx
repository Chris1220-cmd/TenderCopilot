'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import {
  Package,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertTriangle,
  Download,
  FileText,
  Folder,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

const steps = [
  { id: 1, title: 'Αντιστοίχιση Εγγράφων', description: 'Ανά υποφάκελο' },
  { id: 2, title: 'Έλεγχος Πληρότητας', description: 'Ελλείψεις & warnings' },
  { id: 3, title: 'Δημιουργία Πακέτου', description: 'ZIP download' },
];

const folderIcons: Record<string, string> = {
  'Φάκελος Δικαιολογητικών Συμμετοχής': 'text-blue-500',
  'Φάκελος Τεχνικής Προσφοράς': 'text-green-500',
  'Φάκελος Οικονομικής Προσφοράς': 'text-yellow-500',
  'Λοιπά Έγγραφα': 'text-gray-500',
};

export default function PackagePage() {
  const params = useParams();
  const router = useRouter();
  const tenderId = params.id as string;
  const [currentStep, setCurrentStep] = useState(1);
  const [isBuilding, setIsBuilding] = useState(false);

  const { data: tender, isLoading: tenderLoading } =
    trpc.tender.getById.useQuery({ id: tenderId });

  // For the validation step, we'd call the packaging service
  // Here we mock the validation data structure
  const [validation, setValidation] = useState<{
    valid: boolean;
    missingDocuments: string[];
    warnings: string[];
    documents: Array<{
      name: string;
      folder: string;
      source: string;
    }>;
  } | null>(null);

  useEffect(() => {
    if (tender) {
      // Simulate validation — in production this would call the API
      setValidation({
        valid: true,
        missingDocuments: [],
        warnings: ['Ορισμένα έγγραφα είναι ακόμα σε DRAFT κατάσταση'],
        documents: [
          { name: 'Φορολογική Ενημερότητα.pdf', folder: 'Φάκελος Δικαιολογητικών Συμμετοχής', source: 'company' },
          { name: 'Ασφαλιστική Ενημερότητα.pdf', folder: 'Φάκελος Δικαιολογητικών Συμμετοχής', source: 'company' },
          { name: 'ISO 9001.pdf', folder: 'Φάκελος Δικαιολογητικών Συμμετοχής', source: 'company' },
          { name: 'Υπεύθυνη Δήλωση.md', folder: 'Φάκελος Δικαιολογητικών Συμμετοχής', source: 'generated' },
          { name: 'Τεχνική Προσφορά.md', folder: 'Φάκελος Τεχνικής Προσφοράς', source: 'generated' },
          { name: 'Πίνακας Συμμόρφωσης.md', folder: 'Φάκελος Τεχνικής Προσφοράς', source: 'generated' },
        ],
      });
    }
  }, [tender]);

  // Group documents by folder
  const documentsByFolder = validation?.documents.reduce(
    (acc, doc) => {
      if (!acc[doc.folder]) acc[doc.folder] = [];
      acc[doc.folder].push(doc);
      return acc;
    },
    {} as Record<string, typeof validation.documents>
  );

  const handleBuildPackage = async () => {
    setIsBuilding(true);
    // TODO: Call API to build package and trigger download
    // const response = await fetch(`/api/tenders/${tenderId}/package`, { method: 'POST' });
    // const blob = await response.blob();
    // const url = window.URL.createObjectURL(blob);
    // const a = document.createElement('a');
    // a.href = url;
    // a.download = `${tender?.title || 'package'}.zip`;
    // a.click();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsBuilding(false);
    setCurrentStep(3);
  };

  if (tenderLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/tenders/${tenderId}`}>
          <Button variant="ghost" size="icon" className="cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Δημιουργία Πακέτου Υποβολής
          </h1>
          <p className="text-muted-foreground">
            {tender?.title} — {tender?.platform}
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center gap-2 flex-1">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 font-semibold transition-all duration-200',
                currentStep === step.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : currentStep > step.id
                    ? 'border-green-500 bg-green-500 text-white'
                    : 'border-border text-muted-foreground'
              )}
            >
              {currentStep > step.id ? (
                <Check className="h-5 w-5" />
              ) : (
                step.id
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium">{step.title}</div>
              <div className="text-xs text-muted-foreground truncate">
                {step.description}
              </div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'h-0.5 flex-1 mx-2 transition-colors duration-200',
                  currentStep > step.id ? 'bg-green-500' : 'bg-border'
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Αντιστοίχιση Εγγράφων σε Υποφακέλους</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {documentsByFolder &&
              Object.entries(documentsByFolder).map(([folder, docs]) => (
                <div key={folder}>
                  <div className="flex items-center gap-2 mb-3">
                    <Folder
                      className={cn(
                        'h-5 w-5',
                        folderIcons[folder] || 'text-gray-500'
                      )}
                    />
                    <h3 className="font-semibold">{folder}</h3>
                    <Badge variant="secondary">{docs.length} αρχεία</Badge>
                  </div>
                  <div className="space-y-2 ml-7">
                    {docs.map((doc, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                      >
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 text-sm">{doc.name}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px]',
                            doc.source === 'generated'
                              ? 'border-blue-300 text-blue-600'
                              : doc.source === 'company'
                                ? 'border-green-300 text-green-600'
                                : 'border-gray-300'
                          )}
                        >
                          {doc.source === 'generated'
                            ? 'AI Generated'
                            : doc.source === 'company'
                              ? 'Εταιρεία'
                              : 'Επισυναπτόμενο'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <Separator className="mt-4" />
                </div>
              ))}

            <div className="flex justify-end">
              <Button
                onClick={() => setCurrentStep(2)}
                className="cursor-pointer"
              >
                Συνέχεια
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Έλεγχος Πληρότητας</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Validation results */}
            {validation?.valid ? (
              <div className="flex items-center gap-3 rounded-lg bg-green-50 dark:bg-green-950/30 p-4 border border-green-200 dark:border-green-900">
                <Check className="h-5 w-5 text-green-600" />
                <div>
                  <div className="font-medium text-green-800 dark:text-green-300">
                    Όλα τα υποχρεωτικά έγγραφα είναι παρόντα
                  </div>
                  <div className="text-sm text-green-600 dark:text-green-400">
                    Το πακέτο είναι έτοιμο για δημιουργία
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-lg bg-red-50 dark:bg-red-950/30 p-4 border border-red-200 dark:border-red-900">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <div>
                    <div className="font-medium text-red-800 dark:text-red-300">
                      Λείπουν {validation?.missingDocuments.length} έγγραφα
                    </div>
                  </div>
                </div>
                {validation?.missingDocuments.map((doc, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-red-200 p-3 text-sm"
                  >
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                    <span>{doc}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Warnings */}
            {validation?.warnings && validation.warnings.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-yellow-700 dark:text-yellow-400">
                  Προειδοποιήσεις
                </h3>
                {validation.warnings.map((warn, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900 p-3 text-sm"
                  >
                    <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
                    <span>{warn}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Summary */}
            <div className="rounded-lg bg-muted/50 p-4">
              <h3 className="font-medium mb-2">Περίληψη Πακέτου</h3>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Συνολικά αρχεία:</span>
                  <span className="font-medium">
                    {validation?.documents.length || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Πλατφόρμα:</span>
                  <span className="font-medium">{tender?.platform}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="cursor-pointer"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Πίσω
              </Button>
              <Button
                onClick={handleBuildPackage}
                disabled={isBuilding}
                className="cursor-pointer"
              >
                {isBuilding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Δημιουργία...
                  </>
                ) : (
                  <>
                    <Package className="mr-2 h-4 w-4" />
                    Δημιουργία ZIP
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 3 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-6">
            <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
              <Check className="h-10 w-10 text-green-600" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold">Το πακέτο είναι έτοιμο!</h2>
              <p className="text-muted-foreground mt-2">
                Κατεβάστε το ZIP και ανεβάστε το χειροκίνητα στο{' '}
                <span className="font-medium">{tender?.platform}</span>
              </p>
            </div>
            <div className="flex gap-3">
              <Button size="lg" className="cursor-pointer">
                <Download className="mr-2 h-5 w-5" />
                Λήψη ZIP
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => router.push(`/tenders/${tenderId}`)}
                className="cursor-pointer"
              >
                Πίσω στο Διαγωνισμό
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
