# TenderCopilot -- Full SEO Audit Report

**Site:** https://tender-copilot-kappa.vercel.app
**Date:** 2026-03-27
**Audited by:** 12 parallel SEO analysis agents (Technical, Content, Schema, Sitemap, Images, GEO, Hreflang, Page, Strategy, Programmatic, Competitor, Local)

---

## EXECUTIVE SUMMARY

### Overall SEO Health Score: 12/100 -- CRITICAL

| Category | Score | Weight | Weighted | Grade |
|----------|-------|--------|----------|-------|
| Technical SEO | 19/100 | 22% | 4.18 | F |
| Content Quality / E-E-A-T | 24/100 | 23% | 5.52 | F |
| On-Page SEO | 30/100 | 20% | 6.00 | F |
| Schema / Structured Data | 0/100 | 10% | 0.00 | F |
| Performance (CWV) | 20/100 | 10% | 2.00 | F |
| AI Search Readiness (GEO) | 8/100 | 10% | 0.80 | F |
| Images | 25/100 | 5% | 1.25 | F |
| **TOTAL** | | | **19.75/100** | **F** |

### Top 5 Critical Issues

1. **Landing page uses `ssr: false`** -- the ENTIRE public-facing content is invisible to all search engines and AI crawlers
2. **No robots.txt, no sitemap.xml** -- search engines have zero crawl guidance
3. **Zero structured data** -- no JSON-LD, no Open Graph, no Twitter Cards
4. **Exposed API routes leak secrets** -- `/api/health` leaks DB connection string, `/api/test-register` allows unauthenticated user creation
5. **Fake social proof + dead footer links** -- fabricated company logos, non-functional `<span>` links pretending to be navigation

### Top 5 Quick Wins

1. Remove `{ ssr: false }` from `src/app/page.tsx` (5 min fix, unlocks ALL content for crawlers)
2. Add `src/app/robots.ts` + `src/app/sitemap.ts` (already created by sitemap agent)
3. Add Open Graph + Twitter Card meta tags to `layout.tsx` (15 min)
4. Add FAQPage JSON-LD schema (15 min, enables FAQ rich results)
5. Delete/protect debug API routes (30 min, fixes security vulnerability)

---

## CATEGORY DEEP DIVES

---

### 1. TECHNICAL SEO -- 19/100

#### Crawlability (5/20)
- **robots.txt**: MISSING (404)
- **sitemap.xml**: MISSING (404)
- **API exposure**: 11 API routes publicly accessible without auth, including:
  - `/api/health` -- leaks partial DB connection string, env var status
  - `/api/test-register` -- allows unauthenticated user creation
  - `/api/test-auth` -- leaks NextAuth version and config
  - `/api/debug-analysis` -- exposes internal AI analysis
- **404 handling**: Proper status codes but no custom error pages

#### Indexability (3/15)
- No `<link rel="canonical">` on any page
- No `<meta name="robots">` tags
- No `X-Robots-Tag` headers
- No Open Graph or Twitter Card tags
- Only basic `title` and `description` in root layout metadata
- Zero per-page metadata -- all 14+ pages share the same generic title

#### Security Headers (2/15)
- HTTPS: Yes (Vercel enforces)
- **ALL security headers MISSING**: CSP, X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- No `headers()` function in `next.config.js`

#### SSR / JavaScript Rendering (0/10)
- **CRITICAL**: Homepage uses `ssr: false` + `force-dynamic`
- Search engines see an empty `<div>` with zero content
- All headings, text, images, FAQ, pricing -- invisible to crawlers
- This is the single most damaging SEO issue

#### Mobile (8/10)
- Viewport meta tag present
- Tailwind responsive classes used throughout
- Hamburger menu implemented
- Missing: `theme-color`, `apple-touch-icon`, `manifest.json`

---

### 2. CONTENT QUALITY / E-E-A-T -- 24/100

#### Content Quality (38/100)
- Only 1 public page (landing page) with ~800 words
- No blog, no guides, no documentation
- No standalone pages for /about, /pricing, /features
- All content client-rendered (invisible to crawlers)
- Meta description English-only on a Greek-primary site

#### E-E-A-T Breakdown

| Signal | Score | Key Finding |
|--------|-------|-------------|
| **Experience** | 10/25 | No case studies, no testimonials, FAKE company logos |
| **Expertise** | 12/25 | Domain knowledge shown but no blog/guides to demonstrate it |
| **Authoritativeness** | 0/25 | No company info, no team page, no certifications, no social links |
| **Trustworthiness** | 0/25 | Privacy, Terms, GDPR pages all 404 despite claiming compliance |

#### Critical Trust Issues
- **Fake logos** in StatsSection: "Trusted Company", "Enterprise Corp", "Gov Solutions" -- fabricated names
- **Dead footer links**: All 12 footer links are `<span>` elements with `cursor-pointer` but NO `href` -- purely decorative
- **GDPR violation risk**: Claims GDPR compliance but has no privacy policy, terms, or cookie consent
- **Same mockup image** reused for all 4 feature tabs

---

### 3. ON-PAGE SEO -- 30/100

#### Title Tag (6/10)
- "TenderCopilot -- Smart Tender Management" (42 chars)
- Primary keyword at the end, no benefit statement
- Recommended: "AI Tender Management for Greek Procurement | TenderCopilot"

#### Meta Description (6/10)
- 124 chars (ideal: 150-160), no CTA
- Good: "90% faster" differentiator, relevant keywords
- Missing: Greek-language version

#### Heading Hierarchy (6/10)
- H1 exists and is unique: "Win every tender, effortlessly"
- Proper H1 > H2 > H3 nesting
- H2s use marketing language, not keywords

#### Internal Linking (2/10)
- Navigation uses `<button onClick>` instead of `<a href>` -- uncrawlable
- Footer links are non-functional `<span>` elements
- Zero outbound links to authoritative sources
- All CTAs point to /register -- no feature-specific pages

#### Content (3/10)
- ~600 words visible content (thin for homepage)
- "tender management" appears only 1 time (in title)
- "procurement" appears only 2 times
- "Greek" appears only 1 time

---

### 4. SCHEMA / STRUCTURED DATA -- 0/100

**Zero structured data of any kind exists.**

| Schema Type | Status | Impact |
|-------------|--------|--------|
| JSON-LD | NONE | No rich results possible |
| Open Graph | NONE | No social sharing previews |
| Twitter Cards | NONE | No Twitter previews |
| Organization | MISSING | No knowledge panel |
| SoftwareApplication | MISSING | No software rich results |
| FAQPage | MISSING | FAQ rich results wasted |
| Product/Offer | MISSING | No pricing in SERPs |
| WebSite + SearchAction | MISSING | No sitelinks searchbox |
| BreadcrumbList | MISSING | No breadcrumb trails |

**Ready-to-use JSON-LD code has been generated for all 8 schema types** -- see Schema agent report.

---

### 5. IMAGES -- 25/100

#### Critical Issues
- **No OG image** -- social sharing shows no preview
- **No Twitter Card image**
- **Incomplete favicon** -- inline SVG only, no .ico, no apple-touch-icon
- **3 landing images use raw `<img>`** instead of `next/image` -- no WebP/AVIF, no srcset, no optimization
- **15 of 18 images in public/ are orphaned** -- never referenced in code

#### Image Details
| Issue | Files Affected |
|-------|---------------|
| Raw `<img>` (no optimization) | hero-section.tsx, ai-showcase.tsx, features-bento.tsx |
| Poor alt text ("TEC") | layout.tsx, ai-assistant-panel.tsx |
| No width/height (CLS risk) | hero-section.tsx, ai-showcase.tsx, features-bento.tsx |
| All PNGs, no modern formats | All 18 images |

---

### 6. AI SEARCH READINESS (GEO) -- 8/100

| Factor | Score |
|--------|-------|
| AI Crawler Accessibility | 0.2/10 |
| Content Citability | 1/10 (effective, due to SSR) |
| Brand Mention Signals | 0/10 |
| AI Overview Optimization | 2/10 |

- **robots.txt**: Missing -- no AI bot directives
- **llms.txt**: Missing
- **sitemap.xml**: Missing
- **SSR disabled**: All content invisible to GPTBot, ClaudeBot, PerplexityBot
- **Brand presence**: Zero indexed mentions of TenderCopilot online
- **Content quality** is actually good (7/10) but **effectively 0/10** because crawlers can't see it

---

### 7. HREFLANG / INTERNATIONAL SEO

#### Two Competing i18n Systems
1. **next-intl** (configured but underutilized) -- `localePrefix: 'never'`
2. **Custom client-side i18n** (actually used by 57 components) -- localStorage-based

#### Impact
- `localePrefix: 'never'` = No `/el/` or `/en/` URLs
- English version is **completely invisible** to search engines
- 31 component files have hardcoded Greek strings
- Meta title/description English-only on Greek-default site
- No hreflang tags, no x-default, no og:locale

#### Recommendation
- Change to `localePrefix: 'as-needed'`
- Migrate all 57 components from custom i18n to next-intl
- Add hreflang tags with x-default pointing to Greek

---

### 8. PROGRAMMATIC SEO OPPORTUNITIES

The codebase contains rich data that could power **350-560 programmatic pages**:

| Page Type | Est. Pages | Monthly Traffic Potential |
|-----------|-----------|------------------------|
| CPV Code Landing Pages | 100-200 | 2,000-5,000 |
| Category Hubs (promithies, ypiresies, erga) | 3-5 | 1,000-3,000 |
| Platform Guides (ESIDIS, KIMDIS, TED...) | 10-15 | 1,500-4,000 |
| Contracting Authority Pages | 200-300 | 1,500-3,000 |
| Knowledge Guides (Law 4412, ESPD...) | 10-20 | 800-2,000 |
| Regional Pages | 15-20 | 400-1,000 |
| **Total** | **~350-560** | **~7,200-18,000** |

Data sources already in codebase:
- `prisma/schema.prisma` -- Tender model with CPV codes, authorities, platforms
- `src/data/tender-sources.ts` -- 30+ procurement sources
- `src/lib/kad-cpv-map.ts` -- 80+ CPV code mappings
- `src/server/knowledge/` -- Law 4412, checklists, ESPD, common mistakes

---

### 9. COMPETITOR LANDSCAPE

#### Direct Greek Competitors
| Competitor | Strengths | TenderCopilot Advantage |
|------------|-----------|----------------------|
| promitheies.gr | Market leader, 460K+ notices | AI analysis, eligibility check |
| e-tenders.gr | Since 2007, established trust | AI-powered, modern SaaS |
| iSupplies.gr | Used by hospitals/municipalities | End-to-end bid management |
| contracts.gr | Simple tender listings | Full proposal preparation |
| DDA (dda.com.gr) | 6,000+ agency coverage | AI assistant, document analysis |

#### European AI Competitors (no Greek market presence)
Tendium (Sweden), Altura.io (Netherlands), Tenderbolt.ai (France), Brainial (Netherlands), Stotles (UK)

**Key advantage**: TenderCopilot is the **only AI-powered tender SaaS built natively for Greek public procurement** (ESIDIS, KIMDIS, Law 4412).

#### Brand Name Risk
"Tender Copilot" (two words) is already a UK company on Crunchbase and G2. Consider emphasizing "TenderCopilot" (one word) + Greek market positioning.

---

### 10. LOCAL SEO -- 0.6/10

- Zero Google Business Profile
- Zero directory listings (Elevate Greece, GEMI, vrisko.gr, XO.gr)
- No NAP (Name, Address, Phone) anywhere
- No contact page, no about page
- Vercel staging URL signals nothing about Greece
- **Recommendation**: Register `tendercopilot.gr` domain

---

## PRIORITY ACTION PLAN

### P0 -- CRITICAL (Do Today)

| # | Action | Impact | Effort | Files |
|---|--------|--------|--------|-------|
| 1 | **Remove `ssr: false`** from landing page | Unlocks ALL content for crawlers | 5 min | `src/app/page.tsx` |
| 2 | **Delete/protect debug API routes** | Fixes security vulnerability | 30 min | `src/app/api/health/`, `test-register/`, `test-auth/`, `debug-analysis/` |
| 3 | **Deploy robots.ts + sitemap.ts** | Basic crawl infrastructure | Already created | `src/app/robots.ts`, `src/app/sitemap.ts` |

### P1 -- HIGH (This Week)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 4 | Add Open Graph + Twitter Card metadata | Social sharing previews | 15 min |
| 5 | Add FAQPage + Organization JSON-LD | Rich results in SERPs | 30 min |
| 6 | Add canonical URL + metadataBase | Prevent duplicate content | 10 min |
| 7 | Create OG image (1200x630) | Visual social previews | 30 min |
| 8 | Fix footer links (span -> Link) | Crawlable navigation | 30 min |
| 9 | Fix nav links (button -> a) | Crawlable navigation | 20 min |
| 10 | Remove fake company logos | Trust restoration | 10 min |
| 11 | Add security headers in next.config.js | Security + SEO signal | 20 min |

### P2 -- MEDIUM (This Month)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 12 | Create Privacy Policy, Terms, GDPR pages | Legal compliance + trust | 2 hrs |
| 13 | Create About page with company info | E-E-A-T authority | 1 hr |
| 14 | Create Contact page | Trust signal | 30 min |
| 15 | Convert `<img>` to `next/image` | Image optimization + CWV | 1 hr |
| 16 | Add hreflang tags (el/en) | International SEO | 1 hr |
| 17 | Change localePrefix to 'as-needed' | Enable EN indexing | 30 min |
| 18 | Create proper favicon set (.ico, apple-touch-icon) | Browser/bookmark support | 30 min |
| 19 | Delete 15 orphaned images from public/ | Reduce deployment size | 10 min |
| 20 | Add SoftwareApplication + Product JSON-LD | Product rich results | 30 min |

### P3 -- STRATEGIC (Next 3 Months)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 21 | Launch blog with 12 Greek procurement articles | Organic traffic pipeline | Ongoing |
| 22 | Build CPV code landing pages (programmatic) | 2,000-5,000 visits/mo | 2-3 weeks |
| 23 | Build platform guide pages (ESIDIS, KIMDIS...) | 1,500-4,000 visits/mo | 1-2 weeks |
| 24 | Create competitor comparison pages | Brand capture | 1-2 weeks |
| 25 | Register tendercopilot.gr domain | Greek geo-targeting | 1 day |
| 26 | Create Google Business Profile | Brand presence | 30 min |
| 27 | List on Greek directories (Elevate Greece, GEMI...) | Citations + backlinks | 2-3 days |
| 28 | Implement llms.txt for AI crawlers | AI search readiness | 15 min |
| 29 | Migrate custom i18n to next-intl (57 files) | SSR-compatible i18n | 1-2 weeks |
| 30 | Add real testimonials + case studies | E-E-A-T experience | Ongoing |

---

## TRAFFIC PROJECTION (6 Months)

| Source | Current | Month 3 | Month 6 |
|--------|---------|---------|---------|
| Organic Search | 0 | 200-500 | 2,000-5,000 |
| Programmatic Pages | 0 | 500-1,000 | 5,000-10,000 |
| AI Search Citations | 0 | 50-100 | 200-500 |
| Referral (directories) | 0 | 100-200 | 300-500 |
| **Total Organic** | **0** | **~850-1,800** | **~7,500-16,000** |

---

## FILES GENERATED DURING AUDIT

| File | Purpose |
|------|---------|
| `src/app/sitemap.ts` | Next.js dynamic sitemap (created by Sitemap agent) |
| `src/app/robots.ts` | Next.js robots.txt (created by Sitemap agent) |
| `docs/seo-strategy-plan.md` | Full 6-month SEO strategy (created by Strategy agent) |
| `docs/seo/competitor-analysis-2026-03-27.md` | Competitor analysis + comparison page templates |
| `docs/FULL-SEO-AUDIT-REPORT.md` | This report |

---

## KEY FILES REQUIRING CHANGES

| File | Changes Needed |
|------|---------------|
| `src/app/page.tsx` | Remove `ssr: false`, remove `force-dynamic` |
| `src/app/layout.tsx` | Add metadataBase, OG, Twitter, canonical, structured data |
| `src/components/landing/cta-footer.tsx` | Convert `<span>` to `<Link>` with real routes |
| `src/components/landing/navbar.tsx` | Convert `<button onClick>` to `<a href>` |
| `src/components/landing/stats-section.tsx` | Remove fake company logos |
| `src/components/landing/hero-section.tsx` | Convert `<img>` to `<Image>` |
| `src/components/landing/ai-showcase.tsx` | Convert `<img>` to `<Image>` |
| `src/components/landing/features-bento.tsx` | Convert `<img>` to `<Image>`, add unique images |
| `src/i18n/routing.ts` | Change `localePrefix: 'never'` to `'as-needed'` |
| `src/middleware.ts` | Activate next-intl middleware |
| `next.config.js` | Add security headers, AVIF format support |
| `src/app/api/health/route.ts` | Delete or protect |
| `src/app/api/test-register/route.ts` | Delete or protect |
| `src/app/api/test-auth/route.ts` | Delete or protect |
| `src/app/api/debug-analysis/route.ts` | Delete or protect |

---

*Report generated by 12 parallel SEO analysis agents covering: Technical SEO, Content/E-E-A-T, Schema/Structured Data, Sitemap, Images, GEO/AI Search, Hreflang/i18n, Deep Page Analysis, SEO Strategy, Programmatic SEO, Competitor Analysis, and Local SEO.*
