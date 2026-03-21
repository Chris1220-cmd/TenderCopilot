'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Wand2,
  Loader2,
} from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Μη έγκυρη διεύθυνση email'),
  password: z.string().min(1, 'Ο κωδικός πρόσβασης είναι υποχρεωτικός'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const emailValue = watch('email');

  async function onSubmit(data: LoginForm) {
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
        callbackUrl: '/tenders',
      });

      if (result?.error) {
        setError('Λάθος email ή κωδικός πρόσβασης');
      } else {
        window.location.href = '/tenders';
      }
    } catch {
      setError('Κάτι πήγε στραβά. Δοκιμάστε ξανά.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setIsGoogleLoading(true);
    try {
      await signIn('google', { callbackUrl: '/tenders' });
    } catch {
      setError('Αποτυχία σύνδεσης με Google');
      setIsGoogleLoading(false);
    }
  }

  async function handleMagicLink() {
    if (!emailValue || !z.string().email().safeParse(emailValue).success) {
      setError('Εισάγετε ένα έγκυρο email πρώτα');
      return;
    }

    setIsMagicLinkLoading(true);
    setError(null);

    try {
      await signIn('email', {
        email: emailValue,
        redirect: false,
        callbackUrl: '/tenders',
      });
      setMagicLinkSent(true);
    } catch {
      setError('Αποτυχία αποστολής magic link');
    } finally {
      setIsMagicLinkLoading(false);
    }
  }

  return (
    <div className="relative">
      {/* Glass card */}
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl',
          'border border-white/10',
          'bg-white/[0.07] backdrop-blur-xl',
          'shadow-[0_8px_60px_-12px_rgba(30,64,175,0.3)]'
        )}
      >
        {/* Top border glow line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />

        {/* Inner gradient overlay */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.05] to-transparent" />

        <div className="relative space-y-6 p-8 sm:p-10">
          {/* Logo & Title */}
          <div className="flex flex-col items-center space-y-4">
            <img src="/images/logo-icon.png" alt="TenderCopilot" className="h-14 w-14 rounded-xl" />
            <div className="space-y-1.5 text-center">
              <h1 className="bg-gradient-to-b from-white to-white/80 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
                Καλώς ήρθατε
              </h1>
              <p className="text-sm text-slate-400">
                Συνδεθείτε στο TenderCopilot GR
              </p>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Magic link success */}
          {magicLinkSent && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              Ελέγξτε το email σας για τον σύνδεσμο σύνδεσης.
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-slate-300">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.gr"
                  autoComplete="email"
                  className={cn(
                    'h-11 rounded-xl border-white/[0.08] bg-white/[0.05] pl-10 text-white placeholder:text-slate-500',
                    'focus-visible:border-[#3B82F6]/50 focus-visible:ring-2 focus-visible:ring-[#3B82F6]/20',
                    'transition-all duration-200',
                    errors.email && 'border-red-500/50 focus-visible:ring-red-500/20'
                  )}
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-300">
                Κωδικός πρόσβασης
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="********"
                  autoComplete="current-password"
                  className={cn(
                    'h-11 rounded-xl border-white/[0.08] bg-white/[0.05] pl-10 pr-10 text-white placeholder:text-slate-500',
                    'focus-visible:border-[#3B82F6]/50 focus-visible:ring-2 focus-visible:ring-[#3B82F6]/20',
                    'transition-all duration-200',
                    errors.password && 'border-red-500/50 focus-visible:ring-red-500/20'
                  )}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-500 transition-colors duration-200 hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40 focus-visible:ring-offset-0 rounded-sm"
                  tabIndex={0}
                  aria-label={showPassword ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-400">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isLoading}
              className={cn(
                'h-11 w-full cursor-pointer rounded-xl',
                'bg-white text-[#1E40AF] font-semibold',
                'hover:bg-white/90',
                'shadow-lg shadow-white/10',
                'border-0',
                'transition-all duration-200 active:scale-[0.98]',
                'focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'
              )}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Σύνδεση
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.08]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-900/60 px-4 text-slate-500 backdrop-blur-sm">
                ή
              </span>
            </div>
          </div>

          {/* Google sign-in */}
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
            className={cn(
              'h-11 w-full cursor-pointer rounded-xl',
              'border-white/[0.08] bg-white/[0.04]',
              'text-slate-300 hover:bg-white/[0.08] hover:text-white',
              'transition-all duration-200',
              'focus-visible:ring-2 focus-visible:ring-[#3B82F6]/30'
            )}
          >
            {isGoogleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Συνέχεια με Google
              </>
            )}
          </Button>

          {/* Magic link */}
          <Button
            type="button"
            variant="ghost"
            onClick={handleMagicLink}
            disabled={isMagicLinkLoading}
            className={cn(
              'h-10 w-full cursor-pointer rounded-xl',
              'text-slate-400 hover:text-white hover:bg-white/[0.04]',
              'transition-all duration-200',
              'focus-visible:ring-2 focus-visible:ring-[#3B82F6]/30'
            )}
          >
            {isMagicLinkLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Αποστολή Magic Link
              </>
            )}
          </Button>

          {/* Register link */}
          <p className="text-center text-sm text-slate-400">
            Δεν έχετε λογαριασμό;{' '}
            <Link
              href="/register"
              className={cn(
                'font-medium text-[#3B82F6] cursor-pointer',
                'transition-colors duration-200 hover:text-blue-400',
                'focus-visible:outline-none focus-visible:underline'
              )}
            >
              Εγγραφή
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
