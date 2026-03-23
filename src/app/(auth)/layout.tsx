'use client';

import { motion } from 'motion/react';
import { useTranslation } from '@/lib/i18n';

const stats = [
  { value: '500+', key: 'auth.statDocs' },
  { value: '90%', key: 'auth.statTime' },
  { value: '68%', key: 'auth.statWinRate' },
] as const;

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

const statVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      {/* Subtle radial gradient glow — Superhuman deep navy aesthetic */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(108,92,231,0.08),transparent_50%)]" />

      {/* Secondary subtle glow at bottom-right for depth */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(99,102,241,0.05),transparent_50%)]" />

      {/* Two-column grid: product showcase + auth form */}
      <div className="relative z-10 grid w-full grid-cols-1 lg:grid-cols-[3fr_2fr]">
        {/* Left: Product showcase (hidden on mobile) */}
        <div className="hidden lg:flex flex-col items-center justify-center p-12">
          <motion.div
            className="max-w-lg space-y-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.h2
              className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
              variants={itemVariants}
            >
              {t('auth.showcaseTitle')}
            </motion.h2>

            <motion.p
              className="text-lg text-muted-foreground leading-relaxed"
              variants={itemVariants}
            >
              {t('auth.showcaseSubtitle')}
            </motion.p>

            <motion.div
              className="flex gap-8 pt-4"
              variants={itemVariants}
            >
              {stats.map((stat) => (
                <motion.div key={stat.key} variants={statVariants}>
                  <div className="text-2xl font-bold text-foreground">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t(stat.key)}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>

        {/* Right: Auth form */}
        <div className="flex items-center justify-center p-4 py-8 lg:p-12">
          <motion.div
            className="w-full max-w-[440px]"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.5,
              delay: 0.3,
              ease: [0.16, 1, 0.3, 1] as const,
            }}
          >
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
