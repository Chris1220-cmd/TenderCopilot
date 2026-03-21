'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { GlowButton } from '@/components/ui/glow-button';
import { GlassInput } from '@/components/ui/glass-input';

const footerLinks = {
  product: ['Features', 'Pricing', 'Integrations', 'Changelog'],
  resources: ['Documentation', 'API Reference', 'Blog', 'Support'],
  company: ['About', 'Careers', 'Contact', 'Partners'],
  legal: ['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'GDPR'],
};

export function CtaFooter() {
  const { t } = useTranslation();

  return (
    <>
      {/* CTA Section */}
      <section className="relative py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.03] to-transparent" />
        <div className="relative mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
              {t('cta.title')}
            </h2>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <GlassInput
                type="email"
                placeholder={t('cta.placeholder')}
                className="flex-1"
              />
              <GlowButton size="lg">{t('common.tryFree')}</GlowButton>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {t('cta.trial')}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-white/[0.01]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-4">
                {t('footer.product')}
              </h3>
              <ul className="space-y-3">
                {footerLinks.product.map((link) => (
                  <li key={link}>
                    <Link
                      href="#"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer"
                    >
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-4">
                {t('footer.resources')}
              </h3>
              <ul className="space-y-3">
                {footerLinks.resources.map((link) => (
                  <li key={link}>
                    <Link
                      href="#"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer"
                    >
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-4">
                {t('footer.company')}
              </h3>
              <ul className="space-y-3">
                {footerLinks.company.map((link) => (
                  <li key={link}>
                    <Link
                      href="#"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer"
                    >
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-4">
                {t('footer.legal')}
              </h3>
              <ul className="space-y-3">
                {footerLinks.legal.map((link) => (
                  <li key={link}>
                    <Link
                      href="#"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer"
                    >
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom row */}
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-white/[0.06]">
            <p className="text-sm text-muted-foreground">
              &copy; 2026 TenderCopilot
            </p>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-400 glow-cyan">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              {t('footer.poweredByAI')}
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
