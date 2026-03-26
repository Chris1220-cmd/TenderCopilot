# Feature 9: Greek Document Template Engine — Design Spec

**Date:** 2026-03-26
**Status:** Approved
**Author:** Christos Athanasopoulos + Claude

## Summary

DOCX export for all generated documents + new document types (Συνοδευτική Επιστολή, Πίνακας Εμπειρίας). Pre-filled from company profile + tender data. Integrated in existing Generated Documents section.

## Decisions

| Ερώτηση | Απόφαση |
|---------|---------|
| Scope | DOCX export for existing generated docs + 2 new doc types |
| UI | Integrated in existing Generated Documents section (dropdown + DOCX button) |
| Architecture | Shared helpers + per-type DOCX builders (Approach C) |
| Εγγυητική | Skip (bank-issued) |

---

## 1. What Gets Built

### New Document Types

| Type | Enum Value | AI Needed? | Source Data |
|------|-----------|------------|-------------|
| Συνοδευτική Επιστολή | `COVER_LETTER` (exists in enum) | Minimal — mostly template | Company + Tender + Requirements list |
| Πίνακας Εμπειρίας | `COMPANY_EXPERIENCE_TABLE` (new) | None — pure data | Company Projects from DB |

### DOCX Export for ALL Generated Documents

Every GeneratedDocument gets a "Κατέβασε DOCX" button. Per-type formatting:

| Document | DOCX Strategy | Format |
|----------|--------------|--------|
| Υπεύθυνη Δήλωση (SOLEMN_DECLARATION) | **Source data** — company header + Ν.1599 form + declaration text from content | Standard legal form |
| Δήλωση Μη Αποκλεισμού (NON_EXCLUSION_DECLARATION) | **Source data** — company header + declaration body from content + signature | Declaration format |
| Τεχνική Συμμόρφωση (TECHNICAL_COMPLIANCE) | **Content parse** — markdown table → DOCX table | Bordered table |
| Τεχνική Προσφορά (TECHNICAL_PROPOSAL) | **Content parse** — markdown sections → chapters with headings | Multi-section report |
| Συνοδευτική Επιστολή (COVER_LETTER) | **Source data** — company header + tender addressee + enclosed docs list + signature | Letter format |
| Πίνακας Εμπειρίας (COMPANY_EXPERIENCE_TABLE) | **Source data** — company projects from DB → table | Bordered table |
| ESPD | Skip — already has XML export |
| OTHER | **Content parse** — markdown → basic DOCX |

### Content Format Note

`GeneratedDocument.content` stores **markdown text** (not structured JSON). The AI returns `{ title, content }` where content is markdown. For DOCX export:
- **Source-data builders**: Read company/tender from DB, use content field only for the body text
- **Content-parse builders**: Parse markdown content → DOCX elements (headings, paragraphs, tables, lists)

---

## 2. Backend Architecture

### Document DOCX Service (`src/server/services/document-docx.ts`)

**Shared helpers:**
- `companyLetterhead(profile)` — Header block: company name, ΑΦΜ, address, phone, email
- `signatureBlock(profile)` — Footer: city + date, legal rep name, title, signature line
- `borderedTable(headers, rows)` — Table with borders and header styling
- `markdownToDocx(markdown)` — Simple markdown → DOCX converter (headings, paragraphs, bold/italic, lists, tables)

**Per-type builders:**

#### `buildSolemnDeclaration(profile, tender, content)`
Standard Ν.1599/86 form:
- Header: "ΥΠΕΥΘΥΝΗ ΔΗΛΩΣΗ" centered, "(άρθρο 8 Ν.1599/1986)"
- Personal info section: Full name, ΑΦΜ, ID, address (from CompanyProfile.legalRep*)
- Acting as: "Ως νόμιμος εκπρόσωπος της [companyName]"
- Declaration text: From GeneratedDocument.content (markdown → paragraphs)
- Date + signature line

#### `buildNonExclusionDeclaration(profile, tender, content)`
- Company letterhead
- Title: "ΔΗΛΩΣΗ ΜΗ ΑΠΟΚΛΕΙΣΜΟΥ"
- Reference: tender title + reference number
- Body: From content (markdown → paragraphs)
- Signature block

#### `buildCoverLetter(profile, tender, requirements)`
- Company letterhead
- Addressee: contracting authority name
- Reference: "Θέμα: [tender title]", "Αρ. Διακήρυξης: [reference]"
- Body: "Κύριοι, σας υποβάλλουμε τα ακόλουθα δικαιολογητικά..."
- Enclosed documents list: Auto-generated from tender requirements grouped by envelope (Φάκελος Α/Β/Γ)
- Signature block

#### `buildCompanyExperienceTable(projects)`
- Title: "ΠΙΝΑΚΑΣ ΕΜΠΕΙΡΙΑΣ ΕΤΑΙΡΕΙΑΣ"
- Table columns: Α/Α, Τίτλος Έργου, Κύριος Έργου, Προϋπολογισμός, Περίοδος, Κατηγορία, Περιγραφή
- One row per Company Project from DB
- Summary row: total count + total budget

#### `buildTechnicalCompliance(content)`
- Title: "ΠΙΝΑΚΑΣ ΤΕΧΝΙΚΗΣ ΣΥΜΜΟΡΦΩΣΗΣ"
- Parse markdown table from content → DOCX bordered table
- If no table found, fall back to markdown → paragraphs

#### `buildTechnicalProposal(content)`
- Title from GeneratedDocument.title
- Parse markdown sections (## headings) → HeadingLevel.HEADING_2
- Paragraphs, lists, tables converted
- Company letterhead + page numbers

#### `buildGenericDocument(content)`
- Fallback for OTHER type
- Company letterhead
- Content: markdown → DOCX
- Signature block

### Markdown → DOCX Converter

Simple converter handling:
- `# / ## / ###` → HeadingLevel 1/2/3
- Regular text → Paragraph
- `**bold**` → TextRun bold
- `*italic*` → TextRun italics
- `- item` / `1. item` → Bulleted/numbered paragraphs
- `| col | col |` → Table rows (detect markdown tables)

Does NOT need to handle: images, code blocks, nested lists, HTML. 80% coverage is sufficient.

---

## 3. tRPC Endpoints

### New in `document` router:

| Endpoint | Type | Description |
|----------|------|-------------|
| `exportDocx` | Mutation | Input: `{ generatedDocId }` → build DOCX → S3 → return download URL |
| `generateCoverLetter` | Mutation | Input: `{ tenderId }` → builds cover letter from company+tender+requirements → saves GeneratedDocument |
| `generateExperienceTable` | Mutation | Input: `{ tenderId }` → loads company projects → builds markdown table → saves GeneratedDocument |

### `exportDocx` flow:
1. Fetch GeneratedDocument by ID
2. Fetch CompanyProfile + Tender for context
3. Switch on `document.type` → call appropriate builder
4. Pack DOCX with `Packer.toBuffer()`
5. Upload to S3
6. Update GeneratedDocument.fileKey/fileName
7. Return `{ downloadUrl, fileName }`

### `generateCoverLetter` flow:
1. Fetch company profile + tender + requirements
2. Build document content as markdown: standard greeting, reference line, enclosed docs list from requirements grouped by envelope
3. Optional light AI call: polish greeting and closing paragraph. If AI unavailable, use standard boilerplate: "Αξιότιμοι, ... Με εκτίμηση"
4. Save as GeneratedDocument with type COVER_LETTER, status DRAFT

### `generateExperienceTable` flow:
1. Fetch all Company Projects for tenant
2. Build markdown table from project data
3. Save as GeneratedDocument with type COMPANY_EXPERIENCE_TABLE, status DRAFT
4. No AI needed — instant generation

---

## 4. Schema Changes

### New enum value
Add to `GeneratedDocType`:
```prisma
COMPANY_EXPERIENCE_TABLE  // Πίνακας εμπειρίας εταιρείας
```

No new models needed. Everything stores in existing `GeneratedDocument`.

---

## 5. UI Changes

### Documents Tab — Generated Documents section

**Dropdown "Δημιουργία" additions:**
- "Συνοδευτική Επιστολή" → calls `document.generateCoverLetter`
- "Πίνακας Εμπειρίας" → calls `document.generateExperienceTable`

**Each generated document card — new button:**
- **FileDown icon button** → "Κατέβασε DOCX"
- Calls `document.exportDocx({ generatedDocId })`
- On success: `window.open(downloadUrl)`
- Skip for ESPD type (has its own XML export)

---

## 6. i18n

New keys in `teamMembers` → actually in a new `documents` namespace or existing key structure:

```
documents.exportDocx = "Κατέβασε DOCX" / "Download DOCX"
documents.exporting = "Δημιουργία εγγράφου..." / "Generating document..."
documents.exportReady = "Το έγγραφο είναι έτοιμο." / "Document ready."
documents.coverLetter = "Συνοδευτική Επιστολή" / "Cover Letter"
documents.experienceTable = "Πίνακας Εμπειρίας" / "Experience Table"
documents.generating = "Δημιουργία..." / "Generating..."
```

Check existing translation keys — there may already be relevant ones in the `tender` or `documents` namespace.

---

## 7. Edge Cases

| Case | Handling |
|------|----------|
| No company profile | Disable DOCX export, tooltip: "Συμπληρώστε πρώτα το εταιρικό προφίλ" |
| No projects for experience table | Generate empty table with message "Δεν υπάρχουν καταχωρημένα έργα" |
| Content field empty | Skip content section in DOCX, show warning |
| Markdown table parsing fails | Fall back to plain paragraphs |
| ESPD document | Hide DOCX button (already has XML export) |
| Very long content (>50 pages) | No limit — docx library handles it |
