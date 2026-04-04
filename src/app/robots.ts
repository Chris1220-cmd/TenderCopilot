import type { MetadataRoute } from 'next';

const BASE_URL = 'https://tender-copilot-kappa.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/tenders/',
          '/analytics/',
          '/settings/',
          '/tasks/',
          '/company/',
          '/resources/',
          '/fakeloi/',
          '/admin/',
          '/_next/',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
