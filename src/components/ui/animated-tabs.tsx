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
        'relative gap-1.5 cursor-pointer transition-colors duration-200',
        isActive && 'text-blue-600 dark:text-blue-400',
        className
      )}
    >
      {children}
      {isActive && (
        <motion.div
          layoutId="active-tab-indicator"
          className="absolute -bottom-[5px] left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
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
