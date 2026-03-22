# Premium Interior Phase 2 — Superhuman Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform all post-login pages from generic/basic to Superhuman-quality premium: top command bar (no sidebar), deep navy + purple accent colors, spring-physics motion, layered panel transitions.

**Architecture:** Replace sidebar layout with horizontal top nav + command palette. Update globals.css color tokens to Superhuman palette (navy/purple). Apply Framer Motion page transitions, stagger animations, and spring-physics interactions to every page. Use existing Aceternity/Magic UI components deeply.

**Tech Stack:** Next.js 14, Framer Motion (motion), Aceternity UI, Magic UI, Tailwind CSS, Lucide React, Radix UI

**Spec:** `docs/superpowers/specs/2026-03-22-premium-interior-phase2-design.md`

---

## File Structure

### New Files
- `src/components/layout/top-nav.tsx` — Horizontal navigation bar with animated tabs, user menu, notifications
- `src/components/layout/command-palette.tsx` — Ctrl+K search-everything modal
- `src/components/layout/page-transition.tsx` — AnimatePresence wrapper for route transitions
- `src/components/ui/premium-stat-card-v2.tsx` — Superhuman-style stat card with gradient numbers + sparkline
- `src/components/ui/data-table-row.tsx` — Animated table row with hover/select states
- `src/components/ui/slide-panel.tsx` — Right-side overlay panel (for AI chat)

### Modified Files
- `src/app/globals.css` — Replace color tokens with Superhuman navy/purple palette
- `src/app/(dashboard)/layout.tsx` — Remove Sidebar, add TopNav + PageTransition
- `src/app/(dashboard)/dashboard/page.tsx` — Full premium rebuild
- `src/app/(dashboard)/tenders/page.tsx` — Table layout with animated rows
- `src/app/(dashboard)/tenders/[id]/page.tsx` — Animated tabs + slide panel
- `src/app/(dashboard)/company/page.tsx` — Premium form layout
- `src/app/(dashboard)/analytics/page.tsx` — Chart cards + number tickers
- `src/app/(dashboard)/tasks/page.tsx` — Premium task list
- `src/app/(dashboard)/settings/page.tsx` — Grouped settings sections
- All `src/components/tender/*.tsx` — Apply new design tokens

### Deleted Files
- `src/components/layout/sidebar.tsx` — Replaced by top-nav

---

## Task 1: Color System — Superhuman Palette

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace dark mode CSS variables**

Replace the `.dark` block in globals.css with Superhuman navy/purple palette:

```css
.dark {
  --background: 240 20% 6%;         /* #0F0F1A — deep navy */
  --foreground: 240 10% 96%;        /* #F0F0F5 — warm white */
  --card: 240 18% 12%;              /* #161627 — surface */
  --card-foreground: 240 10% 96%;
  --popover: 240 18% 15%;           /* #1C1C35 — elevated */
  --popover-foreground: 240 10% 96%;
  --primary: 258 70% 63%;           /* #6C5CE7 — purple start */
  --primary-foreground: 240 10% 96%;
  --secondary: 240 18% 12%;         /* same as card */
  --secondary-foreground: 240 10% 70%;
  --muted: 240 15% 15%;
  --muted-foreground: 240 10% 50%;  /* #8888A0 — muted lavender */
  --accent: 270 80% 70%;            /* #A855F7 — purple end */
  --accent-foreground: 240 10% 96%;
  --destructive: 354 70% 55%;       /* #FF4757 */
  --destructive-foreground: 240 10% 96%;
  --success: 160 85% 42%;           /* #00D68F */
  --success-foreground: 240 10% 96%;
  --warning: 37 100% 56%;           /* #FFB020 */
  --warning-foreground: 240 20% 6%;
  --border: 240 10% 14%;            /* rgba(255,255,255,0.06) equiv */
  --input: 240 10% 14%;
  --ring: 258 70% 63%;
  --sidebar: 240 20% 4%;
  --sidebar-foreground: 240 10% 70%;
  --sidebar-accent: 240 15% 10%;
}
```

- [ ] **Step 2: Update glassmorphism utilities**

Update `.glass-card` and glow utilities to use purple accent instead of blue:

```css
.glow-purple {
  box-shadow: 0 0 20px rgba(168, 85, 247, 0.15), 0 0 60px rgba(168, 85, 247, 0.05);
}

.gradient-text-purple {
  background: linear-gradient(135deg, #6C5CE7, #A855F7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

- [ ] **Step 3: Update gradient accent glow references**

Replace all `blue-500` accent references with purple in existing utilities.

- [ ] **Step 4: Verify — run `npx next build`**

Ensure no CSS errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "design: superhuman color palette — deep navy + purple accent"
```

---

## Task 2: Top Navigation Bar

**Files:**
- Create: `src/components/layout/top-nav.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`
- Delete: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Create TopNav component**

Create `src/components/layout/top-nav.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Compass,
  BarChart3,
  Bell,
  Search,
  LogOut,
  User,
  Settings,
  Building2,
  CheckSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import { useState, useEffect } from 'react';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Tenders', href: '/tenders', icon: FileText },
  { label: 'Discovery', href: '/discovery', icon: Compass },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
];

export function TopNav({ onOpenCommandPalette }: { onOpenCommandPalette?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const main = document.querySelector('main');
      setScrolled(main ? main.scrollTop > 10 : false);
    };
    const main = document.querySelector('main');
    main?.addEventListener('scroll', handleScroll);
    return () => main?.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 flex h-14 items-center justify-between border-b px-6',
        'bg-card/80 backdrop-blur-xl backdrop-saturate-[180%]',
        'border-border/60 transition-shadow duration-300',
        scrolled && 'shadow-[0_1px_3px_rgba(0,0,0,0.3)]'
      )}
    >
      {/* Left: Logo + Nav */}
      <div className="flex items-center gap-1">
        {/* Logo */}
        <Link href="/dashboard" className="mr-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
            <span className="text-sm font-bold text-white">TC</span>
          </div>
        </Link>

        {/* Nav Tabs */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-x-1 -bottom-[13px] h-[2px] bg-gradient-to-r from-primary to-accent"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right: Search + Notifications + User */}
      <div className="flex items-center gap-2">
        {/* Command Palette Trigger */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-foreground"
          onClick={onOpenCommandPalette}
        >
          <Search className="h-4 w-4" />
          <kbd className="pointer-events-none hidden rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground md:inline">
            Ctrl+K
          </kbd>
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="h-4 w-4" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-[10px] font-semibold text-white">
                  {getInitials(session?.user?.name || 'U')}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link href="/company" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Company
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/tasks" className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4" /> Tasks
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Update dashboard layout**

Replace `src/app/(dashboard)/layout.tsx`:

```tsx
import { Toaster } from '@/components/ui/toaster';
import { TopNav } from '@/components/layout/top-nav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopNav />
      <main className="relative flex-1 overflow-y-auto scrollbar-thin">
        {/* Top edge accent glow */}
        <div className="pointer-events-none fixed inset-x-0 top-14 h-[200px] bg-gradient-to-b from-primary/[0.03] to-transparent" />
        <div className="relative z-10 mx-auto max-w-[1400px] px-6 py-8">{children}</div>
      </main>
      <Toaster />
    </div>
  );
}
```

- [ ] **Step 3: Delete sidebar**

```bash
rm src/components/layout/sidebar.tsx
```

- [ ] **Step 4: Verify build**

```bash
npx next build
```

Fix any import errors referencing deleted sidebar.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: replace sidebar with superhuman-style top nav bar"
```

---

## Task 3: Command Palette

**Files:**
- Create: `src/components/layout/command-palette.tsx`
- Modify: `src/components/layout/top-nav.tsx` (wire up)
- Modify: `src/app/(dashboard)/layout.tsx` (add state)

- [ ] **Step 1: Create CommandPalette component**

Create `src/components/layout/command-palette.tsx` — modal with search input, keyboard navigation, spring animation. Categories: Tenders, Pages, Actions. Ctrl+K to open/close.

- [ ] **Step 2: Wire into layout**

Add `useState` for command palette open state in a client wrapper, pass to TopNav and CommandPalette.

- [ ] **Step 3: Add keyboard shortcut listener**

`useEffect` with Ctrl+K / Cmd+K listener.

- [ ] **Step 4: Test interaction — open/close, search, navigate**

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/command-palette.tsx src/components/layout/top-nav.tsx src/app/(dashboard)/layout.tsx
git commit -m "feat: command palette (Ctrl+K) with search and keyboard navigation"
```

---

## Task 4: Page Transition Wrapper

**Files:**
- Create: `src/components/layout/page-transition.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create PageTransition component**

```tsx
'use client';

import { motion } from 'motion/react';
import { usePathname } from 'next/navigation';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 2: Wrap layout children with PageTransition**

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/page-transition.tsx src/app/(dashboard)/layout.tsx
git commit -m "feat: smooth page transitions with framer motion"
```

---

## Task 5: Dashboard Premium Rebuild

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`
- Create: `src/components/ui/premium-stat-card-v2.tsx`

- [ ] **Step 1: Create PremiumStatCardV2**

Superhuman-style stat card: gradient mono numbers (NumberTicker), caption label, trend arrow, subtle sparkline. Hover: scale(1.005) + border glow.

- [ ] **Step 2: Rebuild dashboard page**

- Full-width, max-w-[1400px]
- Welcome header with user first name + quick action buttons
- 4 stat cards grid (active tenders, pending tasks, compliance, deadlines)
- 2-column: Recent Tenders table rows + Upcoming Deadlines list
- All sections: stagger entrance with motion variants (delay i * 0.04)
- Empty states with Nano Banana illustrations

- [ ] **Step 3: Use 21st.dev Magic to generate stat card component**

Call `mcp__21st-magic__21st_magic_component_builder` for premium stat card design.

- [ ] **Step 4: Generate dashboard welcome illustration with Nano Banana Pro**

Call `mcp__nanobanana-mcp__gemini_generate_image` — dark theme, abstract tender/document artwork.

- [ ] **Step 5: Test visually in browser**

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: premium dashboard rebuild — superhuman stat cards, stagger animations"
```

---

## Task 6: Tenders List Premium

**Files:**
- Modify: `src/app/(dashboard)/tenders/page.tsx`
- Create: `src/components/ui/data-table-row.tsx`

- [ ] **Step 1: Create DataTableRow component**

Animated row: 48px height, hover bg-hover, selected state with left accent border. Keyboard navigable. Stagger entrance.

- [ ] **Step 2: Rebuild tenders page**

- Search + filters bar (dark inputs, ghost filter buttons)
- Table headers: caption style, uppercase, text-tertiary
- Table rows: status badge, title, deadline, compliance score, platform
- Click row → navigate with page transition
- Create tender: gradient primary button
- Empty state: Nano Banana illustration

- [ ] **Step 3: Generate empty tenders illustration with Nano Banana**

- [ ] **Step 4: Test visually**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: premium tenders list — animated table rows, search, filters"
```

---

## Task 7: Tender Detail + AI Slide Panel

**Files:**
- Modify: `src/app/(dashboard)/tenders/[id]/page.tsx`
- Create: `src/components/ui/slide-panel.tsx`
- Modify: All `src/components/tender/*.tsx` tab components

- [ ] **Step 1: Create SlidePanel component**

Right-side overlay panel with spring animation (stiffness 400, damping 30). Backdrop blur overlay. For AI assistant chat.

- [ ] **Step 2: Rebuild tender detail page**

- Breadcrumb navigation
- Header: title + status badge + action buttons (right)
- Animated tab bar with `layoutId="tab-indicator"` underline
- Tab content crossfade animation
- AI panel: button triggers SlidePanel from right

- [ ] **Step 3: Update all tab components**

Apply new design tokens to all 8 tab files:
- `overview-tab.tsx`
- `requirements-tab.tsx`
- `documents-tab.tsx`
- `tasks-tab.tsx`
- `technical-tab-enhanced.tsx`
- `financial-tab.tsx`
- `legal-tab.tsx`
- `activity-tab.tsx`

Replace GlassCard backgrounds with `bg-card` + `border border-border/60`. Update text colors to use new muted-foreground. Ensure all hover states use scale + glow.

- [ ] **Step 4: Update AI panel components**

Update `ai-assistant-panel.tsx`, `ai-brief-panel.tsx`, `go-no-go-panel.tsx`, `missing-info-panel.tsx`, `outcome-panel.tsx` — integrate with SlidePanel, apply new tokens.

- [ ] **Step 5: Test all tabs + AI panel slide**

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: premium tender detail — animated tabs, slide panel, all tabs updated"
```

---

## Task 8: Remaining Pages (Company, Analytics, Tasks, Settings)

**Files:**
- Modify: `src/app/(dashboard)/company/page.tsx`
- Modify: `src/app/(dashboard)/analytics/page.tsx`
- Modify: `src/app/(dashboard)/tasks/page.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Company page**

Clean form layout with grouped sections, subtle separators, section-level save buttons. Apply new design tokens.

- [ ] **Step 2: Analytics page**

Chart cards with gradient borders, NumberTicker for key metrics, time range selector. Use MagicCard for chart containers.

- [ ] **Step 3: Tasks page**

Task list with status badges, stagger entrance, hover states. Checkbox animations.

- [ ] **Step 4: Settings page**

Grouped sections (Profile, Notifications, Integrations, Billing). Toggle switches, clean inputs.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: premium company, analytics, tasks, settings pages"
```

---

## Task 9: Nano Banana Asset Generation

**Files:**
- Output to: `public/images/`

- [ ] **Step 1: Generate dashboard welcome illustration**

Dark theme, abstract tender/document imagery, deep navy palette. 16:9 aspect ratio.

- [ ] **Step 2: Generate empty tenders illustration**

Minimal, dark, elegant — empty folder/document visual. 4:3.

- [ ] **Step 3: Generate empty tasks illustration**

Dark, minimal — checkbox/task visual. 4:3.

- [ ] **Step 4: Generate AI assistant avatar**

Abstract AI head/brain, purple gradient, 1:1.

- [ ] **Step 5: Commit assets**

```bash
git add public/images/
git commit -m "assets: nano banana pro illustrations for dashboard, tenders, tasks, AI"
```

---

## Task 10: Motion Design Polish Pass

**Files:**
- All page and component files

- [ ] **Step 1: Verify all pages have stagger entrance animations**

Every page: motion.div with staggerChildren variants on the container, each child with opacity+y animation.

- [ ] **Step 2: Verify all interactive elements have hover/press states**

Buttons: scale(0.98) on press. Cards: scale(1.005) + border glow on hover. Rows: bg-hover.

- [ ] **Step 3: Verify tab transitions use crossfade + layoutId**

Tender detail tabs + top nav tabs.

- [ ] **Step 4: Add prefers-reduced-motion support**

Wrap all motion in `@media (prefers-reduced-motion: reduce)` — disable animations.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "polish: motion design pass — stagger, hover, press, reduced-motion"
```

---

## Task 11: Build Verification + Visual QA

- [ ] **Step 1: Run `npx next build`**

Fix ALL errors. No warnings for unused imports.

- [ ] **Step 2: Run `npx next start` and visually check every page**

- Dashboard
- Tenders list
- Tender detail (each tab)
- Company
- Analytics
- Tasks
- Settings
- Command palette (Ctrl+K)
- Page transitions between routes

- [ ] **Step 3: Check mobile responsiveness**

Top nav collapses to hamburger. All content readable on 375px width.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "verify: build passes, visual QA complete, all pages premium"
```
