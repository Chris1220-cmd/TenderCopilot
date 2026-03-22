'use client';

import { motion } from 'motion/react';
import Link from 'next/link';

export function AiShowcase() {
  return (
    <section className="relative bg-gradient-to-b from-white via-[#F8F6FF] to-[#F0EAFF] py-24 sm:py-32 overflow-hidden">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left — Image */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div className="rounded-2xl overflow-hidden">
              <img
                src="/images/ai-chat-mockup.png"
                alt="AI tender analysis"
                className="w-full h-auto rounded-2xl"
                loading="lazy"
              />
            </div>
          </motion.div>

          {/* Right — Text */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2
              className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-[#1a1a2e] leading-tight"
              style={{ fontFamily: "'Georgia', serif" }}
            >
              Becoming{' '}
              <span className="italic">unstoppable.</span>
            </h2>
            <p className="mt-6 text-[16px] text-[#1a1a2e]/55 leading-relaxed">
              When AI analyzes every tender for you, it changes{' '}
              <em className="text-[#1a1a2e]/70">how</em> you compete.
              You respond faster, more accurately, and with deeper insights.
              Before you know it, you have the time to be more strategic
              and focused — free to win the tenders that truly matter.
            </p>
            <Link
              href="/register"
              className="mt-8 inline-flex items-center gap-2 text-[14px] font-medium text-[#6C5CE7] hover:text-[#5B4BD6] transition-colors cursor-pointer"
            >
              Read how it works
              <span className="text-[12px]">&rarr;</span>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
