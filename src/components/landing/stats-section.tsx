'use client';

import { motion } from 'motion/react';
import { useTranslation } from '@/lib/i18n';

const stats = [
  { valueKey: 'stats.platformsValue', labelKey: 'stats.platformsLabel' },
  { valueKey: 'stats.accuracyValue', labelKey: 'stats.accuracyLabel' },
  { valueKey: 'stats.fasterValue', labelKey: 'stats.fasterLabel' },
  { valueKey: 'stats.formatsValue', labelKey: 'stats.formatsLabel' },
];

export function StatsSection() {
  const { t } = useTranslation();

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-8"
        >
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.1, duration: 0.5 }}
              className="text-center"
            >
              <div
                className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-[#1a1a2e]"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                {t(stat.valueKey)}
              </div>
              <div className="mt-1 text-[13px] text-[#1a1a2e]/40 font-medium">
                {t(stat.labelKey)}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
