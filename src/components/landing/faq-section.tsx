'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

const faqKeys = [
  { qKey: 'faq.q1', aKey: 'faq.a1' },
  { qKey: 'faq.q2', aKey: 'faq.a2' },
  { qKey: 'faq.q3', aKey: 'faq.a3' },
  { qKey: 'faq.q4', aKey: 'faq.a4' },
  { qKey: 'faq.q5', aKey: 'faq.a5' },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { t } = useTranslation();

  return (
    <section id="faq" className="bg-gradient-to-b from-white to-[#F5FAFE] py-24 sm:py-32">
      <div className="mx-auto max-w-[720px] px-6 lg:px-8">
        <h2
          className="text-center text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-[#1a1a2e] mb-12"
          style={{ fontFamily: "'Georgia', serif" }}
        >
          {t('faq.title')}
        </h2>

        <div className="space-y-0">
          {faqKeys.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={i} className="border-b border-[#E8E0F0]">
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="flex w-full items-center justify-between py-5 text-left cursor-pointer"
                >
                  <span className={cn('text-[15px] font-medium pr-4', isOpen ? 'text-[#1a1a2e]' : 'text-[#1a1a2e]/70')}>
                    {t(faq.qKey)}
                  </span>
                  <span className="shrink-0 text-[#1a1a2e]/30">
                    {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </span>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="pb-5 text-[14px] text-[#1a1a2e]/50 leading-relaxed">
                        {t(faq.aKey)}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
