# Analytics 3D Premium Panels — Design Spec

**Date:** 2026-03-24
**Status:** Approved
**Design language:** Superhuman Carbon — clean, minimal, professional. NO AI-generic.

## Overview

Upgrade the analytics page from flat panels to premium 3D interactive panels with chart animations, mouse-tracked effects, and enterprise SaaS polish.

## New Component: `AnalyticsTiltCard`

Reusable wrapper for all chart panels. Combines:

1. **Mouse-tracked spotlight** — radial gradient glow follows cursor (uses `useMotionValue` + `useMotionTemplate`). Color: `rgba(72,164,214,0.06)` (Picton Blue, very subtle). NO CanvasRevealEffect (too heavy, AI-generic).
2. **3D perspective tilt** — max 3deg rotation on chart panels. Uses `perspective: 800px`, `rotateX/Y` based on mouse position. Smooth 200ms transition back to flat on mouse leave.
3. **BorderBeam on hover** — existing component, `colorFrom="#48A4D6"`, `colorTo="#48A4D6/40"`. Appears on hover only.
4. **Hover lift** — `translateY(-2px)` + `box-shadow: 0 8px 30px rgba(0,0,0,0.08)`.
5. **Active glow** — `box-shadow: 0 0 40px rgba(72,164,214,0.06)` on hover.

### Props
```ts
interface AnalyticsTiltCardProps {
  children: React.ReactNode;
  className?: string;
  index?: number; // for stagger delay
}
```

## Chart Upgrades

### 1. Donut (Status Distribution)
- **Animated draw-in:** `startAngle={90}` + `endAngle` animated from 90→450 via motion
- **Center label:** Total count + "Διαγωνισμοί" text in donut hole
- **Hover slice:** `activeIndex` state, active slice gets `outerRadius + 8`
- **Custom tooltip:** `backdrop-blur-sm bg-card/90 border-border` — NOT default Recharts

### 2. Compliance Comparison (Horizontal Bars)
- **Animated slide-in:** Bar widths animate from 0 via `<Bar isAnimationActive animationDuration={800} animationEasing="ease-out" />`
- **Subtle bar glow:** CSS `filter: drop-shadow(0 0 6px color/30)` on bar SVG
- **Grid lines fade-in:** CartesianGrid with animated opacity 0→1 before bars appear

### 3. Conversion Funnel
- **Cascade animation:** Each `FunnelBar` delayed by `index * 0.12s`
- **Gradient fill:** Each bar gets subtle linear gradient (color → color/70)
- **Percentage labels:** Add conversion rate (%) between stages

### 4. Deadline Proximity
- **Heatmap bars:** Replace flat segments with individual animated bars per category
- **Color intensity:** Urgent = solid red, Safe = lighter green (opacity gradient)
- **Animated fill:** Each bar width animates from 0 with stagger

## KPI Cards Enhancement

### Sparkline mini-charts
- Tiny area chart (40px height) below each KPI value
- Data: last 7 data points (mock for now, real when we have history)
- Styling: stroke `primary/40`, fill `primary/[0.05]`, no axes, no labels
- Uses Recharts `<AreaChart>` with `<Area>` — minimal config

### Hero numbers on chart panels
- Each chart panel header gets a prominent metric:
  - Funnel: total pipeline count
  - Deadline: urgent count (red if > 0)
  - Donut: total tenders
  - Compliance: avg compliance %

## Animation Cascade

Entry sequence when page scrolls into view:
1. KPI cards: 0.04s stagger (already exists)
2. Row 2 panels (Funnel + Deadline): 0.15s after KPI cards
3. Row 3 panels (Donut + Compliance): 0.25s after KPI cards
4. Charts animate AFTER their panel is visible (inView trigger)

## Colors & Style Rules

- Grayscale + Picton Blue `#48A4D6` ONLY for accents/glows
- Status colors unchanged (blue, amber, cyan, green, red)
- Gradient fills: subtle only — `color → color/70`, never aggressive
- NO purple, NO violet, NO gradient text
- Card base: `bg-card border border-border/60 rounded-xl`
- All text via `t()` i18n

## Performance

- `useReducedMotion()` check — disable tilt, spotlight, cascade if user prefers
- No Three.js/WebGL (CanvasRevealEffect NOT used)
- Mouse tracking throttled via `useMotionValue` (already optimized by framer-motion)

## Files Modified

1. **NEW** `src/components/ui/analytics-tilt-card.tsx` — TiltCard wrapper
2. **EDIT** `src/app/(dashboard)/analytics/page.tsx` — wrap panels, upgrade charts
3. **EDIT** `src/components/ui/premium-stat-card-v2.tsx` — add sparkline slot
