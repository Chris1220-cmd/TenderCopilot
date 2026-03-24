'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { motion } from 'motion/react';
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
  email: z.string().email('auth.invalidEmail'),
  password: z.string().min(1, 'auth.passwordRequired'),
});

type LoginForm = z.infer<typeof loginSchema>;

const fieldVariants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(4px)' },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.4,
      delay: 0.15 + i * 0.08,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  }),
};

export default function LoginPage() {
  const { t } = useTranslation();
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
        setError(t('auth.loginError'));
      } else {
        window.location.href = '/tenders';
      }
    } catch {
      setError(t('auth.genericError'));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setIsGoogleLoading(true);
    try {
      await signIn('google', { callbackUrl: '/tenders' });
    } catch {
      setError(t('auth.googleError'));
      setIsGoogleLoading(false);
    }
  }

  async function handleMagicLink() {
    if (!emailValue || !z.string().email().safeParse(emailValue).success) {
      setError(t('auth.magicLinkEmailError'));
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
      setError(t('auth.magicLinkError'));
    } finally {
      setIsMagicLinkLoading(false);
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
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
              className="relative"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-[0_0_40px_rgba(72,164,214,0.25)]">
                <span className="text-lg font-bold text-white tracking-tight">TC</span>
              </div>
              {/* Pulse ring */}
              <div className="absolute -inset-1 rounded-2xl bg-primary/20 animate-ping opacity-20" style={{ animationDuration: '3s' }} />
            </motion.div>
            <div className="space-y-1.5 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {t('auth.loginTitle')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('auth.loginSubtitle')}
              </p>
            </div>
          </motion.div>

          {/* Error message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            >
              {error}
            </motion.div>
          )}

          {/* Magic link success */}
          {magicLinkSent && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
            >
              {t('auth.magicLinkSuccess')}
            </motion.div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
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

            {/* Password */}
            <motion.div
              className="space-y-2"
              custom={2}
              variants={fieldVariants}
              initial="hidden"
              animate="visible"
            >
              <Label htmlFor="password" className="text-sm font-medium text-foreground/80">
                {t('auth.password')}
              </Label>
              <div className="relative group/input">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60 z-10 transition-colors group-focus-within/input:text-primary/70" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="********"
                  autoComplete="current-password"
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
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-400">
                  {t(errors.password.message || 'auth.passwordRequired')}
                </p>
              )}
            </motion.div>

            {/* Forgot password link */}
            <motion.div
              className="flex justify-end"
              custom={3}
              variants={fieldVariants}
              initial="hidden"
              animate="visible"
            >
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:underline"
              >
                {t('auth.forgotPassword')}
              </Link>
            </motion.div>

            {/* Submit */}
            <motion.div
              custom={4}
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
                    {t('auth.submit')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </motion.div>
          </form>

          {/* Divider */}
          <motion.div
            className="relative"
            custom={5}
            variants={fieldVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/40" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-4 text-muted-foreground/60">
                {t('auth.or')}
              </span>
            </div>
          </motion.div>

          {/* Google sign-in */}
          <motion.div
            custom={6}
            variants={fieldVariants}
            initial="hidden"
            animate="visible"
          >
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading}
              className={cn(
                'h-11 w-full cursor-pointer rounded-xl',
                'border-border/60 bg-white/[0.03]',
                'text-muted-foreground hover:bg-white/[0.06] hover:text-foreground hover:border-border',
                'transition-all duration-200',
                'focus-visible:ring-2 focus-visible:ring-ring'
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
                  {t('auth.signInGoogle')}
                </>
              )}
            </Button>
          </motion.div>

          {/* Magic link */}
          <motion.div
            custom={7}
            variants={fieldVariants}
            initial="hidden"
            animate="visible"
          >
            <Button
              type="button"
              variant="ghost"
              onClick={handleMagicLink}
              disabled={isMagicLinkLoading}
              className={cn(
                'h-10 w-full cursor-pointer rounded-xl',
                'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]',
                'transition-all duration-200',
                'focus-visible:ring-2 focus-visible:ring-ring'
              )}
            >
              {isMagicLinkLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  {t('auth.magicLink')}
                </>
              )}
            </Button>
          </motion.div>

          {/* Register link */}
          <motion.p
            className="text-center text-sm text-muted-foreground"
            custom={8}
            variants={fieldVariants}
            initial="hidden"
            animate="visible"
          >
            {t('auth.noAccount')}{' '}
            <Link
              href="/register"
              className={cn(
                'font-medium text-primary cursor-pointer',
                'transition-colors duration-200 hover:text-primary/80',
                'focus-visible:outline-none focus-visible:underline'
              )}
            >
              {t('common.register')}
            </Link>
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}
