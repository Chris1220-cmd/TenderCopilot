'use client';

import { useState } from 'react';
import Link from 'next/link';
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
import { Mail, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';

const forgotSchema = z.object({
  email: z.string().email('auth.invalidEmail'),
});

type ForgotForm = z.infer<typeof forgotSchema>;

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

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
  });

  async function onSubmit(data: ForgotForm) {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      });

      if (!res.ok) throw new Error();
      setSubmitted(true);
    } catch {
      setError(t('auth.genericError'));
    } finally {
      setIsLoading(false);
    }
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
                {t('auth.forgotPasswordTitle')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('auth.forgotPasswordSubtitle')}
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
          {submitted ? (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
            >
              {t('auth.forgotPasswordSuccess')}
            </motion.div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <motion.div
                className="space-y-2"
                custom={1}
                variants={fieldVariants}
                initial="hidden"
                animate="visible"
              >
                <Label htmlFor="email" className="text-sm font-medium text-foreground/80">
                  {t('auth.email')}
                </Label>
                <div className="relative group/input">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60 z-10 transition-colors group-focus-within/input:text-primary/70" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.gr"
                    autoComplete="email"
                    className={cn(
                      'h-11 rounded-xl bg-background/50 border-border/60 pl-10',
                      'focus:border-primary/40 focus:ring-2 focus:ring-primary/15 focus:bg-background/80',
                      'focus:shadow-[0_0_20px_rgba(72,164,214,0.08)]',
                      'transition-all duration-200',
                      errors.email && 'border-red-500/50 focus:ring-red-500/20'
                    )}
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-400">{t(errors.email.message || 'auth.invalidEmail')}</p>
                )}
              </motion.div>

              <motion.div
                custom={2}
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
                      {t('auth.sendResetLink')}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </motion.div>
            </form>
          )}

          {/* Back to login */}
          <motion.div
            className="text-center"
            custom={3}
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
        </div>
      </motion.div>
    </div>
  );
}
