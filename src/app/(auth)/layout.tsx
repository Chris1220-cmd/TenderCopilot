'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import { motion, useMotionValue, useMotionTemplate, useSpring } from 'motion/react';
import { useTranslation } from '@/lib/i18n';
import { NumberTicker } from '@/components/ui/number-ticker';
import { BorderBeam } from '@/components/ui/border-beam';
import { Layers } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Animated grid — subtle perspective lines                           */
/* ------------------------------------------------------------------ */
function AnimatedGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Horizontal lines */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="line-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="30%" stopColor="rgba(72,164,214,0.06)" />
            <stop offset="70%" stopColor="rgba(72,164,214,0.06)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        {Array.from({ length: 12 }).map((_, i) => (
          <line
            key={`h-${i}`}
            x1="0"
            y1={`${(i + 1) * 8}%`}
            x2="100%"
            y2={`${(i + 1) * 8}%`}
            stroke="url(#line-fade)"
            strokeWidth="0.5"
          />
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <line
            key={`v-${i}`}
            x1={`${(i + 1) * 12.5}%`}
            y1="0"
            x2={`${(i + 1) * 12.5}%`}
            y2="100%"
            stroke="rgba(72,164,214,0.03)"
            strokeWidth="0.5"
          />
        ))}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Floating orbs — abstract data points                               */
/* ------------------------------------------------------------------ */
function FloatingOrbs() {
  const orbs = [
    { x: '15%', y: '20%', size: 180, delay: 0, duration: 20 },
    { x: '70%', y: '65%', size: 240, delay: 5, duration: 25 },
    { x: '45%', y: '80%', size: 120, delay: 10, duration: 18 },
  ];

  return (
    <>
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: orb.x,
            top: orb.y,
            width: orb.size,
            height: orb.size,
            background: `radial-gradient(circle, rgba(72,164,214,0.06) 0%, transparent 70%)`,
          }}
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -25, 15, 0],
          }}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            delay: orb.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Pulse rings — emanating from logo                                  */
/* ------------------------------------------------------------------ */
function PulseRings() {
  return (
    <div className="absolute -inset-8">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-2xl border border-primary/[0.08]"
          initial={{ scale: 1, opacity: 0.15 }}
          animate={{ scale: 1.8 + i * 0.3, opacity: 0 }}
          transition={{
            duration: 3,
            repeat: Infinity,
            delay: i * 1,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

/* ------------------------------------------------------------------ */
/*  Metric bar — animated horizontal bar                               */
/* ------------------------------------------------------------------ */
function MetricBar({ value, max, color, delay }: { value: number; max: number; color: string; delay: number }) {
  return (
    <div className="h-1 w-full rounded-full bg-white/[0.04] overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${(value / max) * 100}%` }}
        transition={{ duration: 1.2, delay, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Layout                                                             */
/* ------------------------------------------------------------------ */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(0, { stiffness: 150, damping: 25 });
  const rotateY = useSpring(0, { stiffness: 150, damping: 25 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current) return;
      const { left, top, width, height } = cardRef.current.getBoundingClientRect();
      mouseX.set(e.clientX - left);
      mouseY.set(e.clientY - top);
      rotateX.set(((e.clientY - top - height / 2) / height) * -3);
      rotateY.set(((e.clientX - left - width / 2) / width) * 3);
    },
    [mouseX, mouseY, rotateX, rotateY]
  );

  const handleMouseLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  const spotlightBg = useMotionTemplate`
    radial-gradient(
      450px circle at ${mouseX}px ${mouseY}px,
      rgba(72,164,214,0.06),
      transparent 60%
    )
  `;

  const stats = [
    { value: 500, suffix: '+', key: 'auth.statDocs', bar: 85 },
    { value: 90, suffix: '%', key: 'auth.statTime', bar: 90 },
    { value: 68, suffix: '%', key: 'auth.statWinRate', bar: 68 },
  ];

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background dark">
      <div className="relative z-10 grid w-full grid-cols-1 lg:grid-cols-2">
        {/* ============================================= */}
        {/* LEFT: Brand panel                              */}
        {/* ============================================= */}
        <div className="hidden lg:flex flex-col items-center justify-center relative border-r border-border/30 overflow-hidden">
          {/* Animated grid */}
          <AnimatedGrid />

          {/* Floating orbs */}
          <FloatingOrbs />

          {/* Radial gradient ambience */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_25%_40%,rgba(72,164,214,0.05),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_70%,rgba(72,164,214,0.03),transparent_50%)]" />

          {/* Content */}
          <motion.div
            className="relative z-10 max-w-md space-y-10 px-12"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Logo mark */}
            <motion.div variants={itemVariants} className="relative">
              <div className="relative inline-flex">
                <PulseRings />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent">
                  <Layers className="h-6 w-6 text-white" />
                </div>
              </div>
            </motion.div>

            {/* Title */}
            <motion.div variants={itemVariants} className="space-y-4">
              <h2 className="text-[28px] font-semibold tracking-[-0.02em] text-foreground leading-[1.15]">
                {t('auth.showcaseTitle')}
              </h2>
              <p className="text-[15px] text-muted-foreground/70 leading-relaxed">
                {t('auth.showcaseSubtitle')}
              </p>
            </motion.div>

            {/* Stats with NumberTicker + bars */}
            <motion.div className="space-y-6" variants={itemVariants}>
              {stats.map((stat, i) => (
                <div key={stat.key} className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-muted-foreground/50 uppercase tracking-[0.15em]">
                      {t(stat.key)}
                    </span>
                    <span className="text-lg font-semibold text-foreground tabular-nums flex items-baseline gap-0.5">
                      <NumberTicker value={stat.value} delay={0.6 + i * 0.2} />
                      <span className="text-primary/60 text-sm">{stat.suffix}</span>
                    </span>
                  </div>
                  <MetricBar value={stat.bar} max={100} color="rgba(72,164,214,0.25)" delay={0.8 + i * 0.2} />
                </div>
              ))}
            </motion.div>

            {/* Separator + badge */}
            <motion.div variants={itemVariants} className="space-y-5">
              <div className="h-px w-full bg-border/20" />
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[11px] text-muted-foreground/40 tracking-[0.1em] uppercase">
                  19+ platforms monitored live
                </span>
              </div>
            </motion.div>
          </motion.div>

          {/* Bottom fade */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-background to-transparent" />
        </div>

        {/* ============================================= */}
        {/* RIGHT: Auth form with premium card             */}
        {/* ============================================= */}
        <div className="flex items-center justify-center p-4 py-8 lg:p-12 relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(72,164,214,0.02),transparent_70%)]" />

          <motion.div
            className="w-full max-w-[420px] relative"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div style={{ perspective: '1000px' }}>
              <motion.div
                ref={cardRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{
                  rotateX,
                  rotateY,
                  transformStyle: 'preserve-3d',
                }}
                className="relative group/card"
              >
                {/* Spotlight */}
                <motion.div
                  className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 z-20"
                  style={{ background: spotlightBg }}
                />

                {/* BorderBeam */}
                <div className="absolute inset-0 rounded-2xl overflow-hidden opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 z-20 pointer-events-none">
                  <BorderBeam
                    size={120}
                    duration={8}
                    colorFrom="#48A4D6"
                    colorTo="rgba(72,164,214,0.15)"
                  />
                </div>

                {children}
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
