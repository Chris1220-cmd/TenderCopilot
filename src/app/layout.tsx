import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { getLocale, getMessages } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin', 'greek'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
  preload: false,
});

const BASE_URL = 'https://tender-copilot-kappa.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: 'TenderCopilot — AI Tender Management for Greek Procurement',
  description:
    'Analyze documents, check eligibility, and prepare proposals 90% faster. Smart tender management for Greek public procurement.',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'><stop offset='0%25' stop-color='%234f46e5'/><stop offset='100%25' stop-color='%237c3aed'/></linearGradient></defs><rect width='100' height='100' rx='20' fill='url(%23g)'/><text x='50' y='68' text-anchor='middle' font-size='55' font-weight='bold' fill='white' font-family='system-ui'>TC</text></svg>",
  },
  openGraph: {
    title: 'TenderCopilot — Win Tenders 90% Faster with AI',
    description:
      'AI-powered tender management for Greek public procurement. Analyze documents, check eligibility, and prepare competitive proposals.',
    url: BASE_URL,
    siteName: 'TenderCopilot',
    locale: 'el_GR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TenderCopilot — Win Tenders 90% Faster with AI',
    description:
      'AI-powered tender management for Greek public procurement. Analyze documents, check eligibility, and prepare competitive proposals.',
  },
  alternates: {
    canonical: BASE_URL,
  },
  robots: {
    index: true,
    follow: true,
    'max-snippet': -1,
    'max-image-preview': 'large',
    'max-video-preview': -1,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrains.variable} font-sans`}>
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
