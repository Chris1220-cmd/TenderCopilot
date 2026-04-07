'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { motion } from 'motion/react';
import { Lock, Eye, EyeOff, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';

const resetSchema = z
  .object({
    password: z.string().min(8, 'auth.passwordMin'),
    confirmPassword: z.string().min(1, 'auth.passwordRequired'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'auth.passwordMismatch',
    path: ['confirmPassword'],
  });

type ResetForm = z.infer<typeof resetSchema>;

const fieldVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      delay: 0.15 + i * 0.08,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  }),
};

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
  });

  async function onSubmit(data: ResetForm) {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: data.password }),
      });

      if (!res.ok) {
        setError(t('auth.resetPasswordError'));
        return;
      }

      setSuccess(true);
    } catch {
      setError(t('auth.genericError'));
    } finally {
      setIsLoading(false);
    }
  }

  // No token in URL
  if (!token) {
    return (
      <div className="relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as const }}
          className="rounded-2xl border border-border/60 bg-card/95 backdrop-blur-sm shadow-2xl shadow-black/40 relative overflow-hidden"
        >
          <div className="relative space-y-6 p-8 sm:p-10 text-center">
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {t('auth.resetPasswordError')}
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t('auth.backToLogin')}
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as const }}
        className="rounded-2xl border border-border/60 bg-card/95 backdrop-blur-sm shadow-2xl shadow-black/40 relative overflow-hidden"
      >
        <div className="relative space-y-6 p-8 sm:p-10">
          {/* Language Toggle */}
          <motion.div
            className="flex justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <LanguageToggle />
          </motion.div>

          {/* Logo & Title */}
          <motion.div
            className="flex flex-col items-center space-y-4"
            custom={0}
            variants={fieldVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
            >
              <span className="text-[22px] font-semibold tracking-[-0.03em] text-foreground">
                Tender<span className="text-primary">Copilot</span>
              </span>
            </motion.div>
            <div className="space-y-1.5 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {t('auth.resetPasswordTitle')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('auth.resetPasswordSubtitle')}
              </p>
            </div>
          </motion.div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            >
              {error}
            </motion.div>
          )}

          {/* Success */}
          {success ? (
            <>
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
              >
                {t('auth.resetPasswordSuccess')}
              </motion.div>
              <motion.div
                className="text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Link
                  href="/login"
                  className={cn(
                    'inline-flex items-center gap-1.5 text-sm font-medium text-primary',
                    'hover:text-primary/80 transition-colors duration-200'
                  )}
                >
                  {t('auth.submit')}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </motion.div>
            </>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* New Password */}
              <motion.div
                className="space-y-2"
                custom={1}
                variants={fieldVariants}
                initial="hidden"
                animate="visible"
              >
                <Label htmlFor="password" className="text-sm font-medium text-foreground/80">
                  {t('auth.newPassword')}
                </Label>
                <div className="relative group/input">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60 z-10 transition-colors group-focus-within/input:text-primary/70" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="********"
                    autoComplete="new-password"
                    className={cn(
                      'h-11 rounded-xl bg-background/50 border-border/60 pl-10 pr-10',
                      'focus:border-primary/40 focus:ring-2 focus:ring-primary/15 focus:bg-background/80',
                      'focus:shadow-[0_0_20px_rgba(72,164,214,0.08)]',
                      'transition-all duration-200',
                      errors.password && 'border-red-500/50 focus:ring-red-500/20'
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
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-400">{t(errors.password.message || 'auth.passwordMin')}</p>
                )}
              </motion.div>

              {/* Confirm Password */}
              <motion.div
                className="space-y-2"
                custom={2}
                variants={fieldVariants}
                initial="hidden"
                animate="visible"
              >
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground/80">
                  {t('auth.confirmPassword')}
                </Label>
                <div className="relative group/input">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60 z-10 transition-colors group-focus-within/input:text-primary/70" />
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="********"
                    autoComplete="new-password"
                    className={cn(
                      'h-11 rounded-xl bg-background/50 border-border/60 pl-10 pr-10',
                      'focus:border-primary/40 focus:ring-2 focus:ring-primary/15 focus:bg-background/80',
                      'focus:shadow-[0_0_20px_rgba(72,164,214,0.08)]',
                      'transition-all duration-200',
                      errors.confirmPassword && 'border-red-500/50 focus:ring-red-500/20'
                    )}
                    {...register('confirmPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground/60 transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 rounded-sm z-10"
                    tabIndex={0}
                    aria-label={showConfirm ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-red-400">{t(errors.confirmPassword.message || 'auth.passwordMismatch')}</p>
                )}
              </motion.div>

              {/* Submit */}
              <motion.div
                custom={3}
                variants={fieldVariants}
                initial="hidden"
                animate="visible"
              >
                <Button
                  type="submit"
                  disabled={isLoading}
                  className={cn(
                    'h-11 w-full rounded-xl bg-primary text-primary-foreground font-medium cursor-pointer',
                    'hover:bg-primary/90 hover:shadow-[0_0_30px_rgba(72,164,214,0.15)]',
                    'active:scale-[0.98]',
                    'transition-all duration-200'
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {t('auth.resetPassword')}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </motion.div>
            </form>
          )}

          {/* Back to login */}
          {!success && (
            <motion.div
              className="text-center"
              custom={4}
              variants={fieldVariants}
              initial="hidden"
              animate="visible"
            >
              <Link
                href="/login"
                className={cn(
                  'inline-flex items-center gap-1.5 text-sm text-muted-foreground',
                  'hover:text-foreground transition-colors duration-200',
                  'focus-visible:outline-none focus-visible:underline'
                )}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {t('auth.backToLogin')}
              </Link>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
