'use client';

import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';
import { CountAnimation } from '@/components/ui/count-animation';

const stats = [
  { number: 500, suffix: '+', labelKey: 'stats.docs' },
  { number: 68, suffix: '%', labelKey: 'stats.winRate' },
  { number: 90, suffix: '%', labelKey: 'stats.timeSaved' },
];

export function StatsSection() {
  const { t } = useTranslation();

  return (
    <section id="stats" className="relative py-24 sm:py-32">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.01] to-transparent" />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm p-8 sm:p-12"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0">
            {stats.map((stat, i) => (
              <div
                key={stat.labelKey}
                className={`flex flex-col items-center justify-center text-center ${
                  i < stats.length - 1 ? 'md:border-r md:border-white/[0.06]' : ''
                }`}
              >
                <CountAnimation
                  number={stat.number}
                  suffix={stat.suffix}
                  className="text-4xl sm:text-5xl font-bold text-foreground tabular-nums"
                />
                <span className="mt-2 text-sm text-muted-foreground">
                  {t(stat.labelKey)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
