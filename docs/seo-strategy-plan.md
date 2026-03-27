# TenderCopilot SEO Strategy Plan

**Site:** https://tender-copilot-kappa.vercel.app
**Business:** SaaS platform for Greek public procurement/tender management
**Target Market:** Greek businesses participating in public tenders (dimosii diagonismoi)
**Value Proposition:** "Analyze documents, check eligibility, and prepare proposals 90% faster"
**Date:** 2026-03-27
**Timeframe:** 6-month rolling plan (Q2-Q3 2026)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Audit](#2-current-state-audit)
3. [Competitive Landscape](#3-competitive-landscape)
4. [Technical Foundation (Month 1)](#4-technical-foundation-month-1)
5. [Content Strategy (Months 1-3)](#5-content-strategy-months-1-3)
6. [On-Page Optimization (Months 1-2)](#6-on-page-optimization-months-1-2)
7. [International SEO (Months 2-3)](#7-international-seo-months-2-3)
8. [AI Search Readiness / GEO (Months 2-3)](#8-ai-search-readiness--geo-months-2-3)
9. [Link Building (Ongoing)](#9-link-building-ongoing)
10. [Measurement and KPIs](#10-measurement-and-kpis)
11. [Implementation Roadmap](#11-implementation-roadmap)

---

## 1. Executive Summary

TenderCopilot operates in the niche intersection of AI-powered SaaS and Greek public procurement -- a EUR 30 billion annual market. The site currently has zero SEO infrastructure: no robots.txt, no sitemap, no structured data, no canonical URLs, no hreflang tags, and the landing page is client-side rendered with `ssr: false`. This means the site is essentially invisible to search engines and AI answer engines.

The opportunity is significant. Greek-language competition for procurement software keywords is low (dominated by government portals like Promitheus/ESIDIS and a handful of players like iSupplies and CosmoONE). English-language competition is moderate but fragmented. By executing this plan, TenderCopilot can achieve first-page rankings for 15-20 high-intent Greek keywords within 3-4 months and establish AI search visibility within 2-3 months.

**Priority order:**
1. Fix critical rendering and crawlability blockers (Week 1-2)
2. Implement technical SEO foundation (Month 1)
3. Launch content engine and on-page optimization (Months 1-3)
4. International SEO and GEO optimization (Months 2-3)
5. Link building and authority development (Ongoing)

---

## 2. Current State Audit

### Critical Issues Found

| Issue | Severity | Impact |
|-------|----------|--------|
| Landing page uses `ssr: false` (client-only rendering) | CRITICAL | Google cannot index any landing page content |
| No `robots.txt` | HIGH | No crawler directives; dashboard/API routes exposed |
| No `sitemap.xml` | HIGH | Search engines cannot discover pages efficiently |
| No structured data / JSON-LD | HIGH | No rich results eligibility |
| No canonical URLs | HIGH | Potential duplicate content issues |
| No hreflang tags | HIGH | Greek/English content not linked for search engines |
| `localePrefix: 'never'` in i18n routing | MEDIUM | Same URLs serve different languages without differentiation |
| No Open Graph / Twitter meta tags | MEDIUM | Poor social sharing appearance |
| Inline SVG favicon (data URI) | LOW | Not crawlable as a standard favicon |
| Dashboard mockup image lacks proper alt text | LOW | Missed image SEO opportunity |

### Site Architecture

```
/ .......................... Landing page (client-rendered, NO SSR)
/login .................... Auth page (not indexable)
/register ................. Auth page (not indexable)
/dashboard ................ Protected (not indexable)
/tenders .................. Protected (not indexable)
/tenders/[id] ............. Protected (not indexable)
/company .................. Protected (not indexable)
/analytics ................ Protected (not indexable)
/settings ................. Protected (not indexable)
/api/* .................... API routes (must be blocked)
```

**Key observation:** Only the landing page (/) and auth pages (/login, /register) are public-facing. The entire product is behind authentication. This means SEO must focus on content marketing pages that do not yet exist (blog, feature pages, guides, comparisons).

---

## 3. Competitive Landscape

### Direct Competitors (Greece)

| Competitor | URL | Strengths | SEO Presence |
|------------|-----|-----------|--------------|
| **iSupplies** | isupplies.gr | Established eProcurement platform, ISO certified | Moderate Greek SEO |
| **CosmoONE** (SOFTONE) | cosmo-one.gr | Full tender lifecycle, large enterprise clients | Strong brand, moderate SEO |
| **Promitheies.gr** | promitheies.gr | Tender information aggregator, high domain authority | Strong Greek SEO for tender keywords |
| **Contracts.gr** | contracts.gr | Free tender notifications, broad coverage | Strong content SEO |
| **DDA** | dda.com.gr | Public tender information service | Moderate |

### International Competitors

| Competitor | URL | Relevance |
|------------|-----|-----------|
| **Inventive.ai** | inventive.ai | AI tender management, strong content marketing |
| **SUNP** | sunp.xyz | AI tender management platform |
| **Tender Service** | tender-service.com | International tender information |

### Competitive Gap Analysis

- **iSupplies and CosmoONE** focus on procurement execution (e-tendering), not AI-powered analysis. TenderCopilot's AI differentiator is uncontested in Greece.
- **Promitheies.gr and Contracts.gr** are information/aggregation sites, not SaaS tools. They rank for informational queries but not for solution-seeking queries.
- **No Greek competitor** is producing educational content about using AI for tender management.
- **No Greek competitor** has structured data or GEO optimization.

**TenderCopilot's SEO moat:** First-mover advantage in Greek-language AI procurement content. The Greek market has low keyword competition for long-tail procurement SaaS terms.

---

## 4. Technical Foundation (Month 1)

### 4.1 CRITICAL: Fix SSR for Landing Page

**Current problem:** `src/app/page.tsx` uses `{ ssr: false }` which means search engines see an empty `<div>` with no content.

**Fix:** Change the landing page to server-side rendered.

```tsx
// src/app/page.tsx -- BEFORE (broken for SEO)
import nextDynamic from 'next/dynamic';
export const dynamic = 'force-dynamic';
const LandingPage = nextDynamic(
  () => import('@/components/landing/landing-page').then(mod => mod.LandingPage),
  { ssr: false }  // <-- Google sees nothing
);

// src/app/page.tsx -- AFTER (SEO-friendly)
import { LandingPage } from '@/components/landing/landing-page';

export default function RootPage() {
  return (
    <div className="bg-white text-[#1a1a2e]">
      <LandingPage />
    </div>
  );
}
```

**Priority:** Week 1. Nothing else matters if the landing page is invisible.

### 4.2 robots.txt

Create `src/app/robots.ts`:

```ts
import type { MetadataRoute } from 'next';

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
          '/company/',
          '/analytics/',
          '/settings/',
          '/tasks/',
          '/fakeloi/',
          '/resources/',
        ],
      },
      {
        userAgent: 'GPTBot',
        allow: '/',
      },
      {
        userAgent: 'ChatGPT-User',
        allow: '/',
      },
      {
        userAgent: 'Claude-Web',
        allow: '/',
      },
      {
        userAgent: 'PerplexityBot',
        allow: '/',
      },
    ],
    sitemap: 'https://tender-copilot-kappa.vercel.app/sitemap.xml',
  };
}
```

### 4.3 sitemap.xml

Create `src/app/sitemap.ts`:

```ts
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://tender-copilot-kappa.vercel.app';
  const now = new Date().toISOString();

  return [
    { url: baseUrl, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${baseUrl}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/register`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    // Add blog posts, feature pages, and guides as they are created
    // { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    // { url: `${baseUrl}/features/document-analysis`, ... },
  ];
}
```

### 4.4 Enhanced Metadata

Update `src/app/layout.tsx` metadata:

```ts
export const metadata: Metadata = {
  metadataBase: new URL('https://tender-copilot-kappa.vercel.app'),
  title: {
    default: 'TenderCopilot - AI Diacheirisi Diagonismon Dimosiou | Smart Tender Management',
    template: '%s | TenderCopilot',
  },
  description: 'Analyste eggrafa, elegxte epileximotita kai etoimaste prosfores 90% grigora. I exipni platforma AI gia dimosious diagonismous stin Ellada. Analyze tender documents, check eligibility, and prepare proposals 90% faster.',
  keywords: [
    'tender management', 'diacheirisi diagonismon', 'dimosii diagonismoi',
    'dimosies prosfores', 'AI diagonismoi', 'procurement software Greece',
    'elegchos epileximotitas', 'analysi eggrafon diagonismou',
    'TenderCopilot', 'logismiko prosfores',
  ],
  authors: [{ name: 'TenderCopilot' }],
  creator: 'TenderCopilot',
  openGraph: {
    type: 'website',
    locale: 'el_GR',
    alternateLocale: 'en_US',
    url: 'https://tender-copilot-kappa.vercel.app',
    siteName: 'TenderCopilot',
    title: 'TenderCopilot - AI Diacheirisi Diagonismon',
    description: 'I platforma AI pou voithaei tis ellinikes epicheiriseis na kerdizoun dimosious diagonismous 90% grigora.',
    images: [
      {
        url: '/images/og-image.png',  // Create this: 1200x630px
        width: 1200,
        height: 630,
        alt: 'TenderCopilot - Smart Tender Management Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TenderCopilot - AI Tender Management',
    description: 'Analyze documents, check eligibility, and prepare proposals 90% faster.',
    images: ['/images/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://tender-copilot-kappa.vercel.app',
    languages: {
      'el': 'https://tender-copilot-kappa.vercel.app',
      'en': 'https://tender-copilot-kappa.vercel.app/en',
    },
  },
  verification: {
    google: 'YOUR_GOOGLE_VERIFICATION_CODE',
    // yandex: 'YOUR_YANDEX_CODE',  // if targeting international
  },
};
```

### 4.5 Structured Data / JSON-LD

Create a reusable JSON-LD component and add it to the landing page.

**Organization Schema** (add to layout or landing page):

```tsx
// src/components/seo/json-ld.tsx
export function OrganizationJsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'TenderCopilot',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: 'AI-powered tender management platform for Greek public procurement. Analyze documents, check eligibility, and prepare proposals 90% faster.',
    url: 'https://tender-copilot-kappa.vercel.app',
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'EUR',
      lowPrice: '39',
      highPrice: '99',
      offerCount: '3',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '50',  // Update with real numbers when available
    },
    featureList: [
      'AI Document Analysis',
      'Eligibility Check',
      'Tender Discovery',
      'AI Assistant',
      'Financial Analysis',
      'Legal Compliance Check',
    ],
    inLanguage: ['el', 'en'],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function FAQJsonLd({ faqs }: { faqs: { question: string; answer: string }[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

### 4.6 Canonical URL Strategy

Every public page must declare its canonical URL. With Next.js App Router, this is done via the `metadata` export or `generateMetadata` function in each page's `page.tsx`.

**Pattern:**
```ts
// For each page.tsx:
export const metadata: Metadata = {
  alternates: {
    canonical: 'https://tender-copilot-kappa.vercel.app/blog/example-post',
  },
};
```

### 4.7 Core Web Vitals Optimization

| Metric | Current Risk | Action |
|--------|-------------|--------|
| **LCP** | HIGH (client-rendered landing) | Enable SSR, preload hero image, use `next/image` |
| **CLS** | MEDIUM (motion animations) | Set explicit dimensions on images, font-display: swap |
| **INP** | LOW | Animations use CSS transforms (good) |
| **TTFB** | MEDIUM (Vercel cold starts) | Consider ISR for static pages |

**Specific actions:**
1. Replace `<img>` tags in hero with `next/image` for automatic optimization
2. Add `width` and `height` to all images to prevent CLS
3. Use `font-display: swap` (already handled by `next/font`)
4. Convert landing page to ISR with `revalidate: 3600` instead of `force-dynamic`
5. Create a proper favicon file in `/public/favicon.ico` and `/public/icon.svg`
6. Create OG image at `/public/images/og-image.png` (1200x630px)

### 4.8 Proper Favicon

Replace the inline SVG data URI with proper favicon files:

```
public/
  favicon.ico          (32x32)
  icon.svg             (scalable)
  apple-touch-icon.png (180x180)
```

---

## 5. Content Strategy (Months 1-3)

### 5.1 Keyword Research for the Greek Procurement Market

#### Primary Keywords (Greek) -- High Intent

| Keyword (Greek) | Transliteration | English Equivalent | Search Intent | Priority |
|-----|-----|-----|-----|-----|
| diacheirisi diagonismon | diacheirisi diagonismon | tender management | Commercial | P0 |
| logismiko diagonismon dimosiou | logismiko diagonismon dimosiou | public tender software | Commercial | P0 |
| dimosii diagonismoi | dimosii diagonismoi | public tenders | Informational | P0 |
| analysi eggrafon diagonismou | analysi eggrafon diagonismou | tender document analysis | Commercial | P0 |
| elegchos epileximotitas diagonismou | elegchos epileximotitas | tender eligibility check | Commercial | P1 |
| AI diacheirisi prosferon | AI diacheirisi prosferon | AI bid management | Commercial | P1 |
| proetoimasia prosforas dimosiou | proetoimasia prosforas dimosiou | public tender proposal preparation | Transactional | P1 |
| protheories diagonismon | protheories diagonismon | tender deadlines | Informational | P2 |
| kritiria epileximotitas | kritiria epileximotitas | eligibility criteria | Informational | P2 |
| ESIDIS / Promitheas voeitheia | ESIDIS / Promitheas | ESIDIS / Prometheus help | Informational | P2 |

#### Primary Keywords (English) -- Supporting

| Keyword | Search Volume Est. | Competition | Priority |
|---------|-------------------|-------------|----------|
| tender management software | Medium | High | P1 |
| procurement software Greece | Low | Low | P0 |
| AI tender analysis | Low-Medium | Medium | P1 |
| tender eligibility checker | Low | Low | P0 |
| public procurement Greece | Low-Medium | Medium | P2 |
| ESIDIS tender software | Very Low | Very Low | P0 |

#### Long-Tail Keywords (Greek, transliterated)

- "pos na kerdiso diagonismo dimosiou" (how to win a public tender)
- "odigos ipovolis prosforas sto ESIDIS" (guide to submitting a bid on ESIDIS)
- "dikaiologitika diagonismou dimosiou" (public tender required documents)
- "pistopoiitika ISO gia diagonismous" (ISO certifications for tenders)
- "AI logismiko gia prosfores" (AI software for bids)
- "analysi diakirikseon" (tender notice analysis)
- "provlepsi nikis diagonismou" (tender win prediction)
- "automatopoiisi diagonismon" (tender automation)

### 5.2 Content Hub Architecture

Create a content hub structure that builds topical authority:

```
/blog ............................ Blog listing page
/blog/[slug] ..................... Individual blog posts
/features ........................ Features overview
/features/document-analysis ...... Feature detail page
/features/eligibility-check ...... Feature detail page
/features/tender-discovery ....... Feature detail page
/features/ai-assistant ........... Feature detail page
/guides .......................... Guides listing
/guides/[slug] ................... Individual guides
/glossary ........................ Procurement glossary (GR/EN)
/comparisons ..................... Comparison landing
/comparisons/[slug] .............. vs-competitor pages
```

### 5.3 Blog Content Calendar (Months 1-3)

#### Month 1: Foundation Content (4 posts)

| Week | Title (Greek / English) | Type | Target Keyword |
|------|------------------------|------|----------------|
| 1 | "Ti einai i diacheirisi diagonismon kai giati chreiazeste logismiko" / "What is Tender Management and Why You Need Software" | Pillar | diacheirisi diagonismon |
| 2 | "Odigos: Pos na ipovalete prosfora sto ESIDIS vima pros vima" / "Guide: How to Submit a Bid on ESIDIS Step by Step" | How-to Guide | ipovoli prosforas ESIDIS |
| 3 | "10 lathos pou kostarizoun tous diagonismous sas" / "10 Mistakes That Cost You Tenders" | Listicle | lathos se diagonismous |
| 4 | "Pos i AI allazei tous dimosious diagonismous to 2026" / "How AI is Changing Public Procurement in 2026" | Thought Leadership | AI diagonismoi |

#### Month 2: Feature-Focused Content (4 posts)

| Week | Title (Greek / English) | Type | Target Keyword |
|------|------------------------|------|----------------|
| 5 | "Analysi eggrafon diagonismou: apo ores se lefta" / "Tender Document Analysis: From Hours to Minutes" | Product-Led | analysi eggrafon |
| 6 | "Elegchos epileximotitas: pos na min chanoumaste chronos se akatalillous diagonismous" / "Eligibility Checking: How to Stop Wasting Time on Unqualified Tenders" | Product-Led | elegchos epileximotitas |
| 7 | "Pliros odigos gia ta dikaiologitika diagonismon dimosiou" / "Complete Guide to Public Tender Required Documents" | Comprehensive Guide | dikaiologitika diagonismou |
| 8 | "TenderCopilot vs eiro diagonismou me to cheiri: Sigrisi" / "TenderCopilot vs Manual Tender Search: Comparison" | Comparison | diacheirisi diagonismon logismiko |

#### Month 3: Authority Building (4 posts)

| Week | Title (Greek / English) | Type | Target Keyword |
|------|------------------------|------|----------------|
| 9 | "ISO pistopoiiseis gia dimosious diagonismous: Pliros odigos" / "ISO Certifications for Public Tenders: Complete Guide" | Reference | pistopoiiseis diagonismou |
| 10 | "Pos na megimatopoiisete to win rate sas se dimosious diagonismous" / "How to Maximize Your Win Rate in Public Tenders" | Strategy | win rate diagonismon |
| 11 | "I chrisi tis technitis noimosynis stin proetoimasia prosferon" / "Using AI in Tender Proposal Preparation" | Thought Leadership | AI proetoimasia prosforas |
| 12 | "Nomos 4412/2016: Oti prepei na xerete gia tis dimosies promitheies" / "Law 4412/2016: Everything You Need to Know About Public Procurement" | Legal Guide | nomos dimosion promitheion |

### 5.4 Feature Landing Pages

Create dedicated, SEO-optimized landing pages for each core feature:

**1. Document Analysis** (`/features/document-analysis`)
- H1: "AI Analysi Eggrafon Diagonismou" / "AI Tender Document Analysis"
- Target: "analysi eggrafon diagonismou", "tender document analysis"
- Content: Problem statement, how it works, demo video, testimonials, CTA
- Schema: SoftwareApplication with feature details

**2. Eligibility Check** (`/features/eligibility-check`)
- H1: "Automatopoiimenos Elegchos Epileximotitas" / "Automated Eligibility Check"
- Target: "elegchos epileximotitas", "eligibility check software"
- Content: Before/after comparison, accuracy stats, workflow diagram

**3. Tender Discovery** (`/features/tender-discovery`)
- H1: "Evresi Diagonismon apo 19+ Piges" / "Tender Discovery from 19+ Sources"
- Target: "evresi diagonismon", "vreste dimosious diagonismous"
- Content: Source list, matching algorithm explanation, alert setup

**4. AI Assistant** (`/features/ai-assistant`)
- H1: "AI Voithos Diagonismon" / "AI Tender Assistant"
- Target: "AI voithos diagonismon", "AI tender assistant"
- Content: Chat demo, use cases, prompt examples

### 5.5 FAQ Content Expansion

The current FAQ has 5 questions. Expand to 15-20 questions organized by category to maximize FAQ schema coverage:

**New FAQ Categories:**
- Getting Started (3-4 questions)
- Features and Capabilities (4-5 questions)
- Pricing and Plans (3-4 questions)
- Security and Compliance (3-4 questions)
- Integration and Technical (2-3 questions)

**New FAQ Entries to Add:**

1. "Pos syndesete to TenderCopilot me to ESIDIS/Promithea?" (How to connect TenderCopilot with ESIDIS/Prometheus)
2. "Poia glossa ypostirizei to AI?" (What languages does the AI support?)
3. "Boreis na chrisimopoiiseis to TenderCopilot gia idiotikous diagonismous?" (Can you use TenderCopilot for private tenders?)
4. "Poio einai to pososto epitychias tou AI stous elegchous epileximotitas?" (What is the AI success rate in eligibility checks?)
5. "Yparchi efarmogi gia kinita?" (Is there a mobile app?)
6. "Pos leitoyrgei i chreopoiisi?" (How does billing work?)
7. "Ti simvainei me ta dedomena mou otan akyroso?" (What happens to my data when I cancel?)
8. "Boreis na exagageis ta dedomena sou?" (Can you export your data?)
9. "Ypostirizetai i ipovoli prosforas mesa apo to TenderCopilot?" (Is bid submission supported through TenderCopilot?)
10. "Poia ine i diafora metaxi Professional kai Enterprise?" (What is the difference between Professional and Enterprise?)

### 5.6 Greek-Language SEO Considerations

**Critical points for Greek SEO:**

1. **Character encoding:** Ensure UTF-8 is properly declared. Next.js handles this by default.

2. **Greek keyword targeting:** Greek search queries use both Greek script and "Greeklish" (Latin transliteration). Target both:
   - Target the Greek script version in page content
   - Include Greeklish in meta descriptions and URL slugs
   - Example URL: `/blog/diacheirisi-diagonismon-odigos` (Greeklish slug, Greek content)

3. **URL slug strategy:** Use Greeklish (Latin transliteration) for URL slugs to avoid encoding issues:
   - GOOD: `/blog/elegchos-epileximotitas`
   - BAD: `/blog/%CE%AD%CE%BB%CE%B5%CE%B3%CF%87%CE%BF%CF%82` (encoded Greek)

4. **Greek Google search dominance:** Google holds 96%+ market share in Greece. Bing and other engines are negligible for Greek-language queries.

5. **Content depth:** Greek-language tender content is sparse online. Even moderately comprehensive content can rank quickly due to low competition.

6. **Voice search readiness:** Greek voice search is growing. Write FAQ answers in natural conversational Greek.

---

## 6. On-Page Optimization (Months 1-2)

### 6.1 Title Tag and Meta Description Optimization

| Page | Title Tag | Meta Description |
|------|-----------|------------------|
| **Homepage** | `TenderCopilot - AI Diacheirisi Diagonismon | Kerdiste Diagonismous 90% Grigora` | `To TenderCopilot analyei eggrafa, elegchei epileximotita kai etoimazei prosfores me AI. Exoikonomeiste 90% tou chronou sas stous dimosious diagonismous.` |
| **Login** | `Syndesi | TenderCopilot` | `Syndetheite ston logariasmo sas TenderCopilot kai synechiste ti diacheirisi ton diagonismon sas.` |
| **Register** | `Dimiourgiste Logariasmo - Dorean Dokimi | TenderCopilot` | `Xekiniste dorean to TenderCopilot. Analyste ta prota eggrafa diagonismou mesa se lepta. Den apaititai pistotiki karta.` |
| **Blog** | `Blog - Odigi & Symvoules gia Dimosious Diagonismous | TenderCopilot` | `Odigi, symvoules kai stratigikes gia na kerdizete dimosious diagonismous. AI, analysi eggrafon, epileximotita kai proetoimasia prosforen.` |
| **Pricing** | `Timologisi - Apli kai Diafanis | TenderCopilot` | `Xekiniste dorean. Schediastemeni gia mikres omades, anaptyxomenous organismous kai megales etaireies. Apo 39 EUR/mina.` |
| **Features** | `Dynatotites - AI Analysi, Elegchos, Euresi Diagonismon | TenderCopilot` | `Analysi eggrafon AI, automatopoiimenos elegchos epileximotitas, euresi diagonismon apo 19+ piges kai 24/7 AI voithos.` |

### 6.2 Internal Linking Strategy

**Principle:** Every page should be reachable within 3 clicks from the homepage.

**Hub-and-spoke model:**

```
Homepage
  |-- /features (hub)
  |     |-- /features/document-analysis
  |     |-- /features/eligibility-check
  |     |-- /features/tender-discovery
  |     |-- /features/ai-assistant
  |-- /blog (hub)
  |     |-- /blog/category/guides
  |     |-- /blog/category/tips
  |     |-- /blog/category/news
  |     |-- /blog/[slug] (spokes)
  |-- /guides (hub)
  |     |-- /guides/esidis-submission
  |     |-- /guides/tender-documents
  |     |-- /guides/iso-certifications
  |-- /pricing
  |-- /comparisons
        |-- /comparisons/vs-isupplies
        |-- /comparisons/vs-manual-process
```

**Contextual link rules:**
1. Every blog post links to at least 1 feature page
2. Every blog post links to at least 2 other blog posts
3. Every feature page links to relevant blog posts
4. Every page includes breadcrumb navigation
5. Footer contains links to all hub pages
6. CTA buttons always link to /register

### 6.3 URL Structure

**Rules:**
- Use Greeklish transliteration for Greek content slugs
- Keep URLs short and descriptive
- Use hyphens as word separators
- Maintain flat hierarchy (max 3 levels)

**Examples:**
```
/blog/diacheirisi-diagonismon-odigos
/blog/pos-na-kerdisete-diagonismo
/features/analysi-eggrafon
/guides/esidis-ipovoli-prosforas
/glossary/dimosies-promitheies
```

### 6.4 Heading Structure (H1-H6)

**Every page must have:**
- Exactly one H1 containing the primary keyword
- H2 sections for major content blocks
- H3 for subsections
- No heading level skipping

**Landing page current issue:** The hero section uses H1 correctly, but section headings should use consistent H2 tags.

### 6.5 Image Optimization

| Image | Current Alt | Recommended Alt |
|-------|-------------|-----------------|
| `dashboard-mockup.png` | "TenderCopilot Dashboard" | "TenderCopilot dashboard - diacheirisi diagonismon me AI analysi eggrafon kai elegcho epileximotitas" |
| `ai-chat-mockup.png` | (not used directly) | "AI voithos diagonismon - TenderCopilot chat interface me analysi aparitiseon" |
| `logo-icon.png` | (varies) | "TenderCopilot logo - AI logismiko diagonismon dimosiou" |

**Additional actions:**
1. Convert all images to WebP format with AVIF fallback
2. Use `next/image` for automatic optimization and lazy loading
3. Add `loading="eager"` only for above-the-fold images
4. Set explicit `width` and `height` attributes to prevent CLS
5. Create alt text in both Greek and English based on locale

---

## 7. International SEO (Months 2-3)

### 7.1 URL Strategy Decision

**Current setup:** `localePrefix: 'never'` -- same URL serves both languages based on browser preference. This is NOT SEO-friendly.

**Recommended approach:** Switch to subdirectory-based locale routing.

```
https://tender-copilot-kappa.vercel.app/       --> Greek (default)
https://tender-copilot-kappa.vercel.app/en/     --> English
```

**Implementation:** Update `src/i18n/routing.ts`:

```ts
export const routing = defineRouting({
  locales: ['el', 'en'],
  defaultLocale: 'el',
  localePrefix: 'as-needed',  // Changed from 'never'
  // Greek has no prefix (default), English gets /en/
});
```

### 7.2 Hreflang Implementation

Add hreflang tags to every public page. In Next.js App Router, use the `alternates` metadata:

```ts
// src/app/layout.tsx or per-page metadata
export const metadata: Metadata = {
  alternates: {
    canonical: 'https://tender-copilot-kappa.vercel.app',
    languages: {
      'el': 'https://tender-copilot-kappa.vercel.app',
      'en': 'https://tender-copilot-kappa.vercel.app/en',
      'x-default': 'https://tender-copilot-kappa.vercel.app',
    },
  },
};
```

**For blog posts with `generateMetadata`:**

```ts
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = params;
  return {
    alternates: {
      canonical: `https://tender-copilot-kappa.vercel.app${locale === 'en' ? '/en' : ''}/blog/${slug}`,
      languages: {
        'el': `https://tender-copilot-kappa.vercel.app/blog/${slug}`,
        'en': `https://tender-copilot-kappa.vercel.app/en/blog/${slug}`,
        'x-default': `https://tender-copilot-kappa.vercel.app/blog/${slug}`,
      },
    },
  };
}
```

### 7.3 Greek vs English Content Strategy

| Aspect | Greek Content | English Content |
|--------|--------------|-----------------|
| **Priority** | PRIMARY | Secondary |
| **Volume** | 100% of content | 60-70% translated |
| **Focus** | Greek procurement law, ESIDIS guides, local market | International procurement, AI/tech thought leadership |
| **Keywords** | Greek-script + Greeklish | Standard English keywords |
| **Tone** | Professional, formal (B2B norm in Greece) | Professional, accessible |
| **Legal content** | Greek procurement law (4412/2016) | EU procurement directives |

**Translation workflow:**
1. Write all content in Greek first (primary market)
2. Translate high-value pages to English (features, pricing, top blog posts)
3. Do NOT auto-translate -- use human translation for SEO quality
4. English versions should be adapted, not literal translations

### 7.4 Local Targeting Signals

1. **Google Business Profile:** Not applicable (SaaS, no physical location) -- skip
2. **Greek TLD consideration:** Consider acquiring `tendercopilot.gr` for brand protection and local signal
3. **Google Search Console:** Set geographic target to Greece for the default (Greek) version
4. **Local content signals:** Reference Greek institutions (EAADISY, ESIDIS, Promitheas), Greek laws, and Greek-specific procurement processes

---

## 8. AI Search Readiness / GEO (Months 2-3)

### 8.1 Why GEO Matters for TenderCopilot

Per Gartner, traditional search volume is expected to fall 25% by end of 2026 in favor of AI chatbots. Procurement professionals are early adopters of AI tools. When a Greek business owner asks ChatGPT or Perplexity "what software can help me with dimosii diagonismoi?", TenderCopilot must appear in the response.

### 8.2 llms.txt Implementation

Create `/public/llms.txt`:

```
# TenderCopilot

> AI-powered tender management platform for Greek public procurement.
> Helps businesses analyze tender documents, check eligibility, and
> prepare proposals 90% faster.

## Core Product

- [Homepage](https://tender-copilot-kappa.vercel.app): Main product landing
- [Features](https://tender-copilot-kappa.vercel.app/features): Product capabilities
- [Pricing](https://tender-copilot-kappa.vercel.app/pricing): Plans from EUR 39/month

## Features

- **Document Analysis**: Upload PDF/DOCX/XLSX, AI extracts requirements, deadlines, eligibility criteria
- **Eligibility Check**: AI cross-references tender requirements against company profile (94%+ accuracy)
- **Tender Discovery**: Monitors 19+ procurement platforms including ESIDIS, EU TED
- **AI Assistant**: 24/7 context-aware tender consultant with source citations

## Target Market

- Greek businesses participating in public tenders (dimosii diagonismoi)
- Procurement teams at SMEs and large organizations
- Works with ESIDIS/Promitheas (Greek National Electronic Public Procurement System)

## Key Stats

- 90% time savings in tender preparation
- 94%+ eligibility check accuracy
- 19+ procurement platforms monitored
- Supports Greek and English languages

## Guides and Resources

- [Blog](https://tender-copilot-kappa.vercel.app/blog): Procurement guides and tips
- [Guides](https://tender-copilot-kappa.vercel.app/guides): Step-by-step procurement guides
```

Also create `/public/llms-full.txt` with expanded content including FAQ answers, feature details, and pricing breakdown.

### 8.3 Content Structure for AI Citations

AI answer engines cite content that follows specific patterns. Apply these rules to all content:

**1. Definitive statements early in content:**
```
BAD:  "There are many ways to manage tenders..."
GOOD: "TenderCopilot is an AI-powered tender management platform that
       analyzes documents, checks eligibility, and prepares proposals
       90% faster for Greek public procurement."
```

**2. Structured data signals:**
- Use FAQ schema on all pages with Q&A content
- Use HowTo schema on guide pages
- Use Article schema on blog posts with author, datePublished, dateModified

**3. Passage-level optimization:**
- Each H2 section should be self-contained and independently citable
- Include statistics and specific numbers (AI loves citing stats)
- Use definition patterns: "X is [definition]" format
- Include comparison tables that AI can extract

**4. Entity optimization:**
- Consistently refer to the product as "TenderCopilot"
- Link to authoritative entities: ESIDIS, EU TED, EAADISY, ISO standards
- Build entity associations: "TenderCopilot + Greek procurement + AI"

### 8.4 AI Crawler Access

Ensure AI crawlers can access the site. In `robots.txt` (already specified above):

```
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: Google-Extended
Allow: /
```

### 8.5 Content Formats for GEO

Create content in formats that AI engines prefer:

1. **Comparison tables:** "TenderCopilot vs manual tender management"
2. **Definition pages:** Procurement glossary with clear definitions
3. **Step-by-step guides:** Numbered steps with clear outcomes
4. **Statistical claims with sources:** "94% eligibility check accuracy based on [X] tenders analyzed"
5. **Listicles with structured data:** "Top 10 tips for winning public tenders in Greece"

---

## 9. Link Building (Ongoing)

### 9.1 Greek Procurement Directories and Portals

| Target | URL | Strategy |
|--------|-----|----------|
| **Promitheies.gr** | promitheies.gr | Submit as a tool/resource |
| **Contracts.gr** | contracts.gr | Partner listing / sponsored content |
| **ependyseis.gr** | ependyseis.gr | Business tools directory listing |
| **startup.gr** | startup.gr | Greek startup directory |
| **Found.ation** | thefoundation.gr | Greek tech ecosystem |
| **Elevate Greece** | elevategreece.gov.gr | Official Greek startup registry |
| **SEPE** | sepe.gr | Greek IT companies association |
| **SEN/JHA (EAADISY)** | eaadisy.gr | Public procurement authority (content partnership) |

### 9.2 Industry Publications

| Target | Type | Strategy |
|--------|------|----------|
| **Capital.gr** | Greek business news | Guest article on AI in procurement |
| **Kathimerini.gr** (Economy section) | Mainstream newspaper | Press release / interview |
| **Naftemporiki.gr** | Financial newspaper | Expert commentary |
| **IT Pro (itsecuritypro.gr)** | Greek IT publication | Product review |
| **EU-Startups.com** | EU startup news | Product feature |
| **Tech.eu** | European tech news | Funding/product story |

### 9.3 Content-Driven Link Building

**1. Original Research:**
- Publish an annual "State of Public Procurement in Greece" report
- Analyze trends from publicly available tender data
- This type of content naturally earns links from journalists and researchers

**2. Free Tools:**
- Create a free "Tender Eligibility Quick Check" tool (limited version)
- Create a "Procurement Deadline Calculator" widget
- These attract links and demonstrate product value

**3. Procurement Glossary:**
- Build the most comprehensive Greek procurement glossary online
- This becomes a reference that others link to

### 9.4 Partnership Links

- **Accounting/legal firms:** Partner with Greek accounting and legal firms that serve businesses in procurement
- **Greek chambers of commerce:** Offer webinars/workshops, get listed as a resource
- **Industry associations:** SETE (tourism), SEV (employers), GSEVEE (SMEs)
- **University partnerships:** Partner with public administration programs

### 9.5 Link Building Timeline

| Month | Focus | Target Links |
|-------|-------|-------------|
| 1 | Directory submissions, Elevate Greece | 5-10 |
| 2 | Guest posts, association partnerships | 3-5 |
| 3 | Original research publication, press outreach | 5-10 |
| 4-6 | Ongoing content promotion, partnerships | 3-5/month |

---

## 10. Measurement and KPIs

### 10.1 Key Metrics

| Metric | Baseline (Now) | Month 1 Target | Month 3 Target | Month 6 Target |
|--------|---------------|----------------|----------------|----------------|
| **Indexed pages** | ~1 (maybe 0) | 10+ | 30+ | 60+ |
| **Organic traffic** | ~0 | 100 visits/month | 500 visits/month | 2,000 visits/month |
| **Greek keyword rankings (top 20)** | 0 | 5 keywords | 15 keywords | 30 keywords |
| **Domain Rating (Ahrefs)** | ~0 | 5 | 15 | 25 |
| **Referring domains** | 0 | 10 | 30 | 60 |
| **Core Web Vitals pass** | Fail | Pass | Pass | Pass |
| **AI search mentions** | 0 | Tracking started | 3-5 queries | 10+ queries |
| **Organic signups** | 0 | 5/month | 20/month | 50/month |

### 10.2 Tools

| Tool | Purpose | Cost |
|------|---------|------|
| **Google Search Console** | Indexing, queries, CTR, Core Web Vitals | Free |
| **Google Analytics 4** | Traffic, conversions, user behavior | Free |
| **Ahrefs Lite** | Keyword tracking, backlink monitoring, competitor analysis | ~$99/month |
| **PageSpeed Insights** | Core Web Vitals monitoring | Free |
| **Google Rich Results Test** | Structured data validation | Free |
| **Screaming Frog (free tier)** | Technical SEO auditing (up to 500 URLs) | Free |
| **AI Search Monitoring** | Manual checks on ChatGPT, Perplexity, Google AI Overviews | Manual/Free |
| **Otterly.ai or GEO tracking** | AI search visibility tracking | ~$50-100/month |

### 10.3 Reporting Cadence

| Report | Frequency | Audience | Content |
|--------|-----------|----------|---------|
| **SEO Dashboard** | Weekly | Internal team | Traffic, rankings, indexing status |
| **Monthly SEO Report** | Monthly | Stakeholders | Full metrics, content performance, link acquisition |
| **Quarterly SEO Review** | Quarterly | Leadership | ROI analysis, strategy adjustments, competitive changes |

### 10.4 Conversion Tracking

Set up the following GA4 events:
- `sign_up` -- registration completed
- `page_view` -- with custom dimension for content type (blog, feature, guide)
- `scroll_depth` -- 25%, 50%, 75%, 100%
- `cta_click` -- track which CTAs drive conversions
- `blog_to_signup` -- attribution from blog to signup

---

## 11. Implementation Roadmap

### Week 1-2: Emergency Fixes (CRITICAL)

- [ ] **Fix SSR on landing page** -- Remove `ssr: false`, make landing page server-rendered
- [ ] **Create `robots.txt`** via `src/app/robots.ts`
- [ ] **Create `sitemap.xml`** via `src/app/sitemap.ts`
- [ ] **Add `metadataBase`** to root layout
- [ ] **Create OG image** (1200x630px) at `/public/images/og-image.png`
- [ ] **Create proper favicon files** in `/public/`
- [ ] **Set up Google Search Console** and submit sitemap
- [ ] **Set up Google Analytics 4**

### Week 3-4: Technical SEO (Month 1)

- [ ] **Add structured data** (Organization, SoftwareApplication, FAQ schemas)
- [ ] **Add canonical URLs** to all public pages
- [ ] **Optimize Core Web Vitals** (next/image, font loading, ISR)
- [ ] **Enhance metadata** (titles, descriptions, OG tags per page)
- [ ] **Add breadcrumb navigation** to all pages
- [ ] **Create blog infrastructure** (`/blog` route with MDX or CMS)
- [ ] **Create features page infrastructure** (`/features/*` routes)

### Month 2: Content Launch & International SEO

- [ ] **Publish first 4 blog posts** (Greek, with English translations for top 2)
- [ ] **Create 4 feature landing pages** (document analysis, eligibility, discovery, AI assistant)
- [ ] **Switch to `localePrefix: 'as-needed'`** for URL-based locale routing
- [ ] **Implement hreflang tags** on all public pages
- [ ] **Create `llms.txt`** and `llms-full.txt`
- [ ] **Submit to 5-10 Greek directories**
- [ ] **Start procurement glossary** (20 terms)
- [ ] **Expand FAQ to 15-20 questions** with FAQ schema

### Month 3: Scale & Authority

- [ ] **Publish 4 more blog posts** (months 2 content calendar)
- [ ] **Create comparison pages** (vs manual process, vs competitors)
- [ ] **Publish "State of Greek Procurement" mini-report**
- [ ] **Secure 2-3 guest posts** on Greek business/tech publications
- [ ] **Create free eligibility checker tool** (public, lead gen)
- [ ] **Expand glossary to 50 terms**
- [ ] **AI search visibility audit** -- check mentions on ChatGPT, Perplexity, Google AI Overviews

### Months 4-6: Growth & Optimization

- [ ] **Continue publishing 4 blog posts/month**
- [ ] **Build programmatic SEO pages** (tender category pages if data allows)
- [ ] **Monthly backlink outreach campaign**
- [ ] **A/B test landing page titles and CTAs**
- [ ] **Explore video content** (YouTube SEO for Greek procurement tutorials)
- [ ] **Quarterly strategy review and adjustment**

---

## Appendix A: Quick-Reference Technical Checklist

```
[x] = Done    [ ] = To do    [!] = Critical/Urgent

Technical SEO
[!] Fix SSR (landing page currently invisible to crawlers)
[ ] robots.txt
[ ] sitemap.xml
[ ] Canonical URLs on all pages
[ ] metadataBase in root layout
[ ] Structured data (Organization, SoftwareApplication, FAQ, Article)
[ ] Breadcrumb navigation + BreadcrumbList schema
[ ] Proper favicon (ico, svg, apple-touch-icon)
[ ] OG image (1200x630)
[ ] Core Web Vitals pass
[ ] 404 page optimization
[ ] Redirect strategy for URL changes

Content
[ ] Blog infrastructure
[ ] Feature landing pages (4)
[ ] Expanded FAQ (15-20 questions)
[ ] Procurement glossary
[ ] ESIDIS/Promitheas guides

International
[ ] Switch localePrefix to 'as-needed'
[ ] Hreflang tags on all pages
[ ] Greek URL slug strategy (Greeklish)
[ ] Google Search Console geographic targeting

GEO / AI Search
[ ] llms.txt
[ ] llms-full.txt
[ ] AI crawler access in robots.txt
[ ] Passage-level content optimization
[ ] Entity consistency (TenderCopilot brand)

Link Building
[ ] Greek directory submissions
[ ] Elevate Greece registration
[ ] Guest post pipeline
[ ] Partnership outreach list

Analytics
[ ] Google Search Console setup
[ ] Google Analytics 4 setup
[ ] Conversion tracking (sign_up, CTA clicks)
[ ] Keyword rank tracking (Ahrefs)
[ ] AI search monitoring
```

## Appendix B: Competitor Keyword Gap Opportunities

Based on competitive analysis, these are keywords where competitors rank but TenderCopilot does not yet have content:

| Keyword (Greeklish) | Competitor Ranking | Content to Create |
|---|---|---|
| dimosii diagonismoi | promitheies.gr, contracts.gr | Blog: comprehensive guide |
| ipovoli prosforas ESIDIS | eprocurement.gov.gr | Guide: step-by-step tutorial |
| dikaiologitika diagonismou | various forums | Blog: complete document checklist |
| nomos 4412/2016 | legal sites | Guide: law explained for businesses |
| elegchos pistopoiitikon | various | Feature page + blog post |
| protheomia diagonismou | contracts.gr | Tool: deadline calculator |

## Appendix C: Content Brief Template

For each new content piece, fill out this brief before writing:

```
Title (Greek):
Title (English):
URL slug:
Primary keyword:
Secondary keywords (3-5):
Search intent (informational/commercial/transactional):
Target persona:
Content type (blog/guide/landing/comparison):
Word count target:
H1:
H2 outline:
Internal links to include (min 3):
External links to include (min 2):
CTA:
Schema type:
```

---

## Sources

Research informing this strategy was conducted on 2026-03-27 from the following:

- [Inventive.ai - Tender Management Guide](https://www.inventive.ai/blog-posts/tender-management-a-complete-guide)
- [Growth.cx - B2B SaaS SEO Agency Guide 2026](https://growth.cx/blog/b2b-saas-seo-agency-guide/)
- [Gravitate - B2B SaaS SEO Strategies 2026](https://www.gravitatedesign.com/blog/b2b-saas-seo-strategies/)
- [RevenueZen - B2B SaaS SEO Strategy Guide](https://revenuezen.com/b2b-saas-seo-strategy/)
- [SeoProfy - B2B SaaS SEO Guide 2026](https://seoprofy.com/blog/b2b-saas-seo/)
- [First Page Sage - B2B SaaS SEO Best Practices](https://firstpagesage.com/seo-blog/b2b-saas-seo-best-practices/)
- [DJamware - Next.js SEO Optimization Guide 2026](https://www.djamware.com/post/697a19b07c935b6bb054313e/next-js-seo-optimization-guide--2026-edition)
- [JSDevSpace - SEO in Next.js 16](https://jsdevspace.substack.com/p/how-to-configure-seo-in-nextjs-16)
- [LLMrefs - GEO Guide 2026](https://llmrefs.com/generative-engine-optimization)
- [Search Engine Land - Mastering GEO 2026](https://searchengineland.com/mastering-generative-engine-optimization-in-2026-full-guide-469142)
- [Similarweb - GEO Complete Guide 2026](https://www.similarweb.com/blog/marketing/geo/what-is-geo/)
- [Promitheies.gr - Greek Tender Portal](https://www.promitheies.gr/branch/logismiko)
- [iSupplies - Greek eProcurement Platform](https://isupplies.gr/)
- [CosmoONE - Electronic Procurement](https://www.cosmo-one.gr/en/)
- [ESIDIS - National Electronic Public Procurement System](https://www.interregeurope.eu/good-practices/national-system-of-electronic-public-procurement-esidis)
- [Promitheus Portal](https://portal.eprocurement.gov.gr/)
- [Trade.gov - Greece Selling to Public Sector](https://www.trade.gov/country-commercial-guides/greece-selling-public-sector)
- [Build with Matija - Next.js Hreflang](https://www.buildwithmatija.com/blog/nextjs-advanced-seo-multilingual-canonical-tags)
- [SimpleTiger - SaaS SEO Plan 2026](https://www.simpletiger.com/guide/saas-seo)
- [Skale - SaaS SEO Guide 2026](https://skale.so/saas-seo/guide/)
