import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlowButton } from './glow-button';

interface PricingCardProps {
  name: string;
  price: string;
  period: string;
  features: string[];
  popular?: boolean;
  cta: string;
  className?: string;
}

export function PricingCard({ name, price, period, features, popular, cta, className }: PricingCardProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl p-6',
        'bg-white/[0.03] border backdrop-blur-sm',
        'transition-all duration-300',
        popular
          ? 'border-primary/30 glow-blue scale-[1.02]'
          : 'border-white/[0.06] hover:border-white/[0.1]',
        className
      )}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
            {name === 'Professional' ? 'Δημοφιλές' : 'Popular'}
          </span>
        </div>
      )}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">{name}</h3>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-bold text-foreground">{price}</span>
          <span className="text-sm text-muted-foreground">/{period}</span>
        </div>
      </div>
      <ul className="mb-8 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {feature}
          </li>
        ))}
      </ul>
      <GlowButton variant={popular ? 'default' : 'ghost'} className="w-full">
        {cta}
      </GlowButton>
    </div>
  );
}
