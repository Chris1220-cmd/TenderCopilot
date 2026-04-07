'use client';

import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';

const locales = [
  { code: 'el' as const, label: 'GR', name: 'Ελληνικά' },
  { code: 'en' as const, label: 'EN', name: 'English' },
  { code: 'nl' as const, label: 'NL', name: 'Nederlands' },
];

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useTranslation();
  const current = locales.find((l) => l.code === locale) ?? locales[0];

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
      >
        {current.label}
        <ChevronDown className="h-3 w-3 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {locales.map(({ code, label, name }) => (
          <DropdownMenuItem
            key={code}
            onClick={() => setLocale(code)}
            className={cn(
              'cursor-pointer flex items-center justify-between',
              locale === code && 'font-semibold'
            )}
          >
            <span>{name}</span>
            <span className="text-xs text-muted-foreground">{label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
