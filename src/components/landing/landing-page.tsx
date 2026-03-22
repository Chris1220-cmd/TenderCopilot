'use client';

import { Navbar } from './navbar';
import { HeroSection } from './hero-section';
import { FeaturesBento } from './features-bento';
import { AiShowcase } from './ai-showcase';
import { StatsSection } from './stats-section';
import { PricingSection } from './pricing-section';
import { FaqSection } from './faq-section';
import { CtaFooter } from './cta-footer';

export function LandingPage() {
  return (
    <>
      <Navbar />
      <HeroSection />
      <FeaturesBento />
      <AiShowcase />
      <StatsSection />
      <PricingSection />
      <FaqSection />
      <CtaFooter />
    </>
  );
}
