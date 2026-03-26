# ESPD Auto-Generator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full EU-compliant ESPD XML generation via 6-step wizard with import from authority's ESPD Request, pre-fill from company data, and fakelos integration.

**Architecture:** New `espd.ts` router with 5 procedures. New ESPD XML generator service using `xmlbuilder2`. Wizard UI as full-screen Sheet opened from Documents tab. Wizard state persisted in `Tender.espdData` (JSON). Final XML stored as `GeneratedDocument` with S3 file key.

**Tech Stack:** tRPC, Prisma, React, motion/react, xmlbuilder2, Lucide icons, existing Shadcn + GlassCard components

**Spec:** `docs/superpowers/specs/2026-03-25-espd-auto-generator-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/server/routers/espd.ts` | tRPC router: save/load/import/generate ESPD |
| `src/server/services/espd-xml-generator.ts` | Generate EU-compliant ESPD Response XML |
| `src/server/services/espd-request-parser.ts` | Parse authority ESPD Request XML |
| `src/server/knowledge/espd-criteria.ts` | EU ESPD criterion taxonomy (IDs, labels, categories) |
| `src/components/tender/espd-wizard.tsx` | Wizard shell: stepper, navigation, auto-save |
| `src/components/tender/espd-step-import.tsx` | Step 0: Import ESPD Request |
| `src/components/tender/espd-step-procedure.tsx` | Step 1: Part I procedure info |
| `src/components/tender/espd-step-operator.tsx` | Step 2: Part II operator info |
| `src/components/tender/espd-step-exclusion.tsx` | Step 3: Part III exclusion grounds |
| `src/components/tender/espd-step-selection.tsx` | Step 4: Part IV selection criteria |
| `src/components/tender/espd-step-reduction.tsx` | Step 5: Part V candidate reduction |
| `src/components/tender/espd-step-declarations.tsx` | Step 6: Part VI final declarations |
| `src/components/tender/espd-preview.tsx` | Preview + export screen |
| `src/lib/espd-types.ts` | EspdData TypeScript interface |

### Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add ESPD to GeneratedDocType enum + espdData to Tender |
| `src/server/routers/document.ts` | Add 'ESPD' to Zod generatedDocTypeEnum |
| `src/server/root.ts` | Register espdRouter |
| `src/components/tender/documents-tab.tsx` | Add "Create ESPD" button + wizard Sheet |
| `messages/el.json` | Add `espd.*` i18n keys |
| `messages/en.json` | Add `espd.*` i18n keys |
| `package.json` | Add xmlbuilder2 dependency |

---

## Task 1: Schema + Dependencies

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/server/routers/document.ts`
- Modify: `package.json`

- [ ] **Step 1: Install xmlbuilder2**

```bash
npm install xmlbuilder2
```

- [ ] **Step 2: Add ESPD to GeneratedDocType enum**

In `prisma/schema.prisma`, find the `GeneratedDocType` enum (line ~565) and add `ESPD`:

```prisma
enum GeneratedDocType {
  SOLEMN_DECLARATION
  NON_EXCLUSION_DECLARATION
  TECHNICAL_COMPLIANCE
  TECHNICAL_PROPOSAL
  METHODOLOGY
  COVER_LETTER
  OTHER
  ESPD
}
```

- [ ] **Step 3: Add espdData to Tender model**

In the `Tender` model, add before `createdAt`:

```prisma
  // ESPD Auto-Generator
  espdData Json?
```

- [ ] **Step 4: Push schema changes**

```bash
npx prisma db push
npx prisma generate
```

- [ ] **Step 5: Update Zod enum in document router**

In `src/server/routers/document.ts`, find the `generatedDocTypeEnum` (line ~7). Add `'ESPD'`:

```typescript
const generatedDocTypeEnum = z.enum([
  'SOLEMN_DECLARATION',
  'NON_EXCLUSION_DECLARATION',
  'TECHNICAL_COMPLIANCE',
  'TECHNICAL_PROPOSAL',
  'METHODOLOGY',
  'COVER_LETTER',
  'OTHER',
  'ESPD',
]);
```

- [ ] **Step 6: Verify and commit**

```bash
npx tsc --noEmit
git add prisma/ src/server/routers/document.ts package.json package-lock.json
git commit -m "feat(espd): add schema + xmlbuilder2 dependency"
```

---

## Task 2: EspdData Types + Criteria Reference Data

**Files:**
- Create: `src/lib/espd-types.ts`
- Create: `src/server/knowledge/espd-criteria.ts`

- [ ] **Step 1: Create EspdData TypeScript interface**

Create `src/lib/espd-types.ts`:

```typescript
export interface EspdPartI {
  contractingAuthority: string;
  tenderTitle: string;
  referenceNumber: string;
  platform: string;
  cpvCodes: string[];
  submissionDeadline: string;
}

export interface EspdPartII {
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
  companySize: 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE' | '';
  kadCodes: string[];
}

export interface ExclusionGround {
  category: string; // 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'
  answer: boolean;  // false = NO (default), true = YES
  explanation?: string;
  selfCleaning?: string;
  linkedDocumentId?: string;
}

export interface SelectionEntry {
  description: string;
  value: string;
  requirementId?: string;
}

export interface QualityEntry {
  certificateType: string;
  certificateId?: string;
  description: string;
}

export interface EspdPartIV {
  financial: SelectionEntry[];
  technical: SelectionEntry[];
  quality: QualityEntry[];
}

export interface EspdPartV {
  enabled: boolean;
  criteria?: string;
}

export interface EspdPartVI {
  declarationAccuracy: boolean;
  declarationEvidence: boolean;
  declarationConsent: boolean;
}

export interface EspdData {
  currentStep: number;
  partI: EspdPartI;
  partII: EspdPartII;
  partIII: { exclusionGrounds: ExclusionGround[] };
  partIV: EspdPartIV;
  partV: EspdPartV;
  partVI: EspdPartVI;
}

export const EMPTY_ESPD_DATA: EspdData = {
  currentStep: 0,
  partI: {
    contractingAuthority: '',
    tenderTitle: '',
    referenceNumber: '',
    platform: '',
    cpvCodes: [],
    submissionDeadline: '',
  },
  partII: {
    legalName: '', tradeName: '', taxId: '', taxOffice: '',
    registrationNumber: '', address: '', city: '', postalCode: '',
    country: 'GR', phone: '', email: '', website: '',
    legalRepName: '', legalRepTitle: '', legalRepIdNumber: '',
    companySize: '', kadCodes: [],
  },
  partIII: {
    exclusionGrounds: [
      { category: 'A', answer: false },
      { category: 'B', answer: false },
      { category: 'C', answer: false },
      { category: 'D', answer: false },
      { category: 'E', answer: false },
      { category: 'F', answer: false },
      { category: 'G', answer: false },
      { category: 'H', answer: false },
    ],
  },
  partIV: { financial: [], technical: [], quality: [] },
  partV: { enabled: false },
  partVI: { declarationAccuracy: false, declarationEvidence: false, declarationConsent: false },
};
```

- [ ] **Step 2: Create ESPD criteria reference data**

Create `src/server/knowledge/espd-criteria.ts`:

```typescript
/**
 * EU ESPD Criterion Taxonomy — Greek procurement mapping
 * Based on EU Regulation 2016/7 and N.4412/2016 Articles 73-74
 */

export const EXCLUSION_CRITERIA = [
  {
    category: 'A',
    id: 'criterion:exclusion:crime',
    titleEl: 'Ποινικά αδικήματα (Άρθρο 73 §1 Ν.4412/2016)',
    titleEn: 'Criminal convictions (Art. 73 §1)',
    subcriteria: [
      'Συμμετοχή σε εγκληματική οργάνωση',
      'Δωροδοκία / Διαφθορά',
      'Απάτη',
      'Τρομοκρατικά εγκλήματα',
      'Νομιμοποίηση εσόδων / Χρηματοδότηση τρομοκρατίας',
      'Παιδική εργασία / Εμπορία ανθρώπων',
    ],
    linkedDocType: 'CRIMINAL_RECORD',
  },
  {
    category: 'B',
    id: 'criterion:exclusion:taxes',
    titleEl: 'Καταβολή φόρων (Άρθρο 73 §2)',
    titleEn: 'Payment of taxes (Art. 73 §2)',
    subcriteria: [],
    linkedDocType: 'TAX_CLEARANCE',
  },
  {
    category: 'C',
    id: 'criterion:exclusion:social-security',
    titleEl: 'Καταβολή ασφαλιστικών εισφορών (Άρθρο 73 §2)',
    titleEn: 'Payment of social security (Art. 73 §2)',
    subcriteria: [],
    linkedDocType: 'SOCIAL_SECURITY_CLEARANCE',
  },
  {
    category: 'D',
    id: 'criterion:exclusion:environmental',
    titleEl: 'Περιβαλλοντικές, κοινωνικές, εργατικές υποχρεώσεις (Άρθρο 73 §4)',
    titleEn: 'Environmental, social, labour law (Art. 73 §4)',
    subcriteria: [],
    linkedDocType: null,
  },
  {
    category: 'E',
    id: 'criterion:exclusion:insolvency',
    titleEl: 'Πτώχευση / Αφερεγγυότητα / Εκκαθάριση (Άρθρο 73 §4)',
    titleEn: 'Insolvency / Bankruptcy (Art. 73 §4)',
    subcriteria: [],
    linkedDocType: 'GEMI_CERTIFICATE',
  },
  {
    category: 'F',
    id: 'criterion:exclusion:misconduct',
    titleEl: 'Σοβαρό επαγγελματικό παράπτωμα (Άρθρο 73 §4)',
    titleEn: 'Professional misconduct (Art. 73 §4)',
    subcriteria: [],
    linkedDocType: null,
  },
  {
    category: 'G',
    id: 'criterion:exclusion:conflict',
    titleEl: 'Σύγκρουση συμφερόντων (Άρθρο 73 §4)',
    titleEn: 'Conflict of interest (Art. 73 §4)',
    subcriteria: [],
    linkedDocType: null,
  },
  {
    category: 'H',
    id: 'criterion:exclusion:prior-involvement',
    titleEl: 'Προηγούμενη εμπλοκή στην προετοιμασία (Άρθρο 73 §4)',
    titleEn: 'Prior involvement in procurement (Art. 73 §4)',
    subcriteria: [],
    linkedDocType: null,
  },
] as const;

export const SELECTION_CRITERIA_TYPES = {
  financial: [
    { id: 'criterion:selection:turnover', titleEl: 'Γενικός ετήσιος κύκλος εργασιών', titleEn: 'General yearly turnover' },
    { id: 'criterion:selection:specific-turnover', titleEl: 'Ειδικός ετήσιος κύκλος εργασιών', titleEn: 'Specific yearly turnover' },
    { id: 'criterion:selection:financial-ratio', titleEl: 'Χρηματοοικονομικοί δείκτες', titleEn: 'Financial ratios' },
    { id: 'criterion:selection:insurance', titleEl: 'Ασφάλιση επαγγελματικού κινδύνου', titleEn: 'Professional risk indemnity' },
  ],
  technical: [
    { id: 'criterion:selection:similar-works', titleEl: 'Παρόμοια έργα / υπηρεσίες', titleEn: 'Similar works / services' },
    { id: 'criterion:selection:technical-staff', titleEl: 'Τεχνικό προσωπικό', titleEn: 'Technical staff' },
    { id: 'criterion:selection:equipment', titleEl: 'Τεχνικός εξοπλισμός', titleEn: 'Technical equipment' },
    { id: 'criterion:selection:subcontracting', titleEl: 'Υπεργολαβία', titleEn: 'Subcontracting' },
  ],
  quality: [
    { id: 'criterion:selection:iso9001', titleEl: 'ISO 9001 — Διαχείριση Ποιότητας', titleEn: 'ISO 9001 — Quality Management' },
    { id: 'criterion:selection:iso14001', titleEl: 'ISO 14001 — Περιβαλλοντική Διαχείριση', titleEn: 'ISO 14001 — Environmental Management' },
    { id: 'criterion:selection:iso45001', titleEl: 'ISO 45001 — Υγεία & Ασφάλεια', titleEn: 'ISO 45001 — Health & Safety' },
    { id: 'criterion:selection:emas', titleEl: 'EMAS', titleEn: 'EMAS' },
  ],
} as const;
```

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit
git add src/lib/espd-types.ts src/server/knowledge/espd-criteria.ts
git commit -m "feat(espd): add EspdData types + EU criteria reference data"
```

---

## Task 3: i18n Keys

**Files:**
- Modify: `messages/el.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Add Greek keys**

Add `espd` block to `messages/el.json` after `clarifications`:

```json
"espd": {
  "title": "Δημιουργία ΕΕΕΣ/ESPD",
  "step0": "Εισαγωγή",
  "step1": "Πληροφορίες Διαδικασίας",
  "step2": "Στοιχεία Οικ. Φορέα",
  "step3": "Λόγοι Αποκλεισμού",
  "step4": "Κριτήρια Επιλογής",
  "step5": "Μείωση Υποψηφίων",
  "step6": "Τελικές Δηλώσεις",
  "preview": "Επισκόπηση",
  "exportXml": "Εξαγωγή XML",
  "save": "Αποθήκευση",
  "saved": "Αποθηκεύτηκε",
  "next": "Επόμενο",
  "back": "Πίσω",
  "refreshFromProfile": "Ανανέωση από Προφίλ",
  "importRequest": "Εισαγωγή ESPD Request",
  "createFromScratch": "Δημιουργία από την αρχή",
  "importDescription": "Ανεβάστε το ESPD Request XML της αναθέτουσας αρχής για αυτόματη συμπλήρωση",
  "dropXmlHere": "Σύρετε το XML εδώ ή κάντε κλικ για επιλογή",
  "importSuccess": "Εισαγωγή επιτυχής — {{count}} κριτήρια εντοπίστηκαν",
  "importError": "Σφάλμα κατά την εισαγωγή — ελέγξτε ότι είναι ESPD XML",
  "exclusionNo": "ΟΧΙ",
  "exclusionYes": "ΝΑΙ",
  "explanation": "Εξήγηση",
  "selfCleaning": "Μέτρα Αποκατάστασης",
  "hasDocument": "Υπάρχει δικαιολογητικό",
  "noDocument": "Λείπει δικαιολογητικό",
  "addCriterion": "Προσθήκη Κριτηρίου",
  "removeCriterion": "Αφαίρεση",
  "financialCapacity": "Οικονομική Επάρκεια",
  "technicalCapacity": "Τεχνική Ικανότητα",
  "qualitySystems": "Συστήματα Ποιότητας",
  "reductionToggle": "Ο διαγωνισμός προβλέπει μείωση υποψηφίων;",
  "reductionCriteria": "Κριτήρια μείωσης",
  "declarationAccuracy": "Οι πληροφορίες που παρέχονται είναι ακριβείς και αληθείς",
  "declarationEvidence": "Μπορώ να προσκομίσω τα σχετικά δικαιολογητικά χωρίς καθυστέρηση",
  "declarationConsent": "Συναινώ στην πρόσβαση σε ηλεκτρονικές βάσεις δεδομένων",
  "validationComplete": "Πλήρες",
  "validationErrors": "Σφάλματα",
  "validationWarnings": "Προειδοποιήσεις",
  "generating": "Δημιουργία XML...",
  "downloadReady": "Το αρχείο είναι έτοιμο",
  "editEspd": "Επεξεργασία ΕΕΕΣ",
  "downloadXml": "Λήψη XML",
  "comingSoonPdf": "Εξαγωγή PDF — Σύντομα",
  "contractingAuthority": "Αναθέτουσα Αρχή",
  "tenderTitle": "Τίτλος Διαγωνισμού",
  "referenceNumber": "Αριθμός Αναφοράς",
  "cpvCodes": "Κωδικοί CPV",
  "companySize": "Μέγεθος Επιχείρησης",
  "micro": "Πολύ μικρή",
  "small": "Μικρή",
  "medium": "Μεσαία",
  "large": "Μεγάλη"
}
```

- [ ] **Step 2: Add English keys**

Add equivalent English block to `messages/en.json`:

```json
"espd": {
  "title": "Create ESPD",
  "step0": "Import",
  "step1": "Procedure Information",
  "step2": "Operator Information",
  "step3": "Exclusion Grounds",
  "step4": "Selection Criteria",
  "step5": "Candidate Reduction",
  "step6": "Final Declarations",
  "preview": "Preview",
  "exportXml": "Export XML",
  "save": "Save",
  "saved": "Saved",
  "next": "Next",
  "back": "Back",
  "refreshFromProfile": "Refresh from Profile",
  "importRequest": "Import ESPD Request",
  "createFromScratch": "Create from scratch",
  "importDescription": "Upload the contracting authority's ESPD Request XML for auto-fill",
  "dropXmlHere": "Drop XML here or click to browse",
  "importSuccess": "Import successful — {{count}} criteria detected",
  "importError": "Import error — verify it is an ESPD XML file",
  "exclusionNo": "NO",
  "exclusionYes": "YES",
  "explanation": "Explanation",
  "selfCleaning": "Self-cleaning Measures",
  "hasDocument": "Document available",
  "noDocument": "Document missing",
  "addCriterion": "Add Criterion",
  "removeCriterion": "Remove",
  "financialCapacity": "Financial Capacity",
  "technicalCapacity": "Technical Capacity",
  "qualitySystems": "Quality Systems",
  "reductionToggle": "Procedure requires candidate reduction?",
  "reductionCriteria": "Reduction criteria",
  "declarationAccuracy": "The information provided is accurate and truthful",
  "declarationEvidence": "I can provide supporting evidence without delay",
  "declarationConsent": "I consent to database access for verification",
  "validationComplete": "Complete",
  "validationErrors": "Errors",
  "validationWarnings": "Warnings",
  "generating": "Generating XML...",
  "downloadReady": "File is ready",
  "editEspd": "Edit ESPD",
  "downloadXml": "Download XML",
  "comingSoonPdf": "PDF Export — Coming soon",
  "contractingAuthority": "Contracting Authority",
  "tenderTitle": "Tender Title",
  "referenceNumber": "Reference Number",
  "cpvCodes": "CPV Codes",
  "companySize": "Company Size",
  "micro": "Micro",
  "small": "Small",
  "medium": "Medium",
  "large": "Large"
}
```

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit
git add messages/el.json messages/en.json
git commit -m "feat(espd): add i18n keys for ESPD wizard"
```

---

## Task 4: ESPD Request Parser

**Files:**
- Create: `src/server/services/espd-request-parser.ts`

- [ ] **Step 1: Create the parser service**

```typescript
import { create } from 'xmlbuilder2';
import { EXCLUSION_CRITERIA, SELECTION_CRITERIA_TYPES } from '@/server/knowledge/espd-criteria';
import type { EspdData, ExclusionGround } from '@/lib/espd-types';
import { EMPTY_ESPD_DATA } from '@/lib/espd-types';

/**
 * Parse an ESPD Request XML from a contracting authority
 * and extract procedure info + required criteria.
 */
export function parseEspdRequest(xmlString: string): Partial<EspdData> {
  try {
    const doc = create(xmlString);
    const root = doc.end({ format: 'object' }) as any;

    // Navigate the UBL structure — handle different namespace prefixes
    const espd = root['espd:ESPDRequest'] || root['ESPDRequest'] || root['espd-req:ESPDRequest'] || root;

    const result: Partial<EspdData> = {
      currentStep: 1,
      partI: { ...EMPTY_ESPD_DATA.partI },
      partIII: { exclusionGrounds: [...EMPTY_ESPD_DATA.partIII.exclusionGrounds] },
      partIV: { financial: [], technical: [], quality: [] },
    };

    // Extract contracting authority (Part I)
    const contractingParty = findNode(espd, 'ContractingParty');
    if (contractingParty) {
      const partyName = findText(contractingParty, 'PartyName', 'Name');
      if (partyName) result.partI!.contractingAuthority = partyName;
    }

    // Extract procurement project
    const project = findNode(espd, 'ProcurementProject');
    if (project) {
      const name = findText(project, 'Name');
      if (name) result.partI!.tenderTitle = name;

      const id = findText(project, 'ID');
      if (id) result.partI!.referenceNumber = id;

      // CPV codes
      const commodities = findNodes(project, 'MainCommodityClassification');
      const cpvCodes: string[] = [];
      for (const c of commodities) {
        const code = findText(c, 'ItemClassificationCode');
        if (code) cpvCodes.push(code);
      }
      if (cpvCodes.length > 0) result.partI!.cpvCodes = cpvCodes;
    }

    // Extract criteria (Parts III-IV)
    const criteria = findNodes(espd, 'TenderingCriterion');
    for (const criterion of criteria) {
      const typeCode = findText(criterion, 'CriterionTypeCode');
      const name = findText(criterion, 'Name');
      const id = findText(criterion, 'ID');

      if (typeCode === 'CRITERION.EXCLUSION' || id?.startsWith('criterion:exclusion')) {
        // Map to our exclusion categories
        const match = EXCLUSION_CRITERIA.find(
          (ec) => id?.includes(ec.id) || name?.toLowerCase().includes(ec.titleEn.toLowerCase().split(' ')[0])
        );
        if (match) {
          const idx = result.partIII!.exclusionGrounds.findIndex((g) => g.category === match.category);
          if (idx >= 0) {
            result.partIII!.exclusionGrounds[idx] = { ...result.partIII!.exclusionGrounds[idx] };
          }
        }
      }

      if (typeCode === 'CRITERION.SELECTION' || id?.startsWith('criterion:selection')) {
        // Add to Part IV
        const entry = { description: name || '', value: '', requirementId: id || undefined };
        if (id?.includes('turnover') || id?.includes('financial') || id?.includes('ratio') || id?.includes('insurance')) {
          result.partIV!.financial.push(entry);
        } else {
          result.partIV!.technical.push(entry);
        }
      }
    }

    return result;
  } catch {
    throw new Error('Invalid ESPD XML format');
  }
}

// Helper: find a node by local name (ignoring namespace prefix)
function findNode(obj: any, localName: string): any {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of Object.keys(obj)) {
    const local = key.split(':').pop();
    if (local === localName) return obj[key];
  }
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object') {
      const found = findNode(obj[key], localName);
      if (found) return found;
    }
  }
  return null;
}

function findNodes(obj: any, localName: string): any[] {
  const results: any[] = [];
  if (!obj || typeof obj !== 'object') return results;
  for (const key of Object.keys(obj)) {
    const local = key.split(':').pop();
    if (local === localName) {
      const val = obj[key];
      if (Array.isArray(val)) results.push(...val);
      else results.push(val);
    }
  }
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && !key.split(':').pop()?.match(/^[A-Z]/)) {
      results.push(...findNodes(obj[key], localName));
    }
  }
  return results;
}

function findText(obj: any, ...path: string[]): string | null {
  let current = obj;
  for (const segment of path) {
    current = findNode(current, segment);
    if (!current) return null;
  }
  if (typeof current === 'string') return current;
  if (typeof current === 'object' && current['#']) return current['#'];
  if (typeof current === 'object') {
    for (const key of Object.keys(current)) {
      if (typeof current[key] === 'string') return current[key];
    }
  }
  return null;
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add src/server/services/espd-request-parser.ts
git commit -m "feat(espd): add ESPD Request XML parser"
```

---

## Task 5: ESPD XML Generator Service

**Files:**
- Create: `src/server/services/espd-xml-generator.ts`

- [ ] **Step 1: Create the XML generator**

```typescript
import { create } from 'xmlbuilder2';
import type { EspdData } from '@/lib/espd-types';
import { EXCLUSION_CRITERIA, SELECTION_CRITERIA_TYPES } from '@/server/knowledge/espd-criteria';

const ESPD_NS = {
  'xmlns:espd': 'urn:oasis:names:specification:ubl:schema:xsd:QualificationApplicationResponse-2',
  'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
};

export function generateEspdXml(data: EspdData): string {
  const doc = create({ version: '1.0', encoding: 'UTF-8' });

  const root = doc.ele('espd:QualificationApplicationResponse', ESPD_NS);

  // UBL Version
  root.ele('cbc:UBLVersionID').txt('2.2');
  root.ele('cbc:CustomizationID').txt('urn:fdc:espd:2.1.1');
  root.ele('cbc:ProfileExecutionID').txt('ESPD-EDMv2.1.1');

  // Part I — Procedure Information
  buildPartI(root, data.partI);

  // Part II — Economic Operator
  buildPartII(root, data.partII);

  // Part III — Exclusion Grounds
  buildPartIII(root, data.partIII.exclusionGrounds);

  // Part IV — Selection Criteria
  buildPartIV(root, data.partIV);

  // Part V — Reduction (if enabled)
  if (data.partV.enabled) {
    buildPartV(root, data.partV);
  }

  // Part VI — Final Declarations
  buildPartVI(root, data.partVI);

  return doc.end({ prettyPrint: true });
}

function buildPartI(root: any, partI: EspdData['partI']) {
  const cp = root.ele('cac:ContractingParty');
  const party = cp.ele('cac:Party');
  party.ele('cac:PartyName').ele('cbc:Name').txt(partI.contractingAuthority || '');

  const project = root.ele('cac:ProcurementProject');
  project.ele('cbc:Name').txt(partI.tenderTitle || '');
  project.ele('cbc:ID').txt(partI.referenceNumber || '');

  for (const cpv of partI.cpvCodes) {
    project.ele('cac:MainCommodityClassification')
      .ele('cbc:ItemClassificationCode', { listID: 'CPV' }).txt(cpv);
  }
}

function buildPartII(root: any, partII: EspdData['partII']) {
  const eop = root.ele('cac:EconomicOperatorParty');
  const party = eop.ele('cac:Party');

  party.ele('cac:PartyIdentification').ele('cbc:ID', { schemeName: 'VAT' }).txt(partII.taxId || '');

  party.ele('cac:PartyName').ele('cbc:Name').txt(partII.legalName || '');

  const address = party.ele('cac:PostalAddress');
  address.ele('cbc:StreetName').txt(partII.address || '');
  address.ele('cbc:CityName').txt(partII.city || '');
  address.ele('cbc:PostalZone').txt(partII.postalCode || '');
  address.ele('cac:Country').ele('cbc:IdentificationCode').txt(partII.country || 'GR');

  const contact = party.ele('cac:Contact');
  contact.ele('cbc:Telephone').txt(partII.phone || '');
  contact.ele('cbc:ElectronicMail').txt(partII.email || '');

  // Legal representative
  const rep = eop.ele('cac:RepresentativeNaturalPerson');
  rep.ele('cbc:FamilyName').txt(partII.legalRepName || '');
  rep.ele('cbc:RoleDescription').txt(partII.legalRepTitle || '');

  // Company size
  if (partII.companySize) {
    addCriterionResponse(root, 'criterion:selection:sme', partII.companySize);
  }
}

function buildPartIII(root: any, grounds: EspdData['partIII']['exclusionGrounds']) {
  for (const ground of grounds) {
    const criterion = EXCLUSION_CRITERIA.find((c) => c.category === ground.category);
    if (!criterion) continue;

    addCriterionResponse(root, criterion.id, ground.answer ? 'true' : 'false');

    if (ground.answer && ground.explanation) {
      addCriterionResponse(root, `${criterion.id}:description`, ground.explanation);
    }
    if (ground.answer && ground.selfCleaning) {
      addCriterionResponse(root, `${criterion.id}:self-cleaning`, ground.selfCleaning);
    }
  }
}

function buildPartIV(root: any, partIV: EspdData['partIV']) {
  for (const entry of partIV.financial) {
    addCriterionResponse(root, entry.requirementId || 'criterion:selection:financial', entry.value, entry.description);
  }
  for (const entry of partIV.technical) {
    addCriterionResponse(root, entry.requirementId || 'criterion:selection:technical', entry.value, entry.description);
  }
  for (const entry of partIV.quality) {
    addCriterionResponse(root, entry.certificateId || 'criterion:selection:quality', entry.certificateType, entry.description);
  }
}

function buildPartV(root: any, partV: EspdData['partV']) {
  addCriterionResponse(root, 'criterion:reduction', partV.criteria || '');
}

function buildPartVI(root: any, partVI: EspdData['partVI']) {
  addCriterionResponse(root, 'criterion:declaration:accuracy', partVI.declarationAccuracy ? 'true' : 'false');
  addCriterionResponse(root, 'criterion:declaration:evidence', partVI.declarationEvidence ? 'true' : 'false');
  addCriterionResponse(root, 'criterion:declaration:consent', partVI.declarationConsent ? 'true' : 'false');
}

function addCriterionResponse(root: any, criterionId: string, value: string, description?: string) {
  const tcr = root.ele('cac:TenderingCriterionResponse');
  tcr.ele('cbc:ValidatedCriterionPropertyID').txt(criterionId);
  const rv = tcr.ele('cac:ResponseValue');
  if (value === 'true' || value === 'false') {
    rv.ele('cbc:ResponseIndicator').txt(value);
  } else {
    rv.ele('cbc:ResponseDescription').txt(value);
  }
  if (description) {
    rv.ele('cbc:Description').txt(description);
  }
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add src/server/services/espd-xml-generator.ts
git commit -m "feat(espd): add ESPD XML generator service"
```

---

## Task 6: ESPD Router

**Files:**
- Create: `src/server/routers/espd.ts`
- Modify: `src/server/root.ts`

- [ ] **Step 1: Create the ESPD router**

```typescript
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';
import { db } from '@/lib/db';
import { parseEspdRequest } from '@/server/services/espd-request-parser';
import { generateEspdXml } from '@/server/services/espd-xml-generator';
import { EMPTY_ESPD_DATA } from '@/lib/espd-types';
import type { EspdData } from '@/lib/espd-types';
import { EXCLUSION_CRITERIA } from '@/server/knowledge/espd-criteria';

async function ensureTenderAccess(tenderId: string, tenantId: string | null) {
  if (!tenantId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant.' });
  const tender = await db.tender.findUnique({ where: { id: tenderId } });
  if (!tender || tender.tenantId !== tenantId) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
  return { tender, tenantId };
}

export const espdRouter = router({
  getEspdData: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { tender, tenantId } = await ensureTenderAccess(input.tenderId, ctx.tenantId);

      // Return persisted wizard state if exists
      if (tender.espdData) return tender.espdData as EspdData;

      // Build default from company profile + tender data
      const [profile, certs, legalDocs, requirements] = await Promise.all([
        db.companyProfile.findFirst({ where: { tenantId } }),
        db.certificate.findMany({ where: { tenantId } }),
        db.legalDocument.findMany({ where: { tenantId } }),
        db.tenderRequirement.findMany({ where: { tenderId: input.tenderId } }),
      ]);

      const data: EspdData = { ...EMPTY_ESPD_DATA };

      // Part I from tender
      data.partI = {
        contractingAuthority: tender.contractingAuthority || '',
        tenderTitle: tender.title,
        referenceNumber: tender.referenceNumber || '',
        platform: tender.platform || '',
        cpvCodes: tender.cpvCodes || [],
        submissionDeadline: tender.submissionDeadline?.toISOString().split('T')[0] || '',
      };

      // Part II from company profile
      if (profile) {
        data.partII = {
          legalName: profile.legalName || '',
          tradeName: profile.tradeName || '',
          taxId: profile.taxId || '',
          taxOffice: profile.taxOffice || '',
          registrationNumber: profile.registrationNumber || '',
          address: profile.address || '',
          city: profile.city || '',
          postalCode: profile.postalCode || '',
          country: profile.country || 'GR',
          phone: profile.phone || '',
          email: profile.email || '',
          website: profile.website || '',
          legalRepName: profile.legalRepName || '',
          legalRepTitle: profile.legalRepTitle || '',
          legalRepIdNumber: profile.legalRepIdNumber || '',
          companySize: '',
          kadCodes: profile.kadCodes || [],
        };
      }

      // Part III — link legal documents
      data.partIII.exclusionGrounds = EXCLUSION_CRITERIA.map((ec) => {
        const linkedDoc = ec.linkedDocType
          ? legalDocs.find((d: any) => d.type === ec.linkedDocType)
          : null;
        return {
          category: ec.category,
          answer: false,
          linkedDocumentId: linkedDoc?.id || undefined,
        };
      });

      // Part IV — from requirements
      const financialReqs = requirements.filter((r: any) => r.category === 'FINANCIAL_REQUIREMENTS');
      const technicalReqs = requirements.filter((r: any) => r.category === 'TECHNICAL_REQUIREMENTS');

      data.partIV.financial = financialReqs.map((r: any) => ({
        description: r.text || '',
        value: '',
        requirementId: r.id,
      }));
      data.partIV.technical = technicalReqs.map((r: any) => ({
        description: r.text || '',
        value: '',
        requirementId: r.id,
      }));
      data.partIV.quality = certs.map((c: any) => ({
        certificateType: c.type || '',
        certificateId: c.id,
        description: c.title || '',
      }));

      return data;
    }),

  saveEspdData: protectedProcedure
    .input(z.object({
      tenderId: z.string(),
      espdData: z.any(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);
      await db.tender.update({
        where: { id: input.tenderId },
        data: { espdData: input.espdData },
      });
      return { success: true };
    }),

  getEspdPrefill: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { tenantId } = await ensureTenderAccess(input.tenderId, ctx.tenantId);
      const [profile, certs, legalDocs] = await Promise.all([
        db.companyProfile.findFirst({ where: { tenantId } }),
        db.certificate.findMany({ where: { tenantId } }),
        db.legalDocument.findMany({ where: { tenantId } }),
      ]);
      return { profile, certs, legalDocs };
    }),

  importEspdRequest: protectedProcedure
    .input(z.object({
      tenderId: z.string(),
      xmlContent: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ensureTenderAccess(input.tenderId, ctx.tenantId);

      const parsed = parseEspdRequest(input.xmlContent);

      // Merge with existing espdData or create new
      const tender = await db.tender.findUnique({ where: { id: input.tenderId } });
      const existing = (tender?.espdData as EspdData) || { ...EMPTY_ESPD_DATA };

      const merged: EspdData = {
        ...existing,
        currentStep: 1,
        partI: { ...existing.partI, ...parsed.partI },
        partIII: parsed.partIII || existing.partIII,
        partIV: {
          financial: [...(parsed.partIV?.financial || []), ...existing.partIV.financial],
          technical: [...(parsed.partIV?.technical || []), ...existing.partIV.technical],
          quality: existing.partIV.quality,
        },
      };

      await db.tender.update({
        where: { id: input.tenderId },
        data: { espdData: merged as any },
      });

      const criteriaCount = (parsed.partIII?.exclusionGrounds?.length || 0)
        + (parsed.partIV?.financial?.length || 0)
        + (parsed.partIV?.technical?.length || 0);

      return { espdData: merged, criteriaCount };
    }),

  generateEspdXml: protectedProcedure
    .input(z.object({ tenderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { tender, tenantId } = await ensureTenderAccess(input.tenderId, ctx.tenantId);

      const espdData = tender.espdData as EspdData;
      if (!espdData) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No ESPD data.' });

      // Generate XML
      const xml = generateEspdXml(espdData);

      // Create GeneratedDocument
      const doc = await db.generatedDocument.create({
        data: {
          tenderId: input.tenderId,
          type: 'ESPD',
          title: 'ΕΕΕΣ/ESPD',
          content: JSON.stringify(espdData),
          fileName: `ESPD_${tender.referenceNumber || tender.id}.xml`,
          status: 'FINAL',
        },
      });

      // Auto-mark EXCLUSION_CRITERIA requirements as COVERED
      await db.tenderRequirement.updateMany({
        where: {
          tenderId: input.tenderId,
          category: 'EXCLUSION_CRITERIA',
        },
        data: { coverageStatus: 'COVERED' },
      });

      // Log activity
      await db.activity.create({
        data: {
          tenderId: input.tenderId,
          action: 'espd_generated',
          details: 'ESPD XML generated and linked to fakelos',
        },
      });

      return { documentId: doc.id, xml };
    }),
});
```

- [ ] **Step 2: Register in app router**

In `src/server/root.ts`, add import and register:

```typescript
import { espdRouter } from '@/server/routers/espd';
```

Add to the `router({})` object:

```typescript
espd: espdRouter,
```

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit
git add src/server/routers/espd.ts src/server/root.ts
git commit -m "feat(espd): add ESPD router with 5 procedures"
```

---

## Task 7: Wizard Shell Component

**Files:**
- Create: `src/components/tender/espd-wizard.tsx`

- [ ] **Step 1: Create the wizard shell**

This is the main wizard component with stepper navigation, step rendering, and auto-save. It manages the `EspdData` state, renders the current step component, and handles Back/Next/Save.

Key features:
- Horizontal stepper bar at top (Steps 0-6 + Preview)
- Renders current step component via switch
- Auto-saves `espdData` on step change via `trpc.espd.saveEspdData`
- Back/Next/Save buttons in footer
- "Saved" indicator

The wizard loads data via `trpc.espd.getEspdData` on mount, renders step components passing `espdData` + `onChange` handler, and saves on every step transition.

Create the file with imports from: `trpc`, `useTranslation`, `useToast`, motion/react, lucide-react (ChevronLeft, ChevronRight, Save, Check, Loader2), and the step components.

Component structure:
```
<Sheet fullscreen>
  <SheetContent>
    <Stepper steps={STEPS} current={currentStep} />
    <StepContent step={currentStep} data={espdData} onChange={updateData} tenderId={tenderId} />
    <Footer>
      <BackButton /> <SaveIndicator /> <NextButton />
    </Footer>
  </SheetContent>
</Sheet>
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add src/components/tender/espd-wizard.tsx
git commit -m "feat(espd): add wizard shell with stepper + navigation"
```

---

## Task 8: Step Components — Import + Parts I-II

**Files:**
- Create: `src/components/tender/espd-step-import.tsx`
- Create: `src/components/tender/espd-step-procedure.tsx`
- Create: `src/components/tender/espd-step-operator.tsx`

- [ ] **Step 1: Create Step 0 — Import**

Upload zone (drag-drop or click) for XML file. Two buttons: "Import ESPD Request" and "Create from scratch". On import: reads file as text, calls `trpc.espd.importEspdRequest`, shows success/error toast with criteria count.

Uses: GlassCard, Upload icon, file input ref pattern (same as certificates-list.tsx).

- [ ] **Step 2: Create Step 1 — Part I Procedure Info**

Simple form with fields: contractingAuthority (Input), tenderTitle (Input), referenceNumber (Input), platform (Input), cpvCodes (tag input — Input + add button + badge list), submissionDeadline (date Input).

All pre-filled, all editable. Uses GlassCard layout.

- [ ] **Step 3: Create Step 2 — Part II Operator Info**

Form with 17 fields from `EspdPartII`. All pre-filled from CompanyProfile. "Ανανέωση από Προφίλ" button calls `trpc.espd.getEspdPrefill` and overwrites Part II fields.

`companySize` as Select (MICRO/SMALL/MEDIUM/LARGE). `kadCodes` as tag input.

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit
git add src/components/tender/espd-step-import.tsx src/components/tender/espd-step-procedure.tsx src/components/tender/espd-step-operator.tsx
git commit -m "feat(espd): add wizard Steps 0-2 (import, procedure, operator)"
```

---

## Task 9: Step Components — Parts III-VI

**Files:**
- Create: `src/components/tender/espd-step-exclusion.tsx`
- Create: `src/components/tender/espd-step-selection.tsx`
- Create: `src/components/tender/espd-step-reduction.tsx`
- Create: `src/components/tender/espd-step-declarations.tsx`

- [ ] **Step 1: Create Step 3 — Part III Exclusion Grounds**

8 exclusion categories rendered as cards. Each card shows:
- Category title (from `EXCLUSION_CRITERIA`)
- YES/NO toggle (default NO, green/red indicator)
- If linked LegalDocument exists: green badge "Υπάρχει δικαιολογητικό"
- If YES selected: show explanation textarea + self-cleaning textarea

Import `EXCLUSION_CRITERIA` from knowledge file for labels.

- [ ] **Step 2: Create Step 4 — Part IV Selection Criteria**

3 sections (tabs or accordion): Financial / Technical / Quality.

Each section: list of criteria entries with description + value fields. "Προσθήκη Κριτηρίου" button adds new entry. Remove button per entry.

Quality section shows linked certificates with expiry dates.

Pre-filled from TenderRequirements + Certificates.

- [ ] **Step 3: Create Step 5 — Part V Reduction**

Simple toggle: "Ο διαγωνισμός προβλέπει μείωση υποψηφίων;" If YES: textarea for criteria.

- [ ] **Step 4: Create Step 6 — Part VI Declarations**

3 checkboxes with declaration text. All must be checked before export.

- [ ] **Step 5: Verify and commit**

```bash
npx tsc --noEmit
git add src/components/tender/espd-step-exclusion.tsx src/components/tender/espd-step-selection.tsx src/components/tender/espd-step-reduction.tsx src/components/tender/espd-step-declarations.tsx
git commit -m "feat(espd): add wizard Steps 3-6 (exclusion, selection, reduction, declarations)"
```

---

## Task 10: Preview + Export

**Files:**
- Create: `src/components/tender/espd-preview.tsx`

- [ ] **Step 1: Create Preview component**

Read-only summary of all 6 Parts in GlassCard sections. Each section header is clickable → navigates back to that step for editing.

Validation summary at top:
- Green "Πλήρες" if all steps pass
- Red "X Σφάλματα" if required fields missing
- Amber "Y Προειδοποιήσεις" for optional gaps

Two action buttons:
- "Εξαγωγή XML" → calls `trpc.espd.generateEspdXml`, triggers download of XML string as `.xml` file
- "Εξαγωγή PDF" → disabled, tooltip "Coming soon"

Download logic: create Blob from XML string, create download link, trigger click.

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add src/components/tender/espd-preview.tsx
git commit -m "feat(espd): add preview screen with XML export"
```

---

## Task 11: Documents Tab Integration

**Files:**
- Modify: `src/components/tender/documents-tab.tsx`

- [ ] **Step 1: Add ESPD button and wizard Sheet**

Read the file first. Add:
1. Import `EspdWizard` component
2. State: `const [espdOpen, setEspdOpen] = useState(false);`
3. In the Generated tab, add a button before/alongside the existing generation dropdown:

```tsx
<Button
  onClick={() => setEspdOpen(true)}
  variant="outline"
  className="cursor-pointer gap-2"
>
  <FileText className="h-4 w-4" />
  {t('espd.title')}
</Button>
```

4. Render the wizard:

```tsx
<EspdWizard
  tenderId={tenderId}
  open={espdOpen}
  onOpenChange={setEspdOpen}
/>
```

5. Add ESPD to the `generatedDocTypes` array for proper display in the list:

```typescript
{ type: 'ESPD' as const, label: 'ΕΕΕΣ/ESPD', icon: FileText },
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add src/components/tender/documents-tab.tsx
git commit -m "feat(espd): integrate wizard into Documents tab"
```

---

## Task 12: Build Verification

- [ ] **Step 1: Full build**

```bash
npm run build
```

- [ ] **Step 2: Fix any errors**

Address build errors.

- [ ] **Step 3: Final commit if fixes needed**

```bash
git add -A
git commit -m "fix(espd): build fixes"
```
