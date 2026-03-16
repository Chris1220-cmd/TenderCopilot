'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sparkles,
  Mail,
  Lock,
  User,
  Building2,
  ArrowRight,
  Loader2,
} from 'lucide-react';

const registerSchema = z.object({
  name: z.string().min(1, 'Το όνομα είναι υποχρεωτικό'),
  email: z.string().email('Μη έγκυρη διεύθυνση email'),
  password: z
    .string()
    .min(8, 'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες'),
  companyName: z.string().min(1, 'Η επωνυμία εταιρείας είναι υποχρεωτική'),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async (_data, variables) => {
      // Auto sign-in after successful registration
      await signIn('credentials', {
        email: variables.email,
        password: variables.password,
        redirect: true,
        callbackUrl: '/tenders',
      });
    },
    onError: (err) => {
      setError(err.message || 'Κάτι πήγε στραβά. Δοκιμάστε ξανά.');
    },
  });

  function onSubmit(data: RegisterForm) {
    setError(null);
    registerMutation.mutate(data);
  }

  const isLoading = registerMutation.isPending;

  const fields = [
    {
      id: 'name',
      label: 'Ονοματεπώνυμο',
      type: 'text',
      placeholder: 'Γιάννης Παπαδόπουλος',
      icon: User,
    },
    {
      id: 'email',
      label: 'Email',
      type: 'email',
      placeholder: 'you@company.gr',
      icon: Mail,
    },
    {
      id: 'password',
      label: 'Κωδικός πρόσβασης',
      type: 'password',
      placeholder: '********',
      icon: Lock,
    },
    {
      id: 'companyName',
      label: 'Επωνυμία εταιρείας',
      type: 'text',
      placeholder: 'Η εταιρεία σας',
      icon: Building2,
    },
  ] as const;

  return (
    <div className="relative">
      {/* Glass card */}
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl',
          'border border-white/[0.08]',
          'bg-white/[0.03] backdrop-blur-xl',
          'shadow-[0_0_80px_-20px_rgba(99,102,241,0.15)]'
        )}
      >
        {/* Gradient border glow */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.06] to-transparent" />

        <div className="relative space-y-6 p-8">
          {/* Logo & Title */}
          <div className="flex flex-col items-center space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div className="space-y-1 text-center">
              <h1 className="text-xl font-semibold tracking-tight text-white">
                Δημιουργία λογαριασμού
              </h1>
              <p className="text-sm text-slate-400">
                Ξεκινήστε δωρεάν με το TenderCopilot
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {fields.map((field) => {
              const Icon = field.icon;
              const fieldError = errors[field.id];

              return (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={field.id} className="text-sm text-slate-300">
                    {field.label}
                  </Label>
                  <div className="relative">
                    <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      id={field.id}
                      type={field.type}
                      placeholder={field.placeholder}
                      className={cn(
                        'h-11 border-white/[0.08] bg-white/[0.04] pl-10 text-white placeholder:text-slate-500',
                        'focus-visible:border-indigo-500/50 focus-visible:ring-indigo-500/20',
                        'transition-all duration-200',
                        fieldError && 'border-red-500/50'
                      )}
                      {...register(field.id)}
                    />
                  </div>
                  {fieldError && (
                    <p className="text-xs text-red-400">
                      {fieldError.message}
                    </p>
                  )}
                </div>
              );
            })}

            <Button
              type="submit"
              disabled={isLoading}
              className={cn(
                'h-11 w-full cursor-pointer',
                'bg-gradient-to-r from-indigo-600 to-violet-600',
                'hover:from-indigo-500 hover:to-violet-500',
                'shadow-lg shadow-indigo-500/25',
                'border-0 text-white font-medium',
                'transition-all duration-200 active:scale-[0.98]'
              )}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Εγγραφή
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Login link */}
          <p className="text-center text-sm text-slate-400">
            Έχετε ήδη λογαριασμό;{' '}
            <Link
              href="/login"
              className="font-medium text-indigo-400 transition-colors duration-200 hover:text-indigo-300 cursor-pointer"
            >
              Σύνδεση
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
