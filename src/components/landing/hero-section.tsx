'use client';

import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { GlowButton } from '@/components/ui/glow-button';
import { AnimatedMesh } from '@/components/ui/animated-mesh';
import Link from 'next/link';

export function HeroSection() {
  const { t } = useTranslation();

  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <AnimatedMesh />

      <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-1.5 text-sm font-medium text-cyan-400 glow-cyan">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            {t('hero.badge')}
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-8 text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl"
        >
          {t('hero.title')}
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto"
        >
          {t('hero.subtitle')}
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link href="/register">
            <GlowButton size="lg">{t('common.tryFree')}</GlowButton>
          </Link>
          <GlowButton variant="ghost" size="lg">
            <Play className="h-4 w-4" />
            {t('common.watchDemo')}
          </GlowButton>
        </motion.div>

        {/* Trust line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-6 text-sm text-muted-foreground"
        >
          {t('common.noCard')}
        </motion.p>
      </div>
    </section>
  );
}
