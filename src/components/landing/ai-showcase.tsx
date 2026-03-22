'use client';

import { Shield } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { Spotlight } from '@/components/ui/spotlight';
import { ShineBorder } from '@/components/ui/shine-border';
import { BlurFade } from '@/components/ui/blur-fade';

export function AiShowcase() {
  const { t } = useTranslation();

  return (
    <section id="ai-showcase" className="relative py-24 sm:py-32 overflow-hidden">
      {/* Spotlight effect */}
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20"
        fill="#3B82F6"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          {/* AI Chat Mockup Image with ShineBorder */}
          <BlurFade delay={0} inView direction="right">
            <div className="relative rounded-2xl overflow-hidden">
              <div className="relative rounded-2xl border border-white/[0.08] shadow-2xl shadow-blue-500/10">
                <img
                  src="/images/ai-chat-mockup.png"
                  alt="TenderCopilot AI Analysis - Eligibility Assessment showing 8/9 criteria met with 94% confidence"
                  className="w-full h-auto rounded-2xl"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent rounded-2xl" />
                <ShineBorder
                  shineColor={['#3B82F6', '#06B6D4', '#8B5CF6']}
                  borderWidth={2}
                  duration={10}
                />
              </div>
              {/* Glow effect behind image */}
              <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-blue-500/5 via-cyan-500/5 to-transparent blur-2xl" />
            </div>
          </BlurFade>

          {/* Text content */}
          <div>
            <BlurFade delay={0.1} inView direction="left">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400 mb-6">
                AI-Powered Analysis
              </span>
            </BlurFade>

            <BlurFade delay={0.2} inView direction="left">
              <h2 className="text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl tracking-tight">
                {t('aiShowcase.title')}
              </h2>
            </BlurFade>

            <BlurFade delay={0.3} inView direction="left">
              <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
                {t('aiShowcase.description')}
              </p>
            </BlurFade>

            {/* Key features list */}
            <ul className="mt-8 space-y-4">
              {[
                { label: '8/9 Criteria Check', desc: 'Instant eligibility assessment' },
                { label: '94% Confidence', desc: 'Source-backed answers' },
                { label: 'Real-time Analysis', desc: 'Process documents in seconds' },
              ].map((item, i) => (
                <BlurFade key={i} delay={0.4 + i * 0.1} inView direction="left">
                  <li className="flex items-start gap-3">
                    <div className="mt-1 h-5 w-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                      <span className="text-sm text-muted-foreground ml-2">{item.desc}</span>
                    </div>
                  </li>
                </BlurFade>
              ))}
            </ul>

            <BlurFade delay={0.7} inView direction="left">
              <div className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3">
                <Shield className="h-5 w-5 text-cyan-400" />
                <span className="text-sm text-muted-foreground">
                  {t('aiShowcase.trust')}
                </span>
              </div>
            </BlurFade>
          </div>
        </div>
      </div>
    </section>
  );
}
