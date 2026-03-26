import JSZip from 'jszip';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  TableBorders,
  ShadingType,
} from 'docx';
import { db } from '@/lib/db';
import { uploadFile, getFileUrl } from '@/lib/s3';
import type { CvTemplateId } from '@/lib/cv-templates';

// ─── Types ────────────────────────────────────────────────────

type MemberWithDetails = {
  id: string;
  fullName: string;
  title: string;
  email: string | null;
  phone: string | null;
  totalExperience: number;
  bio: string | null;
  education: Array<{
    degree: string;
    institution: string;
    year: number | null;
  }>;
  experience: Array<{
    projectName: string;
    client: string;
    role: string;
    startYear: number;
    endYear: number | null;
    description: string | null;
  }>;
  certifications: Array<{
    name: string;
    issuer: string;
    issueDate: Date | null;
    expiryDate: Date | null;
  }>;
  requirementRole: string;
};

// ─── Helpers ──────────────────────────────────────────────────

function cellText(text: string, options?: { bold?: boolean; size?: number; shade?: boolean }): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: options?.bold ?? false,
            size: options?.size ?? 20,
          }),
        ],
      }),
    ],
    shading: options?.shade
      ? { type: ShadingType.SOLID, color: 'E8E8E8', fill: 'E8E8E8' }
      : undefined,
  });
}

function labelValueRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      cellText(label, { bold: true, shade: true }),
      cellText(value || '—'),
    ],
  });
}

function sectionHeader(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [
      new TextRun({
        text,
        bold: true,
        size: 24,
        color: '1F4E79',
      }),
    ],
    spacing: { before: 240, after: 120 },
  });
}

function twoColTable(rows: TableRow[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TableBorders.NONE,
    rows,
    columnWidths: [2000, 6500],
  });
}

function borderTable(headers: string[], rows: string[][]): Table {
  const borderOpts = {
    top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  };

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h) =>
      new TableCell({
        children: [
          new Paragraph({
            children: [new TextRun({ text: h, bold: true, size: 18, color: 'FFFFFF' })],
            alignment: AlignmentType.CENTER,
          }),
        ],
        shading: { type: ShadingType.SOLID, color: '2E74B5', fill: '2E74B5' },
      })
    ),
  });

  const dataRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map((cell) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: cell || '—', size: 18 })],
              }),
            ],
          })
        ),
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderOpts as any,
    rows: [headerRow, ...dataRows],
  });
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('el-GR', { year: 'numeric', month: '2-digit' });
}

// ─── Template Builders ────────────────────────────────────────

export function buildEuropassCv(member: MemberWithDetails): Document {
  const children: (Paragraph | Table)[] = [];

  // Title block
  children.push(
    new Paragraph({
      children: [new TextRun({ text: member.fullName, bold: true, size: 48, color: '1F4E79' })],
      alignment: AlignmentType.LEFT,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: member.title, size: 28, color: '595959' })],
      spacing: { after: 240 },
    })
  );

  // Personal Information
  children.push(sectionHeader('PERSONAL INFORMATION'));
  children.push(
    twoColTable([
      labelValueRow('Email', member.email ?? ''),
      labelValueRow('Phone', member.phone ?? ''),
      labelValueRow('Years of Experience', String(member.totalExperience)),
    ])
  );

  if (member.bio) {
    children.push(
      new Paragraph({ spacing: { before: 160, after: 80 } }),
      new Paragraph({
        children: [new TextRun({ text: member.bio, size: 20, italics: true })],
      })
    );
  }

  // Education
  children.push(sectionHeader('EDUCATION'));
  if (member.education.length > 0) {
    children.push(
      borderTable(
        ['Degree', 'Institution', 'Year'],
        member.education.map((e) => [e.degree, e.institution, e.year ? String(e.year) : '—'])
      )
    );
  } else {
    children.push(new Paragraph({ children: [new TextRun({ text: '—', size: 20 })] }));
  }

  // Project Experience
  children.push(sectionHeader('PROJECT EXPERIENCE'));
  if (member.experience.length > 0) {
    children.push(
      borderTable(
        ['Project', 'Client', 'Role', 'Period', 'Description'],
        member.experience.map((e) => [
          e.projectName,
          e.client,
          e.role,
          `${e.startYear}–${e.endYear ?? 'Present'}`,
          e.description ?? '',
        ])
      )
    );
  } else {
    children.push(new Paragraph({ children: [new TextRun({ text: '—', size: 20 })] }));
  }

  // Certifications
  children.push(sectionHeader('CERTIFICATIONS'));
  if (member.certifications.length > 0) {
    children.push(
      borderTable(
        ['Certification', 'Issuer', 'Issue Date', 'Expiry Date'],
        member.certifications.map((c) => [
          c.name,
          c.issuer,
          formatDate(c.issueDate),
          formatDate(c.expiryDate),
        ])
      )
    );
  } else {
    children.push(new Paragraph({ children: [new TextRun({ text: '—', size: 20 })] }));
  }

  return new Document({
    sections: [
      {
        children,
      },
    ],
  });
}

export function buildGreekPublicCv(member: MemberWithDetails): Document {
  const children: (Paragraph | Table)[] = [];

  // Header
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'ΒΙΟΓΡΑΦΙΚΟ ΣΗΜΕΙΩΜΑ', bold: true, size: 48, color: '1F4E79' }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
    }),
    new Paragraph({
      children: [new TextRun({ text: member.fullName, bold: true, size: 36 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: member.title, size: 24, color: '595959' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 320 },
    })
  );

  // Στοιχεία επικοινωνίας
  children.push(sectionHeader('ΣΤΟΙΧΕΙΑ ΕΠΙΚΟΙΝΩΝΙΑΣ'));
  children.push(
    twoColTable([
      labelValueRow('Email:', member.email ?? ''),
      labelValueRow('Τηλέφωνο:', member.phone ?? ''),
      labelValueRow('Συνολική Εμπειρία:', `${member.totalExperience} έτη`),
    ])
  );

  // Σπουδές
  children.push(sectionHeader('ΣΠΟΥΔΕΣ'));
  if (member.education.length > 0) {
    children.push(
      borderTable(
        ['Τίτλος Σπουδών', 'Ίδρυμα', 'Έτος'],
        member.education.map((e) => [e.degree, e.institution, e.year ? String(e.year) : '—'])
      )
    );
  } else {
    children.push(new Paragraph({ children: [new TextRun({ text: '—', size: 20 })] }));
  }

  // Επαγγελματική Εμπειρία
  children.push(sectionHeader('ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΕΜΠΕΙΡΙΑ'));
  if (member.experience.length > 0) {
    children.push(
      borderTable(
        ['Έργο', 'Φορέας', 'Ρόλος', 'Περίοδος'],
        member.experience.map((e) => [
          e.projectName,
          e.client,
          e.role,
          `${e.startYear}–${e.endYear ?? 'Παρόν'}`,
        ])
      )
    );
  } else {
    children.push(new Paragraph({ children: [new TextRun({ text: '—', size: 20 })] }));
  }

  // Πιστοποιήσεις
  children.push(sectionHeader('ΠΙΣΤΟΠΟΙΗΣΕΙΣ'));
  if (member.certifications.length > 0) {
    children.push(
      borderTable(
        ['Τίτλος', 'Φορέας Έκδοσης', 'Ημ. Έκδοσης', 'Ημ. Λήξης'],
        member.certifications.map((c) => [
          c.name,
          c.issuer,
          formatDate(c.issueDate),
          formatDate(c.expiryDate),
        ])
      )
    );
  } else {
    children.push(new Paragraph({ children: [new TextRun({ text: '—', size: 20 })] }));
  }

  return new Document({
    sections: [
      {
        children,
      },
    ],
  });
}

export function buildSummaryCv(member: MemberWithDetails): Document {
  const children: (Paragraph | Table)[] = [];

  // Name + title
  children.push(
    new Paragraph({
      children: [new TextRun({ text: member.fullName, bold: true, size: 44, color: '1F4E79' })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: member.title, size: 26, color: '595959' })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Experience: ${member.totalExperience} years`, size: 20 }),
        ...(member.email ? [new TextRun({ text: `  |  ${member.email}`, size: 20 })] : []),
        ...(member.phone ? [new TextRun({ text: `  |  ${member.phone}`, size: 20 })] : []),
      ],
      spacing: { after: 240 },
    })
  );

  // Key qualifications
  if (member.bio) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: 'KEY QUALIFICATIONS', bold: true, size: 22 })], spacing: { after: 80 } }),
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: member.bio, size: 20 })],
        spacing: { after: 160 },
      })
    );
  }

  // Education (abbreviated)
  children.push(
    new Paragraph({ children: [new TextRun({ text: 'EDUCATION', bold: true, size: 22 })], spacing: { before: 160, after: 80 } })
  );
  for (const e of member.education) {
    children.push(
      new Paragraph({
        bullet: { level: 0 },
        children: [
          new TextRun({ text: `${e.degree}, `, bold: true, size: 20 }),
          new TextRun({ text: `${e.institution}${e.year ? `, ${e.year}` : ''}`, size: 20 }),
        ],
      })
    );
  }
  if (member.education.length === 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: '—', size: 20 })] }));
  }

  // Top 5 experience entries
  children.push(
    new Paragraph({ children: [new TextRun({ text: 'SELECTED EXPERIENCE', bold: true, size: 22 })], spacing: { before: 160, after: 80 } })
  );
  const topExp = member.experience.slice(0, 5);
  for (const e of topExp) {
    children.push(
      new Paragraph({
        bullet: { level: 0 },
        children: [
          new TextRun({ text: `${e.projectName}`, bold: true, size: 20 }),
          new TextRun({ text: ` — ${e.role}, ${e.client} (${e.startYear}–${e.endYear ?? 'Present'})`, size: 20 }),
        ],
      })
    );
  }
  if (topExp.length === 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: '—', size: 20 })] }));
  }

  // Certifications as comma-separated
  if (member.certifications.length > 0) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: 'CERTIFICATIONS', bold: true, size: 22 })], spacing: { before: 160, after: 80 } }),
      new Paragraph({
        children: [
          new TextRun({
            text: member.certifications.map((c) => c.name).join(', '),
            size: 20,
          }),
        ],
      })
    );
  }

  return new Document({
    sections: [
      {
        children,
      },
    ],
  });
}

export function buildStaffingTable(members: MemberWithDetails[]): Document {
  const borderOpts = {
    top: { style: BorderStyle.SINGLE, size: 1, color: '1F4E79' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: '1F4E79' },
    left: { style: BorderStyle.SINGLE, size: 1, color: '1F4E79' },
    right: { style: BorderStyle.SINGLE, size: 1, color: '1F4E79' },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  };

  const headers = ['Α/Α', 'Ονοματεπώνυμο', 'Ρόλος στο Έργο', 'Ειδικότητα', 'Έτη Εμπειρίας', 'Σπουδές'];

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h) =>
      new TableCell({
        children: [
          new Paragraph({
            children: [new TextRun({ text: h, bold: true, size: 18, color: 'FFFFFF' })],
            alignment: AlignmentType.CENTER,
          }),
        ],
        shading: { type: ShadingType.SOLID, color: '1F4E79', fill: '1F4E79' },
      })
    ),
  });

  const dataRows = members.map((m, idx) => {
    const topEdu = m.education.length > 0
      ? `${m.education[0].degree} (${m.education[0].institution})`
      : '—';

    return new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(idx + 1), size: 18 })], alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: m.fullName, bold: true, size: 18 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: m.requirementRole, size: 18 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: m.title, size: 18 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${m.totalExperience}`, size: 18 })], alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: topEdu, size: 18 })] })] }),
      ],
    });
  });

  return new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'ΠΙΝΑΚΑΣ ΣΤΕΛΕΧΩΣΗΣ ΟΜΑΔΑΣ ΕΡΓΟΥ',
                bold: true,
                size: 36,
                color: '1F4E79',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: borderOpts as any,
            rows: [headerRow, ...dataRows],
          }),
        ],
      },
    ],
  });
}

// ─── Main Export Function ─────────────────────────────────────

export async function exportCvs(
  tenderId: string,
  tenantId: string,
  templateId: CvTemplateId
): Promise<{ downloadUrl: string; fileName: string }> {
  // 1. Fetch all TeamRequirements with assigned members
  const requirements = await db.teamRequirement.findMany({
    where: {
      tenderId,
      tender: { tenantId },
      assignedMemberId: { not: null },
    },
    include: {
      assignedMember: {
        include: {
          education: { orderBy: { year: 'desc' } },
          experience: { orderBy: { startYear: 'desc' } },
          certifications: { orderBy: { name: 'asc' } },
        },
      },
    },
  });

  if (requirements.length === 0) {
    throw new Error('NO_ASSIGNMENTS');
  }

  // Deduplicate members but track their roles
  const memberMap = new Map<string, MemberWithDetails>();
  for (const req of requirements) {
    const m = req.assignedMember!;
    if (!memberMap.has(m.id)) {
      memberMap.set(m.id, {
        id: m.id,
        fullName: m.fullName,
        title: m.title,
        email: m.email,
        phone: m.phone,
        totalExperience: m.totalExperience,
        bio: m.bio,
        education: m.education,
        experience: m.experience,
        certifications: m.certifications,
        requirementRole: req.role,
      });
    }
  }

  const members = Array.from(memberMap.values());

  // 2. Build DOCX for each member
  const zip = new JSZip();

  for (const member of members) {
    let doc: Document;
    switch (templateId) {
      case 'europass':
        doc = buildEuropassCv(member);
        break;
      case 'greekPublic':
        doc = buildGreekPublicCv(member);
        break;
      case 'summary':
        doc = buildSummaryCv(member);
        break;
      default:
        doc = buildEuropassCv(member);
    }

    const buf = await Packer.toBuffer(doc);
    const safeName = member.fullName.replace(/[^a-zA-ZΑ-Ωα-ωάέήίόύώ\s]/g, '').trim().replace(/\s+/g, '_');
    zip.file(`CV_${safeName}.docx`, buf);
  }

  // 3. Staffing table (always included)
  const staffingDoc = buildStaffingTable(members);
  const staffingBuf = await Packer.toBuffer(staffingDoc);
  zip.file('Πίνακας_Στελέχωσης.docx', staffingBuf);

  // 4. Bundle to ZIP
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

  // 5. Upload to S3
  const timestamp = Date.now();
  const fileName = `CVs_Tender_${tenderId}_${timestamp}.zip`;
  const key = `exports/cvs/${tenderId}/${fileName}`;

  await uploadFile(key, zipBuffer as Buffer, 'application/zip');

  // 6. Get download URL
  const downloadUrl = await getFileUrl(key);

  return { downloadUrl, fileName };
}
