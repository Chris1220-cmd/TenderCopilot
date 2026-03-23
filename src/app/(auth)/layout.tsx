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
    transition: { staggerChildren: 0.12, delayChildren: 0.3 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background dark">
      {/* Two-column layout */}
      <div className="relative z-10 grid w-full grid-cols-1 lg:grid-cols-2">
        {/* Left: Clean brand panel */}
        <div className="hidden lg:flex flex-col items-center justify-center p-12 relative border-r border-border">
          <motion.div
            className="max-w-md space-y-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Logo mark */}
            <motion.div variants={itemVariants}>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
                <span className="text-base font-bold text-white tracking-tight">TC</span>
              </div>
            </motion.div>

            {/* Title */}
            <motion.h2
              className="text-3xl font-semibold tracking-tight text-foreground"
              variants={itemVariants}
            >
              {t('auth.showcaseTitle')}
            </motion.h2>

            <motion.p
              className="text-base text-muted-foreground leading-relaxed"
              variants={itemVariants}
            >
              {t('auth.showcaseSubtitle')}
            </motion.p>

            {/* Stats */}
            <motion.div className="flex gap-10 pt-4" variants={itemVariants}>
              {stats.map((stat) => (
                <div key={stat.key}>
                  <div className="text-2xl font-semibold text-foreground tabular-nums">
                    {stat.value}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t(stat.key)}
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>

        {/* Right: Auth form */}
        <div className="flex items-center justify-center p-4 py-8 lg:p-12">
          <motion.div
            className="w-full max-w-[420px]"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] as const }}
          >
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
