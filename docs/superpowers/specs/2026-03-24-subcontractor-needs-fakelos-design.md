# Subcontractor & Supplier Needs — Fakelos Integration

**Date:** 2026-03-24
**Status:** Approved
**Author:** Claude + Christos

## Summary

Extend the Fakelos (dossier completeness checker) to include AI-extracted subcontractor and supplier needs alongside document requirements. When the AI reads tender specifications, it identifies external resources needed (hydraulic contractor, electrician, fire equipment supplier, etc.) and adds them to the dossier checklist. Items auto-tick when the user marks them as covered; the readiness score reflects the full picture.

## Problem

Today the Fakelos tab checks only documents, certificates, and legal requirements. But winning a tender also requires securing external subcontractors and suppliers. Users must mentally track these separately, leading to:

- Forgotten subcontractor needs discovered too late
- No single view of "what's still missing" for the full bid
- The AI assistant can't answer "τι μένει;" completely

## Design

### 1. New Database Model — `SubcontractorNeed`

```prisma
model SubcontractorNeed {
  id             String   @id @default(cuid())
  tenderId       String
  tender         Tender   @relation(fields: [tenderId], references: [id], onDelete: Cascade)

  specialty      String                    // "Υδραυλικός", "Ηλεκτρολόγος"
  kind           SubcontractorKind         // SUBCONTRACTOR | SUPPLIER
  reason         String                    // "Απαιτείται από Άρθρο 3.2 — εγκατάσταση υδραυλικών"
  isMandatory    Boolean  @default(false)  // explicitly required by tender
  requiredCerts  Json     @default("[]")   // ["Άδεια ΥΔΕ", "ISO 14001"]
  guidance       String?                   // AI-generated advice in plain Greek
  status         SubcontractorStatus @default(PENDING) // PENDING | IN_PROGRESS | COVERED
  assignedName   String?                   // "Παπαδόπουλος Ηλεκτρικά"
  notes          String?                   // free-text notes
  isAiGenerated  Boolean  @default(true)   // true=AI extracted, false=manually added

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([tenderId])
}

enum SubcontractorKind {
  SUBCONTRACTOR
  SUPPLIER
}

enum SubcontractorStatus {
  PENDING
  IN_PROGRESS
  COVERED
}
```

Add to Tender model:
```prisma
model Tender {
  // ... existing fields
  subcontractorNeeds SubcontractorNeed[]
}
```

### 2. AI Extraction — `analyzeSubcontractorNeeds()`

New method in `ai-bid-orchestrator.ts`:

**Input:** Tender title, brief summary, extracted requirements, attached document text.

**System Prompt (Greek):**
```
Είσαι ειδικός σύμβουλος δημοσίων συμβάσεων στην Ελλάδα.
Αναλύεις τεύχη διαγωνισμών και εντοπίζεις ΕΞΩΤΕΡΙΚΟΥΣ ΠΟΡΟΥΣ που θα χρειαστεί ο ανάδοχος:

1. ΥΠΕΡΓΟΛΑΒΟΙ (SUBCONTRACTOR): Εξωτερικά συνεργεία/τεχνίτες για εκτέλεση εργασιών
   - Υδραυλικοί, ηλεκτρολόγοι, ψυκτικοί, ελαιοχρωματιστές, κλπ.
   - Εξειδικευμένοι τεχνικοί (πυροσβεστικά, ανελκυστήρες, κλπ.)

2. ΠΡΟΜΗΘΕΥΤΕΣ (SUPPLIER): Προμηθευτές υλικών/εξοπλισμού
   - Υλικά κατασκευής, ανταλλακτικά, εξοπλισμός
   - Ειδικά υλικά που απαιτεί η σύμβαση

ΔΕΝ περιλαμβάνεις:
- Εσωτερικό προσωπικό/στελέχη (αυτά καλύπτονται αλλού)
- Πιστοποιητικά/έγγραφα (αυτά καλύπτονται αλλού)
- Εγγυητικές επιστολές

Απάντησε σε JSON:
{
  "needs": [
    {
      "specialty": "Αδειούχος ηλεκτρολόγος εγκαταστάτης",
      "kind": "SUBCONTRACTOR",
      "reason": "Άρθρο 4.3 — Ηλεκτρολογικές εγκαταστάσεις νέου πίνακα",
      "isMandatory": true,
      "requiredCerts": ["Άδεια ηλεκτρολόγου Γ' ειδικότητας"]
    }
  ]
}

Αν δεν υπάρχουν εξωτερικοί πόροι, επέστρεψε {"needs": []}.
```

**Behavior:**
- Called as part of "Full Analysis" pipeline. The actual current pipeline in `page.tsx` is: summarize → extractLegalClauses → assessLegalRisks → extractFinancials → goNoGo. Insert `analyzeSubcontractorNeeds()` after extractFinancials, before goNoGo.
- Deletes existing AI-generated SubcontractorNeeds before re-analysis (preserves manually added via `isAiGenerated: false`). This deliberately diverges from `TeamRequirement` (which uses `mappedStaffName: null` heuristic) — the `isAiGenerated` flag is cleaner.
- Generates guidance for each need (same pattern as fakelos guidance)
- **Error handling:** Graceful failure — log error and return empty array. Do not block the rest of the analysis pipeline.
- **Activity logging:** Create an Activity record like `analyzeTeamRequirements()` does.
- **Token budget:** Follow existing `checkTokenBudget`/`logTokenUsage` pattern. Use requirements + brief as input (not full document text) to keep token usage low.
- **Delete protection:** Router should check `tender.analysisInProgress` before allowing deletes of AI-generated items.

### 3. Fakelos Checker Integration

In `fakelos-checker.ts`, the `runCheck()` method:

1. **Loads SubcontractorNeeds** alongside TenderRequirements
2. **Creates Envelope Δ** — "Φάκελος Δ — Υπεργολάβοι & Προμηθευτές"
3. **Maps statuses:**
   - PENDING → GAP (red, urgency CRITICAL if mandatory, WARNING if optional)
   - IN_PROGRESS → IN_PROGRESS (blue/yellow)
   - COVERED → COVERED (green)
4. **Includes in readiness score** with same weighting (mandatory=3x, optional=1x)
5. **Generates AI guidance** for PENDING items (same flow as document gaps)

Update `classifyEnvelope()` — no change needed since SubcontractorNeeds are handled separately.

**Type widening required:**
- `FakelosEnvelope.id` union: `'A' | 'B' | 'C'` → `'A' | 'B' | 'C' | 'D'`
- `envelopeMap` initialization: add `D: []`
- **Critical — `FakelosItem` discriminator:** Add `itemType: 'requirement' | 'subcontractor'` field to `FakelosItem`. The `requirementId` field becomes `itemId` (or keep `requirementId` and add `itemType`). The `markStatus` mutation in the UI must route to the correct table based on `itemType`. For subcontractor items, `requirementId` holds the `SubcontractorNeed.id`.

Update `ENVELOPE_TITLES`:
```typescript
const ENVELOPE_TITLES: Record<'A' | 'B' | 'C' | 'D', string> = {
  A: 'Φάκελος Α — Δικαιολογητικά Συμμετοχής',
  B: 'Φάκελος Β — Τεχνική Προσφορά',
  C: 'Φάκελος Γ — Οικονομική Προσφορά',
  D: 'Φάκελος Δ — Υπεργολάβοι & Προμηθευτές',
};
```

### 4. UI — Fakelos Tab Updates

#### Config updates
- `envelopeConfig`: Add `D: { letter: 'Δ', gradient: 'from-orange-600 to-amber-500', ring: 'ring-orange-500/30' }`
- `openEnvelopes` default: `new Set(['A', 'B', 'C', 'D'])`

#### Envelope Δ appearance
Same card style as A/B/C envelopes but with distinct icon/color:
- Letter badge: **Δ** with orange/amber gradient
- Same expand/collapse behavior

#### SubcontractorNeed item rendering

Each item shows:
- **Specialty** as title (e.g. "Αδειούχος υδραυλικός")
- **Badge:** `ΥΠΕΡΓΟΛΑΒΟΣ` or `ΠΡΟΜΗΘΕΥΤΗΣ` (small, colored)
- **Reason:** why it's needed + article reference
- **Required certs:** listed as small badges if present
- **Guidance:** AI-generated advice (same style as document guidance)
- **Assigned name** (if COVERED): shown as green text

#### Actions per item:
- **GAP (PENDING):**
  - "Βρέθηκε" button → opens inline form: name + notes → sets COVERED
  - "Σε Αναζήτηση" button → sets IN_PROGRESS
- **IN_PROGRESS:**
  - Shows blue spinner
  - "Βρέθηκε" button still available
- **COVERED:**
  - Green checkmark + assigned name
  - Edit button to change name/notes

#### Manual add button:
- "**+ Προσθήκη Υπεργολάβου/Προμηθευτή**" button at bottom of Envelope Δ
- Opens small form: specialty, kind (dropdown), reason (optional), mandatory (checkbox)
- Creates with `isAiGenerated: false`

### 5. API Router — `subcontractorNeed` router

New tRPC router with:
- `list` — get all SubcontractorNeeds for a tender
- `markStatus` — update status to IN_PROGRESS or COVERED (with optional assignedName, notes)
- `create` — manually add a need
- `delete` — remove a manually-added need (prevent deleting AI-generated during active analysis)
- `update` — edit assignedName, notes, status

### 6. Chat/Assistant Integration

The context builder (`context-builder.ts`) already builds context for the AI assistant. Add SubcontractorNeeds to the tender context so the assistant can:
- See which subcontractors/suppliers are still missing
- Answer "τι μένει;" with a complete picture
- Reference specific needs by name

No changes to the assistant's system prompt needed — it already responds to context.

### 7. Analysis Pipeline Integration

In the "Full Analysis" button flow (tender detail page `runFullAnalysis()`), add `analyzeSubcontractorNeeds()` as a step. The actual current pipeline is:

```
1. summarizeTender()             ← existing
2. extractLegalClauses()         ← existing
3. assessLegalRisks()            ← existing
4. extractFinancials()           ← existing
5. analyzeSubcontractorNeeds()   ← NEW (insert here)
6. goNoGoAnalysis()              ← existing
```

### 8. i18n

Add Greek translations for:
- Envelope Δ title
- Status labels (Εκκρεμεί, Σε Αναζήτηση, Βρέθηκε)
- Kind labels (Υπεργολάβος, Προμηθευτής)
- Action buttons
- Guidance placeholders

## Out of Scope (Future Levels)

- **Level 2:** Supplier address book / directory (save suppliers across tenders)
- **Level 3:** Marketplace, price comparison, auto-RFQ
- **Level 3:** Real-time market pricing / scraping

## Files Affected

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add SubcontractorNeed model, enums, relation |
| `src/server/services/ai-bid-orchestrator.ts` | Add `analyzeSubcontractorNeeds()` method |
| `src/server/services/fakelos-checker.ts` | Load SubcontractorNeeds, create Envelope Δ, include in score |
| `src/server/routers/subcontractor-need.ts` | New router: CRUD + status updates |
| `src/server/routers/_app.ts` | Register new router |
| `src/components/tender/fakelos-tab.tsx` | Render Envelope Δ, SubcontractorNeed items, manual add form |
| `src/app/(dashboard)/tenders/[id]/page.tsx` | Add analyzeSubcontractorNeeds to Full Analysis flow |
| `src/server/services/context-builder.ts` | Include SubcontractorNeeds in assistant context |
| `messages/el.json` | Greek translations |
| `messages/en.json` | English translations |
