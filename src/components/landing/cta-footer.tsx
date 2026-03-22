'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { Meteors } from '@/components/ui/meteors';
import { BlurFade } from '@/components/ui/blur-fade';
import { GlassInput } from '@/components/ui/glass-input';
import { InfiniteSlider } from '@/components/ui/infinite-slider';

const footerLinks = {
  product: ['Features', 'Pricing', 'Integrations', 'Changelog'],
  resources: ['Documentation', 'API Reference', 'Blog', 'Support'],
  company: ['About', 'Careers', 'Contact', 'Partners'],
  legal: ['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'GDPR'],
};

const trustLogos = [
  'ΕΣΗΔΗΣ',
  'Promitheus',
  'Διαύγεια',
  'ΚΗΜΔΗΣ',
  'TED Europa',
  'e-Procurement',
  'SAM.gov',
  'OpenTender',
];

export function CtaFooter() {
  const { t } = useTranslation();

  return (
    <>
      {/* CTA Section with Meteors */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.03] to-transparent" />

        {/* Meteors background */}
        <Meteors number={15} />

        <div className="relative z-10 mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 text-center">
          <BlurFade delay={0} inView>
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
              {t('cta.title')}
            </h2>
          </BlurFade>

          <BlurFade delay={0.15} inView>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <GlassInput
                type="email"
                placeholder={t('cta.placeholder')}
                className="flex-1"
              />
              <ShimmerButton
                shimmerColor="#06B6D4"
                background="linear-gradient(135deg, #3B82F6, #06B6D4)"
                className="px-6 py-3 text-sm font-semibold cursor-pointer whitespace-nowrap"
                borderRadius="12px"
              >
                {t('common.tryFree')}
              </ShimmerButton>
            </div>
          </BlurFade>

          <BlurFade delay={0.3} inView>
            <p className="mt-4 text-sm text-muted-foreground">
              {t('cta.trial')}
            </p>
          </BlurFade>
        </div>
      </section>

      {/* Trust bar - InfiniteSlider */}
      <div className="relative py-12 border-t border-white/[0.04]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-muted-foreground/50 mb-6 uppercase tracking-widest">
            {t('hero.trustedBy')}
          </p>
          <div className="relative">
            {/* Fade edges */}
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-background to-transparent" />
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-background to-transparent" />

            <InfiniteSlider gap={24} speed={30} speedOnHover={60}>
              {trustLogos.map((logo) => (
                <div
                  key={logo}
                  className="inline-flex items-center rounded-full bg-white/[0.03] border border-white/[0.06] px-5 py-2 text-sm text-muted-foreground/70 whitespace-nowrap select-none"
                >
                  {logo}
                </div>
              ))}
            </InfiniteSlider>
          </div>
        </div>
      </div>

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
