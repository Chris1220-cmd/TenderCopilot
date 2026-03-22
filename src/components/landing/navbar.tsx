'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'motion/react';
import { Menu, X, Layers, CreditCard, HelpCircle } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { cn } from '@/lib/utils';

const navLinks = [
  { key: 'nav.features', href: '#features', icon: <Layers className="h-4 w-4" /> },
  { key: 'nav.pricing', href: '#pricing', icon: <CreditCard className="h-4 w-4" /> },
  { key: 'nav.faq', href: '#faq', icon: <HelpCircle className="h-4 w-4" /> },
];

export function Navbar() {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollYProgress } = useScroll();
  const [visible, setVisible] = useState(false);

  useMotionValueEvent(scrollYProgress, 'change', (current) => {
    if (typeof current === 'number') {
      const direction = current - (scrollYProgress.getPrevious() ?? 0);
      if (scrollYProgress.get() < 0.05) {
        setVisible(false);
      } else {
        setVisible(direction < 0);
      }
    }
  });

  const handleNavClick = (href: string) => {
    setMobileOpen(false);
    const id = href.replace('#', '');
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      {/* Static top navbar (visible at top of page) */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-transparent">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 cursor-pointer">
            <img src="/images/logo-icon.png" alt="TenderCopilot" className="h-8 w-8 rounded-lg" />
            <span className="text-lg font-semibold text-foreground">
              TenderCopilot
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <button
                key={link.key}
                onClick={() => handleNavClick(link.href)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer"
              >
                {t(link.key)}
              </button>
            ))}
          </div>

          {/* Desktop right side */}
          <div className="hidden md:flex items-center gap-3">
            <LanguageToggle />
            <Link href="/login">
              <button className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {t('common.login')}
              </button>
            </Link>
            <Link href="/register">
              <ShimmerButton
                shimmerColor="#06B6D4"
                background="linear-gradient(135deg, #3B82F6, #06B6D4)"
                className="px-5 py-2 text-sm font-medium cursor-pointer"
                borderRadius="9999px"
              >
                {t('common.tryFree')}
              </ShimmerButton>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-foreground cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>

        {/* Mobile slide-out */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border"
            >
              <div className="flex flex-col gap-4 px-4 py-6">
                {navLinks.map((link) => (
                  <button
                    key={link.key}
                    onClick={() => handleNavClick(link.href)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 text-left cursor-pointer"
                  >
                    {t(link.key)}
                  </button>
                ))}
                <div className="flex items-center gap-3 pt-4 border-t border-border">
                  <LanguageToggle />
                  <Link href="/login" className="flex-1">
                    <button className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-foreground cursor-pointer">
                      {t('common.login')}
                    </button>
                  </Link>
                  <Link href="/register" className="flex-1">
                    <ShimmerButton
                      shimmerColor="#06B6D4"
                      background="linear-gradient(135deg, #3B82F6, #06B6D4)"
                      className="w-full px-4 py-2 text-sm font-medium cursor-pointer"
                      borderRadius="8px"
                    >
                      {t('common.tryFree')}
                    </ShimmerButton>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* FloatingNav (appears on scroll-up after scrolling down) */}
      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 1, y: -100 }}
          animate={{ y: visible ? 0 : -100, opacity: visible ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex max-w-fit fixed top-6 inset-x-0 mx-auto z-[5000] items-center justify-center"
        >
          <div className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/50 px-2 py-1.5 shadow-lg shadow-black/10 backdrop-blur-md">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-1.5 pl-2 cursor-pointer">
              <img src="/images/logo-icon.png" alt="" className="h-6 w-6 rounded" />
              <span className="text-sm font-semibold text-white hidden sm:block">TC</span>
            </Link>

            <div className="h-5 w-px bg-white/10" />

            {/* Nav items */}
            <div className="flex items-center gap-1">
              {navLinks.map((link) => (
                <button
                  key={link.key}
                  onClick={() => handleNavClick(link.href)}
                  className="relative flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <span className="block sm:hidden">{link.icon}</span>
                  <span className="hidden sm:block">{t(link.key)}</span>
                </button>
              ))}
            </div>

            <div className="h-5 w-px bg-white/10" />

            {/* CTA */}
            <Link href="/login">
              <button className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-all hover:bg-neutral-100 hover:shadow-lg hover:shadow-white/20 cursor-pointer">
                {t('common.login')}
              </button>
            </Link>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
