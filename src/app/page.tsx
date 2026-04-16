import { LandingPage } from '@/components/landing/landing-page';
import {
  JsonLd,
  organizationSchema,
  websiteSchema,
  softwareAppSchema,
  faqSchema,
} from '@/components/seo/json-ld';

export const dynamic = 'force-static';
export const revalidate = 3600; // revalidate every hour

export default function RootPage() {
  return (
    <div className="bg-white text-[#1a1a2e]">
      <JsonLd data={organizationSchema} />
      <JsonLd data={websiteSchema} />
      <JsonLd data={softwareAppSchema} />
      <JsonLd data={faqSchema} />
      <LandingPage />
    </div>
  );
}
