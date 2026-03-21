# Premium UI Redesign — Phase 1: Design System + Layout + Auth + Landing Page

**Date:** 2026-03-21
**Status:** Draft
**Context:** TenderCopilot SaaS — AI-powered tender management platform for Greek public procurement. Full end-to-end premium UI redesign, decomposed into 4 phases. This spec covers Phase 1.

---

## Research Foundation

### Methodology
- **NotebookLM deep research**: 62 sources analyzed across tender management SaaS landscape
- **Direct competitor pages analyzed**: RFPIO/Responsive, Loopio, TenderBoard, Bidsketch, PandaDoc, QorusDocs
- **Top 10 competitors profiled**: SAP Ariba, Coupa, Jaggaer, Tenderbolt.AI, Inventive AI, TenderEyes, Loopio, TenderBoard, Procore, AutoRFP.ai

### Key Strategic Insights from Research
1. **Localized document parsing** (ESHDHS, Diaygeia) is a massive competitive moat — no competitor covers Greek public procurement
2. **Frictionless UX** beats feature count — AutoRFP.ai and TenderBoard win on simplicity, not complexity
3. **AI must be context-aware co-pilot**, not chatbot — Inventive AI's full-context analysis (legal+technical+financial) is the gold standard
4. **Progressive disclosure dashboards** — show metrics first, details on drill-down (not everything at once)
5. **Concrete ROI on landing pages** — "90% faster" beats "AI-powered" every time
6. **Free-to-Supplier tier** critical for Greek SME market adoption

### UI/UX Patterns to Adopt
- **Dashboard**: Anti-clutter, progressive disclosure, side-by-side bid comparison (Procore)
- **Navigation**: Frictionless, mobile-first, integrated into existing workflows (TenderEyes)
- **Data viz**: Kanban pipeline boards over spreadsheets, color-coded status (Bidhive)
- **AI UX**: Proactive co-pilot with inline risk highlighting, one-click insert (TenderEyes SwiftClick)
- **Documents**: Digital binders, native file preview, semantic search (iBinder)
- **Onboarding**: Magic links, zero-registration supplier access (TenderBoard)
- **Landing**: Role-specific targeting, concrete metrics, low-friction CTAs (Zapro, Tenderbolt)

---

## Phase Decomposition (Full Redesign)

| Phase | Scope | Depends On |
|-------|-------|------------|
| **Phase 1** (this spec) | Design System + Layout Shell + Auth + Landing Page | Independent |
| **Phase 2** | Dashboard + Tender List + Tender Detail (all tabs) | Phase 1 |
| **Phase 3** | AI Assistant Panel + Discovery + Company Profile | Phase 2 |
| **Phase 4** | Analytics + Settings + i18n + Final Polish | Phase 3 |

Each phase follows its own spec → plan → execute → review cycle.

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Visual Style | Dark Glass Fusion | Enterprise credibility (dark) + premium depth (glass) + AI identity (glow). No competitor does this. Dual theme support (dark default + light option). |
| Landing Page Tone | AI-Forward + Professional Trust | Highlight AI as USP while maintaining procurement-grade credibility |
| Language | Full bilingual (GR + EN) | Greek market primary, but ready for expansion from day one |
| Decomposition | Foundation First (4 phases) | Build design system once, cascade to all screens |
| Tools | 21st Magic + Nano Banana + Stitch + ui-ux-pro-max | Premium component generation, custom imagery, full page layouts, design system intelligence |
| Token Format | HSL channel format (shadcn convention) | Existing 22+ components use `hsl(var(...))`. All new tokens specified as HSL channels (e.g., `240 6% 4%` not `#09090B`) to avoid migration. Hex values in this doc are for human readability — implementation uses HSL. |
| i18n Approach | Client-side context + JSON dictionaries (Phase 1); `next-intl` with URL routing deferred to Phase 4 | URL-based locale routing (`/el/...`) requires restructuring all route groups. Too risky for Phase 1. Phase 1 uses a React context provider + JSON message files for landing + auth only. |
| Landing Route | `src/app/page.tsx` IS the landing page (no marketing route group) | Next.js App Router conflicts if both `page.tsx` and `(marketing)/page.tsx` resolve to `/`. Landing page lives at root `page.tsx` with its own layout via `(marketing)/layout.tsx` wrapping only marketing sub-pages (pricing, about, etc.). |
| Landing Theme | Dark-only landing page (no theme toggle) | Landing is always dark for maximum impact. Theme toggle appears only inside the authenticated app. |
| Accent Color Migration | Cyan (`#06B6D4`) = new AI accent; Amber (`#F59E0B`) = warning only | Amber shifts from general accent to warning-specific role. `--accent` CSS variable maps to cyan in dark theme. |

---

## Phase 1 Scope

### 1. Design System — "Dark Glass Fusion"

#### 1.1 Color System

**Dark Theme (default):**

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-base` | `#09090B` (zinc-950) | Page background |
| `--bg-surface` | `#18181B` (zinc-900) | Card surfaces |
| `--bg-elevated` | `#27272A` (zinc-800) | Hover states, dropdowns |
| `--glass` | `rgba(255,255,255,0.04)` + `blur(16px)` | Glass cards |
| `--glass-border` | `rgba(255,255,255,0.08)` | Glass card borders |
| `--glass-highlight` | `inset 0 1px 0 rgba(255,255,255,0.05)` | Top edge highlight |
| `--primary` | `#3B82F6` → `#60A5FA` | Primary actions, links |
| `--accent-glow` | `#06B6D4` (cyan-500) | AI features, innovation accent |
| `--success` | `#22C55E` | Pass/win states |
| `--warning` | `#F59E0B` | Deadlines, attention |
| `--destructive` | `#EF4444` | Errors, fail states |
| `--text-primary` | `#F4F4F5` (zinc-100) | Headings |
| `--text-secondary` | `#A1A1AA` (zinc-400) | Body text |
| `--text-muted` | `#71717A` (zinc-500) | Labels, hints |

**Light Theme:**

| Token | Value |
|-------|-------|
| `--bg-base` | `#FAFAFA` |
| `--bg-surface` | `#FFFFFF` |
| `--bg-elevated` | `#F4F4F5` |
| `--glass` | `rgba(255,255,255,0.7)` + `blur(16px)` |
| `--glass-border` | `rgba(0,0,0,0.06)` |
| `--glass-highlight` | `inset 0 1px 0 rgba(255,255,255,0.8)` |
| `--text-primary` | `#09090B` |
| `--text-secondary` | `#52525B` |
| `--text-muted` | `#A1A1AA` |

**Glow Effects:**

| Effect | Value | Used On |
|--------|-------|---------|
| Primary glow | `0 0 20px rgba(59,130,246,0.15)` | Buttons on hover, active nav |
| AI glow | `0 0 24px rgba(6,182,212,0.12)` | AI features, chat panel |
| Success glow | `0 0 16px rgba(34,197,94,0.1)` | Win states, pass badges |
| Warning glow | `0 0 16px rgba(245,158,11,0.1)` | Deadline alerts |

#### 1.2 Typography

| Level | Font | Weight | Size | Usage |
|-------|------|--------|------|-------|
| Display | Inter | 700 | 48-72px | Landing hero headlines |
| H1 | Inter | 600 | 32px | Page titles |
| H2 | Inter | 600 | 24px | Section headings |
| H3 | Inter | 600 | 18px | Card titles |
| Body | Inter | 400 | 14-16px | Paragraphs, descriptions |
| Small | Inter | 400 | 12-13px | Labels, captions |
| Mono | JetBrains Mono | 400 | 13-14px | Data, numbers, IDs |

Greek character set fully supported by Inter.

#### 1.3 Spacing & Radius

| Token | Value |
|-------|-------|
| Base unit | 4px |
| Card padding | 24px |
| Section gap | 32px |
| Card radius | 16px |
| Button radius | 12px |
| Input radius | 10px |
| Badge radius | 8px |
| Avatar radius | full (50%) |

#### 1.4 Motion

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro-interaction | 150ms | ease-out | Button hover, toggle, badge |
| Layout transition | 300ms | cubic-bezier(0.16, 1, 0.3, 1) | Sidebar collapse, tab switch |
| Page transition | 400ms | ease | Route changes |
| Entrance | 500ms | cubic-bezier(0.16, 1, 0.3, 1) | Cards staggered fade-in |
| Glow pulse | 2s | ease-in-out (infinite) | AI elements subtle pulse |

`prefers-reduced-motion: reduce` → disable all animations, instant transitions.

#### 1.5 Component Upgrades

These existing shadcn components get Dark Glass Fusion treatment:

| Component | Change |
|-----------|--------|
| `Button` | Gradient primary (blue→cyan), glow on hover, 12px radius |
| `Card` | Glass background, glass-border, glass-highlight, 16px radius |
| `Input` | Dark glass bg `rgba(255,255,255,0.04)`, glow border on focus |
| `Badge` | Subtle glass bg, color-coded glow per variant |
| `Dialog` | Dark glass overlay, glass card, backdrop blur |
| `DropdownMenu` | Glass bg, subtle border, elevated shadow |
| `Tabs` | Glass pill active state with primary glow |
| `Tooltip` | Dark glass, small text, arrow |
| `Skeleton` | Shimmer animation on dark surface |
| `GlassCard` | Already exists — update to new token system |

New components to create:

| Component | Purpose |
|-----------|---------|
| `GlowButton` | Gradient button with hover glow effect |
| `GlassInput` | Input with glass background and focus glow |
| `StatCard` | Reusable number+trend card — used in landing stats section (Phase 1) and dashboard (Phase 2) |
| `FeatureCard` | Bento grid card with icon, title, description |
| `PricingCard` | Landing page pricing tier card |
| `HeroSection` | Full viewport hero with animated mesh background |
| `BentoGrid` | Asymmetric grid layout for feature showcase |
| `AnimatedMesh` | Animated gradient mesh background component |
| `LanguageToggle` | GR/EN language switcher |

---

### 2. Layout Shell

#### 2.1 Sidebar

**Current:** 260px / 68px collapsed, white/glass background.

**Dark Glass Fusion:**
- Background: `--bg-base` (#09090B) — solid dark, anchored element
- Border-right: `1px solid rgba(255,255,255,0.06)`
- Logo: Gradient icon (blue→cyan) with subtle glow, "TenderCopilot" text
- Navigation items:
  - Default: `text-muted`, no background
  - Hover: `rgba(255,255,255,0.04)` bg, `text-secondary`
  - Active: `rgba(59,130,246,0.1)` bg + `2px solid #3B82F6` left border + `text-primary`
- Separator: `rgba(255,255,255,0.06)` between main nav and bottom items
- Bottom: User avatar + name + settings icon
- Collapse: Spring animation 300ms, icons-only mode with tooltips
- Width: 260px expanded, 68px collapsed (unchanged)

#### 2.2 Topbar

**Current:** 64px, white/glass background.

**Dark Glass Fusion:**
- Background: `rgba(9,9,11,0.8)` + `backdrop-blur(16px)` — glass-on-dark
- Border-bottom: `1px solid rgba(255,255,255,0.06)`
- Height: 64px (unchanged)
- Search: Glass input `rgba(255,255,255,0.04)`, placeholder `text-muted`, primary glow on focus
- Right side:
  - Theme toggle (sun/moon icon) with smooth rotation animation
  - Notification bell with animated badge (primary glow dot)
  - User avatar dropdown (glass dropdown menu)
- Optional breadcrumb: `text-muted` → `text-secondary` hierarchy

#### 2.3 Main Content Area

- Background: `--bg-base` with subtle radial gradient overlay `radial-gradient(ellipse at top, rgba(59,130,246,0.03), transparent 50%)`
- Optional grid pattern: `rgba(255,255,255,0.02)` lines at 32px intervals
- Content container: max-width 1400px, centered, padding 24-32px
- Scroll: Custom thin scrollbar matching dark theme

---

### 3. Auth Pages (Login + Register)

**Current:** Animated gradient orbs, glass form card — functional but basic.

**Dark Glass Fusion Upgrade:**

#### 3.1 Layout (Desktop)

**Structural change:** Current auth layout is centered single-column (`max-w-[440px]`, `flex items-center justify-center`). Phase 1 changes this to a two-column grid. Below `lg` breakpoint (1024px), collapses to single column with form card centered and product showcase hidden.

- Full viewport, dark background `--bg-base`
- Animated mesh gradient background (subtle blue/cyan/purple orbs, slow movement)
- Two-column grid (`grid grid-cols-[3fr_2fr]` on desktop):
  - **Left (60%)**: Product showcase
    - Animated floating dashboard mockup with parallax
    - Or: rotating testimonial cards
    - Gradient text tagline: "Η τεχνητή νοημοσύνη που κερδίζει διαγωνισμούς"
    - Stats: "500+ αναλυθέντα έγγραφα" counter
  - **Right (40%)**: Auth form card

#### 3.2 Auth Form Card
- Glass card: `rgba(255,255,255,0.04)` + `blur(20px)` + `border: 1px solid rgba(255,255,255,0.08)`
- Glowing border on hover: `rgba(59,130,246,0.15)` transition
- Logo: Large gradient logo at top
- Inputs: `GlassInput` component — dark glass bg, glow border on focus
- Show/hide password toggle
- Submit button: `GlowButton` — gradient blue→cyan, glow on hover
- Google sign-in: Glass ghost button with Google SVG icon
- Magic link: Cyan-accent glass button with wand icon
- Error messages: Destructive color with subtle glow
- "Ξεχάσατε τον κωδικό;" link: `text-muted` → `text-primary` on hover (links to placeholder reset page)
- "Δεν έχετε λογαριασμό;" link: `text-secondary` → `text-primary` on hover
- **i18n toggle**: GR/EN pill switch at top-right of card

#### 3.3 Mobile
- Single column, form card fills viewport
- Background: simplified gradient (fewer orbs, less blur for performance)
- Product showcase hidden or minimal (logo + tagline only)

#### 3.4 Register Page
- Same layout as login
- Additional fields: name, company name
- Password strength indicator (color-coded bar)
- Terms checkbox with link to terms page

---

### 4. Landing Page

**Does not exist yet** — built from scratch.

**Target:** World-class SaaS landing page that communicates "AI-powered tender management" with enterprise credibility. Bilingual (GR/EN).

#### 4.1 Navigation Bar
- Fixed top, glass background `rgba(9,9,11,0.8)` + `blur(16px)`
- Logo (gradient) + nav links + language toggle (GR/EN) + "Είσοδος" ghost button + "Δοκιμάστε Δωρεάν" glow button
- Mobile: hamburger → glass slide-out menu
- Scroll behavior: transparent at top → glass on scroll

#### 4.2 Hero Section
- Full viewport height, dark background
- Animated mesh gradient (blue/cyan/purple orbs, slow floating)
- Grid pattern overlay `rgba(255,255,255,0.02)`
- Content:
  - Badge: "AI-Powered" glass pill with AI glow
  - Headline (Display): "Η τεχνητή νοημοσύνη που κερδίζει δημόσιους διαγωνισμούς" (GR) / "The AI that wins public tenders" (EN)
  - Subheadline: "Αναλύστε έγγραφα, ελέγξτε επιλεξιμότητα και δημιουργήστε προσφορές 90% ταχύτερα"
  - CTA row:
    - Primary: `GlowButton` "Δοκιμάστε Δωρεάν" (gradient, glow)
    - Secondary: Ghost button "Δείτε Demo" with play icon
  - Trust line: "Χωρίς πιστωτική κάρτα. Χωρίς δεσμεύσεις."
- Floating dashboard mockup: Perspective-transformed screenshot/mockup of the actual dashboard, with parallax on mouse move, subtle shadow glow

#### 4.3 Trust Bar
- Dark surface strip
- "Χρησιμοποιείται από εταιρείες σε:" + logos (placeholder grid 6-8 logos)
- Subtle opacity (0.4 → 0.7 on hover)

#### 4.4 Features — Bento Grid
- Section heading: "Όλα τα εργαλεία που χρειάζεστε"
- Asymmetric bento grid (3-column layout):
  - **Large card (spans 2 cols)**: AI Document Analysis — icon, title, description, mini animated mockup
  - **Small card**: Smart Eligibility Check — pass/fail visualization
  - **Small card**: Financial Bid Strategy — pricing scenario preview
  - **Large card (spans 2 cols)**: Tender Discovery — ΕΣΗΔΗΣ/Promitheus source badges
  - **Small card**: Legal Compliance Engine — checklist preview
  - **Small card**: AI Assistant Co-pilot — chat bubble mockup
- Each card: Glass background, hover glow, staggered entrance animation
- Icons: Lucide React, gradient accent colors

#### 4.5 AI Showcase
- Split section:
  - Left: Animated chat conversation mockup (messages appearing one by one)
  - Right: Description text
- Heading: "Ο AI Συνεργάτης σας"
- Description: "Αναλύει κάθε έγγραφο σε δευτερόλεπτα. Ελέγχει επιλεξιμότητα. Προτείνει στρατηγική τιμολόγησης. Εντοπίζει κινδύνους πριν υποβάλετε."
- Trust indicator: "Κάθε απάντηση με πηγές και βαθμό εμπιστοσύνης"

#### 4.6 Stats / Social Proof
- Dark surface background with subtle gradient
- 3 large numbers, animated count-up on scroll:
  - "500+" — "Αναλυθέντα Έγγραφα"
  - "68%" — "Αύξηση Win Rate"
  - "90%" — "Εξοικονόμηση Χρόνου"
- Glass dividers between numbers

#### 4.7 Pricing
- Section heading: "Απλή, διαφανής τιμολόγηση"
- 3 tier cards:
  - **Starter** (glass card): Basic features, X tenders/month
  - **Professional** (glass card + glowing border — "Δημοφιλές"): Full AI, unlimited tenders
  - **Enterprise** (glass card): Custom, dedicated support, API
- Toggle: Μηνιαία / Ετήσια (with "Εξοικονόμηση 20%" badge)
- Each card: Feature checklist with check icons, CTA button
- Pricing amounts TBD (placeholder)

#### 4.8 FAQ
- Section heading: "Συχνές Ερωτήσεις"
- Accordion items (glass cards, expand with smooth animation):
  - "Τι είναι το TenderCopilot;"
  - "Πώς λειτουργεί η AI ανάλυση;"
  - "Είναι ασφαλή τα δεδομένα μου;"
  - "Μπορώ να το δοκιμάσω δωρεάν;"
  - "Υποστηρίζετε ΕΣΗΔΗΣ;"
- Expand icon: ChevronDown with rotation animation

#### 4.9 CTA Footer
- Dark gradient background (blue→dark)
- Large heading: "Ξεκινήστε να κερδίζετε διαγωνισμούς σήμερα"
- Email input + "Δοκιμάστε Δωρεάν" glow button (inline)
- Trust: "14 ημέρες δωρεάν. Χωρίς δεσμεύσεις."

#### 4.10 Footer
- Dark surface `--bg-surface`
- Columns: Product, Resources, Company, Legal
- Bottom row: Copyright, social icons (LinkedIn, X/Twitter), language toggle
- "Powered by AI" badge with subtle glow

---

### 5. i18n Foundation

- **Phase 1 approach:** Client-side React context + JSON dictionaries (no URL routing)
- Provider: `I18nProvider` context in `src/lib/i18n.tsx` with `useTranslation()` hook
- Locale files: `messages/el.json`, `messages/en.json`
- Default locale: `el` (Greek)
- Language detection: `localStorage` preference → browser `navigator.language` fallback
- Persistence: `localStorage.setItem('locale', 'el' | 'en')`
- Switcher component: `LanguageToggle` pill (GR | EN) — see accessibility section below
- Phase 1 scope: Landing page + Auth pages only. Dashboard i18n in Phase 4.
- **Phase 4 migration:** Upgrade to `next-intl` with URL-based routing (`/el/...`, `/en/...`), middleware, and SEO-friendly locale URLs.

---

## Tools & Execution Strategy

| Tool | Purpose |
|------|---------|
| **ui-ux-pro-max** | Design system tokens, effects, guidelines via `search.py --design-system` |
| **21st.dev Magic MCP** | Generate premium React components (hero, pricing cards, bento grid, nav) |
| **Nano Banana MCP** | AI-generated hero backgrounds, mesh gradients, custom illustrations |
| **Stitch MCP** | Full page layout imports for landing page sections |
| **shadcn/ui** | Base primitives (extend existing 22 components) |
| **Framer Motion** | Animations, page transitions, scroll-triggered entrances |
| **Lucide React** | Icons (never emojis) |
| **Playwright MCP** | Visual testing in browser |

---

## Files Changed / Created

### New Files
| File | Purpose |
|------|---------|
| `src/app/(marketing)/page.tsx` | Landing page |
| `src/app/(marketing)/layout.tsx` | Marketing layout (no sidebar) |
| `src/components/landing/hero-section.tsx` | Hero with animated mesh |
| `src/components/landing/features-bento.tsx` | Bento grid features |
| `src/components/landing/ai-showcase.tsx` | AI demo section |
| `src/components/landing/pricing-section.tsx` | Pricing tiers |
| `src/components/landing/stats-section.tsx` | Social proof numbers |
| `src/components/landing/faq-section.tsx` | FAQ accordion |
| `src/components/landing/cta-footer.tsx` | CTA + footer |
| `src/components/landing/navbar.tsx` | Marketing navbar |
| `src/components/ui/glow-button.tsx` | Gradient button with glow |
| `src/components/ui/glass-input.tsx` | Glass-styled input |
| `src/components/ui/stat-card.tsx` | Dashboard stat card |
| `src/components/ui/feature-card.tsx` | Bento grid card |
| `src/components/ui/pricing-card.tsx` | Pricing tier card |
| `src/components/ui/animated-mesh.tsx` | Animated gradient mesh bg |
| `src/components/ui/bento-grid.tsx` | Asymmetric grid layout |
| `src/components/ui/language-toggle.tsx` | GR/EN switcher |
| `src/lib/i18n.tsx` | i18n React context provider + useTranslation hook |
| `messages/el.json` | Greek translations (landing + auth) |
| `messages/en.json` | English translations (landing + auth) |

### Modified Files
| File | Change |
|------|--------|
| `src/app/globals.css` | Update CSS custom properties to Dark Glass Fusion tokens |
| `src/app/page.tsx` | Redirect to landing page instead of /dashboard |
| `src/app/(auth)/login/page.tsx` | Dark Glass Fusion redesign, two-column layout, i18n |
| `src/app/(auth)/register/page.tsx` | Dark Glass Fusion redesign + password strength indicator + terms checkbox + show/hide toggle + i18n |
| `src/app/(auth)/layout.tsx` | Updated animated mesh background |
| `src/app/(auth)/auth.css` | Updated orb animations for dark theme |
| `src/components/layout/sidebar.tsx` | Dark Glass Fusion styling |
| `src/components/layout/topbar.tsx` | Glass-on-dark styling |
| `src/components/ui/button.tsx` | Add gradient + glow variants |
| `src/components/ui/card.tsx` | Update to glass token system |
| `src/components/ui/input.tsx` | Add glass variant |
| `src/components/ui/badge.tsx` | Add glow variants |
| `src/components/ui/dialog.tsx` | Glass overlay + glass card |
| `src/components/ui/dropdown-menu.tsx` | Glass background |
| `src/components/ui/tabs.tsx` | Glass pill active state |
| `src/components/ui/skeleton.tsx` | Dark shimmer animation |
| `src/components/ui/glass-card.tsx` | Update to new token system |
| `tailwind.config.ts` | New color tokens, animation keyframes |
| `package.json` | Add next-intl (or i18n library) |

---

## What Does NOT Change in Phase 1

- Dashboard page content/logic (Phase 2)
- Tender detail tabs (Phase 2)
- AI Assistant panel (Phase 3)
- Discovery components (Phase 3)
- Company profile components (Phase 3)
- Analytics page (Phase 4)
- Settings page (Phase 4)
- Any backend/tRPC logic
- Database schema
- AI services

---

## Performance Budget (Landing Page)

- `AnimatedMesh` component: CSS-only animations (no canvas/WebGL) to minimize JS bundle
- Below-fold sections: lazy-load with Intersection Observer (features, AI showcase, pricing, FAQ)
- Hero mockup image: `next/image` with proper sizing and priority loading
- Framer Motion: only for entrance animations, not for continuous background effects
- Target: < 100KB JS for above-fold content

## Mobile Responsive Layouts

| Section | Mobile (< 768px) | Tablet (768-1024px) | Desktop (> 1024px) |
|---------|-------------------|---------------------|--------------------|
| Auth | Single column, showcase hidden | Single column, showcase as top banner | Two-column grid 3fr/2fr |
| Landing Nav | Hamburger → glass slide-out | Full nav | Full nav |
| Hero | Stacked, smaller mockup below text | Stacked, medium mockup | Side-by-side, floating mockup |
| Bento Grid | Single column stack | 2-column grid | 3-column asymmetric |
| AI Showcase | Stacked (mockup above text) | Stacked | Split 50/50 |
| Stats | Stacked vertically | 3 in a row | 3 in a row |
| Pricing | Stacked, swipeable | 3 in a row (compressed) | 3 in a row |
| FAQ | Full width | Full width, max-w-3xl | Full width, max-w-3xl centered |

## Language Toggle Accessibility

`LanguageToggle` is implemented as a button group:
- Semantic: `role="radiogroup"` container, `role="radio"` per option
- Keyboard: Tab focuses group, arrow keys switch selection, Space/Enter confirms
- ARIA: `aria-label="Language"`, `aria-checked` on active option
- Visual: pill shape, active state with primary background

---

## Success Criteria

1. `npm run build` succeeds with zero errors
2. Dark theme is default, light theme toggle works
3. Landing page loads in < 2s, scores 90+ on Lighthouse Performance
4. Auth pages render correctly in both themes
5. Sidebar + topbar match Dark Glass Fusion design
6. All interactive elements have `cursor-pointer`
7. All animations respect `prefers-reduced-motion`
8. Minimum touch target 44x44px on all buttons
9. Focus-visible outlines on all interactive elements
10. GR/EN toggle works on landing + auth pages
11. Mobile responsive (320px - 1920px+)
