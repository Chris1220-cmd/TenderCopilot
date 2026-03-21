'use client';

import { ThemeProvider } from 'next-themes';
import { SessionProvider } from 'next-auth/react';
import { TRPCProvider } from '@/lib/trpc';
import { I18nProvider } from '@/lib/i18n';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <SessionProvider>
        <TRPCProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </TRPCProvider>
      </SessionProvider>
    </I18nProvider>
  );
}
