'use client';

import { useTranslation } from '@/lib/i18n';
import { NumberTicker } from '@/components/ui/number-ticker';
import { Ripple } from '@/components/ui/ripple';
import { BlurFade } from '@/components/ui/blur-fade';

const stats = [
  { number: 500, suffix: '+', labelKey: 'stats.docs' },
  { number: 68, suffix: '%', labelKey: 'stats.winRate' },
  { number: 90, suffix: '%', labelKey: 'stats.timeSaved' },
];

export function StatsSection() {
  const { t } = useTranslation();

  return (
    <section id="stats" className="relative py-24 sm:py-32 overflow-hidden">
      {/* Ripple background effect */}
      <Ripple
        mainCircleSize={180}
        mainCircleOpacity={0.08}
        numCircles={6}
        className="opacity-30"
      />

      <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <BlurFade delay={0} inView>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-8 sm:p-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0">
              {stats.map((stat, i) => (
                <div
                  key={stat.labelKey}
                  className={`flex flex-col items-center justify-center text-center ${
                    i < stats.length - 1 ? 'md:border-r md:border-white/[0.06]' : ''
                  }`}
                >
                  <div className="flex items-baseline gap-0.5">
                    <NumberTicker
                      value={stat.number}
                      delay={0.3 + i * 0.2}
                      className="text-4xl sm:text-5xl font-bold text-foreground tabular-nums"
                    />
                    <span className="text-4xl sm:text-5xl font-bold text-foreground">
                      {stat.suffix}
                    </span>
                  </div>
                  <span className="mt-2 text-sm text-muted-foreground">
                    {t(stat.labelKey)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </BlurFade>
      </div>
    </section>
  );
}
