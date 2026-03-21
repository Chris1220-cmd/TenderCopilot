'use client';

import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlowButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

const GlowButton = forwardRef<HTMLButtonElement, GlowButtonProps>(
  ({ className, variant = 'default', size = 'default', children, ...props }, ref) => {
    return (
      <motion.button
        ref={ref as any}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        {...(props as any)}
        className={cn(
          'relative inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          variant === 'default' && [
            'bg-gradient-to-r from-blue-600 to-cyan-500 text-white',
            'shadow-lg shadow-blue-500/25',
            'hover:shadow-xl hover:shadow-blue-500/30',
          ],
          variant === 'ghost' && [
            'border border-white/10 bg-white/[0.02] text-white',
            'hover:bg-white/[0.06] hover:border-white/20',
          ],
          size === 'default' && 'h-11 px-6 text-sm',
          size === 'sm' && 'h-9 px-4 text-xs',
          size === 'lg' && 'h-12 px-8 text-base',
          className
        )}
      >
        {children}
      </motion.button>
    );
  }
);
GlowButton.displayName = 'GlowButton';

export { GlowButton };
