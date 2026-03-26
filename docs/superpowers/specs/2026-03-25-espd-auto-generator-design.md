# Feature 4: ESPD Auto-Generator — Design Spec

**Date:** 2026-03-25
**Status:** Approved
**Feature:** Full EU-compliant ESPD (ΕΕΕΣ) XML generation via step-by-step wizard with pre-fill from company data and tender requirements.

---

## Problem

Every Greek/EU public procurement bid requires an ESPD (European Single Procurement Document) — a self-declaration XML form. Currently:

1. Users must manually fill the ESPD via the EU ESPD service or ΕΣΗΔΗΣ, re-entering data they already have in TenderCopilot
2. No pre-fill from existing company profile, certificates, or legal documents
3. No connection between tender requirements and ESPD selection criteria
4. No persistence of ESPD data — if you need to regenerate, start from scratch
5. Fakelos checker shows ESPD as a gap but cannot help create it

## Solution

6-step wizard in the Documents tab that pre-fills all ESPD parts from existing data, lets the user review/edit, and exports EU-compliant XML. Full Parts I-VI coverage. Digital signing is out of scope (user signs externally).

---

## Architecture

### Data Model Changes

**Add to `GeneratedDocType` enum:**

```prisma
enum GeneratedDocType {
  // ... existing values ...
  ESPD
}
```

**Add to `Tender` model:**

```prisma
model Tender {
  // ... existing fields ...
  espdData Json?  // Wizard state: structured ESPD responses, auto-saved per step
}
```

No new models — reuses existing `GeneratedDocument` for the final XML artifact.

**Also update:** The Zod enum `generatedDocTypeEnum` in `src/server/routers/document.ts` must include `'ESPD'` — it is hardcoded and does NOT auto-derive from Prisma.

### Prerequisites

```bash
npm install xmlbuilder2
```

Note: `xmlbuilder2` ships its own TypeScript types — no `@types/` package needed.

### EspdData TypeScript Interface

The `espdData` JSON field follows this structure:

```typescript
interface EspdData {
  currentStep: number;
  partI: {
    contractingAuthority: string;
    tenderTitle: string;
    referenceNumber: string;
    platform: string;
    cpvCodes: string[];
    submissionDeadline: string;
  };
  partII: {
    legalName: string;
    tradeName: string;
    taxId: string;
    taxOffice: string;
    registrationNumber: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    phone: string;
    email: string;
    website: string;
    legalRepName: string;
    legalRepTitle: string;
    legalRepIdNumber: string;
    companySize: 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE';
    kadCodes: string[];
  };
  partIII: {
    exclusionGrounds: Array<{
      category: string;       // 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'
      answer: boolean;        // false = NO (default), true = YES
      explanation?: string;
      selfCleaning?: string;
      linkedDocumentId?: string;
    }>;
  };
  partIV: {
    financial: Array<{ description: string; value: string; requirementId?: string }>;
    technical: Array<{ description: string; value: string; requirementId?: string }>;
    quality: Array<{ certificateType: string; certificateId?: string; description: string }>;
  };
  partV: {
    enabled: boolean;
    criteria?: string;
  };
  partVI: {
    declarationAccuracy: boolean;
    declarationEvidence: boolean;
    declarationConsent: boolean;
  };
}
```

### Data Flow

```
CompanyProfile + Tender + TenderRequirements + Certificates + LegalDocuments
  ↓ (pre-fill)
ESPD Wizard (6 steps, auto-save to Tender.espdData)
  ↓ (export)
XML Generator → GeneratedDocument (type=ESPD, content=JSON, fileKey=S3 XML)
  ↓ (integration)
FakelosChecker auto-marks EXCLUSION_CRITERIA as COVERED
```

### New Dependency

Add `xmlbuilder2` package for EU-compliant ESPD XML generation (UBL 2.1 based).

---

## ESPD Wizard — Import + 6 Steps

### Step 0: Import ESPD Request (Entry Point)

**The killer feature.** Contracting authorities publish an ESPD Request XML alongside the tender documents. This step parses it and pre-populates the entire wizard.

**UI:**
- Two options on wizard entry:
  - **"Εισαγωγή ESPD Request"** — Upload/drag-drop the authority's XML file. Parser extracts: contracting authority info (→ Part I), required criteria (→ Parts III-V), and any pre-set values.
  - **"Δημιουργία από την αρχή"** — Skip import, manual wizard (existing flow).

**Import logic:**
1. Parse XML using `xmlbuilder2` (same library used for export)
2. Extract `cac:ContractingParty` → pre-fill Part I
3. Extract `cac:TenderingCriterion` elements → map to Parts III-IV criteria (which exclusion grounds apply, which selection criteria the authority requires)
4. Merge with CompanyProfile data → auto-fill Part II + auto-answer criteria from linked documents
5. Save parsed + merged data to `tender.espdData`
6. Advance to Step 1 with everything pre-filled

**Result:** Ο χρήστης κατεβάζει το ESPD Request, το ανεβάζει, και βλέπει τα πάντα γεμισμένα. Μόνο review + export.

**Backend:** New procedure `importEspdRequest` — takes XML string, parses, merges with company data, returns pre-filled `EspdData`.

---

### Step 1: Part I — Πληροφορίες Διαδικασίας

**Pre-fill from:** Tender data

| Field | Source | Editable |
|-------|--------|----------|
| Αναθέτουσα Αρχή | `tender.contractingAuthority` | Yes |
| Τίτλος Διαγωνισμού | `tender.title` | Yes |
| Αριθμός Αναφοράς | `tender.referenceNumber` | Yes |
| Πλατφόρμα | `tender.platform` | Yes |
| CPV Κωδικοί | `tender.cpvCodes[]` | Yes |
| Προθεσμία Υποβολής | `tender.submissionDeadline` | Yes |

### Step 2: Part II — Πληροφορίες Οικονομικού Φορέα

**Pre-fill from:** CompanyProfile

| Field | Source | Editable |
|-------|--------|----------|
| Επωνυμία | `companyProfile.legalName` | Yes |
| Διακριτικός Τίτλος | `companyProfile.tradeName` | Yes |
| ΑΦΜ | `companyProfile.taxId` | Yes |
| ΔΟΥ | `companyProfile.taxOffice` | Yes |
| Αρ. ΓΕΜΗ | `companyProfile.registrationNumber` | Yes |
| Διεύθυνση | `companyProfile.address, city, postalCode, country` | Yes |
| Τηλέφωνο | `companyProfile.phone` | Yes |
| Email | `companyProfile.email` | Yes |
| Website | `companyProfile.website` | Yes |
| Νόμιμος Εκπρόσωπος | `companyProfile.legalRepName` | Yes |
| Ιδιότητα Εκπροσώπου | `companyProfile.legalRepTitle` | Yes |
| ΑΔΤ Εκπροσώπου | `companyProfile.legalRepIdNumber` | Yes |
| Μέγεθος Επιχείρησης | Manual (ΜΜΕ/Μεγάλη) | Yes |
| Κωδικοί ΚΑΔ | `companyProfile.kadCodes[]` | Yes |

**"Ανανέωση από Προφίλ" button** — re-fetches latest CompanyProfile data.

### Step 3: Part III — Λόγοι Αποκλεισμού (Ν.4412/2016, Άρθρα 73-74)

8 κατηγορίες, κάθε μία ΝΑΙ/ΟΧΙ + explanation field:

| # | Κατηγορία | Default | Linked Document |
|---|-----------|---------|-----------------|
| A | Ποινικά αδικήματα (συμμετοχή σε εγκληματική οργάνωση, διαφθορά, απάτη, τρομοκρατία, νομιμοποίηση εσόδων, παιδική εργασία) | ΟΧΙ | `CRIMINAL_RECORD` |
| B | Καταβολή φόρων | ΟΧΙ | `TAX_CLEARANCE` |
| C | Καταβολή ασφαλιστικών εισφορών | ΟΧΙ | `SOCIAL_SECURITY_CLEARANCE` |
| D | Περιβαλλοντικές, κοινωνικές, εργατικές υποχρεώσεις | ΟΧΙ | — |
| E | Πτώχευση / Αφερεγγυότητα / Εκκαθάριση | ΟΧΙ | `GEMI_CERTIFICATE` |
| F | Σοβαρό επαγγελματικό παράπτωμα | ΟΧΙ | — |
| G | Σύγκρουση συμφερόντων | ΟΧΙ | — |
| H | Προηγούμενη εμπλοκή στην προετοιμασία διαδικασίας | ΟΧΙ | — |

**Auto-link logic:** Αν υπάρχει valid (μη-expired) LegalDocument του αντίστοιχου τύπου, δείχνει green badge "Υπάρχει δικαιολογητικό" δίπλα στη δήλωση.

**Αν ο χρήστης επιλέξει "ΝΑΙ":** Εμφανίζεται textarea "Εξήγηση" + τα πεδία "Self-cleaning measures" (μέτρα αποκατάστασης).

### Step 4: Part IV — Κριτήρια Επιλογής

3 sections, pre-filled from TenderRequirements + Certificates:

**A. Οικονομική & Χρηματοοικονομική Επάρκεια**
- Pre-fill from: `TenderRequirement` where `category = 'FINANCIAL_REQUIREMENTS'`
- Fields: Ετήσιος κύκλος εργασιών, χρηματοοικονομικοί δείκτες, ασφάλιση
- Κουμπί "Προσθήκη κριτηρίου" για custom entries

**B. Τεχνική & Επαγγελματική Ικανότητα**
- Pre-fill from: `TenderRequirement` where `category = 'TECHNICAL_REQUIREMENTS'`
- Fields: Παρόμοια έργα, τεχνικό προσωπικό, εξοπλισμός, μέτρα ποιότητας
- Auto-link ISO/certifications from `Certificate` model
- Κουμπί "Προσθήκη κριτηρίου" για custom entries

**C. Συστήματα Διασφάλισης Ποιότητας**
- Pre-fill from: Certificates (ISO 9001, ISO 14001, ISO 45001, EMAS)
- Δείχνει linked certificates με expiry dates

### Step 5: Part V — Μείωση Αριθμού Υποψηφίων

**Optional step** — ενεργοποιείται μόνο αν ο χρήστης το χρειάζεται.

- Toggle: "Ο διαγωνισμός προβλέπει μείωση υποψηφίων;"
- Αν ΝΑΙ: Textarea "Κριτήρια μείωσης" pre-filled from tender requirements αν υπάρχουν
- Αν ΟΧΙ: Skip, πάει Step 6

### Step 6: Part VI — Τελικές Δηλώσεις

Boilerplate declarations — ο χρήστης confirm-άρει:

- "Οι πληροφορίες που παρέχονται είναι ακριβείς και αληθείς"
- "Μπορώ να προσκομίσω τα σχετικά δικαιολογητικά χωρίς καθυστέρηση"
- "Συναινώ στην πρόσβαση σε ηλεκτρονικές βάσεις δεδομένων"

Checkbox per declaration (all required before export).

### After Step 6: Preview & Export

**Preview screen:**
- Πλήρης επισκόπηση όλων των Parts σε read-only cards
- Clickable sections → jump back to edit
- Validation summary: errors (κόκκινο), warnings (κίτρινο), complete (πράσινο)

**Actions:**
- "Αποθήκευση" → saves `espdData` to Tender
- "Εξαγωγή XML" → generates EU-compliant XML → upload to S3 → creates GeneratedDocument → triggers download
- "Εξαγωγή PDF" → deferred (out of scope, "Coming soon")

---

## Backend — Procedures

New `espd.ts` router (registered in app router). Separate from `document.ts` because ESPD procedures operate on `Tender.espdData`, not on `GeneratedDocument` directly. Only `generateEspdXml` creates a `GeneratedDocument` at the end.

| Procedure | Type | Description |
|-----------|------|-------------|
| `importEspdRequest` | mutation | Parse authority's ESPD Request XML, merge with CompanyProfile data, return pre-filled EspdData |
| `saveEspdData` | mutation | Save wizard state to `tender.espdData` (auto-save per step) |
| `getEspdData` | query | Load wizard state from `tender.espdData` + pre-fill from CompanyProfile/Certificates/LegalDocs/Requirements |
| `generateEspdXml` | mutation | Generate EU-compliant XML from espdData, upload to S3, create GeneratedDocument |
| `getEspdPrefill` | query | Return fresh pre-fill data from CompanyProfile + linked documents (for "Ανανέωση" button) |

### getEspdData Logic

```
1. If tender.espdData exists → return it (persisted wizard state)
2. If not → build default from:
   - Part I: tender fields (title, ref, authority, cpv, deadline)
   - Part II: CompanyProfile fields
   - Part III: 8 exclusion categories, all default "NO", linked LegalDocuments
   - Part IV: map TenderRequirements + Certificates
   - Part V: empty (optional)
   - Part VI: boilerplate declarations (unchecked)
```

### generateEspdXml Logic

```
1. Validate espdData (all required fields present)
2. Build XML using xmlbuilder2 following EU ESPD Exchange Data Model
3. Upload XML to S3 (key: espd/{tenderId}/{timestamp}.xml)
4. Create GeneratedDocument (type=ESPD, status=FINAL)
5. Auto-mark EXCLUSION_CRITERIA TenderRequirements as COVERED in fakelos
6. Return download URL
```

---

## Frontend — Components

### 1. ESPD Wizard Component

New file: `src/components/tender/espd-wizard.tsx`

**Structure:**
- Stepper bar at top (6 steps with labels)
- Step content area (renders current step form)
- Navigation: Back / Next / Save buttons
- Auto-save on step change
- Progress persistence via `espdData`

### 2. Step Components

One component per step:
- `espd-step-procedure.tsx` — Part I form
- `espd-step-operator.tsx` — Part II form
- `espd-step-exclusion.tsx` — Part III form (8 categories with Yes/No toggles)
- `espd-step-selection.tsx` — Part IV form (3 sections with dynamic entries)
- `espd-step-reduction.tsx` — Part V form (optional toggle)
- `espd-step-declarations.tsx` — Part VI form (checkboxes)

### 3. ESPD Preview Component

New file: `src/components/tender/espd-preview.tsx`

Read-only summary of all parts, validation indicators, export buttons.

### 4. Documents Tab Integration

In existing `documents-tab.tsx`:
- Add "Δημιουργία ΕΕΕΣ/ESPD" button in the "Generated" sub-tab, alongside existing document generation dropdown
- Opens ESPD wizard in a **full-screen Sheet** (not Dialog — too cramped for 6-step wizard), using existing `Sheet` component
- Shows existing ESPD in generated documents list with "Επεξεργασία" and "Λήψη XML" actions

**Array field UI:** CPV codes (`cpvCodes`) and KAD codes (`kadCodes`) use tag input pattern — one code per tag, with add/remove buttons.

---

## XML Generation

Using `xmlbuilder2` library to generate UBL 2.1 compliant ESPD XML.

**Key XML structure:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<espd:ESPDResponse xmlns:espd="..." xmlns:cac="..." xmlns:cbc="...">
  <!-- Part I: Procedure Information -->
  <cac:ContractingParty>...</cac:ContractingParty>
  <cac:ProcurementProject>...</cac:ProcurementProject>

  <!-- Part II: Economic Operator -->
  <cac:EconomicOperatorParty>...</cac:EconomicOperatorParty>

  <!-- Parts III-VI: Criteria Responses -->
  <cac:TenderingCriterionResponse>
    <cbc:ID>...</cbc:ID>
    <cbc:ValidatedCriterionPropertyID>...</cbc:ValidatedCriterionPropertyID>
    <cac:ResponseValue>
      <cbc:ResponseIndicator>false</cbc:ResponseIndicator>
    </cac:ResponseValue>
  </cac:TenderingCriterionResponse>
  <!-- ... more criteria ... -->
</espd:ESPDResponse>
```

**Criterion IDs:** Use official EU ESPD criterion taxonomy IDs for each exclusion/selection criterion to ensure compatibility with ΕΣΗΔΗΣ.

---

## i18n Keys

New keys under `espd.*`:

| Key | EL | EN |
|-----|----|----|
| `espd.title` | Δημιουργία ΕΕΕΣ/ESPD | Create ESPD |
| `espd.step1` | Πληροφορίες Διαδικασίας | Procedure Information |
| `espd.step2` | Στοιχεία Οικ. Φορέα | Operator Information |
| `espd.step3` | Λόγοι Αποκλεισμού | Exclusion Grounds |
| `espd.step4` | Κριτήρια Επιλογής | Selection Criteria |
| `espd.step5` | Μείωση Υποψηφίων | Candidate Reduction |
| `espd.step6` | Τελικές Δηλώσεις | Final Declarations |
| `espd.preview` | Επισκόπηση | Preview |
| `espd.exportXml` | Εξαγωγή XML | Export XML |
| `espd.save` | Αποθήκευση | Save |
| `espd.refreshFromProfile` | Ανανέωση από Προφίλ | Refresh from Profile |
| `espd.exclusionNo` | ΟΧΙ | NO |
| `espd.exclusionYes` | ΝΑΙ | YES |
| `espd.explanation` | Εξήγηση | Explanation |
| `espd.selfCleaning` | Μέτρα Αποκατάστασης | Self-cleaning Measures |
| `espd.hasDocument` | Υπάρχει δικαιολογητικό | Document available |
| `espd.addCriterion` | Προσθήκη Κριτηρίου | Add Criterion |
| `espd.financialCapacity` | Οικονομική Επάρκεια | Financial Capacity |
| `espd.technicalCapacity` | Τεχνική Ικανότητα | Technical Capacity |
| `espd.qualitySystems` | Συστήματα Ποιότητας | Quality Systems |
| `espd.reductionToggle` | Ο διαγωνισμός προβλέπει μείωση; | Procedure requires reduction? |
| `espd.declarationAccuracy` | Οι πληροφορίες είναι ακριβείς και αληθείς | Information is accurate and truthful |
| `espd.declarationEvidence` | Μπορώ να προσκομίσω δικαιολογητικά | Can provide supporting evidence |
| `espd.declarationConsent` | Συναινώ στην πρόσβαση σε βάσεις δεδομένων | Consent to database access |
| `espd.validationComplete` | Πλήρες | Complete |
| `espd.validationErrors` | Σφάλματα | Errors |
| `espd.validationWarnings` | Προειδοποιήσεις | Warnings |
| `espd.generating` | Δημιουργία XML... | Generating XML... |
| `espd.downloadReady` | Το αρχείο είναι έτοιμο | File is ready |
| `espd.editEspd` | Επεξεργασία ΕΕΕΣ | Edit ESPD |
| `espd.downloadXml` | Λήψη XML | Download XML |
| `espd.comingSoonPdf` | Εξαγωγή PDF — Σύντομα | PDF Export — Coming soon |

---

## Fakelos Integration

When `generateEspdXml` creates a FINAL GeneratedDocument:

1. Find all `TenderRequirement` where `category = 'EXCLUSION_CRITERIA'` for this tender
2. Update `TenderRequirement.coverageStatus = 'COVERED'` for each matching requirement (Prisma field, source of truth)
3. Optionally trigger `runFakelosCheck()` to refresh the cached `tender.fakelosReport` JSON
4. Do NOT directly mutate `tender.fakelosReport` — it is a computed cache, regenerated by fakelos checker
5. Log activity: "ESPD generated and linked to fakelos"

---

## Validation Rules

**Per-step validation (block Next if errors):**

| Step | Required |
|------|----------|
| 1 | Contracting authority, tender title |
| 2 | Legal name, tax ID, address, legal rep name |
| 3 | All 8 categories answered (default NO is fine) |
| 4 | At least financial OR technical section has entries |
| 5 | No required fields (optional step) |
| 6 | All 3 declaration checkboxes checked |

**Export validation (block XML generation):**
- All steps must pass validation
- Steps 1-4 and 6 must be complete

---

## Out of Scope

- Digital signing of XML (user signs externally via ΕΡΜΗΣ/JSignPdf/ΕΣΗΔΗΣ)
- PDF export of ESPD (Coming soon button)
- Consortium/joint venture ESPD (multiple operators)
- ESPD Request document (only Response)
- EU ESPD Service API integration (self-contained generation)
- ESPD XML schema validation against official XSD (Phase 2)

---

## Design Rules

- Colors: Grayscale + Picton Blue #48A4D6 only
- No purple/violet/indigo
- Wizard stepper: clean horizontal bar, active step highlighted with primary color
- Step forms: GlassCard pattern, consistent with LegalTab
- Cards: bg-card border border-border/60 rounded-xl
- Buttons: Solid bg-primary for primary actions
- All text via t() — no hardcoded strings
- Effects: BlurFade for step transitions
- Touch targets: min 44x44px
- cursor-pointer on all clickable elements
- Auto-save indicator: subtle "Saved" text near stepper
