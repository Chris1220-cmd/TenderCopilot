'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const GlassInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-11 w-full rounded-xl px-4 py-2 text-sm transition-all duration-200',
          'bg-white/50 dark:bg-white/[0.04]',
          'border border-border dark:border-white/[0.08]',
          'text-foreground placeholder:text-muted-foreground/60',
          'focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20',
          'dark:focus:border-primary/30 dark:focus:ring-primary/10',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    );
  }
);
GlassInput.displayName = 'GlassInput';

export { GlassInput };
