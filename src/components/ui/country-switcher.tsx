'use client';

import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Check } from 'lucide-react';
import { SUPPORTED_COUNTRIES } from '@/lib/country-config';

const FLAG: Record<string, string> = {
  GR: '🇬🇷',
  NL: '🇳🇱',
};

export function CountrySwitcher({ className }: { className?: string }) {
  const utils = trpc.useUtils();
  const { data: tenant } = trpc.tenant.get.useQuery();
  const { data: me } = trpc.user.me.useQuery();

  const setActiveCountry = trpc.tenant.setActiveCountry.useMutation({
    onSuccess: () => {
      utils.user.me.invalidate();
      utils.tender.invalidate();
      utils.discovery.invalidate();
    },
  });

  const countries: string[] = tenant?.countries ?? [];

  // Hide entirely for single-country tenants
  if (countries.length < 2) return null;

  const activeCountry = me?.activeCountry ?? countries[0];
  const currentFlag = FLAG[activeCountry] ?? '🏳️';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium',
          'bg-white/[0.06] border border-white/[0.08]',
          'text-muted-foreground hover:text-foreground transition-colors cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className
        )}
        aria-label="Switch country"
      >
        <span className="mr-0.5">{currentFlag}</span>
        <span>{activeCountry}</span>
        <ChevronDown className="h-3 w-3 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {countries.map((code) => {
          const config = SUPPORTED_COUNTRIES.find((c) => c.code === code);
          const isActive = code === activeCountry;
          return (
            <DropdownMenuItem
              key={code}
              disabled={setActiveCountry.isPending}
              onClick={() => setActiveCountry.mutate({ country: code })}
              className={cn(
                'cursor-pointer flex items-center justify-between gap-2',
                isActive && 'font-semibold'
              )}
            >
              <span className="flex items-center gap-2">
                <span>{FLAG[code] ?? '🏳️'}</span>
                <span>{config?.name ?? code}</span>
              </span>
              {isActive && <Check className="h-3 w-3" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
