'use client';

import { type ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { TabsTrigger } from '@/components/ui/tabs';

interface AnimatedTabsTriggerProps {
  value: string;
  activeValue: string;
  children: ReactNode;
  className?: string;
}

export function AnimatedTabsTrigger({
  value,
  activeValue,
  children,
  className,
}: AnimatedTabsTriggerProps) {
  const isActive = value === activeValue;

  return (
    <TabsTrigger
      value={value}
      className={cn(
        'relative px-3 py-2 text-sm font-medium cursor-pointer rounded-none bg-transparent transition-colors duration-200 data-[state=active]:shadow-none',
        isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        className
      )}
    >
      <span className="flex items-center gap-1.5">{children}</span>
      {isActive && (
        <motion.div
          layoutId="active-tab-indicator"
          className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-primary rounded-full"
          transition={{
            type: 'spring',
            stiffness: 380,
            damping: 30,
          }}
        />
      )}
    </TabsTrigger>
  );
}
