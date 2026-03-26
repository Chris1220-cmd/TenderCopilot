# UX Restructure — Phase-Grouped Sidebar Navigation

## Overview

Αντικατάσταση των 11 horizontal tabs στο tender detail page (`/tenders/[id]`) με phase-grouped left sidebar. Τα sections ομαδοποιούνται σε 4 φάσεις που αντικατοπτρίζουν τη φυσική ροή ετοιμασίας φακέλου. Free navigation — κανένα locking.

**Τι λύνει:**
- 11 tabs σε σειρά χωρίς κατεύθυνση = ο χρήστης χάνεται
- Δεν φαίνεται πού βρίσκεται η πρόοδος κάθε section
- Δεν υπάρχει mental model για τη σειρά εργασίας

**Τι ΔΕΝ αλλάζει:**
- Τα content components μέσα σε κάθε section (OverviewTab, RequirementsTab, κλπ) μένουν ακριβώς ίδια
- Ο AI Assistant floating button μένει ως έχει
- Τα action buttons (Analysis, Edit, Compliance Check, Delete) μένουν στο header
- MissingInfoPanel + OutcomePanel μένουν πάνω από το content
- Η λογική activeTab + URL query param μένει ίδια

---

## Layout: Before vs After

### Before (Current)
```
┌──────────────────────────────────────────────────────────┐
│ Breadcrumb > Tender Title        [Actions]               │
│ [Stat Card] [Stat Card] [Stat Card] [Stat Card]         │
│ [Missing Info Panel] [Outcome Panel]                     │
│ [Tab|Tab|Tab|Tab|Tab|Tab|Tab|Tab|Tab|Tab|Tab]           │
│ ┌──────────────────────────────────────────────────────┐ │
│ │                                                      │ │
│ │              Tab Content (full width)                 │ │
│ │                                                      │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### After (New)
```
┌──────────────────────────────────────────────────────────┐
│ Tender Title  [Ref#]  [Status]  [Deadline ⏱ 5d]  [Acts] │
├────────────┬─────────────────────────────────────────────┤
│            │ [Stat Card] [Stat Card] [Stat Card] [Stat] │
│ ΚΑΤΑΝΟΗΣΗ  │ [Missing Info Panel] [Outcome Panel]       │
│ ✓ Σύνοψη   │ ┌─────────────────────────────────────────┐│
│ ● Απαιτήσεις│ │                                         ││
│ ○ Κριτήρια │ │           Section Content               ││
│            │ │                                         ││
│ ΠΡΟΕΤΟΙΜΑΣΙΑ│ │                                         ││
│ ○ Νομικά   │ └─────────────────────────────────────────┘│
│ ○ Τεχνικά  │                                            │
│ ○ Οικονομικά│                                            │
│            │                                            │
│ ΣΥΛΛΟΓΗ    │                                            │
│ ○ Έγγραφα  │                                            │
│ ○ Φάκελος  │                                            │
│ ○ Εργασίες │                                            │
│            │                                            │
│ ΥΠΟΒΟΛΗ    │                                            │
│ ○ Χρονοδιάγ.│                                            │
│ ○ Ιστορικό │                                            │
│            │                                            │
│ ▓▓▓▓░░ 35% │                                            │
├────────────┴─────────────────────────────────────────────┤
│                    [AI Assistant 💬]                      │
└──────────────────────────────────────────────────────────┘
```

---

## Phase Structure

### Φάση 1: Κατανόηση (Understand)
| Section | Tab Value | Icon | i18n Key | Τι κάνει |
|---------|-----------|------|----------|----------|
| Σύνοψη | overview | Eye | tender.overviewTab | AI Brief, Go/No-Go, Intelligence, basic info |
| Απαιτήσεις | requirements | ClipboardList | tender.requirementsTab | Extracted requirements, coverage mapping |
| Κριτήρια | criteria | Award | tender.criteriaTab | Evaluation criteria tree |

### Φάση 2: Προετοιμασία (Prepare)
| Section | Tab Value | Icon | i18n Key | Τι κάνει |
|---------|-----------|------|----------|----------|
| Νομικά | legal | Scale | tender.legalTab | Legal clauses, risk, clarifications |
| Τεχνικά | technical | Wrench | tender.technicalTab | Technical proposal, risks, team requirements |
| Οικονομικά | financial | Banknote | tender.financialTab | Pricing scenarios, eligibility |

### Φάση 3: Συλλογή (Assemble)
| Section | Tab Value | Icon | i18n Key | Τι κάνει |
|---------|-----------|------|----------|----------|
| Έγγραφα | documents | FileText | tender.documentsTab | Uploaded + generated documents |
| Φάκελος | fakelos | FolderCheck | tender.dossierTab | Envelope completeness check |
| Εργασίες | tasks | ListTodo | tender.tasksTab | Task kanban board |

### Φάση 4: Υποβολή (Submit)
| Section | Tab Value | Icon | i18n Key | Τι κάνει |
|---------|-----------|------|----------|----------|
| Χρονοδιάγραμμα | deadline | CalendarClock | deadline.tab | Deadline plan items |
| Ιστορικό | activity | Activity | tender.activityTab | Activity timeline |

---

## Sidebar Component

### New Component: `TenderPhaseSidebar`

**File:** `src/components/tender/tender-phase-sidebar.tsx`

**Props:**
```typescript
type SidebarProps = {
  activeSection: string;
  onSectionChange: (section: string) => void;
  tender: { id: string; status: string; submissionDeadline?: Date | null };
  sectionStatuses: Record<string, SectionStatus>;
  unreadClarifications: number;
};

type SectionStatus = 'not_started' | 'in_progress' | 'complete' | 'has_issues';
```

**Status Icons:**
- `not_started` → Circle (empty, muted)
- `in_progress` → CircleDot (half, amber)
- `complete` → CheckCircle2 (green)
- `has_issues` → AlertTriangle (red)

**Phase Headers:**
- Small uppercase label with phase number
- Color: muted-foreground
- Non-clickable — decorative grouping only

**Active Section:**
- Background: `bg-muted/50`
- Left border: `border-l-2 border-[#48A4D6]`

**Overall Progress Bar:**
- Bottom of sidebar
- Thin bar showing % of sections complete
- Text: "X/11 ολοκληρωμένα"

**Legal Tab Special:** Show unread clarification count badge (same as current)

---

## Section Status Auto-Detection

Status is computed server-side in a new tRPC endpoint, NOT manually set by users.

**New endpoint:** `tender.getSectionStatuses(tenderId)`

| Section | `complete` when | `in_progress` when | `has_issues` when |
|---------|----------------|-------------------|------------------|
| overview | brief + goNoGo exist | either exists | neither exists AND tender age > 1 day |
| requirements | requirements extracted AND coverage > 0 | requirements extracted | no requirements |
| criteria | all criteria status = FINAL | any criteria exists | none |
| legal | legal clauses extracted | clauses exist but risk items unaddressed | unread clarifications > 0 |
| technical | all sections APPROVED | any section exists | sections in AI_DRAFT > 7 days |
| financial | pricing scenario selected | any scenario exists | eligibility = NOT_ELIGIBLE |
| documents | generated docs count ≥ 2 | any generated doc exists | none |
| fakelos | fakelos score ≥ 80% | score > 0 | score < 50% AND deadline ≤ 14 days |
| tasks | all tasks DONE | any task IN_PROGRESS | overdue tasks > 0 |
| deadline | all mandatory items OBTAINED | any item IN_PROGRESS | overdue items > 0 |
| activity | always `complete` (read-only log) | — | — |

---

## Persistent Header

The existing header (breadcrumb + title + status + actions) stays but gets a **deadline countdown** added.

**Add to header row:**
```
[CalendarClock icon] 5 ημέρες (or "ΣΗΜΕΡΑ" / "ΕΛΗΞΕ")
```

Color: green (>7 days), amber (3-7), red (≤3), with pulse animation for ≤1 day.

---

## Responsive Behavior

### Desktop (≥1024px)
- Sidebar: fixed width 220px, left side
- Content: flex-1, right side

### Tablet (768-1023px)
- Sidebar: collapsible, 56px collapsed (icons only), 220px expanded
- Toggle button at top of sidebar

### Mobile (<768px)
- No sidebar visible by default
- Hamburger button in header opens sidebar as a slide-out drawer (Sheet)
- Sheet shows full sidebar with phase groups

---

## i18n Keys

```
tender.phase.understand = "Κατανόηση" / "Understand"
tender.phase.prepare = "Προετοιμασία" / "Prepare"
tender.phase.assemble = "Συλλογή" / "Assemble"
tender.phase.submit = "Υποβολή" / "Submit"
tender.sidebar.progress = "{{count}}/11 ολοκληρωμένα" / "{{count}}/11 complete"
tender.sidebar.toggle = "Πλοήγηση φακέλου" / "Dossier navigation"
tender.deadline.countdown.days = "{{count}} ημέρες" / "{{count}} days"
tender.deadline.countdown.today = "ΣΗΜΕΡΑ" / "TODAY"
tender.deadline.countdown.expired = "ΕΛΗΞΕ" / "EXPIRED"
```

---

## Files to Create/Modify

### New Files
- `src/components/tender/tender-phase-sidebar.tsx` — Sidebar component
- `src/components/tender/section-status-icon.tsx` — Status icon component

### Modified Files
- `src/app/(dashboard)/tenders/[id]/page.tsx` — Replace TabsList with sidebar layout, keep TabsContent
- `src/server/routers/tender.ts` — Add getSectionStatuses endpoint (per-tender, belongs here)
- `messages/el.json` — Phase names + sidebar keys
- `messages/en.json` — Phase names + sidebar keys

---

## Design Decisions

### Why sidebar instead of stepper?
Stepper implies strict linearity. Tender preparation is non-linear — users jump between Legal, Technical, and Financial constantly. A sidebar with free navigation respects this while still showing the recommended order.

### Why keep Tabs/TabsContent under the hood?
The Radix UI Tabs component handles keyboard navigation, accessibility, and the activeTab state. We just replace the visual TabsList with our sidebar — the TabsContent rendering stays the same. Minimal code change, maximum visual impact.

### Why auto-detect status instead of manual?
Users don't mark sections "complete" — they just work. Auto-detection removes friction and gives accurate progress without user effort.

### Why 4 phases and not 3 or 5?
4 maps exactly to the Greek procurement envelope structure: eligibility → technical → financial → submission. This is the mental model that Greek procurement officers already use.
