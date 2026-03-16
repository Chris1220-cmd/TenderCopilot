import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin', 'greek'],
  variable: '--font-inter',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: 'TenderCopilot GR — Ετοιμάστε φακέλους διαγωνισμών με AI',
  description:
    'SaaS πλατφόρμα για ελληνικές επιχειρήσεις που ετοιμάζουν φακέλους συμμετοχής σε διαγωνισμούς Δημοσίου και ιδιωτικού τομέα.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="el" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrains.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
