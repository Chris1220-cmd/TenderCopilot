'use client';

import { motion } from 'motion/react';

const logos = [
  { name: 'Trusted Company', width: 100 },
  { name: 'Enterprise Corp', width: 90 },
  { name: 'Gov Solutions', width: 110 },
  { name: 'Maritime Inc', width: 95 },
  { name: 'Tech Partners', width: 100 },
];

export function StatsSection() {
  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-[14px] text-[#1a1a2e]/35 font-medium"
        >
          Trusted by procurement teams at leading organizations
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mt-8 flex items-center justify-center gap-12 sm:gap-16 flex-wrap"
        >
          {logos.map((logo, i) => (
            <div
              key={i}
              className="text-[15px] font-semibold tracking-[-0.01em] text-[#1a1a2e]/20 uppercase"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              {logo.name}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
