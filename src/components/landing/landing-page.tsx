'use client';

import dynamic from 'next/dynamic';

// Above-fold: loaded immediately
import { Navbar } from './navbar';
import { HeroSection } from './hero-section';
import { TrustBar } from './trust-bar';

// Below-fold: lazy loaded
const FeaturesBento = dynamic(() => import('./features-bento').then(m => m.FeaturesBento), { ssr: true });
const AiShowcase = dynamic(() => import('./ai-showcase').then(m => m.AiShowcase), { ssr: true });
const TestimonialsSection = dynamic(() => import('./testimonials-section').then(m => m.TestimonialsSection), { ssr: true });
const StatsSection = dynamic(() => import('./stats-section').then(m => m.StatsSection), { ssr: true });
const PricingSection = dynamic(() => import('./pricing-section').then(m => m.PricingSection), { ssr: true });
const FaqSection = dynamic(() => import('./faq-section').then(m => m.FaqSection), { ssr: true });
const CtaFooter = dynamic(() => import('./cta-footer').then(m => m.CtaFooter), { ssr: true });

export function LandingPage() {
  return (
    <>
      <Navbar />
      <HeroSection />
      <TrustBar />
      <FeaturesBento />
      <AiShowcase />
      <TestimonialsSection />
      <StatsSection />
      <PricingSection />
      <FaqSection />
      <CtaFooter />
    </>
  );
}
