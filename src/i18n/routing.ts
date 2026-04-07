import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['el', 'en', 'nl'],
  defaultLocale: 'el',
  localePrefix: 'never',
});
