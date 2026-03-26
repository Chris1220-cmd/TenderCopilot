import {
  Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, HeadingLevel, BorderStyle,
  ShadingType, type ITableBordersOptions,
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

export function cell(
  text: string,
  opts?: { bold?: boolean; size?: number; shade?: boolean; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType] }
): TableCell {
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
        children: parseInlineFormatting(text),
        spacing: { after: 40 },
      }));
    }
    // Numbered lists
    else if (/^\d+\.\s/.test(trimmed)) {
      const text = trimmed.replace(/^\d+\.\s/, '');
      elements.push(new Paragraph({
        numbering: { reference: 'default-numbering', level: 0 },
        children: parseInlineFormatting(text),
        spacing: { after: 40 },
      }));
    }
    // Markdown table rows — skip header separator
    else if (/^\|[\s-:|]+\|$/.test(trimmed)) {
      continue;
    }
    // Markdown table data row
    else if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Collect as simple paragraph (tables are handled at a higher level)
      const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());
      elements.push(paragraph(cells.join('  |  ')));
    }
    // Horizontal rule / separator
    else if (trimmed === '---' || trimmed === '***') {
      elements.push(new Paragraph({ spacing: { before: 200, after: 200 }, children: [] }));
    }
    // Regular paragraph
    else {
      elements.push(new Paragraph({
        spacing: { after: 120 },
        children: parseInlineFormatting(trimmed),
      }));
    }
  }

  return elements;
}

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      // Bold
      runs.push(new TextRun({ text: match[2], bold: true, size: 20, font: 'Calibri' }));
    } else if (match[3]) {
      // Italic
      runs.push(new TextRun({ text: match[3], italics: true, size: 20, font: 'Calibri' }));
    } else if (match[4]) {
      // Plain
      runs.push(new TextRun({ text: match[4], size: 20, font: 'Calibri' }));
    }
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text, size: 20, font: 'Calibri' }));
  }

  return runs;
}
