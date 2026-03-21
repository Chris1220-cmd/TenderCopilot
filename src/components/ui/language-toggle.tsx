'use client';

import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const locales = [
  { code: 'el' as const, label: 'GR' },
  { code: 'en' as const, label: 'EN' },
];

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useTranslation();

  return (
    <div
      role="radiogroup"
      aria-label="Language"
      className={cn(
        'inline-flex items-center rounded-lg p-0.5',
        'bg-white/[0.06] border border-white/[0.08]',
        className
      )}
    >
      {locales.map(({ code, label }) => (
        <button
          key={code}
          role="radio"
          aria-checked={locale === code}
          onClick={() => setLocale(code)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              const next = code === 'el' ? 'en' : 'el';
              setLocale(next);
            }
          }}
          className={cn(
            'px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200 cursor-pointer',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            locale === code
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
