'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  BookOpen, ShieldCheck, FileText, Banknote, Send,
  ArrowRight, ArrowLeft, X, CheckCircle2, AlertTriangle,
  XCircle, Loader2, BarChart3,
} from 'lucide-react';

interface BidWizardProps {
  tenderId: string;
  onExit: () => void;
}

const STEPS = [
  { key: 'understand', label: 'Κατανόηση', icon: BookOpen },
  { key: 'eligibility', label: 'Επιλεξιμότητα', icon: ShieldCheck },
  { key: 'documents', label: 'Έγγραφα', icon: FileText },
  { key: 'pricing', label: 'Τιμολόγηση', icon: Banknote },
  { key: 'submit', label: 'Αποστολή', icon: Send },
] as const;

export function BidWizard({ tenderId, onExit }: BidWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);

  // Fetch tender data
  const { data: tender, isLoading: tenderLoading } = trpc.tender.getById.useQuery({ id: tenderId });

  // Fetch requirements for eligibility step
  const { data: requirements } = trpc.requirement.listByTender.useQuery(
    { tenderId },
    { enabled: currentStep >= 1 }
  );

  // Fetch attached documents for documents step
  const { data: documents } = trpc.document.listAttached.useQuery(
    { tenderId },
    { enabled: currentStep >= 2 }
  );

  // Fetch pricing advice for pricing step
  const { data: pricingData } = trpc.pricingIntelligence.pricingAdvice.useQuery(
    { tenderId, language: 'el' },
    { enabled: currentStep >= 3, staleTime: 5 * 60 * 1000 }
  );

  if (tenderLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canGoNext = currentStep < STEPS.length - 1;
  const canGoBack = currentStep > 0;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header with progress */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-lg font-semibold">Οδηγός Προσφοράς</h2>
          <p className="text-sm text-muted-foreground">Βήμα {currentStep + 1} από {STEPS.length}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onExit} type="button">
          <X className="h-4 w-4 mr-1" /> Έξοδος
        </Button>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = i === currentStep;
          const isDone = i < currentStep;
          return (
            <div key={step.key} className="flex items-center flex-1">
              <button
                type="button"
                onClick={() => i <= currentStep && setCurrentStep(i)}
                disabled={i > currentStep}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors w-full',
                  isActive && 'bg-primary text-primary-foreground',
                  isDone && 'bg-primary/10 text-primary cursor-pointer',
                  !isActive && !isDone && 'bg-muted/30 text-muted-foreground',
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <Icon className="h-4 w-4 shrink-0" />
                )}
                <span className="hidden sm:inline truncate">{step.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={cn('h-px w-2 shrink-0', i < currentStep ? 'bg-primary' : 'bg-border')} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="rounded-xl border border-border/60 bg-card p-8 min-h-[400px]">
        {/* Step 1: Understand */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">Κατανόηση του Διαγωνισμού</h3>
              <p className="text-sm text-muted-foreground">Διάβασε τα βασικά στοιχεία πριν ξεκινήσεις.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground mb-1">Τίτλος</p>
                <p className="font-medium text-sm">{tender?.title || '—'}</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground mb-1">Αναθέτουσα Αρχή</p>
                <p className="font-medium text-sm">{tender?.contractingAuthority || '—'}</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground mb-1">Προϋπολογισμός</p>
                <p className="font-medium text-sm">{tender?.budget ? `€${tender.budget.toLocaleString()}` : 'Δεν αναφέρεται'}</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground mb-1">Προθεσμία</p>
                <p className="font-medium text-sm">
                  {tender?.submissionDeadline ? new Date(tender.submissionDeadline).toLocaleDateString('el') : 'Δεν αναφέρεται'}
                </p>
              </div>
            </div>
            {tender?.cpvCodes && tender.cpvCodes.length > 0 && (
              <div className="rounded-lg bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground mb-1">CPV Κωδικοί</p>
                <div className="flex flex-wrap gap-1.5">
                  {tender.cpvCodes.map((cpv: string) => (
                    <span key={cpv} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md">{cpv}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Eligibility */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">Έλεγχος Επιλεξιμότητας</h3>
              <p className="text-sm text-muted-foreground">Πληρείς τις προϋποθέσεις συμμετοχής;</p>
            </div>
            {!requirements?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Δεν έχουν εξαχθεί απαιτήσεις ακόμα.</p>
                <p className="text-xs mt-1">Πάτησε "Ανάλυση" στην επισκόπηση πρώτα.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {requirements.map((req: any) => (
                  <div key={req.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20">
                    {req.coverageStatus === 'COVERED' ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    ) : req.coverageStatus === 'GAP' ? (
                      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="text-sm">{req.text}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {req.coverageStatus === 'COVERED' ? 'Καλύπτεται' :
                         req.coverageStatus === 'GAP' ? 'Λείπει — χρειάζεται ενέργεια' :
                         'Δεν έχει ελεγχθεί'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Documents */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">Απαιτούμενα Έγγραφα</h3>
              <p className="text-sm text-muted-foreground">Ετοίμασε τα έγγραφα που χρειάζονται.</p>
            </div>
            {!documents?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Δεν έχουν ανέβει έγγραφα ακόμα.</p>
                <p className="text-xs mt-1">Μπορείς να ανεβάσεις αρχεία από το tab "Έγγραφα".</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20">
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.fileName || doc.title}</p>
                      <p className="text-xs text-muted-foreground">{doc.category || 'Έγγραφο'}</p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Pricing */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">Τιμολόγηση Προσφοράς</h3>
              <p className="text-sm text-muted-foreground">Βάσει ιστορικών δεδομένων, πρόταση τιμής.</p>
            </div>
            {pricingData?.stats?.recommendedRange ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-4 rounded-xl bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">Χαμηλή</p>
                    <p className="text-lg font-bold">€{pricingData.stats.recommendedRange.low.toLocaleString()}</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-primary/10 border border-primary/20">
                    <p className="text-xs text-primary mb-1">Προτεινόμενη</p>
                    <p className="text-lg font-bold text-primary">€{pricingData.stats.recommendedRange.mid.toLocaleString()}</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">Υψηλή</p>
                    <p className="text-lg font-bold">€{pricingData.stats.recommendedRange.high.toLocaleString()}</p>
                  </div>
                </div>
                {pricingData.aiAdvice?.summary && (
                  <div className="rounded-lg bg-muted/20 p-4">
                    <p className="text-sm">{pricingData.aiAdvice.summary}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground text-center">
                  Βασίζεται σε {pricingData.stats.sampleSize} ιστορικές κατακυρώσεις
                </p>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Δεν υπάρχουν αρκετά ιστορικά δεδομένα.</p>
                <p className="text-xs mt-1">Μπορείς να ορίσεις τη δική σου τιμή.</p>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Submit/Review */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">Τελικός Έλεγχος</h3>
              <p className="text-sm text-muted-foreground">Είσαι έτοιμος να υποβάλεις;</p>
            </div>
            <div className="space-y-3">
              {STEPS.slice(0, 4).map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.key} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">{step.label}</span>
                    <span className="text-xs text-emerald-600 ml-auto">Ολοκληρώθηκε</span>
                  </div>
                );
              })}
            </div>
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold">Η προσφορά σου είναι έτοιμη!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Μπορείς να τη δεις αναλυτικά στο tab "Φάκελος" ή να μεταβείς στην πλατφόρμα υποβολής.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => setCurrentStep((s) => s - 1)}
          disabled={!canGoBack}
          type="button"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Πίσω
        </Button>
        {canGoNext ? (
          <Button onClick={() => setCurrentStep((s) => s + 1)} type="button">
            Επόμενο <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={onExit} type="button" className="bg-emerald-600 hover:bg-emerald-700">
            Ολοκλήρωση <CheckCircle2 className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
