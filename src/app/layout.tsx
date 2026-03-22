import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Geist } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'><stop offset='0%25' stop-color='%234f46e5'/><stop offset='100%25' stop-color='%237c3aed'/></linearGradient></defs><rect width='100' height='100' rx='20' fill='url(%23g)'/><text x='50' y='68' text-anchor='middle' font-size='55' font-weight='bold' fill='white' font-family='system-ui'>TC</text></svg>",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="el" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body className={`${inter.variable} ${jetbrains.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
