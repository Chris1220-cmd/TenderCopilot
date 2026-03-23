'use client';

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface DataTableRowProps {
  index?: number;
  selected?: boolean;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}

export function DataTableRow({
  className,
  index = 0,
  selected,
  onClick,
  children,
}: DataTableRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.03,
        duration: 0.25,
        ease: [0.16, 1, 0.3, 1] as const,
      }}
      onClick={onClick}
      className={cn(
        'group flex items-center gap-4 px-6 py-3 min-h-[48px]',
        'border-b border-border/30 last:border-0',
        'transition-colors duration-150 cursor-pointer',
        'hover:bg-muted/50',
        selected && 'bg-primary/5 border-l-2 border-l-primary',
        className
      )}
    >
      {children}
    </motion.div>
  );
}
