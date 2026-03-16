import { db } from '@/lib/db';
import { ai } from '@/server/ai';
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

    const generated: GeneratedDocumentResult = JSON.parse(result.content);

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

    const generated: GeneratedDocumentResult = JSON.parse(result.content);

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
      maxTokens: 4000,
      temperature: 0.4,
      responseFormat: 'json',
    });

    const generated: GeneratedDocumentResult = JSON.parse(result.content);

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

    const generated: GeneratedDocumentResult = JSON.parse(result.content);

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

  private async loadContext(tenderId: string, tenantId: string) {
    const [company, tender] = await Promise.all([
      db.companyProfile.findUnique({ where: { tenantId } }),
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
