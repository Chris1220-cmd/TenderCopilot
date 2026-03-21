'use client';

import { motion } from 'framer-motion';
import { FileSearch, Shield, DollarSign, Search, Scale, Bot } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { BentoGrid } from '@/components/ui/bento-grid';
import { FeatureCard } from '@/components/ui/feature-card';

const features = [
  { icon: FileSearch, titleKey: 'features.docAnalysis', descKey: 'features.docAnalysisDesc', wide: true },
  { icon: Shield, titleKey: 'features.eligibility', descKey: 'features.eligibilityDesc', wide: false },
  { icon: DollarSign, titleKey: 'features.financial', descKey: 'features.financialDesc', wide: false },
  { icon: Search, titleKey: 'features.discovery', descKey: 'features.discoveryDesc', wide: true },
  { icon: Scale, titleKey: 'features.legal', descKey: 'features.legalDesc', wide: false },
  { icon: Bot, titleKey: 'features.assistant', descKey: 'features.assistantDesc', wide: false },
];

export function FeaturesBento() {
  const { t } = useTranslation();

  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
            {t('features.title')}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('features.subtitle')}
          </p>
        </motion.div>

        {/* Bento Grid */}
        <BentoGrid>
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.titleKey}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className={feature.wide ? 'md:col-span-2' : ''}
              >
                <FeatureCard
                  icon={<Icon className="h-5 w-5" />}
                  title={t(feature.titleKey)}
                  description={t(feature.descKey)}
                  className="h-full"
                />
              </motion.div>
            );
          })}
        </BentoGrid>
      </div>
    </section>
  );
}
