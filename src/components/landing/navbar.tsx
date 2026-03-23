'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { LanguageToggle } from '@/components/ui/language-toggle';

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useTranslation();

  const navLinks = [
    { label: t('nav.product'), href: '#features' },
    { label: t('nav.pricing'), href: '#pricing' },
    { label: t('nav.faq'), href: '#faq' },
  ];

  const handleNavClick = (href: string) => {
    setMobileOpen(false);
    if (href.startsWith('#')) {
      const el = document.getElementById(href.replace('#', ''));
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[#E8E0F0]/60">
      <nav className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 cursor-pointer">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1a1a2e]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white" opacity="0.9"/>
              <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-[#1a1a2e] uppercase">
            TenderCopilot
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <button
              key={link.href}
              onClick={() => handleNavClick(link.href)}
              className="px-4 py-2 text-[14px] font-medium text-[#1a1a2e]/70 hover:text-[#1a1a2e] transition-colors cursor-pointer"
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Desktop right side */}
        <div className="hidden md:flex items-center gap-2">
          <LanguageToggle className="mr-2 bg-[#1a1a2e]/[0.04] border-[#1a1a2e]/10 [&_button[aria-checked=true]]:bg-[#1a1a2e] [&_button[aria-checked=true]]:text-white [&_button]:text-[#1a1a2e]/50" />
          <Link
            href="/login"
            className="px-4 py-2 text-[14px] font-medium text-[#1a1a2e]/70 hover:text-[#1a1a2e] transition-colors cursor-pointer"
          >
            {t('common.login')}
          </Link>
          <Link
            href="/register"
            className="rounded-full border border-[#1a1a2e] bg-[#1a1a2e] px-5 py-2 text-[14px] font-medium text-white hover:bg-[#2a2a3e] transition-colors cursor-pointer"
          >
            {t('common.register')}
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-[#1a1a2e] cursor-pointer"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="md:hidden bg-white/95 backdrop-blur-xl border-b border-[#E8E0F0]/60"
          >
            <div className="flex flex-col gap-1 px-6 py-4">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleNavClick(link.href)}
                  className="py-3 text-left text-[15px] font-medium text-[#1a1a2e]/70 hover:text-[#1a1a2e] cursor-pointer"
                >
                  {link.label}
                </button>
              ))}
              <div className="flex items-center justify-center py-2">
                <LanguageToggle className="bg-[#1a1a2e]/[0.04] border-[#1a1a2e]/10 [&_button[aria-checked=true]]:bg-[#1a1a2e] [&_button[aria-checked=true]]:text-white [&_button]:text-[#1a1a2e]/50" />
              </div>
              <div className="flex items-center gap-3 pt-4 mt-2 border-t border-[#E8E0F0]">
                <Link href="/login" className="flex-1 text-center rounded-lg border border-[#1a1a2e]/20 py-2.5 text-[14px] font-medium text-[#1a1a2e] cursor-pointer">
                  {t('common.login')}
                </Link>
                <Link href="/register" className="flex-1 text-center rounded-lg bg-[#1a1a2e] py-2.5 text-[14px] font-medium text-white cursor-pointer">
                  {t('common.register')}
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
