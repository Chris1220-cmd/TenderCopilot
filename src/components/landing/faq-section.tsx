'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

const faqs = [
  {
    q: 'What file formats does TenderCopilot support?',
    a: 'We support PDF, DOCX, XLSX, and most common document formats. Our AI can extract and analyze content from documents of any size, including 100+ page tender packages.',
  },
  {
    q: 'How accurate is the eligibility check?',
    a: 'Our AI achieves 94%+ accuracy on eligibility assessments by cross-referencing tender requirements against your company profile, certifications, and past performance data.',
  },
  {
    q: 'Can I try TenderCopilot for free?',
    a: 'Yes! Our Starter plan includes a free trial period. No credit card required. You can analyze your first tender documents within minutes of signing up.',
  },
  {
    q: 'How does tender discovery work?',
    a: 'We monitor 19+ procurement platforms including government portals, EU TED, and private platforms. Our AI matches new opportunities to your company profile and sends real-time alerts.',
  },
  {
    q: 'Is my data secure?',
    a: 'Absolutely. All data is encrypted at rest and in transit. We are GDPR compliant and offer enterprise-grade security features including SSO, SAML, and on-premise deployment options.',
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="bg-gradient-to-b from-white to-[#F8F6FF] py-24 sm:py-32">
      <div className="mx-auto max-w-[720px] px-6 lg:px-8">
        <h2
          className="text-center text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-[#1a1a2e] mb-12"
          style={{ fontFamily: "'Georgia', serif" }}
        >
          Frequently asked questions
        </h2>

        <div className="space-y-0">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={i} className="border-b border-[#E8E0F0]">
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="flex w-full items-center justify-between py-5 text-left cursor-pointer"
                >
                  <span className={cn('text-[15px] font-medium pr-4', isOpen ? 'text-[#1a1a2e]' : 'text-[#1a1a2e]/70')}>
                    {faq.q}
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
                        {faq.a}
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
