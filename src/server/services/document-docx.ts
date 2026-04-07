import { Document, Packer, Paragraph, TextRun, TableRow, AlignmentType } from 'docx';
import { db } from '@/lib/db';
import { uploadFile, getFileUrl } from '@/lib/s3';
import {
  companyLetterhead, signatureBlock, centeredTitle, centeredSubtitle,
  paragraph, cell, headerCell, borderedTable, twoColTable, labelValueRow,
  markdownToDocxElements,
} from './document-docx-helpers';

// ─── Types ──────────────────────────────────────────────────

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

function getFileName(docType: string, tenderRef: string | null, tenderTitle: string): string {
  const typeName = DOC_TYPE_NAMES[docType] || 'Έγγραφο';
  if (docType === 'COMPANY_EXPERIENCE_TABLE') return `${typeName}.docx`;
  const ref = tenderRef || tenderTitle.slice(0, 20).replace(/\s+/g, '_');
  const safeRef = ref.replace(/[^a-zA-Z0-9_\u0370-\u03FF-]/g, '_');
  return `${typeName}_${safeRef}.docx`;
}

// ─── Builder: Υπεύθυνη Δήλωση (Ν.1599/86) ─────────────────

function buildSolemnDeclaration(company: any, tender: any, content: string): Document {
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

function buildNonExclusionDeclaration(company: any, tender: any, content: string): Document {
  return new Document({
    sections: [{
      children: [
        ...companyLetterhead(company),
        new Paragraph({ spacing: { before: 300 }, children: [] }),
        centeredTitle('ΔΗΛΩΣΗ ΜΗ ΑΠΟΚΛΕΙΣΜΟΥ'),
        centeredSubtitle('(Άρθρα 73-74 Ν.4412/2016)'),
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

function buildCoverLetter(company: any, tender: any, content: string): Document {
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

function buildExperienceTable(projects: any[]): Document {
  const headerRow = new TableRow({
    children: ['Α/Α', 'Τίτλος Έργου', 'Κύριος Έργου', 'Προϋπολογισμός', 'Περίοδος', 'Κατηγορία'].map((h) => headerCell(h)),
  });

  const dataRows = projects.length > 0
    ? projects.map((p, i) => {
        const period = [
          p.startDate ? new Date(p.startDate).getFullYear() : '',
          p.endDate ? new Date(p.endDate).getFullYear() : 'σήμερα',
        ].filter(Boolean).join(' – ');
        const budget = p.contractAmount ? `€${Number(p.contractAmount).toLocaleString('el-GR')}` : '—';

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
      })
    : [new TableRow({
        children: [cell('Δεν υπάρχουν καταχωρημένα έργα', { alignment: AlignmentType.CENTER })],
      })];

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

// ─── Builder: Generic Report (Proposal / Methodology / Other)

function buildGenericReport(title: string, company: any, content: string): Document {
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

  const company = await db.companyProfile.findFirst({ where: { tenantId } });
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
  const fileName = getFileName(genDoc.type, genDoc.tender.referenceNumber, genDoc.tender.title);
  const key = `exports/${tenantId}/${Date.now()}_${fileName}`;

  await uploadFile(key, Buffer.from(buffer), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

  await db.generatedDocument.update({
    where: { id: generatedDocId },
    data: { fileKey: key, fileName },
  });

  const downloadUrl = await getFileUrl(key);
  return { downloadUrl, fileName };
}
