# SP3 — SME First-Bid Wizard Design

**Date:** 2026-04-16

---

## Goal

Add a linear 5-step wizard mode to the tender detail page that guides first-time bidders through the tender response process. The wizard is an alternative view — advanced users keep using tabs. A "Ξεκίνα Wizard" button on the Overview tab activates it.

## How It Works

### Entry Point
On the tender Overview tab, a new banner appears for tenders in DISCOVERY or IN_PROGRESS status:

```
┌─────────────────────────────────────────────┐
│ 🎯 Πρώτη φορά σε διαγωνισμό;               │
│ Ακολούθησε τον οδηγό βήμα-βήμα.            │
│                        [Ξεκίνα τον Οδηγό →] │
└─────────────────────────────────────────────┘
```

Clicking switches the tender detail view from tab mode to wizard mode.

### The 5 Steps

**Step 1 — Κατανόηση (Understand)**
Shows: AI Brief summary + key tender info (budget, deadline, authority, CPV). The user reads and understands what this tender is about.
Action: "Κατάλαβα, πάμε παρακάτω →"

**Step 2 — Επιλεξιμότητα (Eligibility Check)**
Shows: Auto-generated eligibility checklist from requirements. Each requirement mapped to company profile:
- ✅ Covered (green) — you have this
- ⚠️ Gap (amber) — you're missing this
- ❌ Blocker (red) — you can't participate
Action: "Πληρώ τις προϋποθέσεις →" or "Δεν πληρώ — Go/No-Go"

**Step 3 — Έγγραφα (Documents)**
Shows: Required document checklist based on requirements. Shows which ones exist in company resources, which need to be uploaded/prepared.
Action: Upload missing docs or mark as "θα ετοιμάσω αργότερα"

**Step 4 — Τιμολόγηση (Pricing)**
Shows: Pricing Intelligence card (from SP2.4). If available, shows recommended range. User enters their bid price.
Action: "Ορίζω τιμή €X →"

**Step 5 — Αποστολή (Review & Submit)**
Shows: Final summary — all steps completed or not. Checklist of what's ready and what's pending. Completion percentage.
Action: "Ολοκλήρωσα" → marks tender as REVIEW status

### Navigation
- Linear progress bar at top (Step 1/5, 2/5, etc.)
- Can go back to any previous step
- Can exit wizard anytime → returns to tab view
- Progress persists (stored in tender's status/metadata)

## Architecture

Single new component: `src/components/tender/bid-wizard.tsx`
- Renders inside tender detail page when wizard mode is active
- Uses existing data from tRPC queries (requirements, documents, pricing intelligence)
- Does NOT duplicate logic — it wraps/reuses existing components in a linear flow
- Wizard state (current step) stored in component state + URL param `?wizard=1&step=2`

Modifications:
- `src/app/(dashboard)/tenders/[id]/page.tsx` — add wizard mode toggle + render BidWizard when active
- No new backend endpoints needed — uses existing tRPC queries

## Non-goals
- No new database models
- No new API endpoints
- No tutorial/onboarding outside tender context
