'use client';

import { cn } from '@/lib/utils';

function GlassCard({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card"
      className={cn(
        'relative flex flex-col gap-6 rounded-xl py-6',
        'glass-card glass-hover',
        className
      )}
      {...props}
    />
  );
}

function GlassCardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card-header"
      className={cn(
        'grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-5',
        'has-data-[slot=glass-card-action]:grid-cols-[1fr_auto]',
        className
      )}
      {...props}
    />
  );
}

function GlassCardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card-title"
      className={cn('leading-none font-semibold text-foreground', className)}
      {...props}
    />
  );
}

function GlassCardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

function GlassCardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card-action"
      className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
      {...props}
    />
  );
}

function GlassCardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card-content"
      className={cn('px-5', className)}
      {...props}
    />
  );
}

function GlassCardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-card-footer"
      className={cn('flex items-center px-5', className)}
      {...props}
    />
  );
}

export {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardAction,
  GlassCardContent,
  GlassCardFooter,
};
