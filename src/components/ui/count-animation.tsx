'use client';

import { cn } from '@/lib/utils';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

export function CountAnimation({
  number,
  suffix = '',
  className,
}: {
  number: number;
  suffix?: string;
  className?: string;
}) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, Math.round);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isVisible) {
      const animation = animate(count, number, { duration: 2, ease: 'easeOut' });
      return animation.stop;
    }
  }, [isVisible, count, number]);

  return (
    <span ref={ref} className={cn(className)}>
      <motion.span>{rounded}</motion.span>
      {suffix}
    </span>
  );
}
