'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { trpc } from '@/lib/trpc';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { Label } from '@/components/ui/label';
import { motion } from 'motion/react';
import {
  Mail,
  Lock,
  User,
  Building2,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
} from 'lucide-react';

const registerSchema = z.object({
  name: z.string().min(1, 'auth.nameRequired'),
  email: z.string().email('auth.invalidEmail'),
  password: z
    .string()
    .min(8, 'auth.passwordMin'),
  companyName: z.string().min(1, 'auth.companyRequired'),
});

type RegisterForm = z.infer<typeof registerSchema>;

function PasswordStrength({ password }: { password: string }) {
  const strength = useMemo(() => {
    if (!password) return 0;
    if (password.length < 6) return 1;
    if (password.length < 10) return 2;
    return 3;
  }, [password]);

  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500'];
  const color = colors[strength] || colors[0];

  if (!password) return null;

  return (
    <div className="flex gap-1 pt-1">
      {[1, 2, 3].map((level) => (
        <div
          key={level}
          className={cn(
            'h-1 flex-1 rounded-full transition-all duration-300',
            level <= strength ? color : 'bg-muted/40'
          )}
        />
      ))}
    </div>
  );
}

export default function RegisterPage() {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const passwordValue = watch('password') || '';

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async (_data, variables) => {
      // Auto sign-in after successful registration
      try {
        const result = await signIn('credentials', {
          email: variables.email,
          password: variables.password,
          redirect: false,
        });
        if (result?.error) {
          // Registration succeeded but auto-login failed — redirect to login
          window.location.href = '/login';
        } else {
          window.location.href = '/dashboard';
        }
      } catch {
        window.location.href = '/login';
      }
    },
    onError: (err) => {
      setError(err.message || t('auth.genericError'));
    },
  });

  function onSubmit(data: RegisterForm) {
    if (!termsAccepted) return;
    setError(null);
    registerMutation.mutate(data);
  }

  const isLoading = registerMutation.isPending;

  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as const }}
      >
        {/* Card */}
        <div className="rounded-2xl border border-border bg-card shadow-2xl shadow-black/40 relative overflow-hidden">

          <div className="relative space-y-6 p-8 sm:p-10">
            {/* Language Toggle */}
            <div className="flex justify-end">
              <LanguageToggle />
            </div>

            {/* Logo & Title */}
            <div className="flex flex-col items-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
                <span className="text-base font-bold text-white tracking-tight">TC</span>
              </div>
              <div className="space-y-1 text-center">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  {t('auth.registerTitle')}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t('auth.registerSubtitle')}
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
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm text-foreground/80">
                  {t('auth.name')}
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60 z-10" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    className={cn(
                      'h-11 rounded-xl bg-background border-border pl-10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20',
                      errors.name && 'border-red-500/50'
                    )}
                    {...register('name')}
                  />
                </div>
                {errors.name && (
                  <p className="text-xs text-red-400">{t(errors.name.message || 'auth.nameRequired')}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm text-foreground/80">
                  {t('auth.email')}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60 z-10" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.gr"
                    className={cn(
                      'h-11 rounded-xl bg-background border-border pl-10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20',
                      errors.email && 'border-red-500/50'
                    )}
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-400">{t(errors.email.message || 'auth.invalidEmail')}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm text-foreground/80">
                  {t('auth.password')}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60 z-10" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="********"
                    className={cn(
                      'h-11 rounded-xl bg-background border-border pl-10 pr-10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20',
                      errors.password && 'border-red-500/50'
                    )}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground/60 transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 rounded-sm z-10"
                    tabIndex={0}
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <PasswordStrength password={passwordValue} />
                {errors.password && (
                  <p className="text-xs text-red-400">{t(errors.password.message || 'auth.passwordMin')}</p>
                )}
              </div>

              {/* Company Name */}
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-sm text-foreground/80">
                  {t('auth.company')}
                </Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60 z-10" />
                  <Input
                    id="companyName"
                    type="text"
                    placeholder="Acme Corp"
                    className={cn(
                      'h-11 rounded-xl bg-background border-border pl-10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20',
                      errors.companyName && 'border-red-500/50'
                    )}
                    {...register('companyName')}
                  />
                </div>
                {errors.companyName && (
                  <p className="text-xs text-red-400">{t(errors.companyName.message || 'auth.companyRequired')}</p>
                )}
              </div>

              {/* Terms checkbox */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center pt-0.5">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div
                    className={cn(
                      'h-4 w-4 rounded border transition-all duration-200',
                      'border-border/60 bg-background',
                      'peer-checked:border-primary peer-checked:bg-primary',
                      'peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
                      'flex items-center justify-center'
                    )}
                  >
                    {termsAccepted && (
                      <svg className="h-3 w-3 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground leading-relaxed">
                  {t('auth.termsAgree')}{' '}
                  <Link
                    href="/terms"
                    className="text-primary hover:text-primary/80 underline transition-colors duration-200 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t('auth.termsLink')}
                  </Link>
                </span>
              </label>

              <Button
                type="submit"
                disabled={isLoading || !termsAccepted}
                className="h-11 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer font-medium"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {t('auth.register')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            {/* Login link */}
            <p className="text-center text-sm text-muted-foreground">
              {t('auth.hasAccount')}{' '}
              <Link
                href="/login"
                className="font-medium text-primary transition-colors duration-200 hover:text-primary/80 cursor-pointer focus-visible:outline-none focus-visible:underline"
              >
                {t('common.login')}
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
