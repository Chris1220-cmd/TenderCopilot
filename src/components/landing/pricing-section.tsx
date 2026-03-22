'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { CardSpotlight } from '@/components/ui/card-spotlight';
import { BorderBeam } from '@/components/ui/border-beam';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { BlurFade } from '@/components/ui/blur-fade';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const plans = [
  {
    nameKey: 'pricing.starter',
    descKey: 'pricing.starterDesc',
    monthlyPrice: 49,
    yearlyPrice: 39,
    popular: false,
    featureKeys: ['pricing.starterF1', 'pricing.starterF2', 'pricing.starterF3', 'pricing.starterF4'],
    ctaKey: 'pricing.getStarted',
  },
  {
    nameKey: 'pricing.professional',
    descKey: 'pricing.professionalDesc',
    monthlyPrice: 99,
    yearlyPrice: 79,
    popular: true,
    featureKeys: ['pricing.proF1', 'pricing.proF2', 'pricing.proF3', 'pricing.proF4', 'pricing.proF5', 'pricing.proF6'],
    ctaKey: 'pricing.getStarted',
  },
  {
    nameKey: 'pricing.enterprise',
    descKey: 'pricing.enterpriseDesc',
    monthlyPrice: null,
    yearlyPrice: null,
    popular: false,
    featureKeys: ['pricing.entF1', 'pricing.entF2', 'pricing.entF3', 'pricing.entF4', 'pricing.entF5', 'pricing.entF6'],
    ctaKey: 'pricing.contactSales',
  },
];

export function PricingSection() {
  const { t } = useTranslation();
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section id="pricing" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <BlurFade delay={0} inView>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
              {t('pricing.title')}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('pricing.subtitle')}
            </p>
          </div>
        </BlurFade>

        {/* Toggle */}
        <BlurFade delay={0.1} inView>
          <div className="flex items-center justify-center gap-3 mb-12">
            <span className={cn('text-sm transition-colors duration-200', !isYearly ? 'text-foreground' : 'text-muted-foreground')}>
              {t('common.monthly')}
            </span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className="relative h-7 w-12 rounded-full bg-white/[0.06] border border-white/[0.1] transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Toggle billing period"
            >
              <motion.div
                className="absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500"
                animate={{ x: isYearly ? 20 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
            <span className={cn('text-sm transition-colors duration-200', isYearly ? 'text-foreground' : 'text-muted-foreground')}>
              {t('common.yearly')}
            </span>
            {isYearly && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="ml-1 inline-flex items-center rounded-full bg-green-500/10 border border-green-500/20 px-2.5 py-0.5 text-xs font-medium text-green-400"
              >
                {t('common.save20')}
              </motion.span>
            )}
          </div>
        </BlurFade>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => {
            const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
            return (
              <BlurFade key={plan.nameKey} delay={0.15 + i * 0.1} inView>
                <CardSpotlight
                  className={cn(
                    'relative rounded-2xl p-6 transition-all duration-300 h-full',
                    'bg-black/50 border-neutral-800',
                    plan.popular && 'scale-[1.02]'
                  )}
                  radius={300}
                  color="#1a1a2e"
                >
                  {/* Popular badge */}
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-50">
                      <span className="inline-flex items-center rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-3 py-1 text-xs font-semibold text-white shadow-lg">
                        {t('common.popular')}
                      </span>
                    </div>
                  )}

                  {/* Plan name & desc */}
                  <h3 className="relative z-20 text-lg font-semibold text-foreground">
                    {t(plan.nameKey)}
                  </h3>
                  <p className="relative z-20 mt-1 text-sm text-muted-foreground">
                    {t(plan.descKey)}
                  </p>

                  {/* Price */}
                  <div className="relative z-20 mt-6 mb-6">
                    {price !== null ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-foreground">&euro;{price}</span>
                        <span className="text-sm text-muted-foreground">{t('pricing.perMonth')}</span>
                      </div>
                    ) : (
                      <div className="flex items-baseline">
                        <span className="text-4xl font-bold text-foreground">{t('pricing.custom')}</span>
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="relative z-20 space-y-3 mb-8">
                    {plan.featureKeys.map((fKey) => (
                      <li key={fKey} className="flex items-start gap-2">
                        <Check className="h-4 w-4 mt-0.5 shrink-0 text-cyan-400" />
                        <span className="text-sm text-muted-foreground">{t(fKey)}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div className="relative z-20">
                    <Link href={price !== null ? '/register' : '#'} className="block">
                      {plan.popular ? (
                        <ShimmerButton
                          shimmerColor="#06B6D4"
                          background="linear-gradient(135deg, #3B82F6, #06B6D4)"
                          className="w-full px-6 py-3 text-sm font-semibold cursor-pointer"
                          borderRadius="12px"
                        >
                          {t(plan.ctaKey)}
                        </ShimmerButton>
                      ) : (
                        <button className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-medium text-foreground backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.06] hover:border-white/[0.15] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          {t(plan.ctaKey)}
                        </button>
                      )}
                    </Link>
                  </div>

                  {/* BorderBeam on popular card */}
                  {plan.popular && (
                    <BorderBeam
                      size={100}
                      duration={6}
                      colorFrom="#3B82F6"
                      colorTo="#06B6D4"
                      borderWidth={2}
                    />
                  )}
                </CardSpotlight>
              </BlurFade>
            );
          })}
        </div>
      </div>
    </section>
  );
}
