'use client';

import { motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';

export function AiShowcase() {
  const { t } = useTranslation();

  return (
    <section className="relative bg-gradient-to-b from-white to-[#F5FAFE] py-24 sm:py-32 overflow-hidden">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left — Image */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.0, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative"
          >
            <div className="rounded-2xl overflow-hidden">
              <Image
                src="/images/ai-chat-mockup.png"
                alt={t('aiShowcase.title')}
                width={600}
                height={400}
                className="w-full h-auto rounded-2xl"
              />
            </div>
          </motion.div>

          {/* Right — Text */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.0, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <h2
              className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-[#1a1a2e] leading-tight"
              style={{ fontFamily: "'Georgia', serif" }}
            >
              {t('aiShowcase.title')}{' '}
              <span className="italic">{t('aiShowcase.titleEmphasis')}</span>
            </h2>
            <p className="mt-6 text-[16px] text-[#1a1a2e]/55 leading-relaxed">
              {t('aiShowcase.description')}
            </p>
            <Link
              href="/register"
              className="mt-8 inline-flex items-center gap-2 text-[14px] font-medium text-[#48A4D6] hover:text-[#3B8EBF] transition-colors cursor-pointer"
            >
              {t('aiShowcase.cta')}
              <span className="text-[12px]">&rarr;</span>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
