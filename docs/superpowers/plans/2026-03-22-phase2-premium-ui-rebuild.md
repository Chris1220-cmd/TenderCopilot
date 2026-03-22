# Phase 2 Premium UI Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring dashboard, tender detail, tenders list, and AI chat to the same premium visual quality as the Phase 1 landing page.

**Architecture:** Page-by-page rebuild using existing premium components (MagicCard, NumberTicker, BlurFade, GlassCard, ShimmerButton). Extract 4 shared components first, then apply to each page. No backend changes, no new dependencies.

**Tech Stack:** Next.js 14, React 18, Tailwind CSS, framer-motion/motion, Radix UI, Recharts, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-22-phase2-premium-ui-rebuild-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/components/ui/premium-stat-card.tsx` | MagicCard + NumberTicker stat card |
| `src/components/ui/premium-empty-state.tsx` | Nano Banana illustration empty state |
| `src/components/ui/animated-tabs.tsx` | Radix TabsList with framer-motion sliding indicator |
| `src/components/ui/gradient-heading.tsx` | AnimatedGradientText wrapper for headings |
| `public/images/illustrations/*.png` | 6 Nano Banana generated images |

### Modified Files
| File | Change Type |
|------|------------|
| `src/components/ui/blur-fade.tsx` | Patch: add `useReducedMotion` |
| `src/components/ui/number-ticker.tsx` | Patch: add `useReducedMotion` |
| `src/app/(dashboard)/dashboard/page.tsx` | Major rewrite |
| `src/app/(dashboard)/tenders/page.tsx` | Moderate restyle |
| `src/app/(dashboard)/tenders/[id]/page.tsx` | Moderate restyle |
| `src/components/tender/overview-tab.tsx` | Moderate restyle |
| `src/components/tender/ai-assistant-panel.tsx` | Moderate restyle |
| `src/components/tender/missing-info-panel.tsx` | Minor: GlassCard wrap |
| `src/components/tender/outcome-panel.tsx` | Minor: GlassCard wrap |
| `src/components/tender/requirements-tab.tsx` | Minor: GlassCard + BlurFade |
| `src/components/tender/documents-tab.tsx` | Minor: GlassCard + BlurFade |
| `src/components/tender/tasks-tab.tsx` | Minor: GlassCard + BlurFade |
| `src/components/tender/legal-tab.tsx` | Minor: GlassCard + BlurFade |
| `src/components/tender/financial-tab.tsx` | Minor: GlassCard + BlurFade |
| `src/components/tender/technical-tab-enhanced.tsx` | Minor: GlassCard + BlurFade |
| `src/components/tender/activity-tab.tsx` | Minor: GlassCard + BlurFade |

---

## Task 0: Patch BlurFade and NumberTicker with `useReducedMotion`

**Files:**
- Modify: `src/components/ui/blur-fade.tsx`
- Modify: `src/components/ui/number-ticker.tsx`

- [ ] **Step 1: Patch BlurFade**

In `src/components/ui/blur-fade.tsx`, add `useReducedMotion` import and skip animation when reduced motion is preferred:

```tsx
// Add to imports (line 5):
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
  type MotionProps,
  type UseInViewOptions,
  type Variants,
} from "motion/react"

// Add inside BlurFade function body, before the ref:
const prefersReducedMotion = useReducedMotion()

// After the line `const combinedVariants = variant ?? defaultVariants`:
if (prefersReducedMotion) {
  return <div className={className}>{children}</div>
}
```

- [ ] **Step 2: Patch NumberTicker**

In `src/components/ui/number-ticker.tsx`, add `useReducedMotion` and render static value when reduced motion is preferred:

```tsx
// Add to imports (line 4):
import { useInView, useMotionValue, useReducedMotion, useSpring } from "motion/react"

// Add inside NumberTicker function body, before the ref:
const prefersReducedMotion = useReducedMotion()

// After the ref declaration, add early return:
if (prefersReducedMotion) {
  return (
    <span className={cn("inline-block tracking-wider text-black tabular-nums dark:text-white", className)} {...props}>
      {Intl.NumberFormat("en-US", { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces }).format(value)}
    </span>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds with no errors related to blur-fade or number-ticker.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/blur-fade.tsx src/components/ui/number-ticker.tsx
git commit -m "a11y: add prefers-reduced-motion support to BlurFade and NumberTicker"
```

---

## Task 1: Create PremiumStatCard Component

**Files:**
- Create: `src/components/ui/premium-stat-card.tsx`

**Reference:** Landing features use MagicCard with `gradientSize={250}`, `gradientColor="#1a1a2e"`, `gradientFrom="#3B82F6"`, `gradientTo="#06B6D4"` (see `src/components/landing/features-bento.tsx:77-83`).

- [ ] **Step 1: Create the component**

Create `src/components/ui/premium-stat-card.tsx`:

```tsx
'use client';

import { cn } from '@/lib/utils';
import { MagicCard } from '@/components/ui/magic-card';
import { NumberTicker } from '@/components/ui/number-ticker';
import { BlurFade } from '@/components/ui/blur-fade';
import type { LucideIcon } from 'lucide-react';

interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  color: string;
}

function ProgressRing({ value, size = 52, strokeWidth = 4, color }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/30"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  );
}

export interface PremiumStatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  accentColor: string;
  borderColor: string;
  bgCircle: string;
  textCircle: string;
  showNumberTicker?: boolean;
  showProgressRing?: boolean;
  progressValue?: number;
  blurFadeDelay?: number;
}

export function PremiumStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accentColor,
  borderColor,
  bgCircle,
  textCircle,
  showNumberTicker = true,
  showProgressRing = false,
  progressValue = 0,
  blurFadeDelay = 0,
}: PremiumStatCardProps) {
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  const isNumeric = !isNaN(numericValue) && showNumberTicker;
  const displaySuffix = typeof value === 'string' && value.includes('%') ? '%' : '';

  return (
    <BlurFade delay={blurFadeDelay} inView>
      <MagicCard
        className={cn('h-full rounded-2xl border-white/[0.06]')}
        gradientSize={250}
        gradientColor="#1a1a2e"
        gradientFrom="#3B82F6"
        gradientTo="#06B6D4"
      >
        <div
          className={cn(
            'group relative overflow-hidden p-5',
            'border-l-4',
            borderColor
          )}
        >
          {/* Subtle gradient overlay on hover */}
          <div
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background: `radial-gradient(ellipse at top right, ${accentColor}08, transparent 60%)`,
            }}
          />

          <div className="relative flex items-start justify-between">
            <div className="space-y-1.5 flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {title}
              </p>

              <div className="flex items-end gap-3">
                {showProgressRing ? (
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-bold tracking-tight">
                      {isNumeric ? (
                        <>
                          <NumberTicker value={numericValue} delay={blurFadeDelay + 0.2} />
                          {displaySuffix}
                        </>
                      ) : (
                        value
                      )}
                    </span>
                    <ProgressRing value={progressValue} color={accentColor} />
                  </div>
                ) : (
                  <span className="text-3xl font-bold tracking-tight">
                    {isNumeric ? (
                      <NumberTicker value={numericValue} delay={blurFadeDelay + 0.2} />
                    ) : (
                      value
                    )}
                  </span>
                )}
              </div>

              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>

            {/* Icon circle */}
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                'transition-transform duration-300 group-hover:scale-110',
                bgCircle
              )}
            >
              <Icon className={cn('h-5 w-5', textCircle)} />
            </div>
          </div>

          {/* Bottom glow line */}
          <div
            className="absolute bottom-0 left-0 h-[2px] w-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background: `linear-gradient(90deg, ${accentColor}, transparent)`,
            }}
          />
        </div>
      </MagicCard>
    </BlurFade>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/premium-stat-card.tsx
git commit -m "feat: add PremiumStatCard component (MagicCard + NumberTicker)"
```

---

## Task 2: Create PremiumEmptyState Component

**Files:**
- Create: `src/components/ui/premium-empty-state.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/ui/premium-empty-state.tsx`:

```tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { BlurFade } from '@/components/ui/blur-fade';
import { ShimmerButton } from '@/components/ui/shimmer-button';

export interface PremiumEmptyStateProps {
  imageSrc: string;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function PremiumEmptyState({
  imageSrc,
  title,
  description,
  action,
  className,
}: PremiumEmptyStateProps) {
  return (
    <BlurFade delay={0.1} inView>
      <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
        <div className="relative mb-6 h-[160px] w-[200px]">
          <Image
            src={imageSrc}
            alt=""
            fill
            className="object-contain opacity-80 dark:opacity-60"
            aria-hidden="true"
          />
        </div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{description}</p>
        {action && (
          <div className="mt-5">
            {action.href ? (
              <Link href={action.href}>
                <ShimmerButton
                  shimmerColor="#06B6D4"
                  shimmerSize="0.05em"
                  background="linear-gradient(135deg, #3B82F6, #06B6D4)"
                  className="px-6 py-2.5 text-sm font-semibold cursor-pointer"
                >
                  {action.label}
                </ShimmerButton>
              </Link>
            ) : (
              <ShimmerButton
                shimmerColor="#06B6D4"
                shimmerSize="0.05em"
                background="linear-gradient(135deg, #3B82F6, #06B6D4)"
                className="px-6 py-2.5 text-sm font-semibold cursor-pointer"
                onClick={action.onClick}
              >
                {action.label}
              </ShimmerButton>
            )}
          </div>
        )}
      </div>
    </BlurFade>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/premium-empty-state.tsx
git commit -m "feat: add PremiumEmptyState component with Nano Banana illustration support"
```

---

## Task 3: Create AnimatedTabsList Component

**Files:**
- Create: `src/components/ui/animated-tabs.tsx`

**Reference:** The current `TabsList`/`TabsTrigger` are from `src/components/ui/tabs.tsx` (Radix-based). This wrapper adds a sliding indicator.

- [ ] **Step 1: Create the component**

Create `src/components/ui/animated-tabs.tsx`:

```tsx
'use client';

import { useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { TabsTrigger } from '@/components/ui/tabs';

interface AnimatedTabsTriggerProps {
  value: string;
  activeValue: string;
  children: ReactNode;
  className?: string;
}

export function AnimatedTabsTrigger({
  value,
  activeValue,
  children,
  className,
}: AnimatedTabsTriggerProps) {
  const isActive = value === activeValue;

  return (
    <TabsTrigger
      value={value}
      className={cn(
        'relative gap-1.5 cursor-pointer transition-colors duration-200',
        isActive && 'text-blue-600 dark:text-blue-400',
        className
      )}
    >
      {children}
      {isActive && (
        <motion.div
          layoutId="active-tab-indicator"
          className="absolute -bottom-[5px] left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
          transition={{
            type: 'spring',
            stiffness: 380,
            damping: 30,
          }}
        />
      )}
    </TabsTrigger>
  );
}
```

Note: Only `AnimatedTabsTrigger` is exported. The `TabsList` wrapper stays as-is from Radix — the sliding indicator is rendered per-trigger via `layoutId`.

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/animated-tabs.tsx
git commit -m "feat: add AnimatedTabsList with framer-motion sliding indicator"
```

---

## Task 4: Create GradientHeading Component

**Files:**
- Create: `src/components/ui/gradient-heading.tsx`

**Reference:** `AnimatedGradientText` defaults to orange/purple. This wrapper sets blue/cyan to match the brand.

- [ ] **Step 1: Create the component**

Create `src/components/ui/gradient-heading.tsx`:

```tsx
import { cn } from '@/lib/utils';
import { AnimatedGradientText } from '@/components/ui/animated-gradient-text';

interface GradientHeadingProps {
  children: React.ReactNode;
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
}

export function GradientHeading({
  children,
  as: Tag = 'h1',
  className,
}: GradientHeadingProps) {
  return (
    <Tag className={cn('font-bold tracking-tight', className)}>
      <AnimatedGradientText
        colorFrom="#1D4ED8"
        colorTo="#0891B2"
        speed={0.8}
      >
        {children}
      </AnimatedGradientText>
    </Tag>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/gradient-heading.tsx
git commit -m "feat: add GradientHeading component (blue-cyan brand gradient)"
```

---

## Task 5: Generate Nano Banana Illustrations

**Files:**
- Create: `public/images/illustrations/` (6 PNG files)

**Tool:** Use `mcp__nanobanana-mcp__gemini_generate_image` MCP tool to generate each image.

- [ ] **Step 1: Create illustrations directory**

```bash
mkdir -p public/images/illustrations
```

- [ ] **Step 2: Generate NB-1 — Dashboard Welcome**

Use Nano Banana MCP to generate:
- Prompt: "Abstract watercolor illustration: compass rose, lighthouse silhouette, Greek maritime elements, blue-cyan-indigo palette (#3B82F6, #06B6D4, #4F46E5), modern tech feel, transparent background, minimal, elegant, suitable for both light and dark backgrounds"
- Save to: `public/images/illustrations/dashboard-welcome.png`

- [ ] **Step 3: Generate NB-2 — Empty Tenders**

- Prompt: "Minimalist watercolor illustration: ship at horizon, calm waters, compass pointing forward, start journey feel, blue-cyan palette (#3B82F6, #06B6D4), clean lines, transparent background, suitable for both light and dark backgrounds"
- Save to: `public/images/illustrations/empty-tenders.png`

- [ ] **Step 4: Generate NB-3 — Empty Deadlines**

- Prompt: "Gentle watercolor illustration: calm harbor at sunset, no storms, peaceful atmosphere, blue-amber palette (#3B82F6, #F59E0B), minimal, transparent background, suitable for both light and dark backgrounds"
- Save to: `public/images/illustrations/empty-deadlines.png`

- [ ] **Step 5: Generate NB-4 — Empty Actions**

- Prompt: "Minimalist flat illustration: lightbulb with gears inside, idea and innovation concept, blue-cyan palette (#3B82F6, #06B6D4), clean vector style, transparent background, suitable for both light and dark backgrounds"
- Save to: `public/images/illustrations/empty-actions.png`

- [ ] **Step 6: Generate NB-5 — Empty Reminders**

- Prompt: "Minimalist flat illustration: bell with clock overlay, gentle reminder concept, blue-cyan palette (#3B82F6, #06B6D4), clean vector style, transparent background, suitable for both light and dark backgrounds"
- Save to: `public/images/illustrations/empty-reminders.png`

- [ ] **Step 7: Generate NB-6 — AI Assistant Welcome**

- Prompt: "Friendly robot AI avatar illustration, maritime-tech hybrid, modern flat design, blue-cyan palette (#3B82F6, #06B6D4), approachable and helpful feel, transparent background, suitable for both light and dark backgrounds"
- Save to: `public/images/illustrations/ai-assistant-welcome.png`

- [ ] **Step 8: Commit**

```bash
git add public/images/illustrations/
git commit -m "assets: add 6 Nano Banana illustrations for empty states and dashboard"
```

---

## Task 6: Dashboard Page — Premium Rebuild

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx` (major rewrite)

**Reference files to read first:**
- Current dashboard: `src/app/(dashboard)/dashboard/page.tsx`
- Landing hero for patterns: `src/components/landing/hero-section.tsx`
- Landing features for MagicCard params: `src/components/landing/features-bento.tsx`

- [ ] **Step 1: Read the current dashboard page**

Read `src/app/(dashboard)/dashboard/page.tsx` in full to understand all data fetching and derived state.

- [ ] **Step 2: Rewrite the dashboard page**

Rewrite `src/app/(dashboard)/dashboard/page.tsx` with these changes:

**Imports to add:**
```tsx
import { GradientHeading } from '@/components/ui/gradient-heading';
import { PremiumStatCard } from '@/components/ui/premium-stat-card';
import { PremiumEmptyState } from '@/components/ui/premium-empty-state';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/ui/glass-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { NumberTicker } from '@/components/ui/number-ticker';
import Image from 'next/image';
```

**Imports to remove (VERIFY FIRST):**
- Remove `recharts` imports (`LineChart`, `Line`, `ResponsiveContainer`) — no longer used after sparkline removal
- Before removing `Card`/`CardContent`/`CardHeader`/`CardTitle`, grep the file for all usages. Only remove if nothing else references them after the rewrite. If unsure, leave the import — the build will tell you if it's unused.

**Components to remove:**
- Delete `MiniSparkline` function (renders nothing with empty data)
- Delete `sparkActive`, `sparkTasks`, `sparkCompliance`, `sparkDeadlines` empty arrays
- Delete `StatsCardSkeleton` — replace with PremiumStatCard skeleton

**Welcome Section changes:**
- Replace `style jsx global` block and inline gradient → `<GradientHeading as="h1" className="text-3xl">Καλως ηρθατε, {firstName}</GradientHeading>`
- Add Nano Banana illustration right side:
```tsx
<div className="flex items-center justify-between">
  <div className="space-y-1">
    <GradientHeading as="h1" className="text-3xl">
      Καλως ηρθατε, {firstName}
    </GradientHeading>
    <p className="text-muted-foreground">Ακολουθει η συνοψη των διαγωνισμων σας.</p>
  </div>
  <div className="relative hidden md:block h-[130px] w-[160px] opacity-80 pointer-events-none">
    <Image src="/images/illustrations/dashboard-welcome.png" alt="" fill className="object-contain" aria-hidden="true" />
  </div>
</div>
```
- Add quick actions row below:
```tsx
<div className="flex flex-wrap gap-3 mt-4">
  <Link href="/tenders/new">
    <ShimmerButton shimmerColor="#06B6D4" shimmerSize="0.05em" background="linear-gradient(135deg, #3B82F6, #06B6D4)" className="px-5 py-2 text-sm font-semibold cursor-pointer">
      <Plus className="h-4 w-4 mr-1.5" /> Νέος Διαγωνισμός
    </ShimmerButton>
  </Link>
</div>
```
- Wrap entire welcome section in `<BlurFade delay={0} inView>`

**Stats Grid changes:**
- Replace the 4 plain div stat cards → use `<PremiumStatCard>` component for each
- Pass `blurFadeDelay={0.15 + i * 0.08}` for stagger
- For compliance card: `showProgressRing={true}` `progressValue={complianceScore}`
- Loading state: 4 skeleton cards using MagicCard shells

**Recent Tenders Panel changes:**
- Replace outer div (manual glassmorphism) → `<GlassCard>`/`<GlassCardHeader>`/`<GlassCardContent>`
- Wrap each tender row in `<BlurFade delay={0.3 + i * 0.05} inView>`
- Compliance bar gradient: replace `bg-emerald-500` → `bg-gradient-to-r from-emerald-400 to-emerald-600`
- Replace plain empty state → `<PremiumEmptyState imageSrc="/images/illustrations/empty-tenders.png" title="Δεν υπάρχουν διαγωνισμοί" description="Δημιουργήστε τον πρώτο σας διαγωνισμό!" action={{ label: 'Νέος Διαγωνισμός', href: '/tenders/new' }} />`

**Upcoming Deadlines Panel changes:**
- Replace outer div → `<GlassCard>`/`<GlassCardHeader>`/`<GlassCardContent>`
- Wrap each deadline row in `<BlurFade delay={0.3 + i * 0.05} inView>`
- Replace plain empty state → `<PremiumEmptyState imageSrc="/images/illustrations/empty-deadlines.png" title="Τίποτα επείγον" description="Δεν υπάρχουν προσεχείς deadlines." />`

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -30`
Expected: Build succeeds. No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: premium dashboard rebuild with MagicCard, NumberTicker, GlassCard, BlurFade"
```

---

## Task 7: Tenders List Page — Premium Restyle

**Files:**
- Modify: `src/app/(dashboard)/tenders/page.tsx`

- [ ] **Step 1: Read the current tenders list page**

Read `src/app/(dashboard)/tenders/page.tsx` in full.

- [ ] **Step 2: Apply premium styling**

**Imports to add:**
```tsx
import { MagicCard } from '@/components/ui/magic-card';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { PremiumEmptyState } from '@/components/ui/premium-empty-state';
```

**Changes:**
1. **Header:** Wrap in `<BlurFade delay={0} inView>`. Replace `<Button>` for "Νέος Διαγωνισμός" → `<ShimmerButton>` with same gradient params as landing
2. **Filter bar:** Replace `<Card>` → `<GlassCard>`, `<CardContent>` → `<GlassCardContent>`
3. **Tender cards grid:** Each card:
   - Replace `<Card>` → `<MagicCard className="h-full rounded-2xl border-white/[0.06]" gradientSize={250} gradientColor="#1a1a2e" gradientFrom="#3B82F6" gradientTo="#06B6D4">`
   - Wrap each in `<BlurFade delay={0.05 + i * 0.06} inView>`
   - Move the `<Link>` inside MagicCard content
   - Keep existing delete button hover reveal
4. **Compliance bar gradient:** Replace flat `bg-emerald-500` → `bg-gradient-to-r from-emerald-400 to-emerald-600` (same for amber, red)
5. **Empty state:** Replace plain Card → `<PremiumEmptyState imageSrc="/images/illustrations/empty-tenders.png" title="Κανένας διαγωνισμός" description="Δημιουργήστε τον πρώτο σας διαγωνισμό." action={{ label: 'Νέος Διαγωνισμός', href: '/tenders/new' }} />`

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -30`

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/tenders/page.tsx
git commit -m "feat: premium tenders list with MagicCard, GlassCard, BlurFade"
```

---

## Task 8: Tender Detail Page — Header, Stats & Animated Tabs

**Files:**
- Modify: `src/app/(dashboard)/tenders/[id]/page.tsx`

- [ ] **Step 1: Read the current tender detail page**

Read `src/app/(dashboard)/tenders/[id]/page.tsx` in full.

- [ ] **Step 2: Apply premium styling**

**Imports to add:**
```tsx
import { PremiumStatCard } from '@/components/ui/premium-stat-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { AnimatedTabsTrigger } from '@/components/ui/animated-tabs';
```

**Imports to remove (VERIFY FIRST):**
- Before removing `Card`/`CardContent`, grep the file for all usages: `grep -n "Card\b" src/app/\(dashboard\)/tenders/\[id\]/page.tsx`. Only remove if the stats row is the sole usage. If other sections still use Card, keep the import.

**Changes:**

1. **Breadcrumb + Header:** Wrap in `<BlurFade delay={0} inView>`. "Ανάλυση Διαγωνισμού" button → `<ShimmerButton>` with same params

2. **Stats Row:** Replace 4 `<Card>` stat items → `<PremiumStatCard>` for each:
```tsx
<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
  {stats.map((stat, i) => (
    <PremiumStatCard
      key={i}
      title={stat.label}
      value={stat.value}
      icon={stat.icon}
      accentColor={/* derive from stat.color */}
      borderColor={/* derive from stat.bgColor */}
      bgCircle={stat.bgColor}
      textCircle={stat.color}
      blurFadeDelay={0.1 + i * 0.08}
    />
  ))}
</div>
```

3. **Tab System:** Replace each `<TabsTrigger>` → `<AnimatedTabsTrigger value="..." activeValue={activeTab}>`:
```tsx
<TabsList className="relative flex-wrap h-auto gap-1 p-1">
  <AnimatedTabsTrigger value="overview" activeValue={activeTab}>
    <Eye className="h-3.5 w-3.5" /> Επισκόπηση
  </AnimatedTabsTrigger>
  <AnimatedTabsTrigger value="requirements" activeValue={activeTab}>
    <ClipboardList className="h-3.5 w-3.5" /> Απαιτήσεις
  </AnimatedTabsTrigger>
  {/* ... same for all 8 tabs */}
</TabsList>
```

4. **Tab Content:** Wrap each `<TabsContent>` body in `<BlurFade>` with a `key` prop to force re-mount on tab switch (otherwise `useInView({ once: true })` prevents re-animation):
```tsx
<TabsContent value="overview">
  <BlurFade key={`tab-overview-${activeTab}`} delay={0.05} inView>
    {/* existing content */}
  </BlurFade>
</TabsContent>
```
The `key` changes when `activeTab` changes, forcing React to unmount/remount the BlurFade so it re-animates.

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -30`

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/tenders/\[id\]/page.tsx
git commit -m "feat: premium tender detail with PremiumStatCard, AnimatedTabs, BlurFade"
```

---

## Task 9: Overview Tab — Premium Restyle

**Files:**
- Modify: `src/components/tender/overview-tab.tsx`

- [ ] **Step 1: Read the current overview tab**

Read `src/components/tender/overview-tab.tsx` in full.

- [ ] **Step 2: Apply premium styling**

**Imports to add:**
```tsx
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { ShimmerButton } from '@/components/ui/shimmer-button';
```

**Changes:**
1. **Info grid cards:** Replace `<Card>` → `<GlassCard>`, `<CardContent>` → `<GlassCardContent>`. Wrap each in `<BlurFade delay={0.05 + i * 0.06} inView>`
2. **Compliance card:** Replace `<Card>` → `<GlassCard>`. Gradient bar fill: `bg-gradient-to-r from-emerald-400 to-emerald-600`
3. **Top Gaps card:** Replace `<Card>` → `<GlassCard>`
4. **Notes card:** Replace `<Card>` → `<GlassCard>`
5. **Edit dialog save button:** Replace `<Button>` → `<ShimmerButton>` with brand gradient

- [ ] **Step 3: Commit**

```bash
git add src/components/tender/overview-tab.tsx
git commit -m "feat: premium overview tab with GlassCard, BlurFade, gradient bars"
```

---

## Task 10: AI Brief & Go/No-Go Panels — Minor Enhancements

**Files:**
- Modify: `src/components/tender/ai-brief-panel.tsx`
- Modify: `src/components/tender/go-no-go-panel.tsx`

- [ ] **Step 1: Read both panels**

Read `src/components/tender/ai-brief-panel.tsx` and `src/components/tender/go-no-go-panel.tsx`.

- [ ] **Step 2: Add BlurFade and hover enhancements**

Both files — add import:
```tsx
import { BlurFade } from '@/components/ui/blur-fade';
```

**ai-brief-panel.tsx:**
- Wrap the returned `<GlassCard>` in `<BlurFade delay={0.1} inView>`
- Key point pills: add `hover:scale-[1.02] transition-transform` to existing className

**go-no-go-panel.tsx:**
- Wrap the returned `<GlassCard>` in `<BlurFade delay={0.15} inView>`
- Factor pills: add `hover:scale-[1.02] transition-transform`

- [ ] **Step 3: Commit**

```bash
git add src/components/tender/ai-brief-panel.tsx src/components/tender/go-no-go-panel.tsx
git commit -m "feat: add BlurFade entrance and hover scale to AI panels"
```

---

## Task 11: Missing Info & Outcome Panels — GlassCard Wrap

**Files:**
- Modify: `src/components/tender/missing-info-panel.tsx`
- Modify: `src/components/tender/outcome-panel.tsx`

- [ ] **Step 1: Read both panels**

Read both files to understand their current wrapper structure.

- [ ] **Step 2: Wrap in GlassCard + BlurFade**

**missing-info-panel.tsx:**
- Add imports: `GlassCard`, `GlassCardHeader`, `GlassCardTitle`, `GlassCardContent`, `BlurFade`
- Replace the outer wrapper div/card → `<GlassCard>` compound component
- Wrap entire return in `<BlurFade delay={0.1} inView>`

**outcome-panel.tsx:**
- Same pattern: replace outer wrapper → `<GlassCard>` + `<BlurFade delay={0.1} inView>`

- [ ] **Step 3: Commit**

```bash
git add src/components/tender/missing-info-panel.tsx src/components/tender/outcome-panel.tsx
git commit -m "feat: wrap MissingInfo and Outcome panels in GlassCard + BlurFade"
```

---

## Task 12: Other Tab Components — Batch GlassCard + BlurFade

**Files (7 files, same pattern for each):**
- `src/components/tender/requirements-tab.tsx`
- `src/components/tender/documents-tab.tsx`
- `src/components/tender/tasks-tab.tsx`
- `src/components/tender/legal-tab.tsx`
- `src/components/tender/financial-tab.tsx`
- `src/components/tender/technical-tab-enhanced.tsx`
- `src/components/tender/activity-tab.tsx`

All 7 files currently use plain `div` wrappers with `Card` components inside. None import BlurFade.

- [ ] **Step 1: Read all 7 tab files**

Read each file to identify their top-level Card sections.

- [ ] **Step 2: Apply to each file**

For each file, apply the same pattern:

1. Add imports:
```tsx
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { BlurFade } from '@/components/ui/blur-fade';
```

2. Replace top-level `<Card>` components → `<GlassCard>`, `<CardContent>` → `<GlassCardContent>`, etc.

3. Wrap major content sections in `<BlurFade delay={0.05} inView>` — only 1-2 BlurFade wrappers per tab, not every element.

4. Keep all existing functionality, data fetching, mutations unchanged.

**Important:** Each tab has different internal structure. Read each file before modifying. Some have multiple cards (legal has "Clauses" + "Risk Assessment"), some have tables, some have upload areas. Only replace the outermost card wrappers.

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -30`

- [ ] **Step 4: Commit**

```bash
git add src/components/tender/requirements-tab.tsx src/components/tender/documents-tab.tsx src/components/tender/tasks-tab.tsx src/components/tender/legal-tab.tsx src/components/tender/financial-tab.tsx src/components/tender/technical-tab-enhanced.tsx src/components/tender/activity-tab.tsx
git commit -m "feat: premium styling for all tender tab components (GlassCard + BlurFade)"
```

---

## Task 13: AI Assistant Panel — Premium Upgrade

**Files:**
- Modify: `src/components/tender/ai-assistant-panel.tsx`

This is the most delicate modification — 790 lines of working chat UI. Changes are styling-only.

- [ ] **Step 1: Read the full AI assistant panel**

Read `src/components/tender/ai-assistant-panel.tsx` in full (all 790 lines).

- [ ] **Step 2: Apply premium styling changes**

**Imports to add:**
```tsx
import { BlurFade } from '@/components/ui/blur-fade';
import { motion } from 'motion/react';
import Image from 'next/image';
```

**2a. Tab Bar (around line 358-378):**
Replace the tab buttons' active state styling. Each tab button gets a `motion.div` indicator:
```tsx
{activeTab === tab.key && (
  <motion.div
    layoutId="ai-tab-indicator"
    className="absolute inset-0 rounded-md bg-background shadow-sm"
    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
    style={{ zIndex: 0 }}
  />
)}
<span className="relative z-10 flex items-center justify-center gap-1.5">
  <tab.icon className="h-3.5 w-3.5" />
  {tab.label}
</span>
```
Remove the old conditional `bg-background shadow-sm` from className.

**2b. Chat Messages (around line 404-528):**
- User bubbles: add `shadow-lg shadow-blue-500/10` to existing className
- Assistant bubbles: replace `bg-muted/50 border border-border/50` → `bg-white/50 dark:bg-white/[0.04] backdrop-blur-sm border border-white/20 dark:border-white/10` (glassmorphic)
- Only the **last 3 messages** get wrapped in `<BlurFade delay={0.03} inView>` — older messages render without animation to avoid creating 50+ IntersectionObservers in long conversations. Use `messages.slice(-3).some(m => m.id === msg.id)` to check.

**2c. Typing Indicator (find the `{isTyping &&` block):**
Replace the bounce dots with a shimmer bar. Note: the existing `animate-shimmer` keyframe uses `translateX` (not `background-position`), so use a `background-position` approach instead:
```tsx
{isTyping && (
  <div className="flex gap-2.5">
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600/20 to-cyan-500/20">
      <Bot className="h-4 w-4 text-blue-500" />
    </div>
    <div className="rounded-2xl rounded-bl-md bg-white/50 dark:bg-white/[0.04] backdrop-blur-sm border border-white/20 dark:border-white/10 px-4 py-3">
      <div
        className="h-4 w-24 rounded-full animate-[bg-shimmer_1.5s_ease-in-out_infinite]"
        style={{
          backgroundSize: '200% 100%',
          backgroundImage: 'linear-gradient(90deg, hsl(var(--muted-foreground) / 0.1), hsl(var(--muted-foreground) / 0.3), hsl(var(--muted-foreground) / 0.1))',
        }}
      />
    </div>
  </div>
)}
```
Also add this keyframe to `tailwind.config.ts` in the `keyframes` section:
```js
'bg-shimmer': {
  '0%': { backgroundPosition: '200% 0' },
  '100%': { backgroundPosition: '-200% 0' },
},
```
And add to `animation`:
```js
'bg-shimmer': 'bg-shimmer 1.5s ease-in-out infinite',
```

**2d. Welcome State (around line 389-401):**
Replace the Sparkles icon with Nano Banana illustration:
```tsx
<div className="relative h-[120px] w-[120px] mx-auto mb-3">
  <Image src="/images/illustrations/ai-assistant-welcome.png" alt="" fill className="object-contain opacity-70 dark:opacity-50" aria-hidden="true" />
</div>
```

**2e. Quick Questions (around line 551-580):**
Wrap the quick questions container in `<BlurFade delay={0.1} inView>`.

**2f. Actions Empty State (around line 678-685):**
Replace `<Lightbulb>` icon → Nano Banana:
```tsx
<div className="relative h-[120px] w-[120px] mx-auto mb-2">
  <Image src="/images/illustrations/empty-actions.png" alt="" fill className="object-contain opacity-60" aria-hidden="true" />
</div>
```

**2g. Reminders Empty State (around line 775-782):**
Replace `<Bell>` icon → Nano Banana:
```tsx
<div className="relative h-[120px] w-[120px] mx-auto mb-2">
  <Image src="/images/illustrations/empty-reminders.png" alt="" fill className="object-contain opacity-60" aria-hidden="true" />
</div>
```

**2h. Input Area (find the input and send button):**
- Input: add `focus:shadow-[0_0_20px_rgba(59,130,246,0.1)]` to existing focus classes
- Send button: add `active:scale-95 transition-transform` to className

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | tail -30`

- [ ] **Step 4: Commit**

```bash
git add src/components/tender/ai-assistant-panel.tsx tailwind.config.ts
git commit -m "feat: premium AI chat panel with glassmorphic bubbles, animated tabs, illustrations"
```

---

## Task 14: Build Verification & Final QA

- [ ] **Step 1: Full build**

Run: `npx next build`
Expected: Build succeeds with zero errors.

- [ ] **Step 2: Check for TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 3: Verify all new images exist**

```bash
ls -la public/images/illustrations/
```
Expected: 6 PNG files (dashboard-welcome, empty-tenders, empty-deadlines, empty-actions, empty-reminders, ai-assistant-welcome).

- [ ] **Step 4: Verify no unused imports**

Run: `npx next build 2>&1 | grep -i "unused\|warning"`
Fix any unused import warnings.

- [ ] **Step 5: Final commit if any fixes**

```bash
git add -A
git commit -m "fix: address build warnings from Phase 2 premium UI rebuild"
```

- [ ] **Step 6: Summary verification**

Verify against success criteria:
1. Dashboard uses MagicCard + NumberTicker ✓
2. Tender detail uses PremiumStatCard + AnimatedTabs ✓
3. All empty states have Nano Banana illustrations ✓
4. Tab system has animated sliding indicator ✓
5. AI chat has glassmorphic bubbles + illustration welcome ✓
6. All page entrances have BlurFade stagger ✓
7. Zero new runtime dependencies ✓
8. Build passes ✓
9. Dark mode (all classes have dark: variants) ✓
10. prefers-reduced-motion patched ✓
