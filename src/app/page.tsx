import nextDynamic from 'next/dynamic';

export const dynamic = 'force-dynamic';

const LandingPage = nextDynamic(
  () => import('@/components/landing/landing-page').then(mod => mod.LandingPage),
  { ssr: false }
);

export default function RootPage() {
  return (
    <div className="bg-white text-[#1a1a2e]">
      <LandingPage />
    </div>
  );
}
