'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

const features = [
  {
    id: 'analysis',
    label: 'Document Analysis',
    heading: 'Understand every tender document in seconds',
    description:
      'Upload any PDF, DOCX, or XLSX and our AI extracts requirements, deadlines, eligibility criteria, and compliance needs automatically.',
    bullets: [
      'Extract requirements from 100+ page documents',
      'Identify eligibility criteria instantly',
      'Map compliance requirements to your profile',
      'Support for PDF, DOCX, XLSX formats',
    ],
    learnMore: '/register',
    learnLabel: 'Start analyzing',
    gradient: 'from-[#F0E6FF] via-[#E8D4FF] to-[#DFC4FF]',
  },
  {
    id: 'eligibility',
    label: 'Eligibility Check',
    heading: 'Know if you qualify before you invest time',
    description:
      'AI cross-references tender requirements against your company profile and certifications to give you a clear go/no-go recommendation.',
    bullets: [
      'Instant eligibility scoring',
      'Gap analysis for missing certifications',
      'Go/No-Go recommendation with reasoning',
      'Save hours on unqualified tenders',
    ],
    learnMore: '/register',
    learnLabel: 'Check eligibility',
    gradient: 'from-[#FFF0E6] via-[#FFE4D4] to-[#FFD8C4]',
  },
  {
    id: 'discovery',
    label: 'Tender Discovery',
    heading: 'Find relevant opportunities from 19+ sources',
    description:
      'Our discovery engine monitors government portals, EU TED, and private platforms to surface tenders that match your expertise.',
    bullets: [
      'Monitor 19+ procurement platforms',
      'AI-matched recommendations',
      'Real-time alerts for new opportunities',
      'Filter by industry, region, and budget',
    ],
    learnMore: '/register',
    learnLabel: 'Discover tenders',
    gradient: 'from-[#E6F0FF] via-[#D4E4FF] to-[#C4D8FF]',
  },
  {
    id: 'assistant',
    label: 'AI Assistant',
    heading: 'Your expert tender consultant, available 24/7',
    description:
      'Ask questions about any tender document, get help drafting responses, or request analysis of specific requirements.',
    bullets: [
      'Context-aware answers about your tenders',
      'Draft proposal sections in your voice',
      'Financial analysis and budget validation',
      'Legal clause review and risk assessment',
    ],
    learnMore: '/register',
    learnLabel: 'Meet your assistant',
    gradient: 'from-[#E6FFF0] via-[#D4FFE4] to-[#C4FFD8]',
  },
];

export function FeaturesBento() {
  const [active, setActive] = useState(0);
  const current = features[active];

  return (
    <section id="features" className="relative bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        {/* Section header */}
        <div className="flex items-end justify-between mb-12">
          <h2
            className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-[#1a1a2e]"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            Your TenderCopilot suite
          </h2>
          <Link
            href="/register"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#1a1a2e]/15 px-5 py-2.5 text-[14px] font-medium text-[#1a1a2e] hover:bg-[#1a1a2e]/[0.03] transition-colors cursor-pointer"
          >
            Get started
          </Link>
        </div>

        {/* Tab bar — Superhuman style segmented control */}
        <div className="flex border-b border-[#E8E0F0]">
          {features.map((feature, i) => (
            <button
              key={feature.id}
              onClick={() => setActive(i)}
              className={`relative flex-1 py-4 text-[14px] sm:text-[15px] font-medium transition-colors cursor-pointer ${
                i === active ? 'text-[#1a1a2e]' : 'text-[#1a1a2e]/40 hover:text-[#1a1a2e]/60'
              }`}
            >
              {feature.label}
              {i === active && (
                <motion.div
                  layoutId="feature-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#1a1a2e]"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-12 pt-12"
          >
            {/* Left — text content */}
            <div className="flex flex-col justify-center">
              <h3
                className="text-2xl sm:text-3xl font-semibold tracking-[-0.02em] text-[#1a1a2e] leading-tight"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                {current.heading}
              </h3>
              <p className="mt-4 text-[15px] text-[#1a1a2e]/55 leading-relaxed">
                {current.description}
              </p>
              <Link
                href={current.learnMore}
                className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium text-[#6C5CE7] hover:text-[#5B4BD6] transition-colors cursor-pointer"
              >
                {current.learnLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <ul className="mt-8 space-y-3.5">
                {current.bullets.map((bullet, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.3 }}
                    className="flex items-start gap-3 text-[14px] text-[#1a1a2e]/70"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#1a1a2e]/25 shrink-0" />
                    {bullet}
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* Right — gradient visual placeholder */}
            <div className={`rounded-2xl bg-gradient-to-br ${current.gradient} min-h-[360px] flex items-center justify-center overflow-hidden`}>
              <div className="w-[85%] rounded-xl bg-white/70 backdrop-blur-sm shadow-xl shadow-black/5 border border-white/80 p-1 overflow-hidden">
                <img
                  src="/images/dashboard-mockup.png"
                  alt={current.heading}
                  className="w-full h-auto rounded-lg"
                />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
