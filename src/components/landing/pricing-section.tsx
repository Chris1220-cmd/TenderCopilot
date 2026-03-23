'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';

export function PricingSection() {
  const [isYearly, setIsYearly] = useState(false);
  const { t } = useTranslation();

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

  return (
    <section id="pricing" className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-[1100px] px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-12">
          <h2
            className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-[#1a1a2e]"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            {t('pricing.title')}
          </h2>
          <p className="mt-4 text-[16px] text-[#1a1a2e]/50 max-w-lg mx-auto">
            {t('pricing.subtitle')}
          </p>
        </div>

        {/* Toggle */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <span className={cn('text-[14px] font-medium transition-colors', !isYearly ? 'text-[#1a1a2e]' : 'text-[#1a1a2e]/40')}>
            {t('common.monthly')}
          </span>
          <button
            onClick={() => setIsYearly(!isYearly)}
            className={cn(
              'relative h-7 w-12 rounded-full transition-colors duration-200 cursor-pointer',
              isYearly ? 'bg-[#6C5CE7]' : 'bg-[#1a1a2e]/10'
            )}
          >
            <motion.div
              className="absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-sm"
              animate={{ x: isYearly ? 20 : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
          <span className={cn('text-[14px] font-medium transition-colors', isYearly ? 'text-[#1a1a2e]' : 'text-[#1a1a2e]/40')}>
            {t('common.yearly')}
          </span>
          {isYearly && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="ml-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12px] font-medium text-emerald-600"
            >
              {t('common.save20')}
            </motion.span>
          )}
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, i) => {
            const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
            return (
              <motion.div
                key={t(plan.nameKey)}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 + i * 0.15, duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
                className={cn(
                  'relative rounded-2xl border p-7 transition-shadow hover:shadow-lg hover:shadow-purple-500/5',
                  plan.popular
                    ? 'border-[#6C5CE7]/30 bg-gradient-to-b from-[#F8F6FF] to-white shadow-lg shadow-purple-500/5'
                    : 'border-[#E8E0F0] bg-white'
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-[#6C5CE7] px-3.5 py-1 text-[12px] font-semibold text-white">
                      {t('pricing.mostPopular')}
                    </span>
                  </div>
                )}

                <h3 className="text-[16px] font-semibold text-[#1a1a2e]">{t(plan.nameKey)}</h3>
                <p className="mt-1 text-[13px] text-[#1a1a2e]/45">{t(plan.descKey)}</p>

                <div className="mt-6 mb-6">
                  {price !== null ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-[40px] font-semibold tracking-[-0.02em] text-[#1a1a2e]" style={{ fontFamily: "'Georgia', serif" }}>
                        &euro;{price}
                      </span>
                      <span className="text-[14px] text-[#1a1a2e]/40">{t('pricing.perMonth')}</span>
                    </div>
                  ) : (
                    <span className="text-[40px] font-semibold tracking-[-0.02em] text-[#1a1a2e]" style={{ fontFamily: "'Georgia', serif" }}>
                      {t('pricing.custom')}
                    </span>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.featureKeys.map((fKey) => (
                    <li key={fKey} className="flex items-start gap-2.5">
                      <Check className="h-4 w-4 mt-0.5 shrink-0 text-[#6C5CE7]" />
                      <span className="text-[14px] text-[#1a1a2e]/65">{t(fKey)}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={price !== null ? '/register' : '#'}
                  className={cn(
                    'block w-full rounded-full py-3 text-center text-[14px] font-medium transition-colors cursor-pointer',
                    plan.popular
                      ? 'bg-[#1a1a2e] text-white hover:bg-[#2a2a3e]'
                      : 'border border-[#1a1a2e]/15 text-[#1a1a2e] hover:bg-[#1a1a2e]/[0.03]'
                  )}
                >
                  {t(plan.ctaKey)}
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
