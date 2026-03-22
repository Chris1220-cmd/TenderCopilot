'use client';

import { cn } from '@/lib/utils';
import { MagicCard } from '@/components/ui/magic-card';
import { NumberTicker } from '@/components/ui/number-ticker';
import { BlurFade } from '@/components/ui/blur-fade';
import type { LucideIcon } from 'lucide-react';

interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  color: string;
}

function ProgressRing({ value, size = 52, strokeWidth = 4, color }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/30"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  );
}

export interface PremiumStatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  accentColor: string;
  borderColor: string;
  bgCircle: string;
  textCircle: string;
  showNumberTicker?: boolean;
  showProgressRing?: boolean;
  progressValue?: number;
  blurFadeDelay?: number;
}

export function PremiumStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accentColor,
  borderColor,
  bgCircle,
  textCircle,
  showNumberTicker = true,
  showProgressRing = false,
  progressValue = 0,
  blurFadeDelay = 0,
}: PremiumStatCardProps) {
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  const isNumeric = !isNaN(numericValue) && showNumberTicker;
  const displaySuffix = typeof value === 'string' && value.includes('%') ? '%' : '';

  return (
    <BlurFade delay={blurFadeDelay} inView>
      <MagicCard
        className={cn('h-full rounded-2xl border-white/[0.06]')}
        gradientSize={250}
        gradientColor="#1a1a2e"
        gradientFrom="#3B82F6"
        gradientTo="#06B6D4"
      >
        <div
          className={cn(
            'group relative overflow-hidden p-5',
            'border-l-4',
            borderColor
          )}
        >
          {/* Subtle gradient overlay on hover */}
          <div
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background: `radial-gradient(ellipse at top right, ${accentColor}08, transparent 60%)`,
            }}
          />

          <div className="relative flex items-start justify-between">
            <div className="space-y-1.5 flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {title}
              </p>

              <div className="flex items-end gap-3">
                {showProgressRing ? (
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-bold tracking-tight">
                      {isNumeric ? (
                        <>
                          <NumberTicker value={numericValue} delay={blurFadeDelay + 0.2} />
                          {displaySuffix}
                        </>
                      ) : (
                        value
                      )}
                    </span>
                    <ProgressRing value={progressValue} color={accentColor} />
                  </div>
                ) : (
                  <span className="text-3xl font-bold tracking-tight">
                    {isNumeric ? (
                      <NumberTicker value={numericValue} delay={blurFadeDelay + 0.2} />
                    ) : (
                      value
                    )}
                  </span>
                )}
              </div>

              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>

            {/* Icon circle */}
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                'transition-transform duration-300 group-hover:scale-110',
                bgCircle
              )}
            >
              <Icon className={cn('h-5 w-5', textCircle)} />
            </div>
          </div>

          {/* Bottom glow line */}
          <div
            className="absolute bottom-0 left-0 h-[2px] w-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background: `linear-gradient(90deg, ${accentColor}, transparent)`,
            }}
          />
        </div>
      </MagicCard>
    </BlurFade>
  );
}
