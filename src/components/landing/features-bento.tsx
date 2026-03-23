'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';

const featureKeys = [
  {
    id: 'analysis',
    labelKey: 'features.docAnalysis',
    headingKey: 'features.docAnalysisHeading',
    descKey: 'features.docAnalysisDesc',
    bulletKeys: [
      'features.docAnalysisBullet1',
      'features.docAnalysisBullet2',
      'features.docAnalysisBullet3',
      'features.docAnalysisBullet4',
    ],
    learnMore: '/register',
    ctaKey: 'features.docAnalysisCta',
    gradient: 'from-[#F0E6FF] via-[#E8D4FF] to-[#DFC4FF]',
  },
  {
    id: 'eligibility',
    labelKey: 'features.eligibility',
    headingKey: 'features.eligibilityHeading',
    descKey: 'features.eligibilityDesc',
    bulletKeys: [
      'features.eligibilityBullet1',
      'features.eligibilityBullet2',
      'features.eligibilityBullet3',
      'features.eligibilityBullet4',
    ],
    learnMore: '/register',
    ctaKey: 'features.eligibilityCta',
    gradient: 'from-[#FFF0E6] via-[#FFE4D4] to-[#FFD8C4]',
  },
  {
    id: 'discovery',
    labelKey: 'features.discovery',
    headingKey: 'features.discoveryHeading',
    descKey: 'features.discoveryDesc',
    bulletKeys: [
      'features.discoveryBullet1',
      'features.discoveryBullet2',
      'features.discoveryBullet3',
      'features.discoveryBullet4',
    ],
    learnMore: '/register',
    ctaKey: 'features.discoveryCta',
    gradient: 'from-[#E6F0FF] via-[#D4E4FF] to-[#C4D8FF]',
  },
  {
    id: 'assistant',
    labelKey: 'features.assistant',
    headingKey: 'features.assistantHeading',
    descKey: 'features.assistantDesc',
    bulletKeys: [
      'features.assistantBullet1',
      'features.assistantBullet2',
      'features.assistantBullet3',
      'features.assistantBullet4',
    ],
    learnMore: '/register',
    ctaKey: 'features.assistantCta',
    gradient: 'from-[#E6FFF0] via-[#D4FFE4] to-[#C4FFD8]',
  },
];

export function FeaturesBento() {
  const [active, setActive] = useState(0);
  const { t } = useTranslation();
  const current = featureKeys[active];

  return (
    <section id="features" className="relative bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        {/* Section header */}
        <div className="flex items-end justify-between mb-12">
          <h2
            className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-[#1a1a2e]"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            {t('features.title')}
          </h2>
          <Link
            href="/register"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#1a1a2e]/15 px-5 py-2.5 text-[14px] font-medium text-[#1a1a2e] hover:bg-[#1a1a2e]/[0.03] transition-colors cursor-pointer"
          >
            {t('features.getStarted')}
          </Link>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-[#E8E0F0]">
          {featureKeys.map((feature, i) => (
            <button
              key={feature.id}
              onClick={() => setActive(i)}
              className={`relative flex-1 py-4 text-[14px] sm:text-[15px] font-medium transition-colors cursor-pointer ${
                i === active ? 'text-[#1a1a2e]' : 'text-[#1a1a2e]/40 hover:text-[#1a1a2e]/60'
              }`}
            >
              {t(feature.labelKey)}
              {i === active && (
                <motion.div
                  layoutId="feature-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#1a1a2e]"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-12 pt-12"
          >
            {/* Left — text content */}
            <div className="flex flex-col justify-center">
              <h3
                className="text-2xl sm:text-3xl font-semibold tracking-[-0.02em] text-[#1a1a2e] leading-tight"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                {t(current.headingKey)}
              </h3>
              <p className="mt-4 text-[15px] text-[#1a1a2e]/55 leading-relaxed">
                {t(current.descKey)}
              </p>
              <Link
                href={current.learnMore}
                className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium text-[#6C5CE7] hover:text-[#5B4BD6] transition-colors cursor-pointer"
              >
                {t(current.ctaKey)}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <ul className="mt-8 space-y-3.5">
                {current.bulletKeys.map((bulletKey, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.1, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                    className="flex items-start gap-3 text-[14px] text-[#1a1a2e]/70"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#1a1a2e]/25 shrink-0" />
                    {t(bulletKey)}
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* Right — gradient visual placeholder */}
            <div className={`rounded-2xl bg-gradient-to-br ${current.gradient} min-h-[360px] flex items-center justify-center overflow-hidden`}>
              <div className="w-[85%] rounded-xl bg-white/70 backdrop-blur-sm shadow-xl shadow-black/5 border border-white/80 p-1 overflow-hidden">
                <img
                  src="/images/dashboard-mockup.png"
                  alt={t(current.headingKey)}
                  className="w-full h-auto rounded-lg"
                />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
