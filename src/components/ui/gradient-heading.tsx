import { cn } from '@/lib/utils';
import { AnimatedGradientText } from '@/components/ui/animated-gradient-text';

interface GradientHeadingProps {
  children: React.ReactNode;
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
}

export function GradientHeading({
  children,
  as: Tag = 'h1',
  className,
}: GradientHeadingProps) {
  return (
    <Tag className={cn('font-bold tracking-tight', className)}>
      <AnimatedGradientText
        colorFrom="#1D4ED8"
        colorTo="#0891B2"
        speed={0.8}
      >
        {children}
      </AnimatedGradientText>
    </Tag>
  );
}
