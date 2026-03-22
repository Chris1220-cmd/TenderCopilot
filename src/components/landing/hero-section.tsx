'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#F8F6FF] via-[#EDE4FF] to-[#D8C8F8]">
      {/* Subtle radial glow */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] opacity-40"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(168,85,247,0.15), transparent 70%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-[900px] px-6 pt-32 pb-16 text-center">
        {/* Main heading — large serif italic like Superhuman */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-[80px] font-semibold leading-[1.05] tracking-[-0.03em] text-[#1a1a2e]"
          style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
        >
          Win every tender,{' '}
          <span className="italic">effortlessly</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 text-lg sm:text-xl text-[#1a1a2e]/60 max-w-[600px] mx-auto leading-relaxed"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          AI-powered document analysis, eligibility checks, and proposal generation that saves you 90% of your time
        </motion.p>

        {/* CTA Button — Superhuman style: dark pill with arrow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10"
        >
          <Link
            href="/register"
            className="group inline-flex items-center gap-3 rounded-full bg-[#1a1a2e] px-7 py-4 text-[15px] font-medium text-white transition-all hover:bg-[#2a2a3e] hover:shadow-xl hover:shadow-purple-500/10 cursor-pointer"
          >
            Get TenderCopilot
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-colors group-hover:bg-white/30">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </motion.div>
      </div>

      {/* Floating product mockups — layered depth like Superhuman */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 mx-auto w-full max-w-[1200px] px-6 pb-8"
      >
        <div className="relative">
          {/* Main dashboard mockup — center */}
          <div className="relative mx-auto max-w-[900px] rounded-2xl bg-white/80 backdrop-blur-sm shadow-2xl shadow-purple-900/10 border border-white/60 overflow-hidden">
            <img
              src="/images/dashboard-mockup.png"
              alt="TenderCopilot Dashboard"
              className="w-full h-auto"
              loading="eager"
            />
          </div>

          {/* Floating AI chat card — left side */}
          <motion.div
            initial={{ opacity: 0, x: -30, y: 20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="absolute -left-4 sm:left-4 lg:-left-8 top-[15%] w-[280px] sm:w-[320px] rounded-2xl bg-[#1E1E32]/95 backdrop-blur-xl p-5 shadow-2xl shadow-black/20 border border-white/10"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 7L12 12L22 7L12 2Z"/></svg>
              </div>
              <span className="text-[13px] text-white/80 font-medium">TenderCopilot AI</span>
            </div>
            <p className="text-[13px] text-white/60 leading-relaxed">
              This tender requires ISO 9001 certification. Your company profile shows compliance. Eligibility score: <span className="text-emerald-400 font-semibold">94%</span>
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                <span className="text-[12px] text-white/30">Ask about requirements...</span>
              </div>
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center cursor-pointer">
                <ArrowRight className="h-3.5 w-3.5 text-white" />
              </div>
            </div>
          </motion.div>

          {/* Floating stats card — right side */}
          <motion.div
            initial={{ opacity: 0, x: 30, y: 20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.7, delay: 0.85, ease: [0.16, 1, 0.3, 1] }}
            className="absolute -right-4 sm:right-4 lg:-right-8 top-[25%] w-[240px] sm:w-[260px] rounded-2xl bg-white/90 backdrop-blur-xl p-5 shadow-2xl shadow-purple-900/10 border border-white/60"
          >
            <div className="text-[11px] uppercase tracking-widest text-[#1a1a2e]/40 font-medium">Win Rate</div>
            <div className="mt-2 text-[36px] font-semibold tracking-[-0.02em] text-[#1a1a2e]" style={{ fontFamily: "'Georgia', serif" }}>
              68<span className="text-[24px] text-[#1a1a2e]/40">%</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[12px] font-medium text-emerald-600">+12%</span>
              <span className="text-[12px] text-[#1a1a2e]/40">vs last quarter</span>
            </div>
            {/* Mini sparkline */}
            <svg className="mt-3 w-full h-[32px]" viewBox="0 0 200 32" fill="none">
              <path
                d="M0 28 C30 24, 40 20, 60 18 S90 8, 120 12 S150 6, 170 4 S190 2, 200 2"
                stroke="url(#sparkGrad)"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
              <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="200" y2="0">
                  <stop offset="0%" stopColor="#6C5CE7" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#A855F7" stopOpacity="0.6" />
                </linearGradient>
              </defs>
            </svg>
          </motion.div>
        </div>
      </motion.div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
    </section>
  );
}
