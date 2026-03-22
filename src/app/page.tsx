import nextDynamic from 'next/dynamic';

export const dynamic = 'force-dynamic';

const LandingPage = nextDynamic(
  () => import('@/components/landing/landing-page').then(mod => mod.LandingPage),
  { ssr: false }
);

export default function RootPage() {
  return (
    <div className="dark bg-background text-foreground">
      <LandingPage />
    </div>
  );
}
