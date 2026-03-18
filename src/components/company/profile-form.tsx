'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2,
  Save,
  MapPin,
  Phone,
  Mail,
  Globe,
  User,
  Hash,
  Loader2,
} from 'lucide-react';

// Greek KAD format: two digits, dot, two to four digits (e.g., 62.01, 43.2200)
const KAD_REGEX = /^\d{2}\.\d{2,4}$/;

const profileSchema = z.object({
  legalName: z.string().min(1, 'Η επωνυμία είναι υποχρεωτική'),
  tradeName: z.string().optional(),
  taxId: z
    .string()
    .min(9, 'Το ΑΦΜ πρέπει να είναι 9 ψηφία')
    .max(9, 'Το ΑΦΜ πρέπει να είναι 9 ψηφία'),
  taxOffice: z.string().min(1, 'Η ΔΟΥ είναι υποχρεωτική'),
  registrationNumber: z.string().optional(),
  address: z.string().min(1, 'Η διεύθυνση είναι υποχρεωτική'),
  city: z.string().min(1, 'Η πόλη είναι υποχρεωτική'),
  postalCode: z
    .string()
    .min(5, 'Ο Τ.Κ. πρέπει να είναι 5 ψηφία')
    .max(5, 'Ο Τ.Κ. πρέπει να είναι 5 ψηφία'),
  phone: z.string().min(1, 'Το τηλέφωνο είναι υποχρεωτικό'),
  email: z.string().email('Μη έγκυρο email'),
  website: z.string().url('Μη έγκυρο URL').optional().or(z.literal('')),
  legalRepName: z.string().min(1, 'Το όνομα νόμιμου εκπροσώπου είναι υποχρεωτικό'),
  legalRepTitle: z.string().optional(),
  legalRepIdNumber: z.string().optional(),
  kadCodes: z.string().optional().refine(
    (val) => {
      if (!val) return true;
      return val.split(',').map((s) => s.trim()).filter(Boolean).every((code) => KAD_REGEX.test(code));
    },
    { message: 'Μη έγκυρος ΚΑΔ — απαιτείται μορφή ΧΧ.ΧΧ (π.χ. 62.01)' }
  ),
  description: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function FormField({
  label,
  error,
  icon: Icon,
  children,
  className,
}: {
  label: string;
  error?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', error && '[&_input]:border-destructive [&_input]:ring-destructive/20 [&_textarea]:border-destructive [&_textarea]:ring-destructive/20', className)}>
      <Label className={cn('flex items-center gap-1.5 text-sm font-medium', error && 'text-destructive')}>
        {Icon && <Icon className={cn('h-3.5 w-3.5', error ? 'text-destructive' : 'text-muted-foreground')} />}
        {label}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

const emptyProfile: ProfileFormValues = {
  legalName: '',
  tradeName: '',
  taxId: '',
  taxOffice: '',
  registrationNumber: '',
  address: '',
  city: '',
  postalCode: '',
  phone: '',
  email: '',
  website: '',
  legalRepName: '',
  legalRepTitle: '',
  legalRepIdNumber: '',
  kadCodes: '',
  description: '',
};

export function ProfileForm() {
  const { toast } = useToast();

  const profileQuery = trpc.company.getProfile.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const updateMutation = trpc.company.updateProfile.useMutation({
    onSuccess: () => {
      toast({
        title: 'Επιτυχής αποθήκευση',
        description: 'Το προφίλ ενημερώθηκε επιτυχώς.',
      });
    },
    onError: (err) => {
      toast({
        title: 'Σφάλμα',
        description: err.message || 'Αποτυχία αποθήκευσης. Δοκιμάστε ξανά.',
        variant: 'destructive',
      });
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: emptyProfile,
  });

  useEffect(() => {
    if (profileQuery.data) {
      const d = profileQuery.data as any;
      reset({
        ...d,
        kadCodes: Array.isArray(d.kadCodes) ? d.kadCodes.join(', ') : d.kadCodes || '',
      });
    }
  }, [profileQuery.data, reset]);

  const onSubmit = (data: ProfileFormValues) => {
    // Transform data for API: kadCodes string → array, empty strings → null
    const payload = {
      ...data,
      tradeName: data.tradeName || null,
      registrationNumber: data.registrationNumber || null,
      website: data.website || null,
      legalRepTitle: data.legalRepTitle || null,
      legalRepIdNumber: data.legalRepIdNumber || null,
      description: data.description || null,
      kadCodes: data.kadCodes
        ? data.kadCodes.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
    };
    updateMutation.mutate(payload as any);
  };

  if (profileQuery.isLoading) {
    return (
      <Card className="border-white/10 bg-gradient-to-br from-card/80 to-card backdrop-blur-sm">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-1" />
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card className="border-white/10 bg-gradient-to-br from-card/80 to-card backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-500" />
              Στοιχεία Εταιρείας
            </CardTitle>
            <CardDescription>
              Τα στοιχεία χρησιμοποιούνται αυτόματα στη σύνταξη προσφορών
            </CardDescription>
          </div>
          <Button
            type="submit"
            disabled={!isDirty || updateMutation.isPending}
            className={cn(
              'cursor-pointer',
              'bg-gradient-to-r from-indigo-600 to-violet-600',
              'hover:from-indigo-500 hover:to-violet-500',
              'shadow-lg shadow-indigo-500/25',
              'border-0 text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Αποθήκευση
          </Button>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField
              label="Επωνυμία *"
              error={errors.legalName?.message}
              icon={Building2}
            >
              <Input
                {...register('legalName')}
                placeholder="π.χ. ΕΤΑΙΡΕΙΑ Α.Ε."
                className="transition-all duration-200 focus:ring-2 focus:ring-indigo-500/20"
              />
            </FormField>

            <FormField label="Διακριτικός Τίτλος" error={errors.tradeName?.message}>
              <Input
                {...register('tradeName')}
                placeholder="π.χ. BRAND NAME"
                className="transition-all duration-200 focus:ring-2 focus:ring-indigo-500/20"
              />
            </FormField>

            <FormField
              label="ΑΦΜ *"
              error={errors.taxId?.message}
              icon={Hash}
            >
              <Input
                {...register('taxId')}
                placeholder="123456789"
                maxLength={9}
                className="transition-all duration-200 focus:ring-2 focus:ring-indigo-500/20"
              />
            </FormField>

            <FormField label="ΔΟΥ *" error={errors.taxOffice?.message}>
              <Input
                {...register('taxOffice')}
                placeholder="π.χ. ΦΑΕ Αθηνών"
                className="transition-all duration-200 focus:ring-2 focus:ring-indigo-500/20"
              />
            </FormField>

            <FormField label="Αρ. ΓΕΜΗ" error={errors.registrationNumber?.message}>
              <Input
                {...register('registrationNumber')}
                placeholder="π.χ. 123456789000"
                className="transition-all duration-200 focus:ring-2 focus:ring-indigo-500/20"
              />
            </FormField>
          </div>

          {/* Address */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-4">
              <MapPin className="h-4 w-4" />
              Διεύθυνση
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField
                label="Οδός & Αριθμός *"
                error={errors.address?.message}
                className="md:col-span-2"
              >
                <Input
                  {...register('address')}
                  placeholder="π.χ. Λεωφ. Αλεξάνδρας 15"
                  className="transition-all duration-200 focus:ring-2 focus:ring-indigo-500/20"
                />
              </FormField>

              <FormField label="Πόλη *" error={errors.city?.message}>
                <Input
                  {...register('city')}
                  placeholder="π.χ. Αθήνα"
                  className="transition-all duration-200 focus:ring-2 focus:ring-indigo-500/20"
                />
              </FormField>

              <FormField label="Τ.Κ. *" error={errors.postalCode?.message}>
                <Input
                  {...register('postalCode')}
                  placeholder="π.χ. 11527"
                  maxLength={5}
                  className="transition-all duration-200 focus:ring-2 focus:ring-indigo-500/20"
                />
              </FormField>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-4">
              <Phone className="h-4 w-4" />
              Στοιχεία Επικοινωνίας
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField
                label="Τηλέφωνο *"
                error={errors.phone?.message}
                icon={Phone}
              >
                <Input
                  {...register('phone')}
                  placeholder="π.χ. 210 1234567"
                  className="transition-all duration-200 focus:ring-2 focus:ring-indigo-500/20"
                />
              </FormField>

              <FormField
                label="Email *"
                error={errors.email?.message}
                icon={Mail}
              >
                <Input
                  {...register('email')}
                  type="email"
                  placeholder="info@company.gr"
                  className="transition-all duration-200 focus:ring-2 focus:ring-indigo-500/20"
                />
              </FormField>

              <FormField
                label="Ιστοσελίδα"
                error={errors.website?.message}
                icon={Globe}
              >
                <Input
                  {...register('website')}
                  placeholder="https://www.company.gr"
                  className="transition-all duration-200 focus:ring-2 focus:ring-indigo-500/20"
                />
              </FormField>
            </div>
          </div>

          {/* Legal Rep */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-4">
              <User className="h-4 w-4" />
              Νόμιμος Εκπρόσωπος
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField
                label="Ονοματεπώνυμο *"
                error={errors.legalRepName?.message}
              >
                <Input
                  {...register('legalRepName')}
                  placeholder="π.χ. Ιωάννης Παπαδόπουλος"
                  className="transition-all duration-200 focus:ring-2 focus:ring-indigo-500/20"
                />
              </FormField>

              <FormField
                label="Ιδιότητα"
                error={errors.legalRepTitle?.message}
              >
                <Input
                  {...register('legalRepTitle')}
                  placeholder="π.χ. Διευθύνων Σύμβουλος"
                  className="transition-all duration-200 focus:ring-2 focus:ring-indigo-500/20"
                />
              </FormField>

              <FormField
                label="Αρ. Ταυτότητας"
                error={errors.legalRepIdNumber?.message}
              >
                <Input
                  {...register('legalRepIdNumber')}
                  placeholder="π.χ. ΑΕ 123456"
                  className="transition-all duration-200 focus:ring-2 focus:ring-indigo-500/20"
                />
              </FormField>
            </div>
          </div>

          {/* KAD & Description */}
          <div className="grid grid-cols-1 gap-5">
            <FormField
              label="Κωδικοί ΚΑΔ"
              error={errors.kadCodes?.message}
            >
              <Input
                {...register('kadCodes')}
                placeholder="π.χ. 62.01, 62.02, 63.11 (χωρισμένοι με κόμμα)"
                className="transition-all duration-200 focus:ring-2 focus:ring-indigo-500/20"
              />
            </FormField>

            <FormField
              label="Περιγραφή Εταιρείας"
              error={errors.description?.message}
            >
              <Textarea
                {...register('description')}
                placeholder="Σύντομη περιγραφή δραστηριοτήτων και εμπειρίας..."
                rows={4}
                className="resize-none transition-all duration-200 focus:ring-2 focus:ring-indigo-500/20"
              />
            </FormField>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
