export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

const BASE_URL = 'https://tender-copilot-kappa.vercel.app';

export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'TenderCopilot',
  url: BASE_URL,
  description:
    'AI-powered tender management platform for Greek public procurement teams. Analyze documents, check eligibility, and prepare proposals 90% faster.',
  foundingDate: '2025',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'sales',
    availableLanguage: ['English', 'Greek'],
  },
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'GR',
  },
};

export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'TenderCopilot',
  url: BASE_URL,
  description: 'Smart tender management for Greek public procurement',
  inLanguage: ['el', 'en'],
};

export const softwareAppSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'TenderCopilot',
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Procurement Management',
  operatingSystem: 'Web Browser',
  description:
    'AI-powered tender management platform. Analyze documents, check eligibility, discover opportunities from 19+ procurement platforms, and prepare proposals 90% faster.',
  url: BASE_URL,
  featureList: [
    'AI Document Analysis for tender PDFs, DOCX, XLSX',
    'Automated Eligibility Checking with 94%+ accuracy',
    'Tender Discovery from 19+ procurement platforms',
    'AI Assistant for tender consultation 24/7',
    'Financial Strategy and pricing analysis',
    'Legal Compliance verification',
    'GDPR-compliant data handling',
  ],
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: '39',
    highPrice: '99',
    priceCurrency: 'EUR',
    offerCount: '3',
  },
};

export const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What file formats does TenderCopilot support?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'We support PDF, DOCX, XLSX, and most common document formats. Our AI can extract and analyze content from documents of any size, including 100+ page tender packages.',
      },
    },
    {
      '@type': 'Question',
      name: 'How accurate is the eligibility check?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Our AI achieves 94%+ accuracy on eligibility assessments by cross-referencing tender requirements against your company profile, certifications, and past performance data.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I try TenderCopilot for free?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes! Our Starter plan includes a free trial period. No credit card required. You can analyze your first tender documents within minutes of signing up.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does tender discovery work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'We monitor 19+ procurement platforms including government portals, EU TED, and private platforms. Our AI matches new opportunities to your company profile and sends real-time alerts.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is my data secure?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Absolutely. All data is encrypted at rest and in transit. We are GDPR compliant and offer enterprise-grade security features including SSO, SAML, and on-premise deployment options.',
      },
    },
  ],
};
