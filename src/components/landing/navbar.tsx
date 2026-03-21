'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { GlowButton } from '@/components/ui/glow-button';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { cn } from '@/lib/utils';

const navLinks = [
  { key: 'nav.features', href: '#features' },
  { key: 'nav.pricing', href: '#pricing' },
  { key: 'nav.faq', href: '#faq' },
];

export function Navbar() {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNavClick = (href: string) => {
    setMobileOpen(false);
    const id = href.replace('#', '');
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-background/80 backdrop-blur-xl border-b border-border'
          : 'bg-transparent'
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 cursor-pointer">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500">
            <span className="text-sm font-bold text-white">TC</span>
          </div>
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
            <GlowButton variant="ghost" size="sm">
              {t('common.login')}
            </GlowButton>
          </Link>
          <Link href="/register">
            <GlowButton size="sm">{t('common.tryFree')}</GlowButton>
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
                  <GlowButton variant="ghost" size="sm" className="w-full">
                    {t('common.login')}
                  </GlowButton>
                </Link>
                <Link href="/register" className="flex-1">
                  <GlowButton size="sm" className="w-full">
                    {t('common.tryFree')}
                  </GlowButton>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
