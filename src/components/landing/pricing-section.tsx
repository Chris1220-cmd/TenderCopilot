'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';
import { PricingCard } from '@/components/ui/pricing-card';
import { cn } from '@/lib/utils';

export function PricingSection() {
  const { t } = useTranslation();
  const [yearly, setYearly] = useState(false);

  const plans = [
    {
      name: t('pricing.starter'),
      price: yearly ? '\u20AC39' : '\u20AC49',
      period: yearly ? t('common.monthly') : t('common.monthly'),
      features: [
        '5 active tenders',
        'AI document analysis',
        'Eligibility check',
        'Email support',
      ],
      popular: false,
      cta: t('common.tryFree'),
    },
    {
      name: t('pricing.professional'),
      price: yearly ? '\u20AC79' : '\u20AC99',
      period: yearly ? t('common.monthly') : t('common.monthly'),
      features: [
        '25 active tenders',
        'AI document analysis',
        'Eligibility check',
        'Pricing strategy',
        'AI Co-pilot',
        'Tender discovery',
        'Priority support',
      ],
      popular: true,
      cta: t('common.tryFree'),
    },
    {
      name: t('pricing.enterprise'),
      price: 'Custom',
      period: '',
      features: [
        'Unlimited tenders',
        'All Professional features',
        'Custom integrations',
        'Dedicated account manager',
        'SLA guarantee',
        'On-premise option',
      ],
      popular: false,
      cta: t('common.contactUs'),
    },
  ];

  return (
    <section id="pricing" className="relative py-24 sm:py-32">
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
            {t('pricing.title')}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t('pricing.subtitle')}
          </p>

          {/* Monthly/Yearly toggle */}
          <div className="mt-8 inline-flex items-center gap-3">
            <span className={cn('text-sm', !yearly ? 'text-foreground' : 'text-muted-foreground')}>
              {t('common.monthly')}
            </span>
            <button
              onClick={() => setYearly(!yearly)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 cursor-pointer',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                yearly ? 'bg-primary' : 'bg-white/[0.1]'
              )}
              role="switch"
              aria-checked={yearly}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white transition-transform duration-200',
                  yearly ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
            <span className={cn('text-sm', yearly ? 'text-foreground' : 'text-muted-foreground')}>
              {t('common.yearly')}
            </span>
            {yearly && (
              <span className="rounded-full bg-green-500/10 border border-green-500/20 px-2.5 py-0.5 text-xs text-green-400">
                {t('common.save20')}
              </span>
            )}
          </div>
        </motion.div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <PricingCard
                name={plan.name}
                price={plan.price}
                period={plan.period}
                features={plan.features}
                popular={plan.popular}
                cta={plan.cta}
                className="h-full"
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
