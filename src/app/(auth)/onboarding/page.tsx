'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

type Step = 1 | 2 | 3;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [companyName, setCompanyName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [city, setCity] = useState('');
  const [kadInput, setKadInput] = useState('');
  const [kadCodes, setKadCodes] = useState<string[]>([]);

  // Pre-fill from existing tenant/company profile (Bug #3 fix)
  const { data: tenantData } = trpc.tenant.get.useQuery();
  const { data: companyProfile } = trpc.company.getProfile.useQuery();

  useEffect(() => {
    if (companyProfile?.legalName && !companyName) {
      setCompanyName(companyProfile.legalName);
    } else if (tenantData?.name && !companyName) {
      setCompanyName(tenantData.name);
    }
    if (companyProfile?.taxId && !taxId) setTaxId(companyProfile.taxId);
    if (companyProfile?.city && !city) setCity(companyProfile.city);
    if (companyProfile?.kadCodes?.length && kadCodes.length === 0) {
      setKadCodes(companyProfile.kadCodes);
    }
  }, [tenantData, companyProfile]);

  const completeMutation = trpc.onboarding.complete.useMutation({
    onSuccess: () => { setStep(3); },
  });
  const skipMutation = trpc.onboarding.skip.useMutation({
    onSuccess: () => { router.push('/dashboard'); },
  });

  // Bug #4 fix: progress should reflect step position out of total steps
  // Step 1 = 50% (you're 1/2 of the way through), Step 2 = 100%
  const progress = (step / 2) * 100;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary mx-auto">
          <span className="text-xs font-bold text-white">TC</span>
        </div>
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">TenderCopilot</p>
      </div>

      {/* Progress */}
      {step < 3 && (
        <div className="mb-8 w-full max-w-sm">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Βήμα {step} από 2</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1 w-full rounded-full bg-muted">
            <div
              className="h-1 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Card */}
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        {/* Step 1: Company */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-semibold">Εταιρεία σου</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Συμπλήρωσε τα στοιχεία για να βρούμε τους κατάλληλους διαγωνισμούς.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="company">Επωνυμία εταιρείας *</Label>
                <Input
                  id="company"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="π.χ. Ηλεκτρολογική Παπαδόπουλος ΙΚΕ"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="taxId">ΑΦΜ</Label>
                <Input
                  id="taxId"
                  value={taxId}
                  onChange={e => setTaxId(e.target.value)}
                  placeholder="π.χ. 800123456"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="city">Πόλη</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="π.χ. Αθήνα"
                  className="mt-1"
                />
              </div>
            </div>
            <Button
              onClick={() => setStep(2)}
              disabled={!companyName.trim()}
              className="w-full"
            >
              Επόμενο <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <button
              type="button"
              onClick={() => skipMutation.mutate()}
              disabled={skipMutation.isPending}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              Παράλειψη για τώρα
            </button>
          </div>
        )}

        {/* Step 2: KAD codes */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-semibold">Δραστηριότητα</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Πρόσθεσε KAD κωδικούς για να φιλτράρουμε τους κατάλληλους διαγωνισμούς.
              </p>
            </div>
            <div className="space-y-2">
              <Label>KAD Κωδικοί</Label>
              <div className="flex gap-2">
                <Input
                  value={kadInput}
                  onChange={e => setKadInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && kadInput.trim()) {
                      setKadCodes(prev => Array.from(new Set([...prev, kadInput.trim()])));
                      setKadInput('');
                    }
                  }}
                  placeholder="π.χ. 43.21 (Enter για προσθήκη)"
                  className="flex-1"
                />
              </div>
              {kadCodes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {kadCodes.map(code => (
                    <span key={code} className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {code}
                      <button
                        type="button"
                        onClick={() => setKadCodes(prev => prev.filter(c => c !== code))}
                        className="hover:text-destructive"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" /> Πίσω
              </Button>
              <Button
                onClick={() => completeMutation.mutate({ companyName, taxId, city, kadCodes })}
                disabled={completeMutation.isPending}
                className="flex-1"
              >
                {completeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Τέλος!'}
              </Button>
            </div>
            <button
              type="button"
              onClick={() => skipMutation.mutate()}
              disabled={skipMutation.isPending}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              Παράλειψη για τώρα
            </button>
          </div>
        )}

        {/* Step 3: Complete */}
        {step === 3 && (
          <div className="space-y-5 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">Είσαι έτοιμος! 🎉</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Το προφίλ σου έχει ρυθμιστεί. Μπορείς τώρα να ξεκινήσεις να βρίσκεις διαγωνισμούς.
              </p>
            </div>
            <div className="space-y-2">
              <Button onClick={() => router.push('/tenders')} className="w-full">
                Δες τους Διαγωνισμούς <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard')} className="w-full">
                Εξερεύνησε το Dashboard
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
