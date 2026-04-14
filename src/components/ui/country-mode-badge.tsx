'use client';

import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

const FLAG: Record<string, string> = {
  GR: '🇬🇷',
  NL: '🇳🇱',
};

/**
 * Small pill shown only when the user is operating in a non-primary country.
 * Prevents accidents like creating a Greek tender while in Dutch mode unnoticed.
 */
export function CountryModeBadge({ className }: { className?: string }) {
  const { data: tenant } = trpc.tenant.get.useQuery();
  const { data: me } = trpc.user.me.useQuery();

  const countries: string[] = tenant?.countries ?? [];
  if (countries.length < 2) return null;

  const primaryCountry = countries[0];
  const activeCountry = me?.activeCountry ?? primaryCountry;

  // Only show when the user is in a non-primary country
  if (activeCountry === primaryCountry) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        'bg-amber-500/10 text-amber-700 border border-amber-500/30',
        'dark:bg-amber-400/10 dark:text-amber-300 dark:border-amber-400/30',
        className
      )}
      role="status"
      aria-label={`Operating in ${activeCountry} mode`}
    >
      <span>{FLAG[activeCountry] ?? '🏳️'}</span>
      <span>{activeCountry} Mode</span>
    </span>
  );
}
