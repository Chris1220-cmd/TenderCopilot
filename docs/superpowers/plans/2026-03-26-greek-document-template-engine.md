# Feature 9: Greek Document Template Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add DOCX export for all generated documents + new document types (Cover Letter, Company Experience Table) with pre-filled company/tender data.

**Architecture:** A new `document-docx.ts` service with shared helpers + per-type DOCX builders. A simple markdown-to-DOCX converter for AI-generated content. New generation endpoints for Cover Letter and Experience Table. "Κατέβασε DOCX" button on every generated document card.

**Tech Stack:** docx library (already installed), Prisma, tRPC, existing S3 upload utilities

**Spec:** `docs/superpowers/specs/2026-03-26-greek-document-template-engine-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/server/services/document-docx.ts` | DOCX builders: shared helpers + per-type builders + markdown converter |
| `src/server/services/document-docx-helpers.ts` | Shared DOCX helpers (letterhead, signature, tables, markdown parser) |

### Modified Files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `COMPANY_EXPERIENCE_TABLE` to GeneratedDocType enum |
| `src/server/routers/document.ts` | Add `exportDocx`, `generateCoverLetter`, `generateExperienceTable` endpoints |
| `src/components/tender/documents-tab.tsx` | Add DOCX button + 2 new items in generation dropdown |
| `messages/el.json` | Add document template translation keys |
| `messages/en.json` | Add document template translation keys |

---

## Task 1: Schema — Add COMPANY_EXPERIENCE_TABLE enum value

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enum value**

In `prisma/schema.prisma`, find the `GeneratedDocType` enum and add:

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
  COMPANY_EXPERIENCE_TABLE
}
```

- [ ] **Step 2: Push schema**

```bash
npx prisma db push
npx prisma generate
```

- [ ] **Step 3: Update Zod enum in document router**

In `src/server/routers/document.ts`, find the `generatedDocTypeEnum` and add `'COMPANY_EXPERIENCE_TABLE'`:

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
  'COMPANY_EXPERIENCE_TABLE',
]);
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma src/server/routers/document.ts
git commit -m "feat(docs): add COMPANY_EXPERIENCE_TABLE to GeneratedDocType enum"
```

---

## Task 2: Shared DOCX Helpers

**Files:**
- Create: `src/server/services/document-docx-helpers.ts`

- [ ] **Step 1: Create shared helpers file**

```typescript
import {
  Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, HeadingLevel, BorderStyle,
  ShadingType, ITableBordersOptions,
} from 'docx';

// ─── Borders ────────────────────────────────────────────────

const THIN_BORDERS: ITableBordersOptions = {
  top: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
  left: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
  right: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
  insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
};

// ─── Cell / Row helpers ─────────────────────────────────────

export function cell(text: string, opts?: { bold?: boolean; size?: number; shade?: boolean; alignment?: typeof AlignmentType[keyof typeof AlignmentType] }): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        alignment: opts?.alignment,
        children: [new TextRun({ text, bold: opts?.bold ?? false, size: opts?.size ?? 20, font: 'Calibri' })],
      }),
    ],
    shading: opts?.shade ? { type: ShadingType.SOLID, color: 'E8E8E8', fill: 'E8E8E8' } : undefined,
  });
}

export function headerCell(text: string): TableCell {
  return cell(text, { bold: true, shade: true, size: 20 });
}

export function labelValueRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      cell(label, { bold: true, shade: true }),
      cell(value || '—'),
    ],
  });
}

// ─── Tables ─────────────────────────────────────────────────

export function borderedTable(headerRow: TableRow, dataRows: TableRow[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: THIN_BORDERS,
    rows: [headerRow, ...dataRows],
  });
}

export function twoColTable(rows: TableRow[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: THIN_BORDERS,
    rows,
  });
}

// ─── Company Letterhead ─────────────────────────────────────

interface CompanyInfo {
  legalName: string;
  taxId?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  email?: string | null;
}

export function companyLetterhead(company: CompanyInfo): Paragraph[] {
  const lines: string[] = [company.legalName];
  if (company.taxId) lines.push(`ΑΦΜ: ${company.taxId}`);
  const addr = [company.address, company.city, company.postalCode].filter(Boolean).join(', ');
  if (addr) lines.push(addr);
  const contact = [company.phone, company.email].filter(Boolean).join(' | ');
  if (contact) lines.push(contact);

  return lines.map((line, i) => new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: i === 0 ? 40 : 20 },
    children: [new TextRun({
      text: line,
      bold: i === 0,
      size: i === 0 ? 24 : 18,
      font: 'Calibri',
      color: i === 0 ? '1F4E79' : '555555',
    })],
  }));
}

// ─── Signature Block ────────────────────────────────────────

interface SignatureInfo {
  legalRepName?: string | null;
  legalRepTitle?: string | null;
  city?: string | null;
}

export function signatureBlock(info: SignatureInfo): Paragraph[] {
  const today = new Date().toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const place = info.city || 'Αθήνα';

  return [
    new Paragraph({ spacing: { before: 600 }, children: [] }),
    new Paragraph({
      children: [new TextRun({ text: `${place}, ${today}`, size: 20, font: 'Calibri' })],
    }),
    new Paragraph({ spacing: { before: 400 }, children: [] }),
    new Paragraph({
      children: [new TextRun({ text: info.legalRepName || '________________', size: 20, font: 'Calibri', bold: true })],
    }),
    ...(info.legalRepTitle ? [new Paragraph({
      children: [new TextRun({ text: info.legalRepTitle, size: 18, font: 'Calibri', color: '555555' })],
    })] : []),
    new Paragraph({
      children: [new TextRun({ text: '(Υπογραφή & Σφραγίδα)', size: 16, font: 'Calibri', color: '999999', italics: true })],
    }),
  ];
}

// ─── Section Header ─────────────────────────────────────────

export function sectionTitle(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true, size: 24, color: '1F4E79', font: 'Calibri' })],
    spacing: { before: 300, after: 120 },
  });
}

// ─── Centered Title ─────────────────────────────────────────

export function centeredTitle(text: string, size = 28): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, size, font: 'Calibri', color: '1F4E79' })],
  });
}

export function centeredSubtitle(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text, size: 20, font: 'Calibri', color: '555555' })],
  });
}

// ─── Simple Paragraph ───────────────────────────────────────

export function paragraph(text: string, opts?: { bold?: boolean; spacing?: number }): Paragraph {
  return new Paragraph({
    spacing: { after: opts?.spacing ?? 120 },
    children: [new TextRun({ text, bold: opts?.bold, size: 20, font: 'Calibri' })],
  });
}

// ─── Markdown → DOCX ────────────────────────────────────────

export function markdownToDocxElements(markdown: string): Paragraph[] {
  if (!markdown) return [paragraph('(Κενό περιεχόμενο)')];

  const lines = markdown.split('\n');
  const elements: Paragraph[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Headings
    if (trimmed.startsWith('### ')) {
      elements.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: trimmed.slice(4), bold: true, size: 22, font: 'Calibri' })],
        spacing: { before: 200, after: 80 },
      }));
    } else if (trimmed.startsWith('## ')) {
      elements.push(sectionTitle(trimmed.slice(3)));
    } else if (trimmed.startsWith('# ')) {
      elements.push(centeredTitle(trimmed.slice(2)));
    }
    // Bullet lists
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const text = trimmed.slice(2);
      elements.push(new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: parseBoldItalic(text), size: 20, font: 'Calibri' })],
        spacing: { after: 40 },
      }));
    }
    // Numbered lists
    else if (/^\d+\.\s/.test(trimmed)) {
      const text = trimmed.replace(/^\d+\.\s/, '');
      elements.push(new Paragraph({
        numbering: { reference: 'default-numbering', level: 0 },
        children: [new TextRun({ text: parseBoldItalic(text), size: 20, font: 'Calibri' })],
        spacing: { after: 40 },
      }));
    }
    // Horizontal rule / separator
    else if (trimmed === '---' || trimmed === '***') {
      elements.push(new Paragraph({ spacing: { before: 200, after: 200 }, children: [] }));
    }
    // Regular paragraph
    else {
      elements.push(paragraph(parseBoldItalic(trimmed)));
    }
  }

  return elements;
}

// Strip markdown bold/italic markers (simple — returns plain text)
function parseBoldItalic(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/services/document-docx-helpers.ts
git commit -m "feat(docs): add shared DOCX helpers (letterhead, signature, tables, markdown converter)"
```

---

## Task 3: Per-Type DOCX Builders

**Files:**
- Create: `src/server/services/document-docx.ts`

- [ ] **Step 1: Create the main DOCX builder service**

This file contains:
1. Per-type builder functions
2. The main `exportDocx` function that routes by type
3. File naming logic

```typescript
import { Document, Packer, Paragraph, TextRun, TableRow, AlignmentType, HeadingLevel } from 'docx';
import { db } from '@/lib/db';
import { uploadFile, getFileUrl } from '@/lib/s3';
import {
  companyLetterhead, signatureBlock, sectionTitle, centeredTitle, centeredSubtitle,
  paragraph, cell, headerCell, borderedTable, twoColTable, labelValueRow,
  markdownToDocxElements,
} from './document-docx-helpers';

// ─── Types ──────────────────────────────────────────────────

type CompanyProfile = NonNullable<Awaited<ReturnType<typeof db.companyProfile.findUnique>>>;
type Tender = Awaited<ReturnType<typeof db.tender.findUniqueOrThrow>>;
type Project = Awaited<ReturnType<typeof db.project.findFirst>>;

interface ExportResult {
  downloadUrl: string;
  fileName: string;
}

// ─── File Naming ────────────────────────────────────────────

const DOC_TYPE_NAMES: Record<string, string> = {
  SOLEMN_DECLARATION: 'ΥΔ_Ν1599',
  NON_EXCLUSION_DECLARATION: 'Δήλωση_Μη_Αποκλεισμού',
  TECHNICAL_COMPLIANCE: 'Τεχνική_Συμμόρφωση',
  TECHNICAL_PROPOSAL: 'Τεχνική_Προσφορά',
  METHODOLOGY: 'Μεθοδολογία',
  COVER_LETTER: 'Συνοδευτική_Επιστολή',
  COMPANY_EXPERIENCE_TABLE: 'Πίνακας_Εμπειρίας',
  OTHER: 'Έγγραφο',
  ESPD: 'ΕΕΕΣ',
};

function getFileName(docType: string, tender: Tender): string {
  const typeName = DOC_TYPE_NAMES[docType] || 'Έγγραφο';
  const ref = tender.referenceNumber || tender.title.slice(0, 20).replace(/\s+/g, '_');
  const safeRef = ref.replace(/[^a-zA-Z0-9_\u0370-\u03FF-]/g, '_');
  if (docType === 'COMPANY_EXPERIENCE_TABLE') return `${typeName}.docx`;
  return `${typeName}_${safeRef}.docx`;
}

// ─── Builder: Υπεύθυνη Δήλωση (Ν.1599/86) ─────────────────

function buildSolemnDeclaration(company: CompanyProfile, tender: Tender, content: string): Document {
  return new Document({
    sections: [{
      children: [
        centeredTitle('ΥΠΕΥΘΥΝΗ ΔΗΛΩΣΗ', 32),
        centeredSubtitle('(άρθρο 8 Ν.1599/1986)'),
        new Paragraph({ spacing: { after: 200 }, children: [] }),
        twoColTable([
          labelValueRow('Επωνυμία', company.legalName),
          labelValueRow('ΑΦΜ', company.taxId || '—'),
          labelValueRow('ΔΟΥ', company.taxOffice || '—'),
          labelValueRow('Διεύθυνση', [company.address, company.city, company.postalCode].filter(Boolean).join(', ') || '—'),
          labelValueRow('Νόμιμος Εκπρόσωπος', company.legalRepName || '—'),
          labelValueRow('Αρ. Ταυτότητας', company.legalRepIdNumber || '—'),
        ]),
        new Paragraph({ spacing: { before: 300, after: 100 }, children: [] }),
        paragraph(`Ως νόμιμος εκπρόσωπος της εταιρείας «${company.legalName}», δηλώνω ότι:`, { bold: true }),
        new Paragraph({ spacing: { after: 100 }, children: [] }),
        ...markdownToDocxElements(content),
        ...signatureBlock({ legalRepName: company.legalRepName, legalRepTitle: company.legalRepTitle, city: company.city }),
      ],
    }],
  });
}

// ─── Builder: Δήλωση Μη Αποκλεισμού ────────────────────────

function buildNonExclusionDeclaration(company: CompanyProfile, tender: Tender, content: string): Document {
  return new Document({
    sections: [{
      children: [
        ...companyLetterhead(company),
        new Paragraph({ spacing: { before: 300 }, children: [] }),
        centeredTitle('ΔΗΛΩΣΗ ΜΗ ΑΠΟΚΛΕΙΣΜΟΥ'),
        centeredSubtitle(`(Άρθρα 73-74 Ν.4412/2016)`),
        new Paragraph({ spacing: { after: 100 }, children: [] }),
        paragraph(`Αφορά: ${tender.title}`),
        paragraph(`Αρ. Διακήρυξης: ${tender.referenceNumber || '—'}`),
        new Paragraph({ spacing: { after: 200 }, children: [] }),
        ...markdownToDocxElements(content),
        ...signatureBlock({ legalRepName: company.legalRepName, legalRepTitle: company.legalRepTitle, city: company.city }),
      ],
    }],
  });
}

// ─── Builder: Συνοδευτική Επιστολή ──────────────────────────

function buildCoverLetter(company: CompanyProfile, tender: Tender, content: string): Document {
  return new Document({
    sections: [{
      children: [
        ...companyLetterhead(company),
        new Paragraph({ spacing: { before: 400 }, children: [] }),
        paragraph(`Προς: ${tender.contractingAuthority || '(Αναθέτουσα Αρχή)'}`, { bold: true }),
        new Paragraph({ spacing: { after: 200 }, children: [] }),
        paragraph(`Θέμα: ${tender.title}`, { bold: true }),
        paragraph(`Αρ. Διακήρυξης: ${tender.referenceNumber || '—'}`),
        new Paragraph({ spacing: { after: 300 }, children: [] }),
        ...markdownToDocxElements(content),
        ...signatureBlock({ legalRepName: company.legalRepName, legalRepTitle: company.legalRepTitle, city: company.city }),
      ],
    }],
  });
}

// ─── Builder: Πίνακας Εμπειρίας ────────────────────────────

function buildExperienceTable(projects: Project[]): Document {
  const headerRow = new TableRow({
    children: ['Α/Α', 'Τίτλος Έργου', 'Κύριος Έργου', 'Προϋπολογισμός', 'Περίοδος', 'Κατηγορία'].map((h) => headerCell(h)),
  });

  const dataRows = projects.map((p, i) => {
    const period = [
      p.startDate ? new Date(p.startDate).getFullYear() : '',
      p.endDate ? new Date(p.endDate).getFullYear() : 'σήμερα',
    ].filter(Boolean).join(' – ');
    const budget = p.contractAmount ? `€${p.contractAmount.toLocaleString('el-GR')}` : '—';

    return new TableRow({
      children: [
        cell(String(i + 1), { alignment: AlignmentType.CENTER }),
        cell(p.title),
        cell(p.client || '—'),
        cell(budget),
        cell(period),
        cell(p.category || '—'),
      ],
    });
  });

  return new Document({
    sections: [{
      children: [
        centeredTitle('ΠΙΝΑΚΑΣ ΕΜΠΕΙΡΙΑΣ ΕΤΑΙΡΕΙΑΣ'),
        new Paragraph({ spacing: { after: 200 }, children: [] }),
        borderedTable(headerRow, dataRows),
        new Paragraph({ spacing: { before: 200 }, children: [] }),
        paragraph(`Σύνολο έργων: ${projects.length}`, { bold: true }),
      ],
    }],
  });
}

// ─── Builder: Technical Compliance (markdown → table) ───────

function buildTechnicalCompliance(content: string): Document {
  return new Document({
    sections: [{
      children: [
        centeredTitle('ΠΙΝΑΚΑΣ ΤΕΧΝΙΚΗΣ ΣΥΜΜΟΡΦΩΣΗΣ'),
        new Paragraph({ spacing: { after: 200 }, children: [] }),
        ...markdownToDocxElements(content),
      ],
    }],
  });
}

// ─── Builder: Technical Proposal / Methodology / Other ──────

function buildGenericReport(title: string, company: CompanyProfile, content: string): Document {
  return new Document({
    sections: [{
      children: [
        ...companyLetterhead(company),
        new Paragraph({ spacing: { before: 300 }, children: [] }),
        centeredTitle(title),
        new Paragraph({ spacing: { after: 200 }, children: [] }),
        ...markdownToDocxElements(content),
      ],
    }],
  });
}

// ─── Main Export Function ───────────────────────────────────

export async function exportGeneratedDocToDocx(
  generatedDocId: string,
  tenantId: string
): Promise<ExportResult> {
  const genDoc = await db.generatedDocument.findUnique({
    where: { id: generatedDocId },
    include: { tender: true },
  });

  if (!genDoc) throw new Error('DOCUMENT_NOT_FOUND');

  const company = await db.companyProfile.findUnique({ where: { tenantId } });
  if (!company) throw new Error('NO_COMPANY_PROFILE');

  let doc: Document;

  switch (genDoc.type) {
    case 'SOLEMN_DECLARATION':
      doc = buildSolemnDeclaration(company, genDoc.tender, genDoc.content);
      break;
    case 'NON_EXCLUSION_DECLARATION':
      doc = buildNonExclusionDeclaration(company, genDoc.tender, genDoc.content);
      break;
    case 'COVER_LETTER':
      doc = buildCoverLetter(company, genDoc.tender, genDoc.content);
      break;
    case 'COMPANY_EXPERIENCE_TABLE': {
      const projects = await db.project.findMany({
        where: { tenantId },
        orderBy: { startDate: 'desc' },
      });
      doc = buildExperienceTable(projects);
      break;
    }
    case 'TECHNICAL_COMPLIANCE':
      doc = buildTechnicalCompliance(genDoc.content);
      break;
    default:
      doc = buildGenericReport(genDoc.title, company, genDoc.content);
      break;
  }

  const buffer = await Packer.toBuffer(doc);
  const fileName = getFileName(genDoc.type, genDoc.tender);
  const key = `exports/${tenantId}/${Date.now()}_${fileName}`;

  await uploadFile(key, Buffer.from(buffer), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

  // Update GeneratedDocument with file reference
  await db.generatedDocument.update({
    where: { id: generatedDocId },
    data: { fileKey: key, fileName },
  });

  const downloadUrl = await getFileUrl(key);
  return { downloadUrl, fileName };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/services/document-docx.ts
git commit -m "feat(docs): add per-type DOCX builders and export function"
```

---

## Task 4: Generation Endpoints (Cover Letter + Experience Table)

**Files:**
- Modify: `src/server/services/document-generator.ts`
- Modify: `src/server/routers/document.ts`

- [ ] **Step 1: Add generateCoverLetter to document-generator.ts**

Add a new method to the `DocumentGenerator` class:

```typescript
async generateCoverLetter(tenderId: string, tenantId: string): Promise<string> {
  const { company, tender } = await this.loadContext(tenderId, tenantId);

  // Load requirements grouped by envelope for the enclosed docs list
  const requirements = await db.tenderRequirement.findMany({
    where: { tenderId },
    orderBy: { category: 'asc' },
  });

  const envelopeA = requirements.filter((r) => ['PARTICIPATION_CRITERIA', 'EXCLUSION_CRITERIA', 'DOCUMENTATION_REQUIREMENTS'].includes(r.category));
  const envelopeB = requirements.filter((r) => ['TECHNICAL_REQUIREMENTS'].includes(r.category));
  const envelopeC = requirements.filter((r) => ['FINANCIAL_REQUIREMENTS'].includes(r.category));

  const enclosedList = [
    envelopeA.length > 0 ? `**Φάκελος Δικαιολογητικών Συμμετοχής (Α)**\n${envelopeA.map((r, i) => `${i + 1}. ${r.text.slice(0, 100)}`).join('\n')}` : '',
    envelopeB.length > 0 ? `**Φάκελος Τεχνικής Προσφοράς (Β)**\n${envelopeB.map((r, i) => `${i + 1}. ${r.text.slice(0, 100)}`).join('\n')}` : '',
    envelopeC.length > 0 ? `**Φάκελος Οικονομικής Προσφοράς (Γ)**\n${envelopeC.map((r, i) => `${i + 1}. ${r.text.slice(0, 100)}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n');

  const content = `Αξιότιμοι,

Σε απάντηση της Διακήρυξης με αρ. ${tender.referenceNumber || '—'} για το έργο «${tender.title}», σας υποβάλλουμε τα ακόλουθα δικαιολογητικά και έγγραφα:

${enclosedList}

Παραμένουμε στη διάθεσή σας για οποιαδήποτε διευκρίνιση.

Με εκτίμηση`;

  const doc = await db.generatedDocument.create({
    data: {
      tenderId,
      type: 'COVER_LETTER',
      title: 'Συνοδευτική Επιστολή',
      content,
      status: 'DRAFT',
    },
  });

  await this.logActivity(tenderId, 'Δημιουργήθηκε Συνοδευτική Επιστολή');
  return doc.id;
}
```

- [ ] **Step 2: Add generateExperienceTable to document-generator.ts**

```typescript
async generateExperienceTable(tenderId: string, tenantId: string): Promise<string> {
  const projects = await db.project.findMany({
    where: { tenantId },
    orderBy: { startDate: 'desc' },
  });

  let content: string;
  if (projects.length === 0) {
    content = 'Δεν υπάρχουν καταχωρημένα έργα εμπειρίας.';
  } else {
    const rows = projects.map((p, i) => {
      const period = [
        p.startDate ? new Date(p.startDate).getFullYear() : '',
        p.endDate ? new Date(p.endDate).getFullYear() : 'σήμερα',
      ].filter(Boolean).join(' – ');
      const budget = p.contractAmount ? `€${p.contractAmount.toLocaleString('el-GR')}` : '—';
      return `| ${i + 1} | ${p.title} | ${p.client || '—'} | ${budget} | ${period} | ${p.category || '—'} |`;
    });

    content = `| Α/Α | Τίτλος Έργου | Κύριος Έργου | Προϋπολογισμός | Περίοδος | Κατηγορία |\n|-----|-------------|-------------|---------------|---------|----------|\n${rows.join('\n')}\n\nΣύνολο έργων: ${projects.length}`;
  }

  const doc = await db.generatedDocument.create({
    data: {
      tenderId,
      type: 'COMPANY_EXPERIENCE_TABLE',
      title: 'Πίνακας Εμπειρίας Εταιρείας',
      content,
      status: 'DRAFT',
    },
  });

  await this.logActivity(tenderId, `Δημιουργήθηκε Πίνακας Εμπειρίας (${projects.length} έργα)`);
  return doc.id;
}
```

- [ ] **Step 3: Add tRPC endpoints in document router**

In `src/server/routers/document.ts`, add:

```typescript
import { exportGeneratedDocToDocx } from '@/server/services/document-docx';
```

Add these endpoints:

```typescript
exportDocx: protectedProcedure
  .input(z.object({ generatedDocId: z.string().cuid() }))
  .mutation(async ({ ctx, input }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
    }
    try {
      return await exportGeneratedDocToDocx(input.generatedDocId, ctx.tenantId);
    } catch (err: any) {
      if (err.message === 'DOCUMENT_NOT_FOUND') {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found.' });
      }
      if (err.message === 'NO_COMPANY_PROFILE') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Company profile required.' });
      }
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DOCX export failed.' });
    }
  }),

generateCoverLetter: protectedProcedure
  .input(z.object({ tenderId: z.string().cuid() }))
  .mutation(async ({ ctx, input }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
    }
    return documentGenerator.generateCoverLetter(input.tenderId, ctx.tenantId);
  }),

generateExperienceTable: protectedProcedure
  .input(z.object({ tenderId: z.string().cuid() }))
  .mutation(async ({ ctx, input }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
    }
    return documentGenerator.generateExperienceTable(input.tenderId, ctx.tenantId);
  }),
```

Note: Check how `documentGenerator` is instantiated in the file — it may be `new DocumentGenerator()` or a singleton. Follow the existing pattern.

- [ ] **Step 4: Commit**

```bash
git add src/server/services/document-generator.ts src/server/routers/document.ts
git commit -m "feat(docs): add cover letter and experience table generation + DOCX export endpoint"
```

---

## Task 5: i18n Translations

**Files:**
- Modify: `messages/el.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Add Greek translations**

Find the `tender` or existing documents-related section in `messages/el.json` and add:

```json
"documentTemplates": {
  "exportDocx": "Κατέβασε DOCX",
  "exporting": "Δημιουργία εγγράφου...",
  "exportReady": "Το έγγραφο είναι έτοιμο.",
  "exportFailed": "Η εξαγωγή απέτυχε.",
  "noCompanyProfile": "Συμπληρώστε πρώτα το εταιρικό προφίλ.",
  "coverLetter": "Συνοδευτική Επιστολή",
  "experienceTable": "Πίνακας Εμπειρίας",
  "generating": "Δημιουργία..."
}
```

- [ ] **Step 2: Add English translations**

```json
"documentTemplates": {
  "exportDocx": "Download DOCX",
  "exporting": "Generating document...",
  "exportReady": "Document ready.",
  "exportFailed": "Export failed.",
  "noCompanyProfile": "Complete company profile first.",
  "coverLetter": "Cover Letter",
  "experienceTable": "Experience Table",
  "generating": "Generating..."
}
```

- [ ] **Step 3: Commit**

```bash
git add messages/el.json messages/en.json
git commit -m "feat(i18n): add document template translations"
```

---

## Task 6: UI — DOCX Button + New Generation Types

**Files:**
- Modify: `src/components/tender/documents-tab.tsx`

- [ ] **Step 1: Add new document types to generation dropdown**

Find the `generatedDocTypes` array and add:

```typescript
{ type: 'COVER_LETTER' as const, label: t('documentTemplates.coverLetter'), icon: Mail },
{ type: 'COMPANY_EXPERIENCE_TABLE' as const, label: t('documentTemplates.experienceTable'), icon: TableProperties },
```

Import `Mail` and `TableProperties` from lucide-react.

For COVER_LETTER and COMPANY_EXPERIENCE_TABLE, the dropdown onClick should call the dedicated generation endpoints instead of the generic `createGenerated`:

```typescript
onClick={() => {
  if (dt.type === 'COVER_LETTER') {
    generateCoverLetterMutation.mutate({ tenderId });
  } else if (dt.type === 'COMPANY_EXPERIENCE_TABLE') {
    generateExperienceTableMutation.mutate({ tenderId });
  } else {
    generateMutation.mutate({ tenderId, type: dt.type, title: dt.label, content: '', status: 'DRAFT' });
  }
}}
```

Add the mutations:

```typescript
const generateCoverLetterMutation = trpc.document.generateCoverLetter.useMutation({
  onSuccess: () => { generatedDocsQuery.refetch(); toast({ title: t('common.success') }); },
  onError: (err) => { toast({ title: t('common.error'), description: err.message, variant: 'destructive' }); },
});

const generateExperienceTableMutation = trpc.document.generateExperienceTable.useMutation({
  onSuccess: () => { generatedDocsQuery.refetch(); toast({ title: t('common.success') }); },
  onError: (err) => { toast({ title: t('common.error'), description: err.message, variant: 'destructive' }); },
});
```

- [ ] **Step 2: Add DOCX export button to each generated document card**

Find the generated document card actions section. Add a DOCX button for every document except ESPD:

```typescript
const exportDocxMutation = trpc.document.exportDocx.useMutation({
  onSuccess: (data) => {
    window.open(data.downloadUrl, '_blank');
    toast({ title: t('common.success'), description: t('documentTemplates.exportReady') });
  },
  onError: (err) => {
    const msg = err.message.includes('Company profile')
      ? t('documentTemplates.noCompanyProfile')
      : t('documentTemplates.exportFailed');
    toast({ title: t('common.error'), description: msg, variant: 'destructive' });
  },
});
```

In the card actions, add (skip for ESPD type):

```typescript
{doc.type !== 'ESPD' && (
  <Button
    size="icon"
    variant="ghost"
    className="h-8 w-8 cursor-pointer"
    title={t('documentTemplates.exportDocx')}
    onClick={() => exportDocxMutation.mutate({ generatedDocId: doc.id })}
    disabled={exportDocxMutation.isPending}
  >
    <FileDown className="h-4 w-4" />
  </Button>
)}
```

Import `FileDown` from lucide-react.

- [ ] **Step 3: Commit**

```bash
git add src/components/tender/documents-tab.tsx
git commit -m "feat(docs): add DOCX export button and new generation types to documents tab"
```

---

## Task 7: Build Verification

**Files:** All from previous tasks

- [ ] **Step 1: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(docs): integration fixes from build verification"
```

---

## Dependency Graph

```
Task 1 (Schema)
  ↓
Task 2 (DOCX Helpers) ←── Task 3 (DOCX Builders) [sequential]
  ↓
Task 4 (Generation Endpoints) ←── depends on Task 1 + Task 3
  ↓
Task 5 (i18n) [parallel with Task 4]
  ↓
Task 6 (UI) ←── depends on Task 4 + Task 5
  ↓
Task 7 (Build Verification)
```

Tasks 2 and 5 can run in parallel with other tasks.
All other tasks are sequential.
