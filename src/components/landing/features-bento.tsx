'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const features = [
  {
    iconSrc: '/images/icons/icon-doc-analysis.png',
    titleKey: 'features.docAnalysis',
    descKey: 'features.docAnalysisDesc',
    colSpan: 'md:col-span-4',
    meta: 'PDF, DOCX, XLSX',
  },
  {
    iconSrc: '/images/icons/icon-eligibility.png',
    titleKey: 'features.eligibility',
    descKey: 'features.eligibilityDesc',
    colSpan: 'md:col-span-2',
  },
  {
    iconSrc: '/images/icons/icon-financial.png',
    titleKey: 'features.financial',
    descKey: 'features.financialDesc',
    colSpan: 'md:col-span-2',
  },
  {
    iconSrc: '/images/icons/icon-discovery.png',
    titleKey: 'features.discovery',
    descKey: 'features.discoveryDesc',
    colSpan: 'md:col-span-4',
    meta: '19+ sources',
  },
  {
    iconSrc: '/images/icons/icon-legal.png',
    titleKey: 'features.legal',
    descKey: 'features.legalDesc',
    colSpan: 'md:col-span-3',
  },
  {
    iconSrc: '/images/icons/icon-ai-assistant.png',
    titleKey: 'features.assistant',
    descKey: 'features.assistantDesc',
    colSpan: 'md:col-span-3',
  },
];

export function FeaturesBento() {
  const { t } = useTranslation();
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-index'));
            setVisibleItems((prev) => new Set(prev).add(idx));
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '-50px' }
    );

    const cards = containerRef.current?.querySelectorAll('[data-index]');
    cards?.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

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
        <div ref={containerRef} className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {features.map((feature, i) => {
            const isVisible = visibleItems.has(i);
            return (
              <div
                key={feature.titleKey}
                data-index={i}
                className={cn(feature.colSpan)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={isVisible ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  className={cn(
                    'group relative h-full rounded-2xl p-6',
                    'bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm',
                    'transition-all duration-300 ease-out',
                    'hover:-translate-y-1 hover:bg-white/[0.05] hover:border-white/[0.1]'
                  )}
                >
                  {/* Icon */}
                  <div className="h-16 w-16 mb-4">
                    <img src={feature.iconSrc} alt="" className="w-full h-full object-contain" aria-hidden="true" />
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-semibold text-foreground mb-2">
                    {t(feature.titleKey)}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t(feature.descKey)}
                  </p>

                  {/* Meta badge */}
                  {feature.meta && (
                    <div className="mt-4">
                      <span className="inline-flex items-center rounded-full bg-white/[0.04] border border-white/[0.08] px-2.5 py-0.5 text-xs text-muted-foreground">
                        {feature.meta}
                      </span>
                    </div>
                  )}
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
