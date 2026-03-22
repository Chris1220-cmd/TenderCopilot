'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  value: string;
  label: string;
  suffix?: string;
  className?: string;
}

export function StatCard({ value, label, suffix, className }: StatCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-col items-center gap-2 py-8',
        isVisible ? 'animate-count-up' : 'opacity-0',
        className
      )}
    >
      <div className="text-4xl font-bold text-foreground md:text-5xl">
        {value}
        {suffix && <span className="text-muted-foreground">{suffix}</span>}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
