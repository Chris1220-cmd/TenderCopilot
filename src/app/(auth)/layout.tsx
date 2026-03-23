'use client';

import Image from 'next/image';
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
      {/* Background gradient glows */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_center,rgba(108,92,231,0.12),transparent_60%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(168,85,247,0.06),transparent_50%)]" />

      {/* Dot pattern */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Two-column layout */}
      <div className="relative z-10 grid w-full grid-cols-1 lg:grid-cols-2">
        {/* Left: Hero illustration + stats */}
        <div className="hidden lg:flex flex-col items-center justify-center p-12 relative">
          <motion.div
            className="max-w-xl space-y-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Floating hero illustration */}
            <motion.div
              variants={itemVariants}
              className="relative"
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Image
                  src="/images/illustrations/login-hero.png"
                  alt=""
                  width={560}
                  height={420}
                  className="w-full max-w-[560px] drop-shadow-[0_20px_60px_rgba(108,92,231,0.3)]"
                  priority
                />
              </motion.div>
            </motion.div>

            {/* Title */}
            <motion.h2
              className="text-3xl font-bold tracking-tight bg-gradient-to-r from-[#6C5CE7] via-[#A855F7] to-[#6C5CE7] bg-clip-text text-transparent"
              variants={itemVariants}
            >
              {t('auth.showcaseTitle')}
            </motion.h2>

            <motion.p
              className="text-base text-[#8888A0] leading-relaxed"
              variants={itemVariants}
            >
              {t('auth.showcaseSubtitle')}
            </motion.p>

            {/* Stats */}
            <motion.div className="flex gap-10 pt-2" variants={itemVariants}>
              {stats.map((stat) => (
                <div key={stat.key}>
                  <div className="text-2xl font-bold text-white tabular-nums">
                    {stat.value}
                  </div>
                  <div className="text-xs text-[#55556A] mt-1">
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
