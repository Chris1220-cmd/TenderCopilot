'use client';

import { Play } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { SparklesCore } from '@/components/ui/sparkles';
import { TextGenerateEffect } from '@/components/ui/text-generate-effect';
import { FlipWords } from '@/components/ui/flip-words';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { BorderBeam } from '@/components/ui/border-beam';
import { BlurFade } from '@/components/ui/blur-fade';
import Link from 'next/link';

export function HeroSection() {
  const { t } = useTranslation();

  const flipWords = ['διαγωνισμούς', 'προσφορές', 'συμβάσεις'];

  return (
    <section id="hero" className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* SparklesCore fullpage background */}
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

      {/* Hero background image */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'url(/images/hero-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Gradient glow orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-1/4 left-1/2 -translate-x-1/2 h-[600px] w-[800px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.3), transparent 70%)', filter: 'blur(100px)' }}
        />
        <div
          className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.25), transparent 70%)', filter: 'blur(80px)' }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <BlurFade delay={0} inView>
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-1.5 text-sm font-medium text-cyan-400 backdrop-blur-sm shadow-[0_0_24px_rgba(6,182,212,0.12)]">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            {t('hero.badge')}
          </span>
        </BlurFade>

        {/* Headline with TextGenerateEffect */}
        <BlurFade delay={0.15} inView>
          <div className="mt-8">
            <TextGenerateEffect
              words={t('hero.title')}
              className="text-4xl font-bold tracking-tight md:text-5xl lg:text-7xl"
              duration={0.4}
            />
          </div>
        </BlurFade>

        {/* FlipWords rotating keywords */}
        <BlurFade delay={0.3} inView>
          <div className="mt-4 flex items-center justify-center text-2xl md:text-3xl lg:text-4xl font-semibold text-cyan-400">
            <FlipWords words={flipWords} duration={2500} />
          </div>
        </BlurFade>

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
          <div
            className="absolute inset-0 w-full h-full [mask-image:radial-gradient(350px_200px_at_top,transparent_20%,white)]"
            style={{ backgroundColor: 'hsl(240 6% 4%)' }}
          />
        </div>

        {/* Subtitle */}
        <BlurFade delay={0.45} inView>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto md:text-xl">
            {t('hero.subtitle')}
          </p>
        </BlurFade>

        {/* CTA buttons */}
        <BlurFade delay={0.6} inView>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <ShimmerButton
                shimmerColor="#06B6D4"
                shimmerSize="0.05em"
                background="linear-gradient(135deg, #3B82F6, #06B6D4)"
                className="px-8 py-3.5 text-base font-semibold cursor-pointer"
              >
                {t('common.tryFree')}
              </ShimmerButton>
            </Link>
            <button className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-medium text-foreground backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.06] hover:border-white/[0.15] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Play className="h-4 w-4" />
              {t('common.watchDemo')}
            </button>
          </div>
        </BlurFade>

        {/* Trust line */}
        <BlurFade delay={0.75} inView>
          <p className="mt-6 text-sm text-muted-foreground/60">
            {t('common.noCard')}
          </p>
        </BlurFade>

        {/* Dashboard mockup with BorderBeam */}
        <BlurFade delay={0.9} inView>
          <div className="mt-16 relative max-w-4xl mx-auto">
            <div className="relative rounded-xl overflow-hidden shadow-2xl shadow-blue-500/10 border border-white/[0.06]">
              <img
                src="/images/dashboard-mockup.png"
                alt="TenderCopilot Dashboard"
                className="w-full h-auto"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
              <BorderBeam
                size={120}
                duration={8}
                colorFrom="#3B82F6"
                colorTo="#06B6D4"
                borderWidth={2}
              />
            </div>
          </div>
        </BlurFade>
      </div>
    </section>
  );
}
