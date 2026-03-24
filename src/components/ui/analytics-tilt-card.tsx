'use client';

import React, { useRef, useCallback } from 'react';
import {
  useMotionValue,
  useMotionTemplate,
  useSpring,
  motion,
  useReducedMotion,
} from 'motion/react';
import { cn } from '@/lib/utils';
import { BorderBeam } from '@/components/ui/border-beam';

interface AnalyticsTiltCardProps {
  children: React.ReactNode;
  className?: string;
  index?: number;
}

export function AnalyticsTiltCard({
  children,
  className,
  index = 0,
}: AnalyticsTiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(0, { stiffness: 200, damping: 30 });
  const rotateY = useSpring(0, { stiffness: 200, damping: 30 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (prefersReducedMotion || !ref.current) return;
      const { left, top, width, height } = ref.current.getBoundingClientRect();
      const x = e.clientX - left;
      const y = e.clientY - top;
      mouseX.set(x);
      mouseY.set(y);
      // Max 3deg tilt
      rotateX.set(((y - height / 2) / height) * -3);
      rotateY.set(((x - width / 2) / width) * 3);
    },
    [prefersReducedMotion, mouseX, mouseY, rotateX, rotateY]
  );

  const handleMouseLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  const spotlightBackground = useMotionTemplate`
    radial-gradient(
      400px circle at ${mouseX}px ${mouseY}px,
      rgba(72,164,214,0.06),
      transparent 70%
    )
  `;

  return (
    <div style={{ perspective: '800px' }}>
      <motion.div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX: prefersReducedMotion ? 0 : rotateX,
          rotateY: prefersReducedMotion ? 0 : rotateY,
          transformStyle: 'preserve-3d',
        }}
        className={cn(
          'group/tilt relative overflow-hidden rounded-xl border border-border/60 bg-card p-6',
          'transition-all duration-200',
          'hover:border-primary/20 hover:-translate-y-0.5',
          'hover:shadow-[0_8px_30px_rgba(0,0,0,0.08),0_0_40px_rgba(72,164,214,0.06)]',
          className
        )}
      >
        {/* Mouse-tracked spotlight */}
        <motion.div
          className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-hover/tilt:opacity-100 z-0"
          style={{ background: spotlightBackground }}
        />

        {/* BorderBeam on hover */}
        <BorderBeam
          size={100}
          duration={8}
          delay={index * 0.5}
          colorFrom="#48A4D6"
          colorTo="rgba(72,164,214,0.3)"
          className="opacity-0 group-hover/tilt:opacity-100 transition-opacity"
        />

        {/* Content */}
        <div className="relative z-10">{children}</div>
      </motion.div>
    </div>
  );
}
