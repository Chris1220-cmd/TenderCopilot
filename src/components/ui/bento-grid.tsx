import { cn } from '@/lib/utils';

interface BentoGridProps {
  className?: string;
  children: React.ReactNode;
}

export function BentoGrid({ className, children }: BentoGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
        className
      )}
    >
      {children}
    </div>
  );
}

interface BentoCardProps {
  className?: string;
  children: React.ReactNode;
}

export function BentoCard({ className, children }: BentoCardProps) {
  return (
    <div
      className={cn(
        'group relative rounded-2xl p-6',
        'bg-white/[0.03] dark:bg-white/[0.03]',
        'border border-white/[0.06]',
        'backdrop-blur-sm',
        'transition-all duration-300',
        'hover:bg-white/[0.05] hover:border-white/[0.1]',
        'hover:shadow-lg hover:shadow-blue-500/[0.03]',
        className
      )}
    >
      {children}
    </div>
  );
}
