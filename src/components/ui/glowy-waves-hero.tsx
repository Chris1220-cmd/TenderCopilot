"use client";

import { motion, type Variants } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

type Point = {
  x: number;
  y: number;
};

interface WaveConfig {
  offset: number;
  amplitude: number;
  frequency: number;
  color: string;
  opacity: number;
}

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, staggerChildren: 0.12 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

const statsVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, ease: "easeOut", staggerChildren: 0.08 },
  },
};

export function GlowyWavesHero({
  badge,
  title,
  titleHighlight,
  subtitle,
  primaryCta,
  secondaryCta,
  pills,
  stats,
  onPrimaryCta,
  onSecondaryCta,
}: {
  badge?: string;
  title?: string;
  titleHighlight?: string;
  subtitle?: string;
  primaryCta?: string;
  secondaryCta?: string;
  pills?: string[];
  stats?: { label: string; value: string }[];
  onPrimaryCta?: () => void;
  onSecondaryCta?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<Point>({ x: 0, y: 0 });
  const targetMouseRef = useRef<Point>({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    let animationId: number;
    let time = 0;

    const computeThemeColors = () => {
      return {
        backgroundTop: "hsl(240 6% 4%)",
        backgroundBottom: "hsl(240 6% 6%)",
        wavePalette: [
          { offset: 0, amplitude: 70, frequency: 0.003, color: "rgba(59,130,246,0.8)", opacity: 0.45 },
          { offset: Math.PI / 2, amplitude: 90, frequency: 0.0026, color: "rgba(6,182,212,0.7)", opacity: 0.35 },
          { offset: Math.PI, amplitude: 60, frequency: 0.0034, color: "rgba(139,92,246,0.65)", opacity: 0.3 },
          { offset: Math.PI * 1.5, amplitude: 80, frequency: 0.0022, color: "rgba(59,130,246,0.4)", opacity: 0.25 },
          { offset: Math.PI * 2, amplitude: 55, frequency: 0.004, color: "rgba(6,182,212,0.3)", opacity: 0.2 },
        ] satisfies WaveConfig[],
      };
    };

    const themeColors = computeThemeColors();

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mouseInfluence = prefersReducedMotion ? 10 : 70;
    const influenceRadius = prefersReducedMotion ? 160 : 320;
    const smoothing = prefersReducedMotion ? 0.04 : 0.1;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const recenterMouse = () => {
      const centerPoint = { x: canvas.width / 2, y: canvas.height / 2 };
      mouseRef.current = centerPoint;
      targetMouseRef.current = centerPoint;
    };

    const handleResize = () => { resizeCanvas(); recenterMouse(); };
    const handleMouseMove = (event: MouseEvent) => {
      targetMouseRef.current = { x: event.clientX, y: event.clientY };
    };
    const handleMouseLeave = () => { recenterMouse(); };

    resizeCanvas();
    recenterMouse();

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    const drawWave = (wave: WaveConfig) => {
      ctx.save();
      ctx.beginPath();
      for (let x = 0; x <= canvas.width; x += 4) {
        const dx = x - mouseRef.current.x;
        const dy = canvas.height / 2 - mouseRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const influence = Math.max(0, 1 - distance / influenceRadius);
        const mouseEffect = influence * mouseInfluence * Math.sin(time * 0.001 + x * 0.01 + wave.offset);
        const y = canvas.height / 2 +
          Math.sin(x * wave.frequency + time * 0.002 + wave.offset) * wave.amplitude +
          Math.sin(x * wave.frequency * 0.4 + time * 0.003) * (wave.amplitude * 0.45) +
          mouseEffect;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = wave.color;
      ctx.globalAlpha = wave.opacity;
      ctx.shadowBlur = 35;
      ctx.shadowColor = wave.color;
      ctx.stroke();
      ctx.restore();
    };

    const animate = () => {
      time += 1;
      mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * smoothing;
      mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * smoothing;
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, themeColors.backgroundTop);
      gradient.addColorStop(1, themeColors.backgroundBottom);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      themeColors.wavePalette.forEach(drawWave);
      animationId = window.requestAnimationFrame(animate);
    };

    animationId = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <section className="relative isolate flex min-h-screen w-full items-center justify-center overflow-hidden bg-background">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-6 py-24 text-center md:px-8 lg:px-12">
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full">
          {badge && (
            <motion.div variants={itemVariants}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-foreground/70 backdrop-blur-sm"
            >
              <Sparkles className="h-4 w-4 text-cyan-400" aria-hidden="true" />
              {badge}
            </motion.div>
          )}

          <motion.h1 variants={itemVariants} className="mb-6 text-4xl font-bold tracking-tight text-foreground md:text-6xl lg:text-7xl">
            {title}{" "}
            {titleHighlight && (
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                {titleHighlight}
              </span>
            )}
          </motion.h1>

          <motion.p variants={itemVariants} className="mx-auto mb-10 max-w-3xl text-lg text-foreground/60 md:text-xl">
            {subtitle}
          </motion.p>

          <motion.div variants={itemVariants} className="mb-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            {primaryCta && (
              <Button size="lg" onClick={onPrimaryCta}
                className="group gap-2 rounded-xl px-8 text-base bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 cursor-pointer"
              >
                {primaryCta}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </Button>
            )}
            {secondaryCta && (
              <Button size="lg" variant="outline" onClick={onSecondaryCta}
                className="rounded-xl border-white/10 bg-white/[0.04] px-8 text-base text-foreground/80 backdrop-blur hover:bg-white/[0.08] hover:border-white/20 cursor-pointer"
              >
                {secondaryCta}
              </Button>
            )}
          </motion.div>

          {pills && pills.length > 0 && (
            <motion.ul variants={itemVariants}
              className="mb-12 flex flex-wrap items-center justify-center gap-3 text-xs uppercase tracking-[0.2em] text-foreground/60"
            >
              {pills.map((pill) => (
                <li key={pill} className="rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-2 backdrop-blur">
                  {pill}
                </li>
              ))}
            </motion.ul>
          )}

          {stats && stats.length > 0 && (
            <motion.div variants={statsVariants}
              className="grid gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-sm sm:grid-cols-3"
            >
              {stats.map((stat) => (
                <motion.div key={stat.label} variants={itemVariants} className="space-y-1">
                  <div className="text-xs uppercase tracking-[0.3em] text-foreground/40">{stat.label}</div>
                  <div className="text-3xl font-semibold text-foreground">{stat.value}</div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
