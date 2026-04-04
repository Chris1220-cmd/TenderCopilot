import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Σύνδεση — TenderCopilot',
  description:
    'Συνδεθείτε στον λογαριασμό σας TenderCopilot για AI-powered διαχείριση διαγωνισμών.',
  alternates: { canonical: '/login' },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
