'use client';

import { useTranslation } from '@/lib/i18n';
import { BentoGrid } from '@/components/ui/bento-grid';
import { MagicCard } from '@/components/ui/magic-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { cn } from '@/lib/utils';

const features = [
  {
    iconSrc: '/images/icons/icon-doc-analysis.png',
    titleKey: 'features.docAnalysis',
    descKey: 'features.docAnalysisDesc',
    colSpan: 'md:col-span-2',
    meta: 'PDF, DOCX, XLSX',
  },
  {
    iconSrc: '/images/icons/icon-eligibility.png',
    titleKey: 'features.eligibility',
    descKey: 'features.eligibilityDesc',
    colSpan: '',
  },
  {
    iconSrc: '/images/icons/icon-financial.png',
    titleKey: 'features.financial',
    descKey: 'features.financialDesc',
    colSpan: '',
  },
  {
    iconSrc: '/images/icons/icon-discovery.png',
    titleKey: 'features.discovery',
    descKey: 'features.discoveryDesc',
    colSpan: 'md:col-span-2',
    meta: '19+ sources',
  },
  {
    iconSrc: '/images/icons/icon-legal.png',
    titleKey: 'features.legal',
    descKey: 'features.legalDesc',
    colSpan: '',
  },
  {
    iconSrc: '/images/icons/icon-ai-assistant.png',
    titleKey: 'features.assistant',
    descKey: 'features.assistantDesc',
    colSpan: '',
  },
];

export function FeaturesBento() {
  const { t } = useTranslation();

  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <BlurFade delay={0} inView>
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
              {t('features.title')}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('features.subtitle')}
            </p>
          </div>
        </BlurFade>

        {/* Bento Grid */}
        <BentoGrid className="grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((feature, i) => (
            <BlurFade
              key={feature.titleKey}
              delay={0.1 + i * 0.08}
              inView
              className={cn(feature.colSpan)}
            >
              <MagicCard
                className="h-full rounded-2xl border-white/[0.06]"
                gradientSize={250}
                gradientColor="#1a1a2e"
                gradientFrom="#3B82F6"
                gradientTo="#06B6D4"
              >
                <div className="p-6">
                  {/* Icon */}
                  <div className="h-16 w-16 mb-4">
                    <img
                      src={feature.iconSrc}
                      alt=""
                      className="w-full h-full object-contain"
                      aria-hidden="true"
                    />
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
                </div>
              </MagicCard>
            </BlurFade>
          ))}
        </BentoGrid>
      </div>
    </section>
  );
}
