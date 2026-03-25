# Feature 3: Clarification Monitoring — Design Spec

**Date:** 2026-03-25
**Status:** Approved
**Feature:** Hybrid clarification monitoring with manual entry, smart reminders, and unread alerts

---

## Problem

In Greek public procurement, contracting authorities publish clarifications (διευκρινίσεις) — Q&A that affect all bidders. These appear on ΕΣΗΔΗΣ, ΚΗΜΔΗΣ, or ΔΙΑΥΓΕΙΑ during the tender period. Currently:

1. Users have no way to track published clarifications inside TenderCopilot
2. No reminders to check for new clarifications on procurement portals
3. No visibility on the dashboard or tender overview when new clarifications appear
4. Draft clarifications (AI-generated) exist but have no link to authority responses

## Solution

Hybrid approach: manual entry of published clarifications + smart escalating reminders + unread alerts across the app. AI analysis deferred to future iteration.

---

## Architecture

### Data Model Changes

**Extend `ClarificationQuestion` model** (no new model):

```prisma
model ClarificationQuestion {
  // ... existing fields ...

  // NEW fields
  source      String    @default("AI_GENERATED") // "AI_GENERATED" | "AUTHORITY_PUBLISHED"
  publishedAt DateTime?                           // When authority published it
  sourceUrl   String?                             // Link to ΕΣΗΔΗΣ/ΚΗΜΔΗΣ
  isRead      Boolean   @default(false)           // Whether user has read it
}
```

**Extend `Tender` model:**

```prisma
model Tender {
  // ... existing fields ...

  // NEW field
  lastClarificationCheckAt DateTime? // When user last checked for new clarifications
}
```

**`TenderAlert`** — two new type values (no schema change):
- `CLARIFICATION_CHECK_REMINDER` — "Time to check for new clarifications"
- `CLARIFICATION_NEW_UNREAD` — "X new published clarifications added"

### Reminder Escalation Logic

For each active tender (`GO_NO_GO` or `IN_PROGRESS`) with `submissionDeadline > now`:

```
daysToDeadline = submissionDeadline - now (in days)
interval =
  daysToDeadline > 14 → 5 days
  daysToDeadline > 7  → 2 days
  daysToDeadline ≤ 7  → 1 day

daysSinceCheck = now - lastClarificationCheckAt (or now - createdAt if never checked)
needsReminder = daysSinceCheck >= interval
```

Auto-stop: reminders only fire for tenders with status `GO_NO_GO` or `IN_PROGRESS` AND `submissionDeadline` in the future.

---

## Backend — Procedures

All added to the existing `ai-roles.ts` router (same router that manages ClarificationQuestion):

| Procedure | Type | Description |
|-----------|------|-------------|
| `addPublishedClarification` | mutation | Create ClarificationQuestion with source="AUTHORITY_PUBLISHED", publishedAt, sourceUrl, isRead=false |
| `listPublishedClarifications` | query | Return all published clarifications for a tender, ordered by publishedAt desc |
| `markClarificationRead` | mutation | Set isRead=true on a specific clarification |
| `markClarificationsChecked` | mutation | Set tender.lastClarificationCheckAt=now, dismiss CLARIFICATION_CHECK_REMINDER alerts for that tender |
| `getClarificationReminders` | query | Return list of active tenders needing a clarification check (for dashboard widget) |
| `getUnreadCount` | query | Return count of unread published clarifications per tender (for tab badge) |

### Input/Output

**addPublishedClarification:**
```typescript
input: {
  tenderId: string,
  questionText: string,   // The question asked
  answerText: string,     // Authority's answer
  publishedAt: string,    // ISO date
  sourceUrl?: string,     // Optional link
}
output: ClarificationQuestion
```

**getClarificationReminders:**
```typescript
input: none (uses ctx.tenantId)
output: Array<{
  tenderId: string,
  tenderTitle: string,
  daysToDeadline: number,
  daysSinceCheck: number,
  interval: number,       // Current interval in days
  urgency: "normal" | "warning" | "critical", // based on 1x, 1.5x, 2x+ interval
  platformUrl?: string,   // Tender's source URL for quick access
}>
```

---

## Frontend — Components

### 1. LegalTab — "Δημοσιευμένες Διευκρινίσεις" Section

Location: `src/components/tender/legal-tab.tsx` — new section below existing draft clarifications.

**Layout:**
- Section header: "Δημοσιευμένες Διευκρινίσεις" + unread count badge + "Προσθήκη" button + "Έλεγξα για νέες" button
- Each entry card:
  - Blue dot indicator if unread, disappears on click (markAsRead)
  - "Ε:" prefix + question text
  - "Α:" prefix + answer text
  - Footer: published date + source link (if available)
  - Disabled "Ανάλυση AI" button with tooltip "Coming soon"
- Empty state: "Δεν υπάρχουν δημοσιευμένες διευκρινίσεις" + prompt to check portal

**"Έλεγξα για νέες" button:**
- Calls `markClarificationsChecked`
- Dismisses any pending reminder alerts
- Shows toast confirmation
- Updates `lastClarificationCheckAt` timestamp displayed next to button

### 2. Add Clarification Dialog

Modal form triggered by "Προσθήκη" button:

| Field | Type | Required | Placeholder |
|-------|------|----------|-------------|
| Ερώτηση | Textarea | Yes | "Η ερώτηση που υποβλήθηκε..." |
| Απάντηση | Textarea | Yes | "Η απάντηση της αναθέτουσας..." |
| Ημ. Δημοσίευσης | Date picker | Yes | — |
| Link πηγής | Input (URL) | No | "https://portal.eprocurement.gov.gr/..." |

On submit: calls `addPublishedClarification`, refetches list, closes dialog.

### 3. LegalTab Badge

The tab label "Νομικά" in the tender detail tab bar shows a badge with unread count:
- Uses `getUnreadCount` query
- Badge: small circle with number, same style as notification badges
- Disappears when all are read

### 4. Overview Tab — Alert Banner

When there are unread published clarifications for the current tender:
- Amber banner below the health check banner (existing pattern)
- Text: "{{count}} νέες διευκρινίσεις — Δες τες στο tab Νομικά"
- Clickable → switches to LegalTab
- Follows existing alert banner design from Feature 1

### 5. Dashboard — Clarification Reminders Widget

New widget `src/components/dashboard/clarification-reminders-widget.tsx`:
- Same card pattern as ExpiringCertsWidget (rounded-xl, border-border/60, bg-card)
- Header: "Έλεγχος Διευκρινίσεων" + clock icon
- Each row: tender title + days since check + urgency indicator + "Έλεγξα" button + external link icon
- Urgency colors: muted-foreground (normal), amber (warning), red (critical)
- Empty state: "Όλοι οι διαγωνισμοί είναι ενήμεροι" + checkmark
- Placed on dashboard alongside ExpiringCertsWidget

---

## i18n Keys

New keys under `clarifications.*`:

| Key | EL | EN |
|-----|----|----|
| `clarifications.publishedTitle` | Δημοσιευμένες Διευκρινίσεις | Published Clarifications |
| `clarifications.addNew` | Προσθήκη | Add |
| `clarifications.markChecked` | Έλεγξα για νέες | Checked for new |
| `clarifications.lastChecked` | Τελευταίος έλεγχος: {{date}} | Last checked: {{date}} |
| `clarifications.questionLabel` | Ερώτηση | Question |
| `clarifications.answerLabel` | Απάντηση | Answer |
| `clarifications.publishedAt` | Δημοσιεύτηκε {{date}} | Published {{date}} |
| `clarifications.sourceLink` | Πηγή | Source |
| `clarifications.aiAnalysis` | Ανάλυση AI | AI Analysis |
| `clarifications.comingSoon` | Σύντομα διαθέσιμο | Coming soon |
| `clarifications.noPublished` | Δεν υπάρχουν δημοσιευμένες διευκρινίσεις | No published clarifications |
| `clarifications.checkPortal` | Ελέγξτε το ΕΣΗΔΗΣ για νέες | Check ESIDIS for new ones |
| `clarifications.newUnread` | {{count}} νέες διευκρινίσεις | {{count}} new clarifications |
| `clarifications.seeInLegal` | Δες τες στο tab Νομικά | See them in Legal tab |
| `clarifications.remindersTitle` | Έλεγχος Διευκρινίσεων | Clarification Checks |
| `clarifications.allChecked` | Όλοι οι διαγωνισμοί είναι ενήμεροι | All tenders are up to date |
| `clarifications.daysSinceCheck` | {{days}} ημ. από τελευταίο έλεγχο | {{days}} days since last check |
| `clarifications.checkedNow` | Σημειώθηκε ως ελεγμένο | Marked as checked |

---

## Out of Scope

- Automatic scraping/fetching from ΕΣΗΔΗΣ, ΚΗΜΔΗΣ, ΔΙΑΥΓΕΙΑ, TED APIs
- AI analysis of published clarifications (deferred — "Coming soon" button)
- Email/push notifications (in-app alerts only)
- Auto-matching published clarifications to draft questions
- File attachments on clarifications (just text + URL)

---

## Design Rules

- Colors: Grayscale + Picton Blue #48A4D6 only
- No purple/violet/indigo
- Cards: bg-card border border-border/60 rounded-xl
- Buttons: Solid bg-primary
- All text via t() — no hardcoded strings
- Effects: BlurFade for entry animations
- Touch targets: min 44x44px
- cursor-pointer on all clickable elements
