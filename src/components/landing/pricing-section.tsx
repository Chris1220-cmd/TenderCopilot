'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const plans = [
  {
    name: 'Starter',
    desc: 'For small teams getting started',
    monthlyPrice: 49,
    yearlyPrice: 39,
    popular: false,
    features: ['5 tenders per month', 'Document analysis', 'Eligibility check', 'Email support'],
    cta: 'Get started',
  },
  {
    name: 'Professional',
    desc: 'For growing procurement teams',
    monthlyPrice: 99,
    yearlyPrice: 79,
    popular: true,
    features: ['Unlimited tenders', 'AI Assistant', 'Tender discovery', 'Financial analysis', 'Legal review', 'Priority support'],
    cta: 'Get started',
  },
  {
    name: 'Enterprise',
    desc: 'For large organizations',
    monthlyPrice: null,
    yearlyPrice: null,
    popular: false,
    features: ['Everything in Pro', 'Custom integrations', 'Dedicated account manager', 'SLA guarantee', 'SSO & SAML', 'On-premise option'],
    cta: 'Contact sales',
  },
];

export function PricingSection() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section id="pricing" className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-[1100px] px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-12">
          <h2
            className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-[#1a1a2e]"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-[16px] text-[#1a1a2e]/50 max-w-lg mx-auto">
            Start free, upgrade when you need more power
          </p>
        </div>

        {/* Toggle */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <span className={cn('text-[14px] font-medium transition-colors', !isYearly ? 'text-[#1a1a2e]' : 'text-[#1a1a2e]/40')}>
            Monthly
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
            Yearly
          </span>
          {isYearly && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="ml-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12px] font-medium text-emerald-600"
            >
              Save 20%
            </motion.span>
          )}
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, i) => {
            const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
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
                      Most popular
                    </span>
                  </div>
                )}

                <h3 className="text-[16px] font-semibold text-[#1a1a2e]">{plan.name}</h3>
                <p className="mt-1 text-[13px] text-[#1a1a2e]/45">{plan.desc}</p>

                <div className="mt-6 mb-6">
                  {price !== null ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-[40px] font-semibold tracking-[-0.02em] text-[#1a1a2e]" style={{ fontFamily: "'Georgia', serif" }}>
                        &euro;{price}
                      </span>
                      <span className="text-[14px] text-[#1a1a2e]/40">/month</span>
                    </div>
                  ) : (
                    <span className="text-[40px] font-semibold tracking-[-0.02em] text-[#1a1a2e]" style={{ fontFamily: "'Georgia', serif" }}>
                      Custom
                    </span>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className="h-4 w-4 mt-0.5 shrink-0 text-[#6C5CE7]" />
                      <span className="text-[14px] text-[#1a1a2e]/65">{f}</span>
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
                  {plan.cta}
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
