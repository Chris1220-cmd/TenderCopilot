'use client';

import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

const chatMessages = [
  {
    role: 'user' as const,
    text: 'Does our company meet the eligibility criteria for tender ESHDHS-2024-1847?',
  },
  {
    role: 'assistant' as const,
    text: 'Based on my analysis of the tender documents, your company meets 8 out of 9 required criteria. The missing requirement is ISO 27001 certification, which is mandatory for this tender.',
    source: 'Tender Document Section 4.2',
    confidence: '94%',
  },
  {
    role: 'user' as const,
    text: 'What is the recommended pricing strategy?',
  },
];

export function AiShowcase() {
  const { t } = useTranslation();

  return (
    <section id="ai-showcase" className="relative py-24 sm:py-32 bg-white/[0.01]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          {/* Chat mockup */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="space-y-4"
          >
            {chatMessages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.15 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-5 py-4 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary/20 border border-primary/20 text-foreground'
                      : 'bg-white/[0.04] border border-white/[0.08] text-foreground'
                  }`}
                >
                  <p>{msg.text}</p>
                  {msg.role === 'assistant' && msg.source && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 text-xs text-cyan-400">
                        {msg.source}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 border border-green-500/20 px-2.5 py-0.5 text-xs text-green-400">
                        {msg.confidence}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Text content */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
              {t('aiShowcase.title')}
            </h2>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              {t('aiShowcase.description')}
            </p>
            <div className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3">
              <Shield className="h-5 w-5 text-cyan-400" />
              <span className="text-sm text-muted-foreground">
                {t('aiShowcase.trust')}
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
