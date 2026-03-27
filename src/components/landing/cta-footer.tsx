'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export function CtaFooter() {
  const { t } = useTranslation();

  const productLinks = [
    { key: 'footer.docAnalysis', href: '/#features' },
    { key: 'footer.eligibilityCheck', href: '/#features' },
    { key: 'footer.tenderDiscovery', href: '/#features' },
    { key: 'footer.aiAssistant', href: '/#features' },
  ];

  const companyLinks = [
    { key: 'footer.about', href: '/' },
    { key: 'footer.pricing', href: '/#pricing' },
    { key: 'footer.contact', href: 'mailto:info@tendercopilot.com' },
    { key: 'footer.blog', href: '/' },
  ];

  const legalLinks = [
    { key: 'footer.terms', href: '/' },
    { key: 'footer.privacyPolicy', href: '/' },
    { key: 'footer.gdpr', href: '/' },
    { key: 'footer.security', href: '/' },
  ];

  return (
    <>
      {/* CTA Section */}
      <section className="relative bg-gradient-to-b from-[#F5FAFE] via-[#E0F0FA] to-[#D0E8F5] py-24 sm:py-32 overflow-hidden">
        {/* Subtle radial glow */}
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background: 'radial-gradient(ellipse at center bottom, rgba(108,92,231,0.2), transparent 60%)',
          }}
        />

        <div className="relative z-10 mx-auto max-w-[800px] px-6 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.0, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-[-0.03em] text-[#1a1a2e] leading-[1.1]"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            {t('cta.title')}
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.0, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="mt-10"
          >
            <Link
              href="/register"
              className="group inline-flex items-center gap-3 rounded-full border border-[#1a1a2e]/15 bg-white/80 backdrop-blur-sm px-7 py-4 text-[15px] font-medium text-[#1a1a2e] transition-all hover:bg-white hover:shadow-lg cursor-pointer"
            >
              {t('cta.button')}
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a2e]/10 transition-colors group-hover:bg-[#1a1a2e]/15">
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1a1a2e] py-16">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white" opacity="0.9"/>
                    <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-[14px] font-semibold text-white/90 uppercase tracking-wide">TenderCopilot</span>
              </div>
              <p className="text-[13px] text-white/40 leading-relaxed">
                {t('footer.description')}
              </p>
            </div>

            {/* Products */}
            <div>
              <h3 className="text-[13px] font-semibold text-white/60 mb-4">{t('footer.product')}</h3>
              <ul className="space-y-2.5">
                {productLinks.map((item) => (
                  <li key={item.key}>
                    <Link href={item.href} className="text-[13px] text-white/35 hover:text-white/60 transition-colors">{t(item.key)}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-[13px] font-semibold text-white/60 mb-4">{t('footer.company')}</h3>
              <ul className="space-y-2.5">
                {companyLinks.map((item) => (
                  <li key={item.key}>
                    <Link href={item.href} className="text-[13px] text-white/35 hover:text-white/60 transition-colors">{t(item.key)}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="text-[13px] font-semibold text-white/60 mb-4">{t('footer.legal')}</h3>
              <ul className="space-y-2.5">
                {legalLinks.map((item) => (
                  <li key={item.key}>
                    <Link href={item.href} className="text-[13px] text-white/35 hover:text-white/60 transition-colors">{t(item.key)}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
