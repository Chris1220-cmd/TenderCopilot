# Feature 10 — Multi-Tender Resource Dashboard (Κέντρο Ελέγχου)

## Overview

Νέα σελίδα `/resources` που δίνει cross-tender intelligence σε γραφεία που τρέχουν 5-15 διαγωνισμούς ταυτόχρονα. Τρία focused sections — μόνο αυτά που ο χρήστης ανοίγει κάθε πρωί.

**Τι λύνει:**
- Ο #1 λόγος αποκλεισμού στους ελληνικούς δημόσιους διαγωνισμούς είναι ληγμένα πιστοποιητικά. Σήμερα δεν υπάρχει cross-tender view — δεν βλέπεις ότι η ίδια Φορολογική Ενημερότητα (30 ημέρες validity) χτυπάει 3 φακέλους.
- Τα εγγυητικά (2% × εκτιμώμενη αξία ανά διαγωνισμό) δεσμεύουν κεφάλαιο 6-12 μήνες. Χωρίς συνολική εικόνα, δεν ξέρεις αν χωράεις νέο διαγωνισμό.
- Κανένα υπάρχον view στο app δεν δείχνει τι πρέπει να γίνει ΣΗΜΕΡΑ σε ΟΛΑ τα tenders μαζί.

**Τι ΔΕΝ περιλαμβάνει (σκόπιμα):**
- Portfolio analytics (win rate trends, funnel) → ήδη υπάρχει στο `/analytics`
- Team workload heatmap → γραφεία 3-5 ατόμων ξέρουν ήδη ποιος δουλεύει τι
- Kanban pipeline → η `/tenders` list ήδη δείχνει status + deadline
- Tender timeline/Gantt → eye candy χωρίς καθημερινή αξία

---

## Page Structure

```
Route: /resources
Nav Label: "Κέντρο Ελέγχου" (nav.resources)
Position: Μετά το Analytics στο TopNav

┌────────────────────────────────────────────────────────┐
│ Top Bar: 4 KPI Cards                                   │
│ [Ενεργοί Φάκελοι] [Κρίσιμα Alerts] [Εγγυητικά] [Win%]│
├────────────────────────────────────────────────────────┤
│                                                        │
│ Section A: Πρωινά Alerts                               │
│ ┌─ alert card ──────────────────────────────────────┐  │
│ │ [2 ΗΜΕΡΕΣ] Φορολογική λήγει 28/03                │  │
│ │ Επηρεάζει: ΔΕΥΑ Θεσσ. + ΟΛΘ                     │  │
│ │ → Παράγγειλε νέα σήμερα                          │  │
│ └───────────────────────────────────────────────────┘  │
│ ┌─ alert card ──────────────────────────────────────┐  │
│ │ ...more alerts...                                 │  │
│ └───────────────────────────────────────────────────┘  │
│                                                        │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Section B: Πιστοποιητικά × Φάκελοι Matrix              │
│ ┌───────────────┬────────┬────────┬────────┬────────┐  │
│ │ Πιστοποιητικό │ Λήγει  │ ΔΕΥΑ   │ ΟΛΘ    │ ΔΕΔΔΗΕ │  │
│ │ Φορολογική    │ 28/03  │ ΛΗΓΕΙ  │ ΛΗΓΕΙ  │ ΛΗΓΕΙ  │  │
│ │ Ασφαλιστική   │ 18/04  │  OK    │  OK    │  OK    │  │
│ │ Ποινικό (x3)  │ 15/06  │  OK    │  OK    │  OK    │  │
│ └───────────────┴────────┴────────┴────────┴────────┘  │
│                                                        │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Section C: Εγγυητική Έκθεση                            │
│ ┌─ progress bar: €128K / €200K (64%) ───────────────┐  │
│ │ Διαθέσιμο: €72K → χωράει μέχρι ~€3.6M            │  │
│ └───────────────────────────────────────────────────┘  │
│ ┌─ guarantee list ──────────────────────────────────┐  │
│ │ ΔΕΥΑ Θεσσ. — €10.000                             │  │
│ │ ΟΛΘ — €30.000                                    │  │
│ │ ΔΕΔΔΗΕ — €24.000 (εκκρεμεί)                     │  │
│ └───────────────────────────────────────────────────┘  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## Section A: Πρωινά Alerts

### What generates alerts

| Alert Type | Condition | Severity | Action Text |
|---|---|---|---|
| Certificate expiring | Certificate/LegalDoc `expiryDate` ≤ tender `submissionDeadline` AND `expiryDate` within 14 days from now | CRITICAL (≤3 days), WARNING (≤7), INFO (≤14) | "Παράγγειλε νέα [type]" |
| Guarantee pending | GuaranteeLetter `status=REQUESTED` AND tender deadline within 14 days | WARNING | "Κάλεσε τράπεζα για status" |
| ΥΔ unsigned | Active tender with no `SOLEMN_DECLARATION` GeneratedDocument in FINAL status, deadline ≤14 days | INFO | "Ετοίμασε και υπέγραψε ΥΔ" |
| Clarification unread | Unread published clarifications on active tenders | INFO | "Δες τις νέες διευκρινίσεις" |
| Deadline approaching | Tender `submissionDeadline` ≤7 days | CRITICAL (≤3), WARNING (≤7) | "Ελεγξε ετοιμότητα φακέλου" |
| DeadlinePlanItem overdue | `DeadlinePlanItem.dueDate` < now AND `status` not OBTAINED | WARNING | "Εκκρεμεί: [title]" |

### Alert card anatomy

Each alert card contains:
1. **Countdown badge** — "2 ΗΜΕΡΕΣ", "ΣΗΜΕΡΑ", "ΕΛΗΞΕ" with color (red ≤3d, amber ≤7d, blue >7d)
2. **Title** — What's happening: "Φορολογική Ενημερότητα λήγει 28/03"
3. **Impact** — Which tenders are affected: "Επηρεάζει: ΔΕΥΑ Θεσσ. (01/04) + ΟΛΘ (05/04)"
4. **Action** — What to do: "→ Παράγγειλε νέα σήμερα για να καλύψεις και τους 2"

### Cross-tender intelligence

The key differentiator: alerts are **grouped by root cause, not by tender**. One expiring certificate that affects 3 tenders = 1 alert card showing all 3, not 3 separate alerts. This is the cross-tender intelligence that doesn't exist anywhere in the app today.

### Sort order

Alerts sorted by: severity DESC, then days remaining ASC. CRITICAL first, then WARNING, then INFO. Within same severity, most urgent first.

### Dismissal

Alerts auto-resolve when the condition clears (e.g., certificate renewed). No manual dismiss — this prevents users from hiding important warnings.

---

## Section B: Πιστοποιητικά × Φάκελοι Matrix

### Data source

- **Rows**: All `Certificate` + `LegalDocument` records for the tenant that have `expiryDate` set. Grouped by type. For `LegalDocument`, use the `LegalDocType` enum (TAX_CLEARANCE, SOCIAL_SECURITY_CLEARANCE, GEMI_CERTIFICATE, CRIMINAL_RECORD, JUDICIAL_CERTIFICATE). For `Certificate`, group by `type` string (ISO 9001, ISO 14001, etc.).
- **Columns**: All active tenders (status IN [DISCOVERY, GO_NO_GO, IN_PROGRESS]) that have a `submissionDeadline` set, sorted by deadline ASC.

### Cell status logic

For each cell (document × tender):

```
if document.expiryDate is null:
  → "N/A" (grey)
if document.expiryDate < now:
  → "ΕΛΗΞΕ" (red) — already expired
if document.expiryDate < tender.submissionDeadline:
  → "ΛΗΓΕΙ" (red) — will be expired by submission
if document.expiryDate < tender.submissionDeadline + 7 days:
  → "ΟΡΙΑΚΑ" (amber) — valid at submission but <7 day margin (risky if authority delays opening)
else:
  → "OK" (green)
```

### Special handling

- **Ποινικό Μητρώο**: Show count of people covered, e.g., "Ποινικό Μητρώο (x3 άτομα)". Source: count of board members/legal reps from CompanyProfile (legalRepName) + any configured list. Since there's no board member model, just show the document title as-is.
- **Multiple certificates of same type**: If there are 2 ISO 9001 certificates (shouldn't happen normally), show the one with the latest expiryDate.
- **Tender column header**: Show short title (truncated to ~15 chars) + deadline date colored by urgency.

### Interaction

- Click on a cell → navigate to `/company` (certificates tab or legal docs tab) for renewal
- Click on a tender column header → navigate to `/tenders/[id]`
- No editing in this matrix — it's a read-only cross-reference view

---

## Section C: Εγγυητική Έκθεση

### New Data Model: GuaranteeLetter

This is the only new Prisma model needed for Feature 10.

```prisma
model GuaranteeLetter {
  id              String    @id @default(cuid())
  tenderId        String
  tenantId        String
  type            GuaranteeType  @default(PARTICIPATION)
  amount          Float          // in EUR
  bank            String?        // issuing bank name
  referenceNumber String?        // bank reference or tender reference
  status          GuaranteeStatus @default(REQUESTED)
  requestedAt     DateTime?
  issuedAt        DateTime?
  validUntil      DateTime?
  releasedAt      DateTime?
  notes           String?   @db.Text
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  tender  Tender  @relation(fields: [tenderId], references: [id], onDelete: Cascade)
  tenant  Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([tenderId])
}

enum GuaranteeType {
  PARTICIPATION    // Εγγυητική Συμμετοχής (2% of estimated value)
  PERFORMANCE      // Εγγυητική Καλής Εκτέλεσης (4% of contract value)
  ADVANCE_PAYMENT  // Εγγυητική Προκαταβολής
}

enum GuaranteeStatus {
  REQUESTED   // Αιτήθηκε στην τράπεζα
  ISSUED      // Εκδόθηκε
  ACTIVE      // Ενεργή (submitted with tender)
  RELEASED    // Αποδεσμεύτηκε
  EXPIRED     // Έληξε
}
```

### New field on CompanyProfile

```prisma
// Add to CompanyProfile model:
guaranteeCreditLine  Float?   // Total available credit line in EUR
```

### UI Components

**Progress Bar:**
- Numerator: Sum of `amount` for all GuaranteeLetters with `status` IN [REQUESTED, ISSUED, ACTIVE]
- Denominator: `CompanyProfile.guaranteeCreditLine`
- Percentage: committed / creditLine × 100
- Color: green (≤50%), amber (50-80%), red (>80%)
- Below bar: "Διαθέσιμο: €X → χωράει νέος διαγωνισμός μέχρι ~€Y εκτιμώμενη αξία" (where Y = available / 0.02)

**Guarantee List:**
- Each row: tender title + amount + status badge
- Status colors: REQUESTED=amber, ISSUED=blue, ACTIVE=green, RELEASED=grey
- Sorted: REQUESTED first (needs action), then ACTIVE, then ISSUED, then RELEASED
- Click row → navigate to tender detail

**Add Guarantee:**
- Button "Προσθήκη Εγγυητικής" → Sheet/Dialog form:
  - Select tender (dropdown of active tenders)
  - Type (PARTICIPATION / PERFORMANCE / ADVANCE_PAYMENT)
  - Amount (EUR, pre-filled with 2% × tender.budget if type=PARTICIPATION)
  - Bank name
  - Reference number
  - Status
  - Notes

### Edge cases

- If `guaranteeCreditLine` is not set on CompanyProfile: show the guarantee list but no progress bar. Show prompt: "Ορίσε πιστωτικό όριο εγγυητικών στο Εταιρικό Προφίλ"
- If no guarantees exist: show empty state with explanation of what this section does

---

## Top Bar KPIs

4 stat cards at the top for context:

| KPI | Source | Notes |
|---|---|---|
| Ενεργοί Φάκελοι | Count of tenders with status IN [DISCOVERY, GO_NO_GO, IN_PROGRESS] | Neutral color |
| Κρίσιμα Alerts | Count of CRITICAL + WARNING alerts from Section A | Red if >0, green if 0 |
| Εγγυητικά Δεσμευμένα | Sum of active guarantee amounts (€) | Amber/red based on % of credit line |
| Win Rate | WON / (WON + LOST) × 100 | Green. Context metric, not actionable |

---

## API Layer

### New tRPC Router: `resources`

```typescript
// src/server/routers/resources.ts

resourcesRouter = router({

  // Section A: Alerts
  getAlerts: protectedProcedure.query(async ({ ctx }) => {
    // 1. Fetch active tenders (DISCOVERY, GO_NO_GO, IN_PROGRESS) with deadlines
    // 2. Fetch all certificates + legal docs for tenant with expiryDate
    // 3. Fetch guarantee letters with status REQUESTED
    // 4. Fetch DeadlinePlanItems that are overdue
    // 5. Fetch unread clarification counts per tender
    // 6. Fetch generated docs to check for missing ΥΔ
    // 7. Cross-reference: for each expiring doc, find ALL affected tenders
    // 8. Group by root cause, not by tender
    // 9. Sort by severity + urgency
    // Returns: ResourceAlert[]
  }),

  // Section B: Certificate Matrix
  getCertificateMatrix: protectedProcedure.query(async ({ ctx }) => {
    // 1. Fetch active tenders with submissionDeadline, sorted by deadline
    // 2. Fetch all certificates + legal docs with expiryDate
    // 3. Compute cell status for each doc × tender pair
    // Returns: { tenders: TenderColumn[], documents: DocRow[], cells: CellStatus[][] }
  }),

  // Section C: Guarantees
  getGuaranteeOverview: protectedProcedure.query(async ({ ctx }) => {
    // 1. Fetch all guarantee letters for tenant
    // 2. Fetch company profile for credit line
    // 3. Compute totals
    // Returns: { guarantees: GuaranteeLetter[], creditLine: number | null, committed: number, available: number }
  }),

  // Section C: Guarantee mutations
  createGuarantee: protectedProcedure
    .input(createGuaranteeSchema)
    .mutation(async ({ ctx, input }) => { ... }),

  updateGuarantee: protectedProcedure
    .input(updateGuaranteeSchema)
    .mutation(async ({ ctx, input }) => { ... }),

  deleteGuarantee: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => { ... }),

  // Top bar KPIs
  getKpis: protectedProcedure.query(async ({ ctx }) => {
    // Reuse analytics.getTenderStats + count alerts + sum guarantees
    // Returns: { activeTenders: number, criticalAlerts: number, guaranteeCommitted: number, winRate: number }
  }),
})
```

---

## i18n Keys

```
resources.title = "Κέντρο Ελέγχου" / "Control Center"
resources.subtitle = "Cross-tender overview" / ...
resources.kpi.activeTenders = "Ενεργοί Φάκελοι" / "Active Tenders"
resources.kpi.criticalAlerts = "Κρίσιμα Alerts" / "Critical Alerts"
resources.kpi.guaranteeCommitted = "Εγγυητικά Δεσμευμένα" / "Guarantees Committed"
resources.kpi.winRate = "Win Rate" / "Win Rate"

resources.alerts.title = "Σήμερα / Αυτή την Εβδομάδα" / "Today / This Week"
resources.alerts.empty = "Δεν υπάρχουν εκκρεμότητες" / "No pending actions"
resources.alerts.daysLeft = "{count} ημέρες" / "{count} days"
resources.alerts.today = "ΣΗΜΕΡΑ" / "TODAY"
resources.alerts.expired = "ΕΛΗΞΕ" / "EXPIRED"
resources.alerts.affects = "Επηρεάζει" / "Affects"
resources.alerts.action.orderCertificate = "Παράγγειλε νέα σήμερα" / "Order new today"
resources.alerts.action.callBank = "Κάλεσε τράπεζα για status" / "Call bank for status"
resources.alerts.action.signDocuments = "Κλείσε batch signing session" / "Schedule batch signing"
resources.alerts.action.checkClarifications = "Δες τις νέες διευκρινίσεις" / "Check new clarifications"
resources.alerts.action.checkReadiness = "Ελεγξε ετοιμότητα φακέλου" / "Check dossier readiness"

resources.matrix.title = "Πιστοποιητικά × Φάκελοι" / "Certificates × Tenders"
resources.matrix.certificate = "Πιστοποιητικό" / "Certificate"
resources.matrix.expires = "Λήγει" / "Expires"
resources.matrix.status.ok = "OK"
resources.matrix.status.expiring = "ΛΗΓΕΙ" / "EXPIRING"
resources.matrix.status.marginal = "ΟΡΙΑΚΑ" / "MARGINAL"
resources.matrix.status.expired = "ΕΛΗΞΕ" / "EXPIRED"
resources.matrix.status.na = "N/A"

resources.guarantees.title = "Εγγυητική Έκθεση" / "Guarantee Exposure"
resources.guarantees.committed = "Δεσμευμένα" / "Committed"
resources.guarantees.creditLine = "Γραμμή" / "Credit Line"
resources.guarantees.available = "Διαθέσιμο" / "Available"
resources.guarantees.maxTenderValue = "χωράει νέος διαγωνισμός μέχρι" / "fits new tender up to"
resources.guarantees.add = "Προσθήκη Εγγυητικής" / "Add Guarantee"
resources.guarantees.noCreditLine = "Ορίσε πιστωτικό όριο εγγυητικών στο Εταιρικό Προφίλ" / "Set guarantee credit line in Company Profile"
resources.guarantees.empty = "Δεν υπάρχουν εγγυητικές" / "No guarantees"
resources.guarantees.status.requested = "Αιτήθηκε" / "Requested"
resources.guarantees.status.issued = "Εκδόθηκε" / "Issued"
resources.guarantees.status.active = "Ενεργή" / "Active"
resources.guarantees.status.released = "Αποδεσμεύτηκε" / "Released"
resources.guarantees.status.expired = "Έληξε" / "Expired"
resources.guarantees.type.participation = "Συμμετοχής" / "Participation"
resources.guarantees.type.performance = "Καλής Εκτέλεσης" / "Performance"
resources.guarantees.type.advancePayment = "Προκαταβολής" / "Advance Payment"
```

---

## Navigation Update

Add to TopNav `navItems` array:
```typescript
{ labelKey: 'nav.resources', href: '/resources', icon: Shield }
```

Position: After "Analytics", before the user dropdown items.

---

## Files to Create/Modify

### New Files
- `src/app/(dashboard)/resources/page.tsx` — Main page
- `src/components/resources/alerts-section.tsx` — Section A
- `src/components/resources/certificate-matrix.tsx` — Section B
- `src/components/resources/guarantee-section.tsx` — Section C
- `src/components/resources/guarantee-form-sheet.tsx` — Add/edit guarantee form
- `src/server/routers/resources.ts` — tRPC router
- `prisma/migrations/XXXX_add_guarantee_letter/migration.sql` — Auto-generated

### Modified Files
- `prisma/schema.prisma` — Add GuaranteeLetter model, GuaranteeType enum, GuaranteeStatus enum, guaranteeCreditLine on CompanyProfile, relation on Tender
- `src/server/routers/_app.ts` — Register resources router
- `src/components/layout/top-nav.tsx` — Add nav item
- `messages/el.json` — Greek translations
- `messages/en.json` — English translations

---

## Design Decisions

### Why no separate /resources route for team allocation?
Greek tender offices are small (3-5 people). Everyone knows who's doing what. A heatmap adds visual complexity without actionable value. If the office grows to 15+ people, this can be added later as a tab within /resources.

### Why no Kanban/pipeline view?
The `/tenders` page already shows status + deadline. A Kanban would be a visual reorganization of the same data. The resources page should show things you CAN'T see anywhere else — cross-tender certificate validity and guarantee exposure.

### Why alerts don't have manual dismiss?
Dismissed alerts give a false sense of security. A procurement officer who dismisses "Φορολογική λήγει" and then forgets to renew it = disqualification. Alerts clear automatically when the root cause is resolved (certificate renewed, guarantee issued, etc.).

### Why guarantee tracking lives here, not in each tender?
Guarantees are a cross-tender resource. The total exposure across ALL tenders determines whether you can enter a new tender. This is inherently a portfolio-level concern, not a per-tender concern.
