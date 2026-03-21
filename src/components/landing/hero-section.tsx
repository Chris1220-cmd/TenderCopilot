'use client';

import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { GlowButton } from '@/components/ui/glow-button';
import { SparklesCore } from '@/components/ui/sparkles';
import Link from 'next/link';

export function HeroSection() {
  const { t } = useTranslation();

  return (
    <section id="hero" className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Sparkles background */}
      <div className="w-full absolute inset-0 h-full">
        <SparklesCore
          id="tsparticlesfullpage"
          background="transparent"
          minSize={0.6}
          maxSize={1.4}
          particleDensity={80}
          className="w-full h-full"
          particleColor="#3B82F6"
          speed={0.8}
        />
      </div>

      {/* Gradient glow orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-1/4 left-1/2 -translate-x-1/2 h-[600px] w-[800px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.3), transparent 70%)', filter: 'blur(100px)' }}
        />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.25), transparent 70%)', filter: 'blur(80px)' }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-1.5 text-sm font-medium text-cyan-400 backdrop-blur-sm shadow-[0_0_24px_rgba(6,182,212,0.12)]">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            {t('hero.badge')}
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-8 text-4xl font-bold tracking-tight md:text-5xl lg:text-7xl"
          style={{
            background: 'linear-gradient(to bottom, #ffffff, #ffffff, rgba(255, 255, 255, 0.6))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.03em',
          }}
        >
          {t('hero.title')}
        </motion.h1>

        {/* Sparkle line under title */}
        <div className="w-[40rem] max-w-full h-20 relative mx-auto">
          <div className="absolute inset-x-20 top-0 bg-gradient-to-r from-transparent via-blue-500 to-transparent h-[2px] w-3/4 blur-sm" />
          <div className="absolute inset-x-20 top-0 bg-gradient-to-r from-transparent via-blue-500 to-transparent h-px w-3/4" />
          <div className="absolute inset-x-60 top-0 bg-gradient-to-r from-transparent via-cyan-500 to-transparent h-[5px] w-1/4 blur-sm" />
          <div className="absolute inset-x-60 top-0 bg-gradient-to-r from-transparent via-cyan-500 to-transparent h-px w-1/4" />

          <SparklesCore
            background="transparent"
            minSize={0.4}
            maxSize={1}
            particleDensity={1200}
            className="w-full h-full"
            particleColor="#FFFFFF"
          />

          <div className="absolute inset-0 w-full h-full [mask-image:radial-gradient(350px_200px_at_top,transparent_20%,white)]" style={{ backgroundColor: 'hsl(240 6% 4%)' }} />
        </div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg text-muted-foreground max-w-2xl mx-auto md:text-xl"
        >
          {t('hero.subtitle')}
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
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

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 grid grid-cols-3 gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-sm max-w-lg mx-auto"
        >
          <div className="space-y-1 text-center">
            <div className="text-2xl font-bold text-foreground">500+</div>
            <div className="text-xs text-muted-foreground">{t('stats.docs')}</div>
          </div>
          <div className="space-y-1 text-center border-x border-white/[0.06]">
            <div className="text-2xl font-bold text-foreground">68%</div>
            <div className="text-xs text-muted-foreground">{t('stats.winRate')}</div>
          </div>
          <div className="space-y-1 text-center">
            <div className="text-2xl font-bold text-foreground">90%</div>
            <div className="text-xs text-muted-foreground">{t('stats.timeSaved')}</div>
          </div>
        </motion.div>

        {/* Trust line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-6 text-sm text-muted-foreground/60"
        >
          {t('common.noCard')}
        </motion.p>
      </div>
    </section>
  );
}
