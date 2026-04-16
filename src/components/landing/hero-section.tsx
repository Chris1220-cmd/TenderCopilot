'use client';

import { motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export function HeroSection() {
  const { t } = useTranslation();

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#0A0A1A]">
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] animate-aurora opacity-30"
          style={{
            background:
              'conic-gradient(from 180deg at 50% 50%, #48A4D6 0deg, #0A0A1A 120deg, #7DD3FC 240deg, #48A4D6 360deg)',
            filter: 'blur(120px)',
          }}
        />
      </div>

      {/* Dot grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Grain texture */}
      <div
        className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none"
        style={{ filter: 'url(#grain)' }}
      />
      <svg className="hidden" aria-hidden="true">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>

      {/* Decorative star/sparkle dots */}
      <div className="absolute inset-0 pointer-events-none">
        {[
          { top: '12%', left: '8%', size: 2 },
          { top: '22%', left: '18%', size: 1.5 },
          { top: '35%', left: '5%', size: 1 },
          { top: '55%', left: '12%', size: 2 },
          { top: '15%', right: '10%', size: 1.5 },
          { top: '30%', right: '6%', size: 1 },
          { top: '48%', right: '15%', size: 2 },
          { top: '65%', right: '8%', size: 1.5 },
          { top: '8%', left: '45%', size: 1 },
          { top: '72%', left: '30%', size: 1.5 },
          { top: '78%', right: '35%', size: 1 },
        ].map((dot, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/30"
            style={{
              top: dot.top,
              left: 'left' in dot ? dot.left : undefined,
              right: 'right' in dot ? dot.right : undefined,
              width: `${dot.size * 2}px`,
              height: `${dot.size * 2}px`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-[1000px] px-6 pt-32 pb-16 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-1.5 mb-8"
        >
          <Sparkles className="h-3.5 w-3.5 text-[#7DD3FC]" />
          <span className="text-xs font-medium text-white/70">AI-Powered Tender Management</span>
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-[1.05] tracking-[-0.04em] text-white"
        >
          {t('hero.title')}{' '}
          <span className="bg-gradient-to-r from-[#48A4D6] via-[#7DD3FC] to-[#48A4D6] bg-clip-text text-transparent">
            {t('hero.titleEmphasis')}
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-6 text-lg sm:text-xl text-white/50 max-w-xl mx-auto leading-relaxed"
        >
          {t('hero.subtitle')}
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/register"
            className="group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#48A4D6] to-[#7DD3FC] px-8 py-4 text-[15px] font-semibold text-white transition-all hover:shadow-[0_0_40px_rgba(72,164,214,0.4)] cursor-pointer"
          >
            {t('hero.cta')}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="#features"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-8 py-4 text-[15px] font-medium text-white/70 transition-all hover:bg-white/5 hover:text-white cursor-pointer"
          >
            Δες πώς λειτουργεί
          </Link>
        </motion.div>
      </div>

      {/* Product mockup with glow */}
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, delay: 1.0 }}
        className="relative z-10 mx-auto w-full max-w-[1100px] px-6 pb-8"
      >
        <div className="relative" style={{ perspective: '1200px' }}>
          {/* Glow behind mockup */}
          <div className="absolute inset-0 -m-8 rounded-3xl bg-[#48A4D6]/20 blur-3xl" />

          {/* Main mockup */}
          <div
            className="relative mx-auto max-w-[950px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-[#48A4D6]/10"
            style={{ transform: 'rotateX(2deg)' }}
          >
            <Image
              src="/images/dashboard-mockup.png"
              alt="TenderCopilot Dashboard"
              width={950}
              height={594}
              className="w-full h-auto"
              priority
            />
          </div>

          {/* Floating AI chat card — left */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 1.5 }}
            className="absolute -left-4 lg:-left-12 top-[15%] w-[280px] sm:w-[300px]"
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="rounded-2xl bg-white/5 backdrop-blur-2xl p-5 border border-white/10 shadow-2xl shadow-black/40"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded-full bg-gradient-to-r from-[#48A4D6] to-[#7DD3FC] flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-white" />
                </div>
                <span className="text-[13px] text-white/70 font-medium">{t('hero.aiChat')}</span>
              </div>
              <p className="text-[13px] text-white/50 leading-relaxed">
                {t('hero.aiMessage')} <span className="text-[#7DD3FC] font-semibold">94%</span>
              </p>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                  <span className="text-[12px] text-white/20">{t('hero.aiPlaceholder')}</span>
                </div>
                <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-[#48A4D6] to-[#7DD3FC] flex items-center justify-center cursor-pointer">
                  <ArrowRight className="h-3.5 w-3.5 text-white" />
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Floating stats card — right */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 1.8 }}
            className="absolute -right-4 lg:-right-12 top-[25%] w-[240px] sm:w-[260px]"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              className="rounded-2xl bg-white/5 backdrop-blur-2xl p-5 border border-white/10 shadow-2xl shadow-black/40"
            >
              <div className="text-[11px] uppercase tracking-widest text-white/30 font-medium">
                {t('hero.winRate')}
              </div>
              <div className="mt-2 text-[36px] font-bold tracking-[-0.02em] text-white">
                68<span className="text-[24px] text-white/30">%</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-[12px] font-medium text-[#7DD3FC]">+12%</span>
                <span className="text-[12px] text-white/30">{t('hero.vsLastQuarter')}</span>
              </div>
              <svg className="mt-3 w-full h-[32px]" viewBox="0 0 200 32" fill="none">
                <path
                  d="M0 28 C30 24, 40 20, 60 18 S90 8, 120 12 S150 6, 170 4 S190 2, 200 2"
                  stroke="url(#sparkGrad2)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="sparkGrad2" x1="0" y1="0" x2="200" y2="0">
                    <stop offset="0%" stopColor="#48A4D6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#7DD3FC" stopOpacity="0.8" />
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {/* Bottom gradient: dark to white transition */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-white via-white/80 to-transparent" />
    </section>
  );
}
