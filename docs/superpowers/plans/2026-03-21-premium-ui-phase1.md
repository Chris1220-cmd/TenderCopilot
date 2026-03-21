# Premium UI Redesign Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform TenderCopilot from basic glass UI to premium Dark Glass Fusion design system, rebuild auth pages, create landing page from scratch, and add i18n foundation.

**Architecture:** Update CSS custom properties to new dark-first token system (HSL format, shadcn-compatible). Create new premium UI primitives (GlowButton, GlassInput, AnimatedMesh, BentoGrid). Build marketing landing page as root page. Redesign auth pages with two-column layout. Add client-side i18n with React context.

**Tech Stack:** Next.js 14, shadcn/ui, Tailwind CSS, Framer Motion, Lucide React, 21st.dev Magic MCP, Nano Banana MCP

**Spec:** `docs/superpowers/specs/2026-03-21-premium-ui-redesign-phase1-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|----------------|
| `src/lib/i18n.tsx` | I18nProvider context, useTranslation hook, locale detection |
| `messages/el.json` | Greek translations for landing + auth |
| `messages/en.json` | English translations for landing + auth |
| `src/components/ui/glow-button.tsx` | Gradient button with hover glow effect |
| `src/components/ui/glass-input.tsx` | Dark glass input with focus glow |
| `src/components/ui/animated-mesh.tsx` | CSS-only animated gradient mesh background |
| `src/components/ui/bento-grid.tsx` | Asymmetric responsive grid layout |
| `src/components/ui/stat-card.tsx` | Number + trend + optional sparkline card |
| `src/components/ui/language-toggle.tsx` | GR/EN radio group switcher |
| `src/components/landing/navbar.tsx` | Marketing fixed navbar (glass on scroll) |
| `src/components/landing/hero-section.tsx` | Full-viewport hero with mesh bg + mockup |
| `src/components/landing/features-bento.tsx` | Bento grid feature cards |
| `src/components/landing/ai-showcase.tsx` | AI demo split section |
| `src/components/landing/stats-section.tsx` | Animated count-up social proof |
| `src/components/landing/pricing-section.tsx` | 3-tier pricing cards |
| `src/components/landing/faq-section.tsx` | Accordion FAQ |
| `src/components/landing/cta-footer.tsx` | CTA + footer |

### Modified Files

| File | What Changes |
|------|-------------|
| `src/app/globals.css` | Dark Glass Fusion tokens (lines 14-72), glass utilities (107-163), grid pattern (197-208), glow effects (183-193), new gradient-text-cyan utility |
| `tailwind.config.ts` | New keyframes (glow-pulse, float-slow, count-up), new animation definitions, updated radius default |
| `src/app/page.tsx` | Replace redirect('/dashboard') with landing page render |
| `src/app/layout.tsx` | Update metadata title/description, add i18n provider wrapping |
| `src/components/ui/button.tsx` | Add 'glow' and 'ghost-glass' variants |
| `src/components/ui/glass-card.tsx` | Update to use new token system colors |
| `src/components/layout/sidebar.tsx` | Dark solid bg, remove backdrop-blur, update active state styling |
| `src/components/layout/topbar.tsx` | Glass-on-dark background, updated border |
| `src/app/(auth)/login/page.tsx` | Two-column layout, dark glass form, GlassInput, GlowButton, i18n, forgot password link |
| `src/app/(auth)/register/page.tsx` | Match login redesign + password strength + terms checkbox |
| `src/app/(auth)/layout.tsx` | Dark bg, updated mesh animation |
| `src/app/(auth)/auth.css` | Update orb colors for dark theme |

---

## Task 1: Design System — CSS Custom Properties

**Files:**
- Modify: `src/app/globals.css:14-72` (CSS variables)
- Modify: `src/app/globals.css:107-218` (glass utilities, glow effects, bg patterns)

- [ ] **Step 1: Update `:root` (light theme) CSS variables**

Replace lines 14-43 in `globals.css`:

```css
@layer base {
  :root {
    --background: 0 0% 98%;
    --foreground: 240 6% 10%;
    --card: 0 0% 100%;
    --card-foreground: 240 6% 10%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 6% 10%;
    --primary: 217 91% 60%;
    --primary-foreground: 0 0% 98%;
    --secondary: 240 5% 96%;
    --secondary-foreground: 240 6% 10%;
    --muted: 240 5% 96%;
    --muted-foreground: 240 4% 46%;
    --accent: 187 92% 42%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 98%;
    --success: 142 76% 36%;
    --success-foreground: 0 0% 98%;
    --warning: 38 92% 50%;
    --warning-foreground: 240 6% 10%;
    --border: 240 6% 90%;
    --input: 240 6% 90%;
    --ring: 217 91% 60%;
    --radius: 1rem;
    --sidebar: 240 6% 97%;
    --sidebar-foreground: 240 6% 10%;
    --sidebar-accent: 240 5% 94%;
  }
}
```

Note: `--accent` changed from amber (38 92% 50%) to cyan (187 92% 42%). `--radius` changed from 0.75rem to 1rem (16px).

- [ ] **Step 2: Update `.dark` CSS variables**

Replace lines 45-72:

```css
  .dark {
    --background: 240 6% 4%;
    --foreground: 240 5% 96%;
    --card: 240 6% 7%;
    --card-foreground: 240 5% 96%;
    --popover: 240 6% 7%;
    --popover-foreground: 240 5% 96%;
    --primary: 217 91% 60%;
    --primary-foreground: 240 6% 4%;
    --secondary: 240 4% 16%;
    --secondary-foreground: 240 5% 96%;
    --muted: 240 4% 16%;
    --muted-foreground: 240 4% 46%;
    --accent: 187 92% 42%;
    --accent-foreground: 240 5% 96%;
    --destructive: 0 63% 31%;
    --destructive-foreground: 240 5% 96%;
    --success: 142 76% 36%;
    --success-foreground: 240 5% 96%;
    --warning: 38 92% 50%;
    --warning-foreground: 240 6% 4%;
    --border: 240 4% 16%;
    --input: 240 4% 16%;
    --ring: 217 91% 60%;
    --sidebar: 240 6% 3%;
    --sidebar-foreground: 240 5% 96%;
    --sidebar-accent: 240 4% 10%;
  }
```

- [ ] **Step 3: Update glass utilities for Dark Glass Fusion**

Replace lines 107-163 (glass system) with updated values:

```css
@layer utilities {
  .glass {
    background: rgba(255, 255, 255, 0.65);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
  }
  .dark .glass {
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
  }

  .glass-card {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(0, 0, 0, 0.06);
    box-shadow:
      0 4px 16px rgba(0, 0, 0, 0.04),
      inset 0 1px 0 rgba(255, 255, 255, 0.8);
  }
  .dark .glass-card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow:
      0 4px 16px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .glass-border {
    border: 1px solid rgba(0, 0, 0, 0.06);
  }
  .dark .glass-border {
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .glass-hover {
    transition: all 300ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .glass-hover:hover {
    background: rgba(255, 255, 255, 0.8);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.06);
  }
  .dark .glass-hover:hover {
    background: rgba(255, 255, 255, 0.06);
    box-shadow:
      0 10px 24px rgba(0, 0, 0, 0.3),
      0 0 20px rgba(59, 130, 246, 0.05);
  }
}
```

- [ ] **Step 4: Add cyan glow and gradient-text-cyan utility**

After `.glow-green` (line ~192), add:

```css
  .glow-cyan {
    box-shadow: 0 0 24px rgba(6, 182, 212, 0.12), 0 0 60px rgba(6, 182, 212, 0.04);
  }
```

After `.gradient-text-blue` (line ~179), add:

```css
  .gradient-text-cyan {
    background: linear-gradient(135deg, #3b82f6, #06b6d4);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
```

- [ ] **Step 5: Update grid pattern to 32px**

Change `background-size: 24px 24px` to `background-size: 32px 32px` in both `.bg-grid` and `.dark .bg-grid` (lines 201, 207).

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: update design system to Dark Glass Fusion tokens"
```

---

## Task 2: Tailwind Config — Keyframes & Animations

**Files:**
- Modify: `tailwind.config.ts:69-101`

- [ ] **Step 1: Add new keyframes**

After the `shimmer` keyframe (line 91), add:

```ts
'glow-pulse': {
  '0%, 100%': { opacity: '0.4' },
  '50%': { opacity: '0.8' },
},
'count-up': {
  from: { opacity: '0', transform: 'translateY(10px)' },
  to: { opacity: '1', transform: 'translateY(0)' },
},
'float-slow': {
  '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
  '33%': { transform: 'translate(30px, -50px) scale(1.05)' },
  '66%': { transform: 'translate(-20px, 30px) scale(0.95)' },
},
'float-medium': {
  '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
  '50%': { transform: 'translate(-40px, -30px) scale(1.1)' },
},
```

- [ ] **Step 2: Add new animation definitions**

After the `shimmer` animation (line 100), add:

```ts
'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
'count-up': 'count-up 0.5s ease-out forwards',
'float-slow': 'float-slow 20s ease-in-out infinite',
'float-medium': 'float-medium 15s ease-in-out infinite',
```

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat: add glow-pulse, count-up, float-up animations"
```

---

## Task 3: i18n Foundation

**Files:**
- Create: `src/lib/i18n.tsx`
- Create: `messages/el.json`
- Create: `messages/en.json`

- [ ] **Step 1: Create i18n context provider**

Create `src/lib/i18n.tsx`:

```tsx
'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import el from '../../messages/el.json';
import en from '../../messages/en.json';

type Locale = 'el' | 'en';
type Messages = typeof el;

const messages: Record<Locale, Messages> = { el, en };

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const result = path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
    return undefined;
  }, obj);
  return typeof result === 'string' ? result : path;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('el');

  useEffect(() => {
    const stored = localStorage.getItem('locale') as Locale | null;
    if (stored && (stored === 'el' || stored === 'en')) {
      setLocaleState(stored);
    } else {
      const browserLang = navigator.language.startsWith('el') ? 'el' : 'en';
      setLocaleState(browserLang);
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
    document.documentElement.lang = newLocale;
  }, []);

  const t = useCallback((key: string): string => {
    return getNestedValue(messages[locale] as unknown as Record<string, unknown>, key);
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useTranslation must be used within I18nProvider');
  return context;
}
```

- [ ] **Step 2: Create Greek translations**

Create `messages/el.json`:

```json
{
  "common": {
    "login": "Είσοδος",
    "register": "Εγγραφή",
    "tryFree": "Δοκιμάστε Δωρεάν",
    "watchDemo": "Δείτε Demo",
    "learnMore": "Μάθετε Περισσότερα",
    "noCard": "Χωρίς πιστωτική κάρτα. Χωρίς δεσμεύσεις.",
    "monthly": "Μηνιαία",
    "yearly": "Ετήσια",
    "save20": "Εξοικονόμηση 20%",
    "popular": "Δημοφιλές",
    "contactUs": "Επικοινωνήστε"
  },
  "nav": {
    "features": "Χαρακτηριστικά",
    "pricing": "Τιμολόγηση",
    "about": "Σχετικά",
    "faq": "FAQ"
  },
  "hero": {
    "badge": "AI-Powered",
    "title": "Η τεχνητή νοημοσύνη που κερδίζει δημόσιους διαγωνισμούς",
    "subtitle": "Αναλύστε έγγραφα, ελέγξτε επιλεξιμότητα και δημιουργήστε προσφορές 90% ταχύτερα",
    "trustedBy": "Χρησιμοποιείται από εταιρείες σε:"
  },
  "features": {
    "title": "Όλα τα εργαλεία που χρειάζεστε",
    "subtitle": "Από την ανάλυση εγγράφων μέχρι την υποβολή προσφοράς",
    "docAnalysis": "AI Ανάλυση Εγγράφων",
    "docAnalysisDesc": "Αυτόματη εξαγωγή απαιτήσεων, κριτηρίων και προθεσμιών από κάθε τύπο εγγράφου",
    "eligibility": "Έλεγχος Επιλεξιμότητας",
    "eligibilityDesc": "Άμεση αξιολόγηση αν πληροίτε τα κριτήρια κάθε διαγωνισμού",
    "financial": "Στρατηγική Τιμολόγησης",
    "financialDesc": "AI-driven σενάρια τιμολόγησης και ανάλυση ανταγωνιστικότητας",
    "discovery": "Εύρεση Διαγωνισμών",
    "discoveryDesc": "Αυτόματη αναζήτηση από ΕΣΗΔΗΣ, Promitheus και 19+ πηγές",
    "legal": "Νομική Συμμόρφωση",
    "legalDesc": "Αυτόματος έλεγχος νομικών απαιτήσεων και εγγράφων",
    "assistant": "AI Συνεργάτης",
    "assistantDesc": "Ρωτήστε οτιδήποτε για τον διαγωνισμό σας — με πηγές και βαθμό εμπιστοσύνης"
  },
  "aiShowcase": {
    "title": "Ο AI Συνεργάτης σας",
    "description": "Αναλύει κάθε έγγραφο σε δευτερόλεπτα. Ελέγχει επιλεξιμότητα. Προτείνει στρατηγική τιμολόγησης. Εντοπίζει κινδύνους πριν υποβάλετε.",
    "trust": "Κάθε απάντηση με πηγές και βαθμό εμπιστοσύνης"
  },
  "stats": {
    "docs": "Αναλυθέντα Έγγραφα",
    "winRate": "Αύξηση Win Rate",
    "timeSaved": "Εξοικονόμηση Χρόνου"
  },
  "pricing": {
    "title": "Απλή, διαφανής τιμολόγηση",
    "subtitle": "Επιλέξτε το πλάνο που ταιριάζει στην επιχείρησή σας",
    "starter": "Starter",
    "professional": "Professional",
    "enterprise": "Enterprise"
  },
  "faq": {
    "title": "Συχνές Ερωτήσεις",
    "q1": "Τι είναι το TenderCopilot;",
    "a1": "Το TenderCopilot είναι μια AI-powered πλατφόρμα που βοηθά εταιρείες να ετοιμάζουν φακέλους συμμετοχής σε δημόσιους διαγωνισμούς γρηγορότερα και αποτελεσματικότερα.",
    "q2": "Πώς λειτουργεί η AI ανάλυση;",
    "a2": "Η πλατφόρμα αναλύει αυτόματα τα έγγραφα του διαγωνισμού, εξάγει απαιτήσεις, ελέγχει επιλεξιμότητα και προτείνει στρατηγική τιμολόγησης.",
    "q3": "Είναι ασφαλή τα δεδομένα μου;",
    "a3": "Απολύτως. Χρησιμοποιούμε κρυπτογράφηση end-to-end, τα δεδομένα σας αποθηκεύονται σε ευρωπαϊκούς servers και τηρούμε πλήρη GDPR συμμόρφωση.",
    "q4": "Μπορώ να το δοκιμάσω δωρεάν;",
    "a4": "Ναι! Προσφέρουμε 14 ημέρες δωρεάν δοκιμή χωρίς πιστωτική κάρτα.",
    "q5": "Υποστηρίζετε ΕΣΗΔΗΣ;",
    "a5": "Ναι, υποστηρίζουμε αναζήτηση και ανάλυση διαγωνισμών από ΕΣΗΔΗΣ, Promitheus, Διαύγεια και 19+ ακόμα πηγές."
  },
  "cta": {
    "title": "Ξεκινήστε να κερδίζετε διαγωνισμούς σήμερα",
    "placeholder": "Εισάγετε το email σας",
    "trial": "14 ημέρες δωρεάν. Χωρίς δεσμεύσεις."
  },
  "auth": {
    "loginTitle": "Καλώς ήρθατε",
    "loginSubtitle": "Συνδεθείτε στον λογαριασμό σας",
    "registerTitle": "Δημιουργία Λογαριασμού",
    "registerSubtitle": "Ξεκινήστε τη δωρεάν δοκιμή σας",
    "email": "Email",
    "password": "Κωδικός",
    "name": "Ονοματεπώνυμο",
    "company": "Επωνυμία Εταιρείας",
    "forgotPassword": "Ξεχάσατε τον κωδικό;",
    "noAccount": "Δεν έχετε λογαριασμό;",
    "hasAccount": "Έχετε ήδη λογαριασμό;",
    "signInGoogle": "Σύνδεση με Google",
    "magicLink": "Σύνδεση με Magic Link",
    "magicLinkSent": "Ελέγξτε το email σας!",
    "termsAgree": "Αποδέχομαι τους",
    "termsLink": "Όρους Χρήσης",
    "invalidEmail": "Μη έγκυρη διεύθυνση email",
    "passwordRequired": "Ο κωδικός πρόσβασης είναι υποχρεωτικός",
    "loginError": "Λάθος email ή κωδικός πρόσβασης",
    "genericError": "Κάτι πήγε στραβά. Δοκιμάστε ξανά."
  },
  "footer": {
    "product": "Προϊόν",
    "resources": "Πόροι",
    "company": "Εταιρεία",
    "legal": "Νομικά",
    "poweredByAI": "Powered by AI"
  }
}
```

- [ ] **Step 3: Create English translations**

Create `messages/en.json` — same structure as `el.json`, all values in English. Key translations:

- `hero.title`: "The AI that wins public tenders"
- `hero.subtitle`: "Analyze documents, check eligibility, and create proposals 90% faster"
- `features.title`: "All the tools you need"
- `aiShowcase.title`: "Your AI Co-pilot"
- `pricing.title`: "Simple, transparent pricing"
- `faq.title`: "Frequently Asked Questions"
- `cta.title`: "Start winning tenders today"
- `auth.loginTitle`: "Welcome back"
- `auth.registerTitle`: "Create Account"
- All other keys translated to natural English (not machine translation)

- [ ] **Step 4: Wrap app with I18nProvider and set dark default**

In `src/app/providers.tsx`:
1. Import `I18nProvider` from `@/lib/i18n`
2. Wrap it around the existing provider stack (outermost client provider)
3. Change `defaultTheme="system"` to `defaultTheme="dark"` on `ThemeProvider`

```tsx
import { I18nProvider } from '@/lib/i18n';

// In the return:
<I18nProvider>
  <SessionProvider>
    <TRPCProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
        {children}
      </ThemeProvider>
    </TRPCProvider>
  </SessionProvider>
</I18nProvider>
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n.tsx messages/el.json messages/en.json src/app/providers.tsx
git commit -m "feat: add i18n foundation with Greek/English support"
```

---

## Task 4: Premium UI Primitives

**Files:**
- Create: `src/components/ui/glow-button.tsx`
- Create: `src/components/ui/glass-input.tsx`
- Create: `src/components/ui/animated-mesh.tsx`
- Create: `src/components/ui/language-toggle.tsx`
- Create: `src/components/ui/bento-grid.tsx`
- Create: `src/components/ui/stat-card.tsx`
- Modify: `src/components/ui/button.tsx:13-26` (add variants)
- Modify: `src/components/ui/glass-card.tsx:9-17` (update tokens)

**Use 21st.dev Magic MCP** to generate each component, then customize for Dark Glass Fusion.

- [ ] **Step 1: Create GlowButton component**

`src/components/ui/glow-button.tsx` — gradient blue→cyan button with hover glow. Uses Framer Motion for hover scale. Variants: `default` (gradient fill), `ghost` (transparent with border glow on hover).

- [ ] **Step 2: Create GlassInput component**

`src/components/ui/glass-input.tsx` — extends base Input with glass bg `rgba(255,255,255,0.04)` in dark mode, focus glow border `ring-primary/30`.

- [ ] **Step 3: Create AnimatedMesh component**

`src/components/ui/animated-mesh.tsx` — CSS-only animated gradient background. Three floating orbs (blue, cyan, purple) with `animate-float-slow` and `animate-float-medium`. No JS animation — pure CSS for performance. Respects `prefers-reduced-motion`.

- [ ] **Step 4: Create LanguageToggle component**

`src/components/ui/language-toggle.tsx` — Pill-shaped radio group. `role="radiogroup"`, individual `role="radio"` buttons. Arrow key navigation. Uses `useTranslation()` hook. Active state: primary bg + white text.

- [ ] **Step 5: Create BentoGrid component**

`src/components/ui/bento-grid.tsx` — Responsive asymmetric grid. Props: `children`. Uses CSS Grid with `grid-template-columns` and `span` utilities. Single column on mobile, 2 on tablet, 3 on desktop. Children can use `className="col-span-2"` for wide cards.

- [ ] **Step 6: Create StatCard component**

`src/components/ui/stat-card.tsx` — Glass card with large number, label, and optional trend indicator. Animated count-up on scroll entry (Intersection Observer). Props: `value: string`, `label: string`, `suffix?: string`.

- [ ] **Step 7: Create FeatureCard component**

`src/components/ui/feature-card.tsx` — Bento grid card with icon slot, title, description. Glass-card styling with hover glow. Props: `icon: ReactNode`, `title: string`, `description: string`, `className?: string`. Supports `col-span-2` for wide cards.

- [ ] **Step 8: Create PricingCard component**

`src/components/ui/pricing-card.tsx` — Pricing tier card. Props: `name: string`, `price: string`, `period: string`, `features: string[]`, `popular?: boolean`, `cta: string`. Popular variant gets glowing border `border-primary/30 glow-blue`. Glass card background, check icons for features.

- [ ] **Step 9: Add 'glow' and 'ghost-glass' variants to Button**

In `src/components/ui/button.tsx`, add two new variants to `buttonVariants`:

```ts
glow: "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98]",
'ghost-glass': "border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/20 text-white",
```

- [ ] **Step 8: Update GlassCard to new token system**

In `src/components/ui/glass-card.tsx`, update the className from `bg-white/60 dark:bg-white/[0.06]` to use the new glass token values from globals.css. Keep `glass-card glass-hover` utility classes.

- [ ] **Step 11: Upgrade existing shadcn components**

Apply Dark Glass Fusion styling to these existing components (small className changes each):

- `src/components/ui/card.tsx` — Add glass background classes, update border-radius to `rounded-2xl`
- `src/components/ui/input.tsx` — Add dark glass variant: `dark:bg-white/[0.04] dark:border-white/[0.08] dark:focus:border-primary/30`
- `src/components/ui/badge.tsx` — Add subtle glass bg and per-variant glow classes
- `src/components/ui/dialog.tsx` — Glass overlay `bg-black/60 backdrop-blur-sm`, glass card content
- `src/components/ui/dropdown-menu.tsx` — Glass bg `dark:bg-zinc-900/90 dark:backdrop-blur-xl dark:border-white/[0.08]`
- `src/components/ui/tabs.tsx` — Glass pill active state: `data-[state=active]:bg-primary/10 data-[state=active]:text-primary`
- `src/components/ui/skeleton.tsx` — Dark shimmer: `dark:bg-white/[0.04]` with shimmer animation

- [ ] **Step 12: Commit**

```bash
git add src/components/ui/
git commit -m "feat: add premium UI primitives and upgrade shadcn components"
```

---

## Task 5: Layout Shell — Sidebar Dark Glass Fusion

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Update sidebar background**

Change line 72 from:
```ts
'bg-white/80 dark:bg-slate-950/80',
'backdrop-blur-xl',
```
to:
```ts
'bg-background',
```

Remove the glass edge highlight div (line 80-81). The sidebar becomes solid dark — no blur.

- [ ] **Step 2: Update active state styling**

In the nav link className (line 123-125), update active state:
```ts
isActive
  ? 'bg-primary/10 text-primary dark:bg-primary/[0.08]'
  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-white/[0.04]'
```

- [ ] **Step 3: Update border and separator**

Change sidebar border (line 74) from:
```ts
'border-r border-white/10 dark:border-white/5',
```
to:
```ts
'border-r border-border',
```

- [ ] **Step 4: Update collapse toggle button styling**

Update the collapse button (line 243-250) to use dark glass styling consistent with new tokens.

- [ ] **Step 5: Update tooltip styling**

Update all `TooltipContent` classNames to use `bg-popover text-popover-foreground border-border` instead of hardcoded dark colors.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: sidebar Dark Glass Fusion styling"
```

---

## Task 6: Layout Shell — Topbar Dark Glass Fusion

**Files:**
- Modify: `src/components/layout/topbar.tsx`

- [ ] **Step 1: Update topbar background**

Change the header className from:
```ts
'bg-white/60 dark:bg-slate-950/60 backdrop-blur-xl'
```
to:
```ts
'bg-background/80 backdrop-blur-xl dark:bg-[rgba(9,9,11,0.8)]'
```

Update border from `border-white/10 dark:border-white/5` to `border-border`.

- [ ] **Step 2: Update search input styling**

Apply `GlassInput` styling or update classes to match dark glass theme:
```ts
'bg-muted/50 dark:bg-white/[0.04] border-border dark:border-white/[0.08] focus:border-primary/30'
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/topbar.tsx
git commit -m "feat: topbar Dark Glass Fusion styling"
```

---

## Task 7: Auth Pages Redesign

**Files:**
- Modify: `src/app/(auth)/layout.tsx`
- Modify: `src/app/(auth)/auth.css`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/register/page.tsx`

- [ ] **Step 1: Update auth layout to dark background + two-column grid**

In `layout.tsx`, change from centered single-column to:
- `grid grid-cols-1 lg:grid-cols-[3fr_2fr]` on desktop
- Dark background `bg-background`
- Left panel: Product showcase (hidden on mobile)
- Right panel: Children (auth form)
- `AnimatedMesh` component as background

- [ ] **Step 2: Update auth.css orb colors**

Change orb colors from current palette to blue/cyan/purple for Dark Glass Fusion.

- [ ] **Step 3: Redesign login page**

Use `GlassInput`, `GlowButton`, add:
- `LanguageToggle` at top-right
- "Ξεχάσατε τον κωδικό;" link
- Updated glass card styling
- Google sign-in with glass ghost button
- Magic link with cyan accent
- Use `useTranslation()` for all text

- [ ] **Step 4: Redesign register page**

Match login design plus:
- Password strength indicator (color bar)
- Terms checkbox with link
- Show/hide password toggle
- Company name field
- Use `useTranslation()` for all text

- [ ] **Step 5: Commit**

```bash
git add src/app/(auth)/
git commit -m "feat: auth pages Dark Glass Fusion redesign with i18n"
```

---

## Task 8: Landing Page — Core Structure

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`
- Create: `src/components/landing/navbar.tsx`
- Create: `src/components/landing/hero-section.tsx`

- [ ] **Step 1: Convert root page to landing page**

Replace `src/app/page.tsx` redirect with landing page component. Import and render all landing sections. Use `className="dark"` to force dark theme on landing page (always dark).

- [ ] **Step 2: Update root layout metadata**

Update `src/app/layout.tsx` metadata to bilingual:
```ts
title: 'TenderCopilot — AI-Powered Tender Management',
description: 'Αναλύστε έγγραφα, ελέγξτε επιλεξιμότητα και δημιουργήστε προσφορές 90% ταχύτερα | Analyze documents, check eligibility, and create proposals 90% faster',
```

- [ ] **Step 3: Create landing navbar**

`src/components/landing/navbar.tsx`:
- Fixed position, transparent at top → glass on scroll (Intersection Observer or scroll listener)
- Logo (gradient icon) + nav links + `LanguageToggle` + "Είσοδος" ghost-glass button + "Δοκιμάστε Δωρεάν" glow button
- Mobile: hamburger icon → glass slide-out sheet
- Use `useTranslation()` for all text

**Use 21st.dev Magic MCP** to generate the navbar component.

- [ ] **Step 4: Create hero section**

`src/components/landing/hero-section.tsx`:
- Full viewport height (`min-h-screen`)
- `AnimatedMesh` background
- Grid pattern overlay
- Content: AI badge (glass pill with glow-cyan), headline, subtitle, CTA row, trust line
- Floating dashboard mockup with perspective transform (CSS `transform: perspective(1000px) rotateY(-5deg)`)
- Use `Nano Banana MCP` to generate a hero background image if needed
- Use `useTranslation()` for all text

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx src/components/landing/navbar.tsx \
  src/components/landing/hero-section.tsx
git commit -m "feat: landing page core structure with navbar and hero"
```

---

## Task 9: Landing Page — Feature Sections

**Files:**
- Create: `src/components/landing/features-bento.tsx`
- Create: `src/components/landing/ai-showcase.tsx`
- Create: `src/components/landing/stats-section.tsx`

- [ ] **Step 1: Create features bento grid**

`src/components/landing/features-bento.tsx`:
- Use `BentoGrid` component
- 6 feature cards with Lucide icons, titles, descriptions from translations
- First card (AI Document Analysis) spans 2 columns
- Fourth card (Tender Discovery) spans 2 columns
- Each card: glass-card styling, hover glow, staggered entrance animation (Framer Motion)
- Lazy-loaded with Intersection Observer

- [ ] **Step 2: Create AI showcase section**

`src/components/landing/ai-showcase.tsx`:
- Split layout: left = animated chat mockup, right = description
- Chat mockup: 3-4 hardcoded messages appearing with staggered animation
- Trust indicator badge
- Lazy-loaded

- [ ] **Step 3: Create stats section**

`src/components/landing/stats-section.tsx`:
- Dark surface background with gradient
- 3 `StatCard` components: "500+", "68%", "90%"
- Count-up animation triggered on scroll entry
- Glass dividers between cards

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/features-bento.tsx src/components/landing/ai-showcase.tsx \
  src/components/landing/stats-section.tsx
git commit -m "feat: landing page features, AI showcase, and stats sections"
```

---

## Task 10: Landing Page — Pricing, FAQ, Footer

**Files:**
- Create: `src/components/landing/pricing-section.tsx`
- Create: `src/components/landing/faq-section.tsx`
- Create: `src/components/landing/cta-footer.tsx`

- [ ] **Step 1: Create pricing section**

`src/components/landing/pricing-section.tsx`:
- Monthly/Yearly toggle with "Εξοικονόμηση 20%" badge
- 3 glass cards: Starter, Professional (glowing border + "Δημοφιλές" badge), Enterprise
- Feature checklists with Check icons
- CTA button per tier
- Prices TBD (use placeholder: "€49/μήνα", "€99/μήνα", "Επικοινωνήστε")

- [ ] **Step 2: Create FAQ section**

`src/components/landing/faq-section.tsx`:
- 5 Q&A accordion items
- Glass card per item, expand with Framer Motion height animation
- ChevronDown icon with rotation
- Max-width centered

- [ ] **Step 3: Create CTA + footer**

`src/components/landing/cta-footer.tsx`:
- CTA: Dark gradient bg, headline, email input + glow button inline, trust text
- Footer: 4-column links grid, bottom row with copyright + social icons + language toggle + "Powered by AI" badge
- Responsive: stacked on mobile

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/pricing-section.tsx src/components/landing/faq-section.tsx \
  src/components/landing/cta-footer.tsx
git commit -m "feat: landing page pricing, FAQ, and footer sections"
```

---

## Task 11: Build Verification & Polish

**Files:**
- All files from Tasks 1-10

- [ ] **Step 1: Run build**

```bash
npm run build
```

Expected: Build succeeds with zero errors. Fix any TypeScript or import issues.

- [ ] **Step 2: Visual verification in browser**

Open http://localhost:3000 and verify:
- Landing page renders with dark theme, all sections visible
- Scroll behavior: navbar goes from transparent to glass
- Animations play (mesh, entrance, count-up)
- Mobile responsive at 375px, 768px, 1024px, 1440px
- Language toggle switches GR/EN

- [ ] **Step 3: Verify auth pages**

Navigate to /login and /register:
- Two-column layout on desktop, single on mobile
- Glass card renders correctly
- GlowButton and GlassInput work
- Language toggle works
- Dark theme consistent

- [ ] **Step 4: Verify dashboard shell**

Navigate to /dashboard (logged in):
- Sidebar: solid dark background, no blur
- Active nav item: primary glow left border
- Topbar: glass-on-dark
- Theme toggle: sun/moon switches between dark/light

- [ ] **Step 5: Lighthouse check**

Run Lighthouse on landing page:
- Performance: target 90+
- Accessibility: target 95+
- Fix any issues found

- [ ] **Step 6: Final commit**

```bash
git add src/ messages/ tailwind.config.ts
git commit -m "feat: Phase 1 complete — Dark Glass Fusion design system, landing page, auth redesign"
```

---

## Execution Notes

### Using 21st.dev Magic MCP
For each component that needs premium quality, use `mcp__21st-magic__21st_magic_component_builder` to generate the initial code, then customize:
- Navbar, Hero, Pricing cards, Feature cards

### Using Nano Banana MCP
For custom imagery:
- Hero background gradient/illustration
- Landing page mockup screenshots

### Using ui-ux-pro-max
Run before starting implementation:
```bash
python C:/Users/athan/.claude/skills/ui-ux-pro-max/scripts/search.py "dark glassmorphism SaaS dashboard" --design-system
```

### Key Dependencies Already Installed
- `framer-motion` v12.36.0 (in package.json)
- `lucide-react` v0.468.0 (in package.json)
- `next-themes` v0.4.4 (in package.json)
- No new npm packages needed (i18n is custom context, not next-intl)
