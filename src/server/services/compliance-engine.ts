import { db } from '@/lib/db';
import type {
  TenderRequirement,
  Certificate,
  LegalDocument,
  Project,
  ContentLibraryItem,
  RequirementType,
  CoverageStatus,
} from '@prisma/client';

interface CompanyAssets {
  certificates: Certificate[];
  legalDocs: LegalDocument[];
  projects: Project[];
  contentItems: ContentLibraryItem[];
}

interface MatchResult {
  requirementId: string;
  status: CoverageStatus;
  mappings: Array<{
    type: 'certificate' | 'legalDocument' | 'project' | 'contentLibrary';
    id: string;
    reason: string;
  }>;
}

/**
 * Compliance engine that matches tender requirements against company assets.
 * Uses rule-based matching with keyword and type analysis.
 */
export class ComplianceEngine {
  private _docTypeKeywords: Record<string, string[]> = {};

  /**
   * Run compliance check for all requirements of a tender.
   */
  async runComplianceCheck(
    tenderId: string,
    tenantId: string,
    opts: { userId?: string } = {}
  ): Promise<{
    score: number;
    results: MatchResult[];
  }> {
    // Load country-specific compliance keywords via the full fallback chain.
    // tender.country wins so existing tenders keep their original legal context
    // even when the user has switched active country.
    const { getPromptContext } = await import('@/lib/prompts');
    const { resolveCountry } = await import('@/lib/active-country');

    const tenderRecord = await db.tender.findUnique({
      where: { id: tenderId },
      select: { country: true },
    });
    const country = await resolveCountry({
      tenderCountry: tenderRecord?.country,
      userId: opts.userId,
      tenantId,
    });
    this._docTypeKeywords = getPromptContext(country).docTypeKeywords;

    // Load requirements
    const requirements = await db.tenderRequirement.findMany({
      where: { tenderId },
      include: { mappings: true },
    });

    // Load company assets
    const assets = await this.loadCompanyAssets(tenantId);

    // Match each requirement
    const results: MatchResult[] = [];
    for (const req of requirements) {
      // Skip manually overridden requirements
      if (req.coverageStatus === 'MANUAL_OVERRIDE') {
        results.push({
          requirementId: req.id,
          status: 'MANUAL_OVERRIDE',
          mappings: [],
        });
        continue;
      }

      const match = this.matchRequirement(req, assets);
      results.push(match);
    }

    // Save results to DB
    await this.saveResults(results);

    // Calculate compliance score
    const score = this.calculateScore(requirements, results);

    // Update tender
    await db.tender.update({
      where: { id: tenderId },
      data: { complianceScore: score },
    });

    // Log activity
    await db.activity.create({
      data: {
        tenderId,
        action: 'compliance_check',
        details: `Compliance score: ${score.toFixed(1)}% — ${results.filter((r) => r.status === 'COVERED').length}/${requirements.filter((r) => r.mandatory).length} υποχρεωτικές απαιτήσεις καλύπτονται`,
      },
    });

    return { score, results };
  }

  private async loadCompanyAssets(tenantId: string): Promise<CompanyAssets> {
    const [certificates, legalDocs, projects, contentItems] = await Promise.all([
      db.certificate.findMany({ where: { tenantId } }),
      db.legalDocument.findMany({ where: { tenantId } }),
      db.project.findMany({ where: { tenantId } }),
      db.contentLibraryItem.findMany({ where: { tenantId } }),
    ]);

    return { certificates, legalDocs, projects, contentItems };
  }

  /**
   * Rule-based matching of a requirement against company assets.
   */
  private matchRequirement(
    requirement: TenderRequirement & { mappings: Array<{ id: string }> },
    assets: CompanyAssets
  ): MatchResult {
    const mappings: MatchResult['mappings'] = [];
    const text = requirement.text.toLowerCase();

    // If already has manual mappings, consider it covered
    if (requirement.mappings.length > 0) {
      return {
        requirementId: requirement.id,
        status: 'COVERED',
        mappings: [],
      };
    }

    // Match by requirement type
    switch (requirement.type) {
      case 'CERTIFICATE':
        this.matchCertificates(text, assets.certificates, mappings);
        break;

      case 'DOCUMENT':
        this.matchLegalDocs(text, requirement, assets.legalDocs, mappings);
        this.matchCertificates(text, assets.certificates, mappings);
        break;

      case 'EXPERIENCE':
        this.matchProjects(text, requirement, assets.projects, mappings);
        break;

      case 'DECLARATION':
        // Declarations can typically be generated — check if we have templates
        this.matchContentItems(text, assets.contentItems, mappings);
        break;

      case 'TECHNICAL':
        this.matchContentItems(text, assets.contentItems, mappings);
        break;

      default:
        // Try all asset types
        this.matchCertificates(text, assets.certificates, mappings);
        this.matchLegalDocs(text, requirement, assets.legalDocs, mappings);
        this.matchProjects(text, requirement, assets.projects, mappings);
        this.matchContentItems(text, assets.contentItems, mappings);
        break;
    }

    return {
      requirementId: requirement.id,
      status: mappings.length > 0 ? 'COVERED' : 'GAP',
      mappings,
    };
  }

  private matchCertificates(
    text: string,
    certificates: Certificate[],
    mappings: MatchResult['mappings']
  ): void {
    const certKeywords: Record<string, string[]> = {
      'iso 9001': ['iso 9001', 'ποιότητ', 'quality'],
      'iso 14001': ['iso 14001', 'περιβαλλοντ', 'environment'],
      'iso 27001': ['iso 27001', 'ασφάλεια πληροφοριών', 'information security'],
      'iso 45001': ['iso 45001', 'υγεία και ασφάλεια', 'health safety'],
      'ohsas': ['ohsas', 'υγεία εργασίας'],
    };

    for (const cert of certificates) {
      const certType = cert.type.toLowerCase();
      const certTitle = cert.title.toLowerCase();

      // Direct type match
      if (text.includes(certType) || text.includes(certTitle)) {
        mappings.push({
          type: 'certificate',
          id: cert.id,
          reason: `Πιστοποιητικό "${cert.title}" αντιστοιχεί άμεσα στην απαίτηση`,
        });
        continue;
      }

      // Keyword match
      for (const [certKey, keywords] of Object.entries(certKeywords)) {
        if (
          (certType.includes(certKey) || certTitle.includes(certKey)) &&
          keywords.some((kw) => text.includes(kw))
        ) {
          mappings.push({
            type: 'certificate',
            id: cert.id,
            reason: `Πιστοποιητικό "${cert.title}" πιθανώς καλύπτει την απαίτηση (keyword match: ${certKey})`,
          });
        }
      }
    }
  }

  private matchLegalDocs(
    text: string,
    requirement: TenderRequirement,
    legalDocs: LegalDocument[],
    mappings: MatchResult['mappings']
  ): void {
    const docTypeKeywords = this._docTypeKeywords;

    for (const doc of legalDocs) {
      const keywords = docTypeKeywords[doc.type] || [];
      if (keywords.some((kw) => text.includes(kw))) {
        // Check if document is not expired
        const isValid = !doc.expiryDate || new Date(doc.expiryDate) > new Date();
        if (isValid) {
          mappings.push({
            type: 'legalDocument',
            id: doc.id,
            reason: `Έγγραφο "${doc.title}" (${doc.type}) καλύπτει αυτή την απαίτηση`,
          });
        }
      }
    }
  }

  private matchProjects(
    text: string,
    requirement: TenderRequirement,
    projects: Project[],
    mappings: MatchResult['mappings']
  ): void {
    if (requirement.type !== 'EXPERIENCE' && !text.includes('εμπειρί') && !text.includes('έργ')) {
      return;
    }

    // Check if text specifies minimum amount or count
    const amountMatch = text.match(/(\d[\d.,]*)\s*€|€\s*(\d[\d.,]*)/);
    const minAmount = amountMatch
      ? parseFloat((amountMatch[1] || amountMatch[2]).replace(/\./g, '').replace(',', '.'))
      : 0;

    const countMatch = text.match(/τουλάχιστον\s+(\d+)/);
    const minCount = countMatch ? parseInt(countMatch[1]) : 1;

    // Filter qualifying projects
    const qualifying = projects.filter((p) => {
      if (minAmount > 0 && (p.contractAmount || 0) < minAmount / minCount) {
        return false;
      }
      return true;
    });

    if (qualifying.length >= minCount) {
      const totalAmount = qualifying.reduce((sum, p) => sum + (p.contractAmount || 0), 0);
      mappings.push({
        type: 'project',
        id: qualifying[0].id,
        reason: `${qualifying.length} σχετικά έργα (συνολική αξία: €${totalAmount.toLocaleString('el-GR')}) πληρούν πιθανώς την απαίτηση`,
      });
    }
  }

  private matchContentItems(
    text: string,
    contentItems: ContentLibraryItem[],
    mappings: MatchResult['mappings']
  ): void {
    const categoryKeywords: Record<string, string[]> = {
      METHODOLOGY: ['μεθοδολογ', 'methodology', 'approach'],
      QA_PLAN: ['ποιότητ', 'quality', 'qa'],
      HSE_PLAN: ['υγεία', 'ασφάλεια', 'περιβάλλον', 'hse'],
      TEAM_DESCRIPTION: ['ομάδα', 'team', 'στελέχη', 'προσωπικό'],
      RISK_MANAGEMENT: ['κίνδυν', 'risk'],
      COMPANY_PROFILE: ['εταιρ', 'company'],
    };

    for (const item of contentItems) {
      const keywords = categoryKeywords[item.category] || [];
      const tagMatch = item.tags.some((tag) => text.includes(tag.toLowerCase()));
      const keywordMatch = keywords.some((kw) => text.includes(kw));
      const titleMatch = text.includes(item.title.toLowerCase());

      if (tagMatch || keywordMatch || titleMatch) {
        mappings.push({
          type: 'contentLibrary',
          id: item.id,
          reason: `Κείμενο "${item.title}" (${item.category}) μπορεί να χρησιμοποιηθεί ως βάση`,
        });
      }
    }
  }

  private async saveResults(results: MatchResult[]): Promise<void> {
    for (const result of results) {
      if (result.status === 'MANUAL_OVERRIDE') continue;

      // Update requirement status
      await db.tenderRequirement.update({
        where: { id: result.requirementId },
        data: { coverageStatus: result.status },
      });

      // Create mappings
      for (const mapping of result.mappings) {
        const data: Record<string, unknown> = {
          requirementId: result.requirementId,
          notes: mapping.reason,
        };

        switch (mapping.type) {
          case 'certificate':
            data.certificateId = mapping.id;
            break;
          case 'legalDocument':
            data.legalDocumentId = mapping.id;
            break;
          case 'project':
            data.projectId = mapping.id;
            break;
          case 'contentLibrary':
            data.contentLibraryItemId = mapping.id;
            break;
        }

        await db.requirementMapping.create({ data: data as any });
      }
    }
  }

  /**
   * Calculate compliance score as percentage of mandatory requirements covered.
   */
  private calculateScore(
    requirements: TenderRequirement[],
    results: MatchResult[]
  ): number {
    const mandatory = requirements.filter((r) => r.mandatory);
    if (mandatory.length === 0) return 100;

    const mandatoryResults = results.filter((r) =>
      mandatory.some((m) => m.id === r.requirementId)
    );

    const covered = mandatoryResults.filter(
      (r) => r.status === 'COVERED' || r.status === 'MANUAL_OVERRIDE'
    ).length;

    return (covered / mandatory.length) * 100;
  }
}

export const complianceEngine = new ComplianceEngine();
