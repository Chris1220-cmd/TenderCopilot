'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { BlurFade } from '@/components/ui/blur-fade';
import { ShimmerButton } from '@/components/ui/shimmer-button';

export interface PremiumEmptyStateProps {
  imageSrc: string;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function PremiumEmptyState({
  imageSrc,
  title,
  description,
  action,
  className,
}: PremiumEmptyStateProps) {
  return (
    <BlurFade delay={0.1} inView>
      <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
        <div className="relative mb-6 h-[160px] w-[200px]">
          <Image
            src={imageSrc}
            alt=""
            fill
            className="object-contain opacity-80 dark:opacity-60"
            aria-hidden="true"
          />
        </div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{description}</p>
        {action && (
          <div className="mt-5">
            {action.href ? (
              <Link href={action.href}>
                <ShimmerButton
                  shimmerColor="#06B6D4"
                  shimmerSize="0.05em"
                  background="linear-gradient(135deg, #3B82F6, #06B6D4)"
                  className="px-6 py-2.5 text-sm font-semibold cursor-pointer"
                >
                  {action.label}
                </ShimmerButton>
              </Link>
            ) : (
              <ShimmerButton
                shimmerColor="#06B6D4"
                shimmerSize="0.05em"
                background="linear-gradient(135deg, #3B82F6, #06B6D4)"
                className="px-6 py-2.5 text-sm font-semibold cursor-pointer"
                onClick={action.onClick}
              >
                {action.label}
              </ShimmerButton>
            )}
          </div>
        )}
      </div>
    </BlurFade>
  );
}
