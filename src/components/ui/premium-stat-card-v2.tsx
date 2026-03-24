'use client';

import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NumberTicker } from '@/components/ui/number-ticker';
import { BorderBeam } from '@/components/ui/border-beam';

interface PremiumStatCardV2Props {
  title: string;
  value: number;
  suffix?: string;
  subtitle: string;
  icon: LucideIcon;
  index?: number;
  colorClass?: string;
  sparkline?: React.ReactNode;
}

export function PremiumStatCardV2({
  title,
  value,
  suffix,
  subtitle,
  icon: Icon,
  index = 0,
  colorClass,
  sparkline,
}: PremiumStatCardV2Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.04,
        duration: 0.3,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={{ scale: 1.005, transition: { duration: 0.15 } }}
      className="group relative overflow-hidden rounded-xl border border-border/60 bg-card p-5 sm:p-6 transition-colors duration-200 hover:border-primary/20 cursor-default"
    >
      {/* Subtle glow on hover */}
      <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-br from-primary/[0.03] to-accent/[0.02]" />

      {/* BorderBeam on hover */}
      <BorderBeam size={80} duration={6} delay={index * 0.5} className="opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            {title}
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/[0.08] text-primary/70 transition-colors group-hover:bg-primary/[0.12] group-hover:text-primary">
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline gap-1">
          <span
            className={cn(
              'text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent',
              colorClass
            )}
          >
            <NumberTicker value={value} delay={0.2 + index * 0.1} />
          </span>
          {suffix && (
            <span className={cn('text-lg font-medium bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent', colorClass)}>
              {suffix}
            </span>
          )}
        </div>

        <p className="mt-1.5 text-xs text-muted-foreground/70">{subtitle}</p>

        {sparkline && sparkline}
      </div>
    </motion.div>
  );
}
