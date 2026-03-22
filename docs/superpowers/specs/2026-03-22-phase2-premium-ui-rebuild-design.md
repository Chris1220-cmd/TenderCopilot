# Phase 2 — Premium UI Rebuild: Dashboard, Tender Detail, AI Chat

**Date:** 2026-03-22
**Status:** Draft
**Author:** Claude (with Christos Athanasopoulos)
**Branch:** `feat/premium-ui-phase2`

---

## 1. Problem Statement

Phase 1 rebuilt the landing page to premium quality using MagicCard, SparklesCore, TextGenerateEffect, BlurFade, ShimmerButton, and BorderBeam. The result: a world-class first impression.

But after login, users enter a **visually disconnected dashboard**. The stat cards are plain divs, sparklines are empty arrays rendering nothing, there are no entrance animations, and NumberTicker (already installed) is unused. The tender detail page has 8 tabs with 15+ panel components — structurally sound but visually flat. The AI chat panel is the best-styled internal component (glassmorphic) but still lacks the depth of the landing page.

**Goal:** Bring every post-login page to the same visual quality as the landing page, using the same component library and design language. End-to-end premium — no visual drop-off after login.

---

## 2. Scope

### In Scope
- Dashboard page (`src/app/(dashboard)/dashboard/page.tsx`)
- Tenders list page (`src/app/(dashboard)/tenders/page.tsx`)
- Tender detail page (`src/app/(dashboard)/tenders/[id]/page.tsx`)
- All tender tab components (overview, requirements, documents, tasks, legal, financial, technical, activity)
- AI assistant panel (`src/components/tender/ai-assistant-panel.tsx`)
- AI Brief panel, Go/No-Go panel, Missing Info panel, Outcome panel
- Nano Banana generated illustrations for empty states and dashboard welcome
- 5 new shared components extracted during rebuild

### Out of Scope
- Landing page (already done in Phase 1)
- Company page, Tasks page, Analytics page, Settings page (future phases)
- Backend/API changes
- Sidebar and Topbar (already well-styled)
- Auth pages

---

## 3. Design Language (Consistency with Phase 1)

All premium styling must use the **exact same parameters** as the landing page to maintain visual continuity.

### MagicCard Parameters
```tsx
<MagicCard
  className="h-full rounded-2xl border-white/[0.06]"
  gradientSize={250}
  gradientColor="#1a1a2e"
  gradientFrom="#3B82F6"
  gradientTo="#06B6D4"
>
```

### BlurFade Stagger Pattern
```tsx
// For lists/grids: 0.1 + index * 0.08
<BlurFade delay={0.1 + i * 0.08} inView>
```

### Color System
| Role | Value |
|------|-------|
| Primary gradient start | `#3B82F6` (blue-500) |
| Primary gradient end | `#06B6D4` (cyan-500) |
| Accent gradient | `from-indigo-600 to-violet-600` |
| Glassmorphism bg | `bg-white/60 dark:bg-white/[0.06] backdrop-blur-xl` |
| Glassmorphism border | `border border-white/20 dark:border-white/10` |
| Gradient text | `bg-gradient-to-r from-blue-700 to-cyan-600 bg-clip-text text-transparent` |

### Motion Budget (Dashboard vs Landing)
- **Landing:** Full animations — particles, flip words, parallax
- **Dashboard:** Entrance-only animations — BlurFade on mount, NumberTicker count-up, hover effects via MagicCard. **No looping particles or heavy animations** in work areas.

---

## 4. Detailed Design by Page

### 4.1 Dashboard Page

**File:** `src/app/(dashboard)/dashboard/page.tsx` (full rewrite, ~600 lines → ~500 lines)

#### 4.1.1 Welcome Section
- `BlurFade` entrance (delay 0)
- Replace `style jsx global` gradient hack → use `AnimatedGradientText` component
- Add decorative Nano Banana illustration (right side, `opacity-80`, `pointer-events-none`)
- Add quick actions row: 3x `ShimmerButton` — "Νέος Διαγωνισμός" (link to /tenders/new), "Τρέξε Ανάλυση" (link to /analytics), "Δες Reports" (link to /tenders)

#### 4.1.2 Stats Grid (4 cards)
- Replace plain `div` cards → `MagicCard` wrapper per card
- Import and use `NumberTicker` for numeric values (activeTenders, pendingTasks, complianceScore, upcomingDeadlines)
- `BlurFade` per card: `delay={0.15 + i * 0.08}`
- **Remove** empty sparkline arrays and `MiniSparkline` component — they render blank space
- Keep `ProgressRing` for compliance, add CSS animation for initial draw: `animate-[draw_1s_ease-out_forwards]`
- Keep existing glassmorphic hover effects (translate-y, shadow), they compose well with MagicCard

#### 4.1.3 Recent Tenders Panel
- Wrap in `GlassCard` (replaces plain div with manual glassmorphism classes)
- Each tender row: `BlurFade` with stagger
- Compliance bars: CSS gradient fills instead of flat colors (`bg-gradient-to-r from-emerald-400 to-emerald-600`)
- Empty state: `PremiumEmptyState` with Nano Banana illustration
- Section title: subtle gradient text

#### 4.1.4 Upcoming Deadlines Panel
- `GlassCard` wrapper
- `BlurFade` stagger per item
- Urgent items (≤14 days): add animated pulse ring (`animate-pulse` on the icon background, subtle)
- Days counter: `NumberTicker` for the countdown number
- Empty state: `PremiumEmptyState` with Nano Banana illustration

---

### 4.2 Tenders List Page

**File:** `src/app/(dashboard)/tenders/page.tsx` (~360 lines → ~380 lines)

#### 4.2.1 Header
- `BlurFade` entrance
- "Νέος Διαγωνισμός" button → `ShimmerButton` (matching landing CTA style)

#### 4.2.2 Filter Bar
- Replace `Card` → `GlassCard`

#### 4.2.3 Tender Cards Grid
- Replace `Card` → `MagicCard` per tender card (same params as landing features)
- `BlurFade` stagger: `delay={0.05 + i * 0.06}` (faster stagger since many cards)
- Compliance bar: gradient fills
- Delete button: keep existing reveal-on-hover pattern

#### 4.2.4 Empty State
- Replace plain Card + Inbox icon → `PremiumEmptyState` component with Nano Banana illustration

---

### 4.3 Tender Detail Page

**File:** `src/app/(dashboard)/tenders/[id]/page.tsx` (~540 lines → ~560 lines)

#### 4.3.1 Header Section
- `BlurFade` entrance
- "Ανάλυση Διαγωνισμού" button → `ShimmerButton` with gradient shimmer
- Status badge: add subtle box-shadow glow matching status color
- Breadcrumb links: animated underline on hover

#### 4.3.2 Stats Row (4 cards)
- Replace `Card` → `MagicCard` per stat
- `NumberTicker` for numeric values
- `BlurFade` stagger

#### 4.3.3 Tab System — Animated Tabs
- Replace basic `TabsList` styling → custom wrapper with framer-motion `layoutId` sliding indicator
- Active tab gets gradient underline that animates between tabs
- Tab icons: color transition on active (muted → brand blue)
- `TabsContent`: `BlurFade` entrance on each tab switch (delay 0.05, short)

#### 4.3.4 Overview Tab
**File:** `src/components/tender/overview-tab.tsx`
- Info grid cards → `GlassCard` per card
- `BlurFade` stagger on info items
- ComplianceScoreBar: animated gradient fill on mount
- Notes section: `GlassCard` wrapper
- Edit dialog save button → `ShimmerButton`

#### 4.3.5 AI Brief & Go/No-Go Panels
**Files:** `ai-brief-panel.tsx`, `go-no-go-panel.tsx`
- Already use `GlassCard` — **keep current implementation**
- Add: `BlurFade` entrance wrapper
- Key point pills: add `hover:scale-[1.02]` transition
- These are the reference quality level — other panels should match

#### 4.3.6 Missing Info & Outcome Panels
**Files:** `missing-info-panel.tsx`, `outcome-panel.tsx`
- Wrap in `GlassCard` (currently plain divs/cards)
- Critical missing items: subtle pulse animation on icon
- `BlurFade` entrance

#### 4.3.7 Other Tab Components
**Files:** `requirements-tab.tsx`, `documents-tab.tsx`, `tasks-tab.tsx`, `legal-tab.tsx`, `financial-tab.tsx`, `technical-tab-enhanced.tsx`, `activity-tab.tsx`
- Each tab: wrap main container sections in `GlassCard` where currently using plain `Card`
- Add `BlurFade` entrance to main content sections
- Keep existing functionality unchanged — this is styling only

---

### 4.4 AI Assistant Panel

**File:** `src/components/tender/ai-assistant-panel.tsx` (~790 lines → ~830 lines)

#### 4.4.1 Floating Button
- Keep current design (good: gradient, pulse, badge)
- No changes needed

#### 4.4.2 Panel Header
- Tab bar: replace manual active state → framer-motion `layoutId` sliding background
- Bot icon area: add micro SparklesCore (particleDensity=15, contained in 36x36px area, blue particles)

#### 4.4.3 Chat Messages
- User bubbles: add subtle `shadow-lg shadow-blue-500/10`
- Assistant bubbles: glassmorphic background (`bg-white/50 dark:bg-white/[0.04] backdrop-blur-sm border border-white/20 dark:border-white/10`)
- Typing indicator: replace bounce dots → animated gradient shimmer bar (CSS `animate-shimmer`)
- Each new message: `BlurFade` entrance (delay 0.05)

#### 4.4.4 Welcome State
- Replace Sparkles icon → Nano Banana AI assistant illustration (120x120px)
- Quick questions: add `BlurFade` stagger

#### 4.4.5 Actions & Reminders Empty States
- Replace plain icons → Nano Banana illustrations (lightbulb, bell themes)

#### 4.4.6 Input Area
- Focus state: `focus:ring-2 focus:ring-blue-500/30 focus:shadow-[0_0_20px_rgba(59,130,246,0.1)]`
- Send button: `active:scale-95` micro-interaction

---

## 5. Shared Components to Extract

### 5.1 PremiumStatCard
**File:** `src/components/ui/premium-stat-card.tsx`

```tsx
interface PremiumStatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  accentColor: string;
  showNumberTicker?: boolean;
  showProgressRing?: boolean;
  progressValue?: number;
  blurFadeDelay?: number;
}
```

Wraps MagicCard + NumberTicker + icon + optional ProgressRing. Used in Dashboard stats, Tender Detail stats, and future Analytics page.

### 5.2 PremiumEmptyState
**File:** `src/components/ui/premium-empty-state.tsx`

```tsx
interface PremiumEmptyStateProps {
  imageSrc: string;        // Nano Banana illustration path
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}
```

Centered layout: illustration (max-w-[200px]) + title + subtitle + optional ShimmerButton CTA. Used across all empty states.

### 5.3 AnimatedTabSystem
**File:** `src/components/ui/animated-tabs.tsx`

```tsx
interface AnimatedTabsListProps {
  children: React.ReactNode;
  className?: string;
  indicatorClassName?: string; // defaults to "bg-gradient-to-r from-blue-500 to-cyan-500 h-[2px]"
  layoutId?: string;          // defaults to "tab-indicator"
}
```

Wrapper around Radix `TabsList` that renders a framer-motion `motion.div` with `layoutId` as a sliding underline indicator. Each `TabsTrigger` child gets wrapped to detect active state and position the indicator. `TabsContent` is unchanged — standard Radix. Uses `mode="wait"` on AnimatePresence for content transitions. Drop-in: replace `<TabsList>` with `<AnimatedTabsList>`, keep everything else the same.

### 5.5 GradientHeading
**File:** `src/components/ui/gradient-heading.tsx`

```tsx
interface GradientHeadingProps {
  children: React.ReactNode;
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
}
```

Wraps `AnimatedGradientText` for page-level headings. Replaces inline gradient CSS hacks.

---

## 6. Nano Banana Image Generation Plan

| Image ID | Filename | Prompt Direction | Dimensions | Used In |
|----------|----------|-----------------|------------|---------|
| NB-1 | `dashboard-welcome.png` | Abstract watercolor: compass rose, lighthouse silhouette, Greek maritime elements, blue-cyan-indigo palette, modern tech feel, transparent background | 400x320 @2x | Dashboard welcome section |
| NB-2 | `empty-tenders.png` | Minimalist watercolor: ship at horizon, calm waters, compass pointing forward, "start journey" feel, blue-cyan palette | 320x240 @2x | Dashboard recent tenders empty, Tenders list empty |
| NB-3 | `empty-deadlines.png` | Gentle watercolor: calm harbor at sunset, no storms, peaceful atmosphere, blue-amber palette | 320x240 @2x | Dashboard deadlines empty |
| NB-4 | `empty-actions.png` | Minimalist: lightbulb with gears inside, idea/innovation concept, blue-cyan palette | 240x240 @2x | AI chat actions tab empty |
| NB-5 | `empty-reminders.png` | Minimalist: bell with clock overlay, gentle reminder concept, blue-cyan palette | 240x240 @2x | AI chat reminders tab empty |
| NB-6 | `ai-assistant-welcome.png` | Friendly robot/AI avatar, maritime-tech hybrid, modern flat illustration, blue-cyan palette, approachable feel | 240x240 @2x | AI chat welcome state |

All images: watercolor/vector hybrid style, brand blue-cyan-indigo palette, transparent or white background, optimized for dark and light mode display.

---

## 7. Implementation Order (Page-by-Page)

```
Step 0: Add prefers-reduced-motion support to BlurFade and NumberTicker
Step 1: Shared components (PremiumStatCard, PremiumEmptyState, AnimatedTabSystem, GradientHeading)
Step 2: Generate Nano Banana illustrations (6 images)
Step 3: Dashboard page rebuild
Step 4: Tenders list page rebuild
Step 5: Tender detail page + header + stats + animated tabs
Step 6: Overview tab, Missing Info panel, Outcome panel
Step 7: Other tab components (requirements, documents, tasks, legal, financial, technical, activity)
Step 8: AI assistant panel premium upgrade
Step 9: Cross-page testing + visual QA
Step 10: Build verification + deploy
```

---

## 8. Technical Constraints

- **No new dependencies.** All components (MagicCard, NumberTicker, BlurFade, ShimmerButton, BorderBeam, GlassCard, AnimatedGradientText, SparklesCore) already exist in `src/components/ui/`.
- **No backend changes.** This is purely frontend styling.
- **SSR safety.** MagicCard uses `useMotionValue` — already handles SSR via `useEffect` + `mounted` state. All premium components are `'use client'` marked.
- **Performance.** No looping particles in dashboard (unlike landing page). SparklesCore only in AI chat header (15 particles, contained). BlurFade `inView` ensures animations only fire when visible. Tab content transitions use short durations (200ms) and `mode="wait"` on AnimatePresence to prevent animation overlap on rapid tab switching.
- **Dark mode.** All glassmorphism values have explicit dark mode variants. MagicCard auto-detects theme via `useTheme()`.
- **Bundle size.** Zero increase — all components already imported somewhere. Only new files are the shared wrappers and Nano Banana images (~6 PNGs, ~50-100KB each). Images served via `next/image` for automatic optimization.
- **Accessibility / `prefers-reduced-motion`.** BlurFade and NumberTicker do NOT currently check `prefers-reduced-motion`. Implementation Step 1 must add a `useReducedMotion()` hook (from `motion/react`) to both components so animations are skipped when the user's OS setting requests it. This is a prerequisite before using them extensively.
- **Import paths.** SparklesCore is exported from `src/components/ui/sparkles.tsx` (not `sparkles-core.tsx`). Import as `@/components/ui/sparkles`. Note: `sparkles.tsx` imports from `framer-motion` while other motion components use `motion/react` — both packages are installed and compatible.
- **AnimatedGradientText defaults.** The component defaults to orange/purple gradients. The `GradientHeading` wrapper (Section 5.5) must explicitly set `colorFrom="#1D4ED8"` and `colorTo="#0891B2"` to match the brand blue-cyan palette.

---

## 9. Success Criteria

1. Visual parity between landing page and dashboard — same design language, same component library
2. All stat cards use MagicCard + NumberTicker across dashboard and tender detail
3. All empty states have Nano Banana illustrations
4. Tab system has animated sliding indicator
5. AI chat panel has glassmorphic message bubbles, animated typing, and illustration welcome
6. All page entrances have BlurFade stagger animations
7. Zero new runtime dependencies
8. Build passes (`next build`) with no errors
9. Dark mode fully functional
10. `prefers-reduced-motion` respected (BlurFade and NumberTicker patched with `useReducedMotion()` to disable animations)

---

## 10. Files Modified (Summary)

| File | Action |
|------|--------|
| `src/app/(dashboard)/dashboard/page.tsx` | Major rewrite |
| `src/app/(dashboard)/tenders/page.tsx` | Moderate restyle |
| `src/app/(dashboard)/tenders/[id]/page.tsx` | Moderate restyle |
| `src/components/tender/overview-tab.tsx` | Moderate restyle |
| `src/components/tender/ai-assistant-panel.tsx` | Moderate restyle |
| `src/components/tender/missing-info-panel.tsx` | Minor restyle (GlassCard wrap) |
| `src/components/tender/outcome-panel.tsx` | Minor restyle (GlassCard wrap) |
| `src/components/tender/requirements-tab.tsx` | Minor restyle |
| `src/components/tender/documents-tab.tsx` | Minor restyle |
| `src/components/tender/tasks-tab.tsx` | Minor restyle |
| `src/components/tender/legal-tab.tsx` | Minor restyle |
| `src/components/tender/financial-tab.tsx` | Minor restyle |
| `src/components/tender/technical-tab-enhanced.tsx` | Minor restyle |
| `src/components/tender/activity-tab.tsx` | Minor restyle |
| `src/components/ui/premium-stat-card.tsx` | **New** |
| `src/components/ui/premium-empty-state.tsx` | **New** |
| `src/components/ui/animated-tabs.tsx` | **New** |
| `src/components/ui/gradient-heading.tsx` | **New** |
| `src/components/ui/blur-fade.tsx` | Patch (add `useReducedMotion`) |
| `src/components/ui/number-ticker.tsx` | Patch (add `useReducedMotion`) |
| `public/images/illustrations/*.png` | **New** (6 Nano Banana images) |
