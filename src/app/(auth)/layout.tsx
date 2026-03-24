'use client';

import { useRef, useCallback } from 'react';
import { motion, useMotionValue, useMotionTemplate, useSpring } from 'motion/react';
import { useTranslation } from '@/lib/i18n';
import { NumberTicker } from '@/components/ui/number-ticker';
import { Particles } from '@/components/ui/particles';
import { DotPattern } from '@/components/ui/dot-pattern';
import { BorderBeam } from '@/components/ui/border-beam';
import { Globe } from '@/components/ui/globe';

/* ------------------------------------------------------------------ */
/*  Globe config — Greek/EU tender sources                             */
/* ------------------------------------------------------------------ */
const GLOBE_CONFIG = {
  width: 600,
  height: 600,
  onRender: () => {},
  devicePixelRatio: 2,
  phi: 0,
  theta: 0.25,
  dark: 1,
  diffuse: 1.2,
  mapSamples: 40000,
  mapBrightness: 6,
  baseColor: [0.6, 0.65, 0.75],
  markerColor: [72 / 255, 164 / 255, 214 / 255],
  glowColor: [0.05, 0.1, 0.2],
  markers: [
    { location: [37.9838, 23.7275], size: 0.08 },  // Athens
    { location: [40.6401, 22.9444], size: 0.06 },  // Thessaloniki
    { location: [50.8503, 4.3517], size: 0.05 },   // Brussels (EU)
    { location: [48.8566, 2.3522], size: 0.04 },   // Paris
    { location: [52.52, 13.405], size: 0.04 },      // Berlin
    { location: [41.9028, 12.4964], size: 0.04 },   // Rome
    { location: [40.4168, -3.7038], size: 0.04 },   // Madrid
    { location: [38.7223, -9.1393], size: 0.03 },   // Lisbon
    { location: [48.2082, 16.3738], size: 0.03 },   // Vienna
    { location: [59.3293, 18.0686], size: 0.03 },   // Stockholm
  ],
};

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

const floatVariants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  },
};

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

  // Mouse-tracked spotlight for the card
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(0, { stiffness: 150, damping: 25 });
  const rotateY = useSpring(0, { stiffness: 150, damping: 25 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current) return;
      const { left, top, width, height } = cardRef.current.getBoundingClientRect();
      const x = e.clientX - left;
      const y = e.clientY - top;
      mouseX.set(x);
      mouseY.set(y);
      rotateX.set(((y - height / 2) / height) * -4);
      rotateY.set(((x - width / 2) / width) * 4);
    },
    [mouseX, mouseY, rotateX, rotateY]
  );

  const handleMouseLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  const spotlightBg = useMotionTemplate`
    radial-gradient(
      500px circle at ${mouseX}px ${mouseY}px,
      rgba(72,164,214,0.07),
      transparent 60%
    )
  `;

  const stats = [
    { value: 500, suffix: '+', key: 'auth.statDocs' },
    { value: 90, suffix: '%', key: 'auth.statTime' },
    { value: 68, suffix: '%', key: 'auth.statWinRate' },
  ];

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background dark">
      {/* Two-column layout */}
      <div className="relative z-10 grid w-full grid-cols-1 lg:grid-cols-2">
        {/* ============================================= */}
        {/* LEFT: Immersive brand panel                    */}
        {/* ============================================= */}
        <div className="hidden lg:flex flex-col items-center justify-center relative border-r border-border/40 overflow-hidden">
          {/* Dot pattern background with glow */}
          <DotPattern
            width={24}
            height={24}
            cr={0.8}
            glow
            className="text-primary/15 [mask-image:radial-gradient(ellipse_at_center,white_20%,transparent_70%)]"
          />

          {/* Radial gradient ambience */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(72,164,214,0.06),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_80%,rgba(72,164,214,0.03),transparent_50%)]" />

          {/* Particles */}
          <Particles
            className="absolute inset-0"
            quantity={15}
            color="#48A4D6"
            staticity={40}
            size={0.6}
          />

          {/* Content */}
          <motion.div
            className="relative z-10 max-w-md space-y-8 px-12"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Logo */}
            <motion.div variants={itemVariants}>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-[0_0_30px_rgba(72,164,214,0.2)]">
                <span className="text-base font-bold text-white tracking-tight">TC</span>
              </div>
            </motion.div>

            {/* Title */}
            <motion.h2
              className="text-3xl font-semibold tracking-tight text-foreground leading-[1.2]"
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

            {/* Stats with NumberTicker */}
            <motion.div className="flex gap-10 pt-2" variants={itemVariants}>
              {stats.map((stat) => (
                <div key={stat.key}>
                  <div className="text-2xl font-semibold text-foreground tabular-nums flex items-baseline">
                    <NumberTicker value={stat.value} delay={0.8} />
                    <span className="text-primary/70 ml-0.5">{stat.suffix}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground/60 mt-1 uppercase tracking-widest">
                    {t(stat.key)}
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Animated separator line */}
            <motion.div variants={itemVariants} className="pt-4">
              <div className="relative h-px w-full overflow-hidden">
                <div className="absolute inset-0 bg-border/30" />
                <motion.div
                  className="absolute h-full w-20 bg-gradient-to-r from-transparent via-primary/50 to-transparent"
                  animate={{ x: ['-80px', '400px'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
                />
              </div>
            </motion.div>

            {/* Source badge */}
            <motion.div variants={itemVariants} className="flex items-center gap-2 pt-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] text-muted-foreground/50 uppercase tracking-widest">
                19+ procurement platforms monitored
              </span>
            </motion.div>
          </motion.div>

          {/* Globe — floating bottom-right */}
          <motion.div
            className="absolute -bottom-20 -right-20 w-[420px] h-[420px] opacity-70"
            variants={floatVariants}
            initial="hidden"
            animate="visible"
          >
            <Globe className="w-full h-full" config={GLOBE_CONFIG} />
          </motion.div>

          {/* Subtle bottom gradient fade */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
        </div>

        {/* ============================================= */}
        {/* RIGHT: Auth form with premium card             */}
        {/* ============================================= */}
        <div className="flex items-center justify-center p-4 py-8 lg:p-12 relative">
          {/* Subtle background texture */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(72,164,214,0.02),transparent_70%)]" />

          <motion.div
            className="w-full max-w-[420px] relative"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            {/* 3D tilt wrapper */}
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
                {/* Spotlight overlay */}
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
                    colorTo="rgba(72,164,214,0.2)"
                  />
                </div>

                {/* Outer glow on hover */}
                <div className="absolute -inset-1 rounded-[18px] bg-primary/[0.03] opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 blur-xl z-0" />

                {children}
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
