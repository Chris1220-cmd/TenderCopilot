'use client';

import { motion } from 'motion/react';
import { Shield, Zap, Globe, Lock, Award, Clock } from 'lucide-react';

const badges = [
  { icon: Globe, text: '37 πηγές διαγωνισμών' },
  { icon: Zap, text: 'AI ανάλυση σε δευτερόλεπτα' },
  { icon: Shield, text: 'GDPR compliant' },
  { icon: Lock, text: 'End-to-end encryption' },
  { icon: Award, text: 'ISO 27001 ready' },
  { icon: Clock, text: '24/7 monitoring' },
];

export function TrustBar() {
  return (
    <section className="relative py-12 bg-white border-y border-gray-100">
      <div className="mx-auto max-w-6xl px-6">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-xs uppercase tracking-[0.2em] text-gray-400 font-medium mb-8"
        >
          Γιατί να μας εμπιστευτείτε
        </motion.p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {badges.map((badge, i) => (
            <motion.div
              key={badge.text}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="flex items-center gap-2.5 text-gray-500"
            >
              <badge.icon className="h-4 w-4 text-[#48A4D6]" />
              <span className="text-sm font-medium whitespace-nowrap">{badge.text}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
