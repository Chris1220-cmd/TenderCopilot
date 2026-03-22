# TenderCopilot Phase 2: Premium Interior Redesign — Superhuman Style

## Direction
Exact Superhuman aesthetic clone: deep navy dark mode, purple accent gradient, top command bar navigation (NO sidebar), spring-physics motion, layered panels with depth. Every pixel premium.

## Scope
ALL pages after sign-in:
- Layout shell (top nav + command palette)
- Dashboard
- Tenders list
- Tender detail (all tabs + AI panels)
- Company
- Analytics
- Tasks
- Settings

## Navigation — Top Command Bar

### Structure
```
[TC Logo] [Dashboard] [Tenders] [Discovery] [Analytics] [...] | [⌘K Search] [🔔] [Avatar]
```

- Horizontal tabs with animated sliding underline (spring: stiffness 500, damping 30)
- Active tab: white text + underline. Inactive: muted lavender
- Command palette (Cmd+K / Ctrl+K): modal overlay with search-everything
- User menu: dropdown with Company, Tasks, Settings, Logout
- Mobile: hamburger → slide-down menu with backdrop blur

### Behavior
- Sticky top, 56px height
- Background: surface color + backdrop-filter: blur(20px) saturate(180%)
- Border-bottom: 1px solid rgba(255,255,255,0.06)
- On scroll: subtle shadow appears

## Color Palette

### Backgrounds
- `--bg-primary`: #0F0F1A (deepest)
- `--bg-surface`: #161627 (cards, panels)
- `--bg-elevated`: #1C1C35 (modals, dropdowns)
- `--bg-hover`: rgba(255,255,255,0.04)
- `--bg-active`: rgba(255,255,255,0.08)

### Text
- `--text-primary`: #F0F0F5
- `--text-secondary`: #8888A0
- `--text-tertiary`: #55556A
- `--text-accent`: #A78BFA

### Accent (Purple Gradient)
- `--accent-start`: #6C5CE7
- `--accent-end`: #A855F7
- `--accent-glow`: rgba(168,85,247,0.15)

### Semantic
- `--success`: #00D68F
- `--warning`: #FFB020
- `--danger`: #FF4757
- `--info`: #3B82F6

### Borders
- `--border-subtle`: rgba(255,255,255,0.06)
- `--border-default`: rgba(255,255,255,0.10)
- `--border-focus`: rgba(168,85,247,0.5)

## Typography

- Font: Inter (already installed)
- Display: 32px / 600 / -0.025em tracking
- Headline: 20px / 600 / -0.02em
- Title: 16px / 600 / -0.01em
- Body: 14px / 400 / normal
- Caption: 12px / 500 / normal
- Mono: JetBrains Mono 13px (code, numbers)

## Motion Design

### Page Transitions (AnimatePresence)
```tsx
initial={{ opacity: 0, y: 8 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -4 }}
transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
```

### Panel Layers (AI chat, detail panels)
- Slide from right: x: 100% → 0, with backdrop blur overlay
- Spring: { stiffness: 400, damping: 30 }
- Backdrop: rgba(0,0,0,0.5) + blur(8px)

### List Item Stagger
```tsx
variants={{
  hidden: { opacity: 0, y: 12 },
  visible: (i) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }
  })
}}
```

### Hover/Press
- Hover: scale(1.005) + border glow (accent-glow), 150ms ease-out
- Press: scale(0.98), 50ms, spring release
- Focus-visible: 2px ring accent color, 2px offset

### Tab Switch
- Content: crossfade with layout animation
- Underline: layoutId="tab-indicator" (shared layout animation)

## Components

### Cards
- Background: var(--bg-surface)
- Border: 1px solid var(--border-subtle)
- Border-radius: 12px
- Padding: 20px
- Hover: border-color var(--border-default) + subtle translate-y(-1px)
- NO heavy box-shadows

### Stat Cards
- Number: 32px mono, gradient text (accent)
- Label: 12px caption, text-secondary
- Trend indicator: up/down arrow + percentage, color-coded
- Subtle sparkline or mini chart inside

### Data Tables / List Rows
- Row height: 48px
- Hover: bg-hover background
- Selected: bg-active + left accent border (3px)
- Keyboard navigable (arrow keys)
- Column headers: caption style, text-tertiary, uppercase

### Buttons
- Primary: gradient background (accent-start → accent-end), white text, 40px height, 12px border-radius
- Secondary: transparent, border var(--border-default), text-primary, hover bg-hover
- Ghost: no border, text-secondary, hover text-primary
- All: cursor-pointer, min 44px touch target

### Inputs
- Background: var(--bg-primary)
- Border: 1px solid var(--border-subtle)
- Focus: border-color var(--border-focus) + glow shadow
- Height: 40px, padding 12px, border-radius 8px
- Placeholder: text-tertiary

### Badges
- Pill shape: border-radius 9999px
- Semi-transparent background matching semantic color
- Font: caption, 500 weight
- Padding: 2px 8px

### Command Palette
- Modal: centered, 560px width, bg-elevated
- Search input at top, large (48px)
- Results grouped by category
- Keyboard: up/down navigate, enter select, esc close
- Spring animation on open/close

## Page Layouts

### Dashboard
- Full-width, max-width 1400px, centered
- Row 1: Welcome + quick actions (2 buttons)
- Row 2: 4 stat cards (grid, equal width)
- Row 3: 2-column — Recent Tenders (wider) + Upcoming Deadlines
- All sections: BlurFade stagger entrance

### Tenders List
- Full-width table layout
- Search + filters bar at top
- Table rows (NOT card grid)
- Status badge + deadline + compliance score per row
- Click row → navigate to detail (page transition)
- Empty state: Nano Banana illustration

### Tender Detail
- Breadcrumb: Dashboard / Tenders / {title}
- Header: title + status + actions (right-aligned)
- Tab bar: animated underline tabs
- Tab content: full width, animated crossfade
- AI Panel: triggered by button, slides from right as overlay panel

### Company / Settings
- Clean form layouts
- Grouped sections with subtle separators
- Save buttons at section level

### Analytics
- Chart cards with hover tooltips
- Number tickers for key metrics
- Time range selector

## Assets (Nano Banana Pro)

Generate with Nano Banana:
1. Dashboard welcome illustration (dark theme, abstract tender/document imagery)
2. Empty tenders illustration
3. Empty tasks illustration
4. AI assistant avatar/illustration
5. 3D icons for each stat card (if needed — or use refined Lucide with gradient backgrounds)
6. Analytics chart backgrounds

## Technical

### Libraries
- `motion` (Framer Motion) — already installed, use for ALL animations
- Aceternity UI: animated-tabs (underline), spotlight, card-spotlight
- Magic UI: number-ticker, border-beam, shimmer-button, blur-fade, magic-card
- NO new heavy deps (no GSAP, no Three.js)

### File Changes
- DELETE: `src/components/layout/sidebar.tsx`
- CREATE: `src/components/layout/top-nav.tsx`
- CREATE: `src/components/layout/command-palette.tsx`
- MODIFY: `src/app/(dashboard)/layout.tsx` — remove sidebar, add top-nav
- MODIFY: `src/app/globals.css` — new color tokens
- MODIFY: All dashboard pages — new premium components
- MODIFY: All tender tab components — apply new design system

### Constraints
- Windows ARM64: avoid Three.js/WebGL components
- Use `'use client'` on all animated components
- Test with `next build` before declaring done
- All animations respect `prefers-reduced-motion`
