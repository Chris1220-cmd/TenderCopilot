import { db } from '@/lib/db';
import { ai } from '@/server/ai';
import { parseAIResponse } from './ai-prompts';
import type { DocumentGenerationRequest, GeneratedDocumentResult } from '@/server/ai/types';
import type { GeneratedDocType } from '@prisma/client';

/**
 * Service for AI-powered document generation.
 * Generates Greek legal documents, compliance tables, and technical proposals.
 */
export class DocumentGeneratorService {
  /**
   * Generate a solemn declaration (Υπεύθυνη Δήλωση Ν. 1599/1986)
   */
  async generateSolemnDeclaration(
    tenderId: string,
    tenantId: string,
    requirementTexts: string[]
  ): Promise<string> {
    const { company, tender } = await this.loadContext(tenderId, tenantId);

    const result = await ai().complete({
      messages: [
        {
          role: 'system',
          content: `Είσαι ειδικός νομικός σύμβουλος στους δημόσιους διαγωνισμούς. Παράγεις υπεύθυνες δηλώσεις σύμφωνα με τον Ν.1599/1986.
Χρησιμοποίησε τα στοιχεία εταιρείας και τις απαιτήσεις για να παράξεις πλήρη υπεύθυνη δήλωση.
Απάντησε ΜΟΝΟ σε JSON format: { "title": "...", "content": "..." (markdown), "sections": [...] }`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            type: 'solemn_declaration',
            tenderTitle: tender.title,
            tenderReference: tender.referenceNumber ?? undefined,
            contractingAuthority: tender.contractingAuthority ?? undefined,
            companyName: company?.legalName || '',
            companyTaxId: company?.taxId || '',
            legalRepName: company?.legalRepName || '',
            legalRepTitle: company?.legalRepTitle || '',
            requirements: requirementTexts.map((t) => ({ text: t, category: 'DECLARATION' })),
          } satisfies DocumentGenerationRequest),
        },
      ],
      maxTokens: 2000,
      temperature: 0.3,
      responseFormat: 'json',
    });

    const generated = parseAIResponse<GeneratedDocumentResult>(result.content, [], 'generateSolemnDeclaration');

    // Save to DB
    const doc = await db.generatedDocument.create({
      data: {
        tenderId,
        type: 'SOLEMN_DECLARATION',
        title: generated.title,
        content: generated.content,
        status: 'DRAFT',
      },
    });

    await this.logActivity(tenderId, `Δημιουργήθηκε Υπεύθυνη Δήλωση: "${generated.title}"`);

    return doc.id;
  }

  /**
   * Generate non-exclusion declaration
   */
  async generateNonExclusionDeclaration(
    tenderId: string,
    tenantId: string
  ): Promise<string> {
    const { company, tender } = await this.loadContext(tenderId, tenantId);

    const result = await ai().complete({
      messages: [
        {
          role: 'system',
          content: `Παράγεις δηλώσεις μη αποκλεισμού για δημόσιους διαγωνισμούς (Άρθρα 73-74 Ν.4412/2016).
Απάντησε σε JSON: { "title": "...", "content": "..." (markdown), "sections": [...] }`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            type: 'non_exclusion',
            tenderTitle: tender.title,
            tenderReference: tender.referenceNumber ?? undefined,
            contractingAuthority: tender.contractingAuthority ?? undefined,
            companyName: company?.legalName || '',
            companyTaxId: company?.taxId || '',
            legalRepName: company?.legalRepName || '',
            legalRepTitle: company?.legalRepTitle || '',
          } satisfies DocumentGenerationRequest),
        },
      ],
      maxTokens: 2000,
      temperature: 0.3,
      responseFormat: 'json',
    });

    const generated = parseAIResponse<GeneratedDocumentResult>(result.content, [], 'generateNonExclusionDeclaration');

    const doc = await db.generatedDocument.create({
      data: {
        tenderId,
        type: 'NON_EXCLUSION_DECLARATION',
        title: generated.title,
        content: generated.content,
        status: 'DRAFT',
      },
    });

    await this.logActivity(tenderId, `Δημιουργήθηκε Δήλωση Μη Αποκλεισμού`);
    return doc.id;
  }

  /**
   * Generate technical compliance table
   */
  async generateTechnicalComplianceTable(
    tenderId: string,
    tenantId: string
  ): Promise<string> {
    const { company, tender } = await this.loadContext(tenderId, tenantId);

    const techRequirements = await db.tenderRequirement.findMany({
      where: {
        tenderId,
        category: 'TECHNICAL_REQUIREMENTS',
      },
      include: {
        mappings: {
          include: {
            contentLibraryItem: true,
          },
        },
      },
    });

    const result = await ai().complete({
      messages: [
        {
          role: 'system',
          content: `Δημιούργησε πίνακα τεχνικής συμμόρφωσης (Technical Compliance Matrix) για δημόσιο διαγωνισμό.
Για κάθε τεχνική απαίτηση, δημιούργησε:
- Requirement: η αρχική απαίτηση
- Response: draft απάντηση βασισμένη σε υπάρχοντα κείμενα εταιρείας (αν υπάρχουν)
- ReferenceDocument: σχετικά αποδεικτικά/αναφορές

Απάντησε σε JSON: { "title": "...", "content": "..." (markdown table), "sections": [...] }`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            type: 'technical_compliance',
            tenderTitle: tender.title,
            tenderReference: tender.referenceNumber,
            companyName: company?.legalName || '',
            requirements: techRequirements.map((r) => ({
              text: r.text,
              category: r.category,
              existingContent: r.mappings
                .filter((m) => m.contentLibraryItem)
                .map((m) => m.contentLibraryItem!.content)
                .join('\n'),
            })),
          }),
        },
      ],
      maxTokens: 8000,
      temperature: 0.4,
      responseFormat: 'json',
    });

    const generated = parseAIResponse<GeneratedDocumentResult>(result.content, [], 'generateTechnicalComplianceTable');

    const doc = await db.generatedDocument.create({
      data: {
        tenderId,
        type: 'TECHNICAL_COMPLIANCE',
        title: generated.title || 'Πίνακας Τεχνικής Συμμόρφωσης',
        content: generated.content,
        status: 'DRAFT',
      },
    });

    await this.logActivity(tenderId, `Δημιουργήθηκε Πίνακας Τεχνικής Συμμόρφωσης`);
    return doc.id;
  }

  /**
   * Generate technical/methodology proposal narrative
   */
  async generateTechnicalProposal(
    tenderId: string,
    tenantId: string
  ): Promise<string> {
    const { company, tender } = await this.loadContext(tenderId, tenantId);

    const allRequirements = await db.tenderRequirement.findMany({
      where: { tenderId },
    });

    const contentItems = await db.contentLibraryItem.findMany({
      where: { tenantId },
    });

    const result = await ai().complete({
      messages: [
        {
          role: 'system',
          content: `Δημιούργησε draft τεχνική/μεθοδολογική προσφορά για δημόσιο διαγωνισμό.
Δομή κεφαλαίων:
1. Κατανόηση Απαιτήσεων (Understanding of Requirements)
2. Μεθοδολογία Υλοποίησης (Methodology)
3. Ομάδα Έργου (Team)
4. Διαχείριση Κινδύνων (Risk Management)
5. Χρονοδιάγραμμα (Timeline)

Χρησιμοποίησε τα υπάρχοντα κείμενα ως βάση. Πάντα στα ελληνικά.
Απάντησε σε JSON: { "title": "...", "content": "..." (markdown), "sections": [{ "heading": "...", "content": "..." }] }`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            type: 'technical_proposal',
            tenderTitle: tender.title,
            tenderReference: tender.referenceNumber ?? undefined,
            contractingAuthority: tender.contractingAuthority ?? undefined,
            companyName: company?.legalName || '',
            requirements: allRequirements.map((r) => ({ text: r.text, category: r.category })),
            existingContent: contentItems.map((c) => `[${c.category}] ${c.title}:\n${c.content}`).join('\n\n'),
          }),
        },
      ],
      maxTokens: 6000,
      temperature: 0.5,
      responseFormat: 'json',
    });

    const generated = parseAIResponse<GeneratedDocumentResult>(result.content, [], 'generateTechnicalProposal');

    const doc = await db.generatedDocument.create({
      data: {
        tenderId,
        type: 'TECHNICAL_PROPOSAL',
        title: generated.title || 'Τεχνική Προσφορά',
        content: generated.content,
        status: 'DRAFT',
      },
    });

    await this.logActivity(tenderId, `Δημιουργήθηκε Τεχνική Προσφορά (draft)`);
    return doc.id;
  }

  async generateCoverLetter(tenderId: string, tenantId: string): Promise<string> {
    const { tender } = await this.loadContext(tenderId, tenantId);

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
        const budget = p.contractAmount ? `€${Number(p.contractAmount).toLocaleString('el-GR')}` : '—';
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

  private async loadContext(tenderId: string, tenantId: string) {
    const [company, tender] = await Promise.all([
      db.companyProfile.findFirst({ where: { tenantId } }),
      db.tender.findUniqueOrThrow({ where: { id: tenderId } }),
    ]);
    return { company, tender };
  }

  private async logActivity(tenderId: string, details: string) {
    await db.activity.create({
      data: { tenderId, action: 'document_generated', details },
    });
  }
}

export const documentGenerator = new DocumentGeneratorService();
