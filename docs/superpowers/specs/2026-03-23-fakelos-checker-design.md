# Fakelos Checker — AI Consultant for Tender Dossier Completeness

**Date:** 2026-03-23
**Status:** Approved
**Author:** Claude (with Christos Athanasopoulos)

---

## 1. Problem Statement

Greek companies preparing public tender dossiers currently pay €3.000-15.000 per tender to consulting firms. These consultants read the διακήρυξη, extract requirements, cross-check with company documents, and ensure completeness before submission. 30-40% of tender exclusions in Greece are due to missing or expired administrative documents — a problem that is entirely preventable.

**Goal:** Replace the external consultant with an AI-powered dossier completeness checker that reads the tender proclamation, extracts every requirement, cross-checks with the company vault, and provides actionable guidance in plain Greek — telling the non-expert user exactly what they need, why, and how to get it.

**Target User:** Business owners and employees who have NO tender expertise. They know their business but not procurement law. The tool must speak their language, not legal jargon.

---

## 2. Scope

### In Scope (Phase 1 — MVP)
- **Fakelos Tab** inside tender detail: AI-driven completeness checklist grouped by Φάκελος Α/Β/Γ
- **War Room Page** (`/fakeloi`): overview of all active tenders with readiness scores
- **Smart Guidance**: each gap explained in plain Greek with source reference (article + page), action steps, urgency level
- **Expiry Validation**: flag documents that expire before tender deadline
- **Auto Cross-Check**: match requirements against company vault (certificates, legal docs, projects, financials)
- **Readiness Score**: weighted completeness percentage with status (ΕΤΟΙΜΟΣ / ΚΙΝΔΥΝΟΣ / ΜΗ ΕΤΟΙΜΟΣ)

### In Scope (Phase 2 — Post-MVP)
- **Auto-Generate ΕΕΕΣ/ESPD** from company profile + tender data
- **Auto-Generate Υπεύθυνες Δηλώσεις** (sworn declarations) from templates
- **Εγγυητική Επιστολή template** pre-filled with correct amounts
- **Cross-tender intelligence**: "Your ISO 9001 expires in 2 months, affects 3 active tenders"

### Out of Scope
- Submission package ZIP generation (future phase)
- ΕΣΗΔΗΣ direct integration/upload
- Pricing strategy / bid amount recommendations (already exists in Financial tab)
- Technical proposal content generation (already exists in Technical tab)

---

## 3. Architecture

### 3.1 Data Flow

```
User uploads διακήρυξη PDF
  ↓
Existing: Document extraction (pdf-parse / Document AI / Gemini Vision)
  ↓
Existing: AI analysis (summarize + extract requirements + legal + financial)
  ↓
Existing: TenderRequirement table populated with categories/types
  ↓
NEW: Fakelos Checker Service
  ├─ 1. Parse requirements into Φάκελος Α/Β/Γ structure
  ├─ 2. Generate plain-Greek guidance for each requirement
  ├─ 3. Cross-check against company vault (certificates, legal docs, projects, financials)
  ├─ 4. Validate expiry dates vs tender deadline
  ├─ 5. Calculate weighted readiness score
  └─ 6. Return structured FakelosReport
  ↓
Frontend: Fakelos Tab renders checklist with guidance
Frontend: War Room page shows all tenders overview
```

### 3.2 Backend — FakelosCheckerService

**File:** `src/server/services/fakelos-checker.ts`

**Core method:** `runFakelosCheck(tenderId: string, tenantId: string): Promise<FakelosReport>`

**FakelosReport structure:**
```typescript
interface FakelosReport {
  readinessScore: number;         // 0-100 weighted
  status: 'READY' | 'AT_RISK' | 'NOT_READY';
  statusMessage: string;          // "Σας λείπουν 5 δικαιολογητικά..."
  lastCheckedAt: Date;
  deadline: Date | null;
  daysUntilDeadline: number | null;

  envelopes: FakelosEnvelope[];   // Α, Β, Γ
  criticalGaps: FakelosItem[];    // mandatory items with status GAP
  expiringItems: FakelosItem[];   // items expiring before deadline
}

interface FakelosEnvelope {
  id: 'A' | 'B' | 'C';
  title: string;                  // "Φάκελος Α — Δικαιολογητικά Συμμετοχής"
  totalItems: number;
  coveredItems: number;
  score: number;                  // 0-100
  items: FakelosItem[];
}

interface FakelosItem {
  requirementId: string;
  title: string;                  // Plain Greek short title
  description: string;            // Plain Greek full explanation
  articleReference: string;       // "Άρθρο 2.2.4.2, σελ. 23"
  status: 'COVERED' | 'GAP' | 'EXPIRING' | 'IN_PROGRESS' | 'MANUAL_OVERRIDE';
  urgency: 'CRITICAL' | 'WARNING' | 'OK';
  mandatory: boolean;

  // If COVERED
  matchedAsset?: {
    type: 'certificate' | 'legalDocument' | 'project' | 'contentLibrary' | 'generatedDocument';
    id: string;
    name: string;
    expiryDate?: Date;
  };

  // If GAP or EXPIRING
  guidance?: string;              // "Εκδίδεται από πιστοποιημένο φορέα (TÜV, Bureau Veritas)..."
  actionLabel?: string;           // "Ανέβασε Αρχείο" | "Ζήτησέ το από τον λογιστή"
  estimatedCost?: string;         // "~€2.000-5.000"
  estimatedTime?: string;         // "1-3 μήνες"

  // If EXPIRING
  expiryDate?: Date;
  daysUntilExpiry?: number;
}
```

**How it works:**

1. **Load existing data**: Fetch TenderRequirements (already extracted by AI), company vault (certificates, legal docs, projects, financials), tender metadata (deadline, budget)

2. **Classify into envelopes**: Map each requirement's `category` to envelope:
   - `PARTICIPATION_CRITERIA` + `EXCLUSION_CRITERIA` + `DOCUMENTATION_REQUIREMENTS` → Φάκελος Α
   - `TECHNICAL_REQUIREMENTS` → Φάκελος Β
   - `FINANCIAL_REQUIREMENTS` → Φάκελος Γ
   - `CONTRACT_TERMS` → Φάκελος Α (usually part of admin docs)

3. **Generate guidance via AI**: For items with status GAP, call Gemini to generate plain-Greek guidance. Prompt includes:
   - The requirement text
   - The article reference
   - Whether it's mandatory
   - Instruction: "Εξήγησε σε απλά ελληνικά τι χρειάζεται, πώς το αποκτά, πόσο κοστίζει, πόσο χρόνο παίρνει. Μίλα σαν σύμβουλος σε πελάτη που δεν ξέρει από δημόσιους διαγωνισμούς."

4. **Cross-check vault**: Use existing ComplianceEngine + RequirementMappings for matching. Add expiry date validation against tender deadline.

5. **Calculate readiness score**:
   - Mandatory items weight: 3x
   - Optional items weight: 1x
   - Score = (covered_weighted / total_weighted) * 100
   - Status thresholds: ≥95% READY, ≥80% AT_RISK, <80% NOT_READY

6. **Cache results**: Store FakelosReport as JSON in tender metadata. Re-run on demand or when documents change.

### 3.3 API Router

**File:** `src/server/routers/fakelos.ts`

```typescript
// Procedures:
fakelos.runCheck        // POST - runs full check, returns FakelosReport
fakelos.getReport       // GET - returns cached report (or null)
fakelos.markItemStatus  // POST - user marks item as IN_PROGRESS or MANUAL_OVERRIDE
fakelos.getWarRoom      // GET - returns summary for all active tenders
```

### 3.4 Frontend — Fakelos Tab

**File:** `src/components/tender/fakelos-tab.tsx`

**Structure:**
- Top: Readiness score (circular progress, animated) + status badge + status message + deadline countdown
- Action buttons: "Τρέξε Έλεγχο" (ShimmerButton) + "Δημιουργία Πακέτου" (when ≥95%)
- Three collapsible sections for Φάκελος Α/Β/Γ, each with:
  - Header: envelope letter icon + title + coverage count + section score
  - Items list sorted by urgency (CRITICAL first, then WARNING, then OK)

**Item rendering by status:**
- `CRITICAL` (mandatory + GAP): Red border, red icon ✕, full guidance expanded, action buttons
- `WARNING` (expiring or optional GAP): Amber border, amber icon !, guidance visible
- `OK` (covered): Subtle border, green checkmark ✓, compact single line, expiry date shown
- `IN_PROGRESS` (user-marked): Blue border, spinner icon, "Σε εξέλιξη" label

**Premium styling (matching existing Superhuman design):**
- GlassCard wrapper for each envelope section
- BlurFade stagger entrance (delay per item)
- Motion spring animation for collapsible sections
- Circular score: animated SVG draw on mount
- Gradient accent on envelope letter icons (Α=purple, Β=blue, Γ=green)
- Hover: scale(1.005) + border glow
- All items: cursor-pointer, expandable on click for full guidance
- ShimmerButton for primary CTA
- `prefers-reduced-motion` respected

### 3.5 Frontend — War Room Page

**File:** `src/app/(dashboard)/fakeloi/page.tsx`

**Replaces:** Discovery placeholder page (`/discovery` — currently shows "Σύντομα διαθέσιμο" empty state, no real functionality to preserve) → rename nav link to "Φάκελοι"

**Structure:**
- Header: "Οι Φάκελοί Μου" + total stats (X active, Y ready, Z critical)
- Grid of tender cards, each showing:
  - Tender title + reference number
  - Circular readiness score (large, color-coded)
  - Deadline countdown (days left, urgent = red)
  - Critical gaps count
  - Status badge (ΕΤΟΙΜΟΣ / ΣΕ ΕΞΕΛΙΞΗ / ΚΙΝΔΥΝΟΣ / ΜΗ ΕΤΟΙΜΟΣ)
  - Click → navigate to tender detail, auto-open Φάκελος tab
- Sort by: urgency (deadline × inverse readiness) by default
- Empty state: Nano Banana illustration + "Δημιουργήστε τον πρώτο διαγωνισμό"

**Premium styling:**
- MagicCard per tender card
- BlurFade stagger entrance
- NumberTicker for readiness scores
- Stagger container/item variants (matching dashboard pattern)

### 3.6 Navigation Update

**File:** `src/components/layout/top-nav.tsx`

Change Discovery nav item:
```tsx
// Before:
{ label: 'Discovery', href: '/discovery', icon: Compass },
// After:
{ label: 'Φάκελοι', href: '/fakeloi', icon: FolderCheck },
```

### 3.7 Tender Detail Integration

**File:** `src/app/(dashboard)/tenders/[id]/page.tsx`

Add new tab between "Εγγραφα" and "Εργασιες":
```tsx
<AnimatedTabsTrigger value="fakelos" activeValue={activeTab}>
  <FolderCheck className="h-3.5 w-3.5" />Φάκελος
</AnimatedTabsTrigger>
```

Tab content:
```tsx
<TabsContent value="fakelos" forceMount={activeTab === 'fakelos' ? true : undefined}>
  <FakelosTab tenderId={tenderId} />
</TabsContent>
```

---

## 4. AI Guidance Generation

### 4.1 Prompt Design

For each GAP item, the AI generates guidance using this prompt pattern:

```
Είσαι σύμβουλος δημοσίων συμβάσεων με 20 χρόνια εμπειρία στην Ελλάδα.
Ένας πελάτης σου (που ΔΕΝ ξέρει από διαγωνισμούς) ετοιμάζει φάκελο και του λείπει:

Απαίτηση: {requirement.text}
Άρθρο: {requirement.articleReference}
Κατηγορία: {requirement.category}
Υποχρεωτικό: {requirement.mandatory ? 'ΝΑΙ — χωρίς αυτό αποκλείεται' : 'ΟΧΙ — αλλά βαθμολογείται'}

Εξήγησέ του σε 2-3 προτάσεις:
1. Τι ακριβώς είναι αυτό (σε γλώσσα που καταλαβαίνει μη-ειδικός)
2. Πώς το αποκτά (πού απευθύνεται, online ή αυτοπροσώπως)
3. Εκτιμώμενο κόστος και χρόνος
4. Αν είναι υποχρεωτικό, τόνισε ότι χωρίς αυτό ΑΠΟΚΛΕΙΕΤΑΙ

Απάντησε ΜΟΝΟ σε απλά ελληνικά. Χωρίς νομική ορολογία.
```

### 4.2 Source References — Critical for Trust

Every finding MUST include:
- **Article reference**: e.g., "Άρθρο 2.2.4.2"
- **Page number**: from the original PDF extraction
- **Original text snippet**: the actual text from the διακήρυξη (truncated to ~100 chars)

This allows the user to VERIFY. The AI is a helper, not the authority. The user (or their lawyer) can always go check the source.

### 4.3 Confidence Handling

- If AI confidence < 0.7 on a requirement extraction: mark with "⚠ Χαμηλή βεβαιότητα — ελέγξτε χειροκίνητα"
- If requirement text is ambiguous: show both the AI interpretation AND the original text
- Never hide uncertainty — the user must know when to double-check

---

## 5. Database Changes

### Minimal — leverage existing models

No new Prisma models needed. Add two fields to the existing Tender model:

```prisma
model Tender {
  // ... existing fields
  fakelosReport     Json?      // Cached FakelosReport JSON
  fakelosCheckedAt  DateTime?  // Last check timestamp
}
```

**Empty vault handling:** If the company vault is empty (new user, no documents uploaded), ALL items show as GAP with a prominent banner: "Δεν έχετε ανεβάσει έγγραφα εταιρείας. Πηγαίνετε στο Εταιρεία → Πιστοποιητικά για να ξεκινήσετε." with a CTA button to `/company`.

User-marked statuses (IN_PROGRESS, MANUAL_OVERRIDE) already exist in the `coverageStatus` field of `TenderRequirement`.

---

## 6. Implementation Order

```
Step 1: Backend — FakelosCheckerService (core logic + AI guidance generation)
Step 2: Backend — Fakelos router (API endpoints)
Step 3: Database — Add fakelosReport/fakelosCheckedAt to Tender model (if needed)
Step 4: Frontend — FakelosTab component (premium styled)
Step 5: Frontend — War Room page (/fakeloi)
Step 6: Navigation — Update top-nav Discovery→Φάκελοι
Step 7: Integration — Add Φάκελος tab to tender detail page
Step 8: Testing — Visual QA + build verification
```

---

## 7. Success Criteria

1. User uploads tender PDF → within 60 seconds sees complete Φάκελος Α/Β/Γ checklist
2. Every GAP item has: plain Greek explanation + source reference + action steps
3. Expiring documents flagged with days-until-expiry vs days-until-deadline
4. Readiness score accurately reflects mandatory coverage
5. War Room shows all tenders sorted by urgency
6. Non-expert user can understand every item without external help
7. AI confidence < 0.7 items are clearly marked for manual review
8. Build passes, dark mode works, animations respect prefers-reduced-motion

---

## 8. Files Modified/Created

| File | Action |
|------|--------|
| `src/server/services/fakelos-checker.ts` | **New** — Core service |
| `src/server/routers/fakelos.ts` | **New** — API router |
| `src/server/routers/_app.ts` | Modify — Register fakelos router |
| `prisma/schema.prisma` | Modify — Add fakelosReport fields (if needed) |
| `src/components/tender/fakelos-tab.tsx` | **New** — Tender detail tab |
| `src/app/(dashboard)/fakeloi/page.tsx` | **New** — War Room page (replaces discovery) |
| `src/app/(dashboard)/tenders/[id]/page.tsx` | Modify — Add Φάκελος tab |
| `src/components/layout/top-nav.tsx` | Modify — Discovery → Φάκελοι |
| `src/app/(dashboard)/discovery/page.tsx` | Delete — Replaced by /fakeloi |
