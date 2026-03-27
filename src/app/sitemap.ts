import type { MetadataRoute } from 'next';

const BASE_URL = 'https://tender-copilot-kappa.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  // ── Public marketing pages ────────────────────────────────
  // The homepage is the single-page landing that contains all
  // marketing content (features, pricing, FAQ) as anchor sections.
  const publicPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
  ];

  // ── Authentication pages ──────────────────────────────────
  // Login & register are publicly accessible and should be indexed
  // so users can find them via search.
  const authPages: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/login`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/register`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ];

  // ── Future public pages (uncomment as they are created) ───
  // When you create dedicated pages for these routes, uncomment
  // the corresponding entries below.
  //
  // const futurePages: MetadataRoute.Sitemap = [
  //   {
  //     url: `${BASE_URL}/pricing`,
  //     lastModified: now,
  //     changeFrequency: 'monthly',
  //     priority: 0.8,
  //   },
  //   {
  //     url: `${BASE_URL}/features`,
  //     lastModified: now,
  //     changeFrequency: 'monthly',
  //     priority: 0.8,
  //   },
  //   {
  //     url: `${BASE_URL}/about`,
  //     lastModified: now,
  //     changeFrequency: 'monthly',
  //     priority: 0.6,
  //   },
  //   {
  //     url: `${BASE_URL}/blog`,
  //     lastModified: now,
  //     changeFrequency: 'weekly',
  //     priority: 0.7,
  //   },
  //   {
  //     url: `${BASE_URL}/contact`,
  //     lastModified: now,
  //     changeFrequency: 'monthly',
  //     priority: 0.5,
  //   },
  //   {
  //     url: `${BASE_URL}/faq`,
  //     lastModified: now,
  //     changeFrequency: 'monthly',
  //     priority: 0.5,
  //   },
  //   {
  //     url: `${BASE_URL}/terms`,
  //     lastModified: now,
  //     changeFrequency: 'yearly',
  //     priority: 0.2,
  //   },
  //   {
  //     url: `${BASE_URL}/privacy`,
  //     lastModified: now,
  //     changeFrequency: 'yearly',
  //     priority: 0.2,
  //   },
  //   {
  //     url: `${BASE_URL}/gdpr`,
  //     lastModified: now,
  //     changeFrequency: 'yearly',
  //     priority: 0.2,
  //   },
  //   {
  //     url: `${BASE_URL}/security`,
  //     lastModified: now,
  //     changeFrequency: 'yearly',
  //     priority: 0.2,
  //   },
  // ];

  return [...publicPages, ...authPages];
}
