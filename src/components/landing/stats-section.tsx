'use client';

import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';
import { StatCard } from '@/components/ui/stat-card';

const stats = [
  { value: '500+', labelKey: 'stats.docs' },
  { value: '68%', labelKey: 'stats.winRate' },
  { value: '90%', labelKey: 'stats.timeSaved' },
];

export function StatsSection() {
  const { t } = useTranslation();

  return (
    <section id="stats" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/[0.06]"
        >
          {stats.map((stat) => (
            <StatCard
              key={stat.labelKey}
              value={stat.value}
              label={t(stat.labelKey)}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
