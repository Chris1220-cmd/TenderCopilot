import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Εγγραφή — Δωρεάν Δοκιμή 14 Ημερών | TenderCopilot',
  description:
    'Δημιουργήστε δωρεάν λογαριασμό TenderCopilot. 14 ημέρες δοκιμή Professional plan χωρίς πιστωτική κάρτα.',
  alternates: { canonical: '/register' },
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
