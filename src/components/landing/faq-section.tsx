'use client';

import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const faqKeys = ['1', '2', '3', '4', '5'];

export function FaqSection() {
  const { t } = useTranslation();

  return (
    <section id="faq" className="relative py-24 sm:py-32 bg-white/[0.01]">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="text-3xl font-bold text-foreground text-center mb-12 sm:text-4xl"
        >
          {t('faq.title')}
        </motion.h2>

        <AccordionPrimitive.Root type="single" collapsible className="space-y-3">
          {faqKeys.map((key, i) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
            >
              <AccordionPrimitive.Item
                value={`faq-${key}`}
                className={cn(
                  'rounded-2xl border backdrop-blur-sm transition-all duration-300',
                  'bg-white/[0.03] border-white/[0.06]',
                  'data-[state=open]:bg-white/[0.05] data-[state=open]:border-white/[0.1]'
                )}
              >
                <AccordionPrimitive.Header className="flex">
                  <AccordionPrimitive.Trigger
                    className={cn(
                      'flex w-full items-center justify-between px-6 py-5 text-left cursor-pointer',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-2xl',
                      'group'
                    )}
                  >
                    <span className="text-sm font-medium text-foreground pr-4">
                      {t(`faq.q${key}`)}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300',
                        'group-data-[state=open]:rotate-180'
                      )}
                    />
                  </AccordionPrimitive.Trigger>
                </AccordionPrimitive.Header>
                <AccordionPrimitive.Content
                  className={cn(
                    'overflow-hidden transition-all',
                    'data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up'
                  )}
                >
                  <p className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed">
                    {t(`faq.a${key}`)}
                  </p>
                </AccordionPrimitive.Content>
              </AccordionPrimitive.Item>
            </motion.div>
          ))}
        </AccordionPrimitive.Root>
      </div>
    </section>
  );
}
