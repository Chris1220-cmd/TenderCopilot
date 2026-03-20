import { db } from '@/lib/db';
import { ai } from '@/server/ai';
import { parseAIResponse } from './ai-prompts';
import type {
  TenderRequirement,
  Certificate,
  LegalDocument,
  Project,
  ContentLibraryItem,
  GeneratedDocument,
  RequirementCategory,
  CoverageStatus,
} from '@prisma/client';

// ─── Types ──────────────────────────────────────────────────

interface EvidenceRef {
  docId: string;
  docType: 'certificate' | 'legalDocument' | 'project' | 'contentLibrary' | 'generatedDocument';
  page?: number;
  section?: string;
  confidence: number;
}

interface ComplianceMatrixResult {
  score: number;
  covered: number;
  gaps: number;
  unmapped: number;
  total: number;
}

interface ChecklistItem {
  description: string;
  required: boolean;
  status: 'ready' | 'missing' | 'pending' | 'expired';
  document?: string;
}

interface ChecklistCategory {
  category: string;
  items: ChecklistItem[];
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  readinessScore: number;
}

interface CategoryBreakdown {
  category: RequirementCategory;
  total: number;
  covered: number;
  gaps: number;
  unmapped: number;
  score: number;
}

interface ComplianceReport {
  overallScore: number;
  categoryBreakdowns: CategoryBreakdown[];
  gapList: Array<{
    requirementId: string;
    requirementText: string;
    category: RequirementCategory;
    mandatory: boolean;
    remediation: string;
  }>;
  timelineRisks: Array<{
    entityType: string;
    entityId: string;
    entityTitle: string;
    expiryDate: Date;
    daysUntilExpiry: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  comparisonInsights: string;
}

// ─── Company Assets (shared type) ───────────────────────────

interface CompanyAssets {
  certificates: Certificate[];
  legalDocs: LegalDocument[];
  projects: Project[];
  contentItems: ContentLibraryItem[];
  generatedDocs: GeneratedDocument[];
}

// ─── AI Compliance Guardian Service ─────────────────────────

/**
 * AI Compliance Guardian -- Acts as the QA/Compliance Officer.
 * Maintains full compliance matrix, validates submission packages,
 * generates checklists, ensures nothing is missed.
 * Expert in N.4412/2016 requirements for Greek public procurement.
 */
class AIComplianceService {
  // ─── updateComplianceMatrix ─────────────────────────────────

  /**
   * Full re-scan of all TenderRequirements vs company assets.
   * For each requirement:
   *   - Finds matching evidence with confidence score
   *   - Updates coverageStatus (COVERED >= 0.7, GAP if no match, UNMAPPED if not analyzed)
   *   - Stores evidenceRefs JSON
   *   - Calculates and updates tender.complianceScore
   */
  async updateComplianceMatrix(
    tenderId: string,
    tenantId: string
  ): Promise<ComplianceMatrixResult> {
    // Load requirements
    const requirements = await db.tenderRequirement.findMany({
      where: { tenderId },
      include: { mappings: true },
    });

    // Load all company assets
    const assets = await this.loadCompanyAssets(tenantId, tenderId);

    let covered = 0;
    let gaps = 0;
    let unmapped = 0;
    const total = requirements.length;

    // Use AI to analyze each requirement against assets
    for (const req of requirements) {
      // Skip manually overridden
      if (req.coverageStatus === 'MANUAL_OVERRIDE') {
        covered++;
        continue;
      }

      try {
        const evidenceRefs = await this.findMatchingEvidence(req, assets);
        const bestConfidence = evidenceRefs.length > 0
          ? Math.max(...evidenceRefs.map((e) => e.confidence))
          : 0;

        let status: CoverageStatus;
        if (bestConfidence >= 0.7) {
          status = 'COVERED';
          covered++;
        } else if (evidenceRefs.length === 0) {
          status = 'GAP';
          gaps++;
        } else {
          // Has low-confidence matches, still a gap
          status = 'GAP';
          gaps++;
        }

        await db.tenderRequirement.update({
          where: { id: req.id },
          data: {
            coverageStatus: status,
            evidenceRefs: evidenceRefs as unknown as any,
          },
        });
      } catch {
        unmapped++;
        await db.tenderRequirement.update({
          where: { id: req.id },
          data: { coverageStatus: 'UNMAPPED' },
        });
      }
    }

    // Calculate score: percentage of mandatory requirements covered
    const mandatoryReqs = requirements.filter((r) => r.mandatory);
    const mandatoryCovered = mandatoryReqs.length > 0
      ? mandatoryReqs.filter((r) => {
          if (r.coverageStatus === 'MANUAL_OVERRIDE') return true;
          // Re-check from our loop tracking
          return false; // We'll recalculate below
        }).length
      : 0;

    // Recalculate from DB state after updates
    const updatedRequirements = await db.tenderRequirement.findMany({
      where: { tenderId, mandatory: true },
    });
    const updatedCovered = updatedRequirements.filter(
      (r) => r.coverageStatus === 'COVERED' || r.coverageStatus === 'MANUAL_OVERRIDE'
    ).length;
    const score = updatedRequirements.length > 0
      ? (updatedCovered / updatedRequirements.length) * 100
      : 100;

    // Update tender compliance score
    await db.tender.update({
      where: { id: tenderId },
      data: { complianceScore: Math.round(score * 10) / 10 },
    });

    // Log activity
    await db.activity.create({
      data: {
        tenderId,
        action: 'compliance_matrix_updated',
        details: `Ενημέρωση μήτρας συμμόρφωσης: ${score.toFixed(1)}% — ${covered}/${total} καλύπτονται, ${gaps} κενά, ${unmapped} μη αναλυμένα`,
      },
    });

    return { score: Math.round(score * 10) / 10, covered, gaps, unmapped, total };
  }

  // ─── generateSubmissionChecklist ────────────────────────────

  /**
   * Creates comprehensive checklist based on:
   *   - All mandatory requirements
   *   - Platform-specific document needs (ESIDIS vs cosmoONE)
   *   - Required signatures, stamps, certifications
   *   - File format requirements (PDF, DOCX)
   *   - Naming conventions
   */
  async generateSubmissionChecklist(tenderId: string): Promise<ChecklistCategory[]> {
    const tender = await db.tender.findUniqueOrThrow({
      where: { id: tenderId },
      include: {
        requirements: { include: { mappings: true } },
        generatedDocuments: true,
        attachedDocuments: true,
      },
    });

    try {
      const result = await ai().complete({
        messages: [
          {
            role: 'system',
            content: `Είσαι ο Υπεύθυνος Ποιότητας / Compliance Officer για δημόσιους διαγωνισμούς στην Ελλάδα (Ν.4412/2016).
Δημιούργησε ένα πλήρες checklist υποβολής.

Κατηγορίες:
1. ΔΙΚΑΙΟΛΟΓΗΤΙΚΑ ΣΥΜΜΕΤΟΧΗΣ — Φορολογική, ασφαλιστική ενημερότητα, ΓΕΜΗ, ποινικά μητρώα κλπ.
2. ΤΕΧΝΙΚΑ ΕΓΓΡΑΦΑ — Τεχνική προσφορά, μεθοδολογία, πίνακας συμμόρφωσης, βιογραφικά
3. ΟΙΚΟΝΟΜΙΚΑ ΕΓΓΡΑΦΑ — Οικονομική προσφορά, εγγυητική επιστολή
4. ΠΙΣΤΟΠΟΙΗΤΙΚΑ — ISO, επαγγελματικά πιστοποιητικά
5. ΥΠΕΥΘΥΝΕΣ ΔΗΛΩΣΕΙΣ — Υ.Δ. μη αποκλεισμού, νομιμοποίηση, λοιπές δηλώσεις
6. ΜΟΡΦΟΠΟΙΗΣΗ & ΠΛΑΤΦΟΡΜΑ — Ονοματολογία αρχείων, μορφότυπα (PDF/DOCX), ψηφιακές υπογραφές, δομή φακέλων

Για κάθε στοιχείο δώσε:
- description: Τι ακριβώς χρειάζεται
- required: true/false
- status: "ready" | "missing" | "pending" | "expired"
- document: Τίτλος εγγράφου (αν υπάρχει)

Πλατφόρμα υποβολής: ${tender.platform}
${tender.platform === 'ESIDIS' ? 'Δομή ΕΣΗΔΗΣ: Φάκελοι (Δικαιολογητικά Συμμετοχής, Τεχνική Προσφορά, Οικονομική Προσφορά). Μόνο PDF αρχεία.' : ''}
${tender.platform === 'COSMOONE' ? 'Πλατφόρμα cosmoONE: Ξεχωριστά uploads ανά κατηγορία. PDF ή DOCX αρχεία.' : ''}

Απάντησε ΜΟΝΟ σε JSON array: [{ "category": "...", "items": [{ "description": "...", "required": true/false, "status": "...", "document": "..." }] }]`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              tenderTitle: tender.title,
              referenceNumber: tender.referenceNumber,
              platform: tender.platform,
              submissionDeadline: tender.submissionDeadline,
              requirements: tender.requirements.map((r) => ({
                text: r.text,
                category: r.category,
                type: r.type,
                mandatory: r.mandatory,
                coverageStatus: r.coverageStatus,
                hasMappings: r.mappings.length > 0,
              })),
              existingGeneratedDocs: tender.generatedDocuments.map((d) => ({
                type: d.type,
                title: d.title,
                status: d.status,
              })),
              existingAttachedDocs: tender.attachedDocuments.map((d) => ({
                fileName: d.fileName,
                category: d.category,
              })),
            }),
          },
        ],
        maxTokens: 8000,
        temperature: 0.2,
        responseFormat: 'json',
      });

      const checklist: ChecklistCategory[] = parseAIResponse<ChecklistCategory[]>(result.content, [], 'generateSubmissionChecklist');

      await db.activity.create({
        data: {
          tenderId,
          action: 'checklist_generated',
          details: `Δημιουργήθηκε checklist υποβολής: ${checklist.reduce((sum, c) => sum + c.items.length, 0)} στοιχεία σε ${checklist.length} κατηγορίες`,
        },
      });

      return checklist;
    } catch {
      // Fallback: generate rule-based checklist from requirements
      return this.generateFallbackChecklist(tender);
    }
  }

  // ─── validateSubmissionPackage ──────────────────────────────

  /**
   * Pre-submission validation:
   *   - All mandatory requirements have COVERED status
   *   - All required documents exist (attached or generated)
   *   - No certificates expired by submission deadline
   *   - Generated documents are in FINAL status
   *   - Legal documents (tax/insurance clearance) are valid
   */
  async validateSubmissionPackage(tenderId: string): Promise<ValidationResult> {
    const tender = await db.tender.findUniqueOrThrow({
      where: { id: tenderId },
      include: {
        requirements: true,
        generatedDocuments: true,
        attachedDocuments: true,
      },
    });

    const tenantId = tender.tenantId;
    const errors: string[] = [];
    const warnings: string[] = [];
    const deadline = tender.submissionDeadline || new Date();

    // 1. Check all mandatory requirements
    const mandatoryReqs = tender.requirements.filter((r) => r.mandatory);
    const uncoveredMandatory = mandatoryReqs.filter(
      (r) => r.coverageStatus !== 'COVERED' && r.coverageStatus !== 'MANUAL_OVERRIDE'
    );
    for (const req of uncoveredMandatory) {
      errors.push(
        `Υποχρεωτική απαίτηση χωρίς κάλυψη: "${req.text.substring(0, 80)}..." (${req.category})`
      );
    }

    // 2. Check all generated documents are FINAL
    const draftDocs = tender.generatedDocuments.filter((d) => d.status === 'DRAFT');
    for (const doc of draftDocs) {
      errors.push(
        `Έγγραφο "${doc.title}" είναι ακόμα σε κατάσταση DRAFT — πρέπει να οριστικοποιηθεί`
      );
    }

    const reviewedDocs = tender.generatedDocuments.filter((d) => d.status === 'REVIEWED');
    for (const doc of reviewedDocs) {
      warnings.push(
        `Έγγραφο "${doc.title}" είναι σε κατάσταση REVIEWED — εξετάστε οριστικοποίηση σε FINAL`
      );
    }

    // 3. Check certificates not expired
    const certificates = await db.certificate.findMany({
      where: { tenantId },
    });
    for (const cert of certificates) {
      if (cert.expiryDate && new Date(cert.expiryDate) < deadline) {
        errors.push(
          `Πιστοποιητικό "${cert.title}" λήγει στις ${cert.expiryDate.toLocaleDateString('el-GR')} — πριν την προθεσμία υποβολής`
        );
      }
    }

    // 4. Check legal documents validity
    const legalDocs = await db.legalDocument.findMany({
      where: { tenantId },
    });

    const requiredLegalTypes = ['TAX_CLEARANCE', 'SOCIAL_SECURITY_CLEARANCE'];
    for (const docType of requiredLegalTypes) {
      const doc = legalDocs.find((d) => d.type === docType);
      if (!doc) {
        errors.push(
          `Λείπει υποχρεωτικό νομικό έγγραφο: ${docType === 'TAX_CLEARANCE' ? 'Φορολογική Ενημερότητα' : 'Ασφαλιστική Ενημερότητα'}`
        );
      } else if (doc.expiryDate && new Date(doc.expiryDate) < deadline) {
        errors.push(
          `${doc.title} λήγει στις ${doc.expiryDate.toLocaleDateString('el-GR')} — πριν την προθεσμία υποβολής`
        );
      }
    }

    // 5. Check if we have minimum expected documents
    const hasAttachedDocs = tender.attachedDocuments.length > 0;
    const hasGeneratedDocs = tender.generatedDocuments.length > 0;
    if (!hasAttachedDocs && !hasGeneratedDocs) {
      errors.push('Δεν υπάρχουν καθόλου έγγραφα (ούτε επισυναπτόμενα ούτε δημιουργημένα)');
    }

    // 6. Deadline proximity warning
    const daysUntilDeadline = Math.ceil(
      (deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilDeadline < 0) {
      errors.push(`Η προθεσμία υποβολής έχει παρέλθει!`);
    } else if (daysUntilDeadline <= 1) {
      warnings.push(`Η προθεσμία υποβολής είναι σήμερα/αύριο!`);
    } else if (daysUntilDeadline <= 3) {
      warnings.push(`Η προθεσμία υποβολής είναι σε ${daysUntilDeadline} ημέρες`);
    }

    // Calculate readiness score
    const totalChecks =
      mandatoryReqs.length +
      tender.generatedDocuments.length +
      certificates.length +
      requiredLegalTypes.length;
    const passedChecks = totalChecks - errors.length;
    const readinessScore = totalChecks > 0
      ? Math.max(0, Math.min(100, Math.round((passedChecks / totalChecks) * 100)))
      : 0;

    const valid = errors.length === 0;

    await db.activity.create({
      data: {
        tenderId,
        action: 'submission_validated',
        details: `Validation: ${valid ? 'PASS' : 'FAIL'} — ${errors.length} σφάλματα, ${warnings.length} προειδοποιήσεις, readiness: ${readinessScore}%`,
      },
    });

    return { valid, errors, warnings, readinessScore };
  }

  // ─── getComplianceReport ───────────────────────────────────

  /**
   * Full compliance report:
   *   - Overall score
   *   - Per-category breakdown
   *   - Gap list with remediation suggestions
   *   - Timeline risks (expiring documents)
   *   - Comparison with similar won/lost tenders
   */
  async getComplianceReport(tenderId: string): Promise<ComplianceReport> {
    const tender = await db.tender.findUniqueOrThrow({
      where: { id: tenderId },
      include: {
        requirements: true,
        generatedDocuments: true,
      },
    });

    const tenantId = tender.tenantId;
    const overallScore = tender.complianceScore ?? 0;

    // 1. Per-category breakdown
    const categories: RequirementCategory[] = [
      'PARTICIPATION_CRITERIA',
      'EXCLUSION_CRITERIA',
      'TECHNICAL_REQUIREMENTS',
      'FINANCIAL_REQUIREMENTS',
      'DOCUMENTATION_REQUIREMENTS',
      'CONTRACT_TERMS',
    ];

    const categoryBreakdowns: CategoryBreakdown[] = categories.map((cat) => {
      const catReqs = tender.requirements.filter((r) => r.category === cat);
      const catCovered = catReqs.filter(
        (r) => r.coverageStatus === 'COVERED' || r.coverageStatus === 'MANUAL_OVERRIDE'
      ).length;
      const catGaps = catReqs.filter((r) => r.coverageStatus === 'GAP').length;
      const catUnmapped = catReqs.filter((r) => r.coverageStatus === 'UNMAPPED').length;

      return {
        category: cat,
        total: catReqs.length,
        covered: catCovered,
        gaps: catGaps,
        unmapped: catUnmapped,
        score: catReqs.length > 0 ? (catCovered / catReqs.length) * 100 : 100,
      };
    });

    // 2. Gap list with remediation suggestions
    const gapRequirements = tender.requirements.filter(
      (r) => r.coverageStatus === 'GAP' || r.coverageStatus === 'UNMAPPED'
    );

    let gapList: ComplianceReport['gapList'] = [];
    if (gapRequirements.length > 0) {
      try {
        const result = await ai().complete({
          messages: [
            {
              role: 'system',
              content: `Είσαι ο Υπεύθυνος Συμμόρφωσης για δημόσιους διαγωνισμούς (Ν.4412/2016).
Για κάθε κενό στη συμμόρφωση, πρότεινε συγκεκριμένη ενέργεια αποκατάστασης στα ελληνικά.
Απάντησε ΜΟΝΟ σε JSON array: [{ "requirementId": "...", "remediation": "..." }]`,
            },
            {
              role: 'user',
              content: JSON.stringify(
                gapRequirements.map((r) => ({
                  requirementId: r.id,
                  text: r.text,
                  category: r.category,
                  type: r.type,
                  mandatory: r.mandatory,
                }))
              ),
            },
          ],
          maxTokens: 6000,
          temperature: 0.3,
          responseFormat: 'json',
        });

        const remediations: Array<{ requirementId: string; remediation: string }> =
          parseAIResponse<Array<{ requirementId: string; remediation: string }>>(result.content, [], 'getComplianceRemediations');

        gapList = gapRequirements.map((r) => ({
          requirementId: r.id,
          requirementText: r.text,
          category: r.category,
          mandatory: r.mandatory,
          remediation:
            remediations.find((rem) => rem.requirementId === r.id)?.remediation ||
            'Απαιτείται εξέταση και προσκόμιση κατάλληλου αποδεικτικού.',
        }));
      } catch {
        gapList = gapRequirements.map((r) => ({
          requirementId: r.id,
          requirementText: r.text,
          category: r.category,
          mandatory: r.mandatory,
          remediation: this.getFallbackRemediation(r.type, r.category),
        }));
      }
    }

    // 3. Timeline risks — expiring certificates & legal documents
    const timelineRisks: ComplianceReport['timelineRisks'] = [];
    const deadline = tender.submissionDeadline || new Date();

    const [certificates, legalDocs] = await Promise.all([
      db.certificate.findMany({ where: { tenantId } }),
      db.legalDocument.findMany({ where: { tenantId } }),
    ]);

    for (const cert of certificates) {
      if (cert.expiryDate) {
        const daysUntil = Math.ceil(
          (new Date(cert.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        if (daysUntil <= 90) {
          timelineRisks.push({
            entityType: 'certificate',
            entityId: cert.id,
            entityTitle: cert.title,
            expiryDate: cert.expiryDate,
            daysUntilExpiry: daysUntil,
            severity: daysUntil <= 0 ? 'critical' : daysUntil <= 14 ? 'high' : daysUntil <= 30 ? 'medium' : 'low',
          });
        }
      }
    }

    for (const doc of legalDocs) {
      if (doc.expiryDate) {
        const daysUntil = Math.ceil(
          (new Date(doc.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        if (daysUntil <= 90) {
          timelineRisks.push({
            entityType: 'legalDocument',
            entityId: doc.id,
            entityTitle: doc.title,
            expiryDate: doc.expiryDate,
            daysUntilExpiry: daysUntil,
            severity: daysUntil <= 0 ? 'critical' : daysUntil <= 14 ? 'high' : daysUntil <= 30 ? 'medium' : 'low',
          });
        }
      }
    }

    // Sort by severity
    timelineRisks.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

    // 4. Comparison with similar won/lost tenders
    let comparisonInsights = '';
    try {
      const similarTenders = await db.tender.findMany({
        where: {
          tenantId,
          id: { not: tenderId },
          status: { in: ['WON', 'LOST'] },
        },
        select: {
          id: true,
          title: true,
          status: true,
          complianceScore: true,
          budget: true,
          cpvCodes: true,
        },
        take: 10,
        orderBy: { updatedAt: 'desc' },
      });

      if (similarTenders.length > 0) {
        const wonTenders = similarTenders.filter((t) => t.status === 'WON');
        const lostTenders = similarTenders.filter((t) => t.status === 'LOST');
        const avgWonScore =
          wonTenders.length > 0
            ? wonTenders.reduce((sum, t) => sum + (t.complianceScore || 0), 0) / wonTenders.length
            : 0;
        const avgLostScore =
          lostTenders.length > 0
            ? lostTenders.reduce((sum, t) => sum + (t.complianceScore || 0), 0) / lostTenders.length
            : 0;

        comparisonInsights = `Βάσει ${similarTenders.length} προηγούμενων διαγωνισμών: ` +
          `Μ.Ο. score κερδισμένων: ${avgWonScore.toFixed(1)}%, ` +
          `Μ.Ο. score χαμένων: ${avgLostScore.toFixed(1)}%. ` +
          `Τρέχον score: ${overallScore.toFixed(1)}%. ` +
          (overallScore >= avgWonScore
            ? 'Η τρέχουσα κατάσταση είναι σε ικανοποιητικό επίπεδο σε σχέση με κερδισμένους διαγωνισμούς.'
            : `Χρειάζεται βελτίωση κατά ${(avgWonScore - overallScore).toFixed(1)} ποσοστιαίες μονάδες για να φτάσουμε στο μέσο όρο κερδισμένων.`);
      } else {
        comparisonInsights = 'Δεν υπάρχουν προηγούμενοι διαγωνισμοί για σύγκριση.';
      }
    } catch {
      comparisonInsights = 'Δεν ήταν δυνατή η σύγκριση με προηγούμενους διαγωνισμούς.';
    }

    await db.activity.create({
      data: {
        tenderId,
        action: 'compliance_report_generated',
        details: `Αναφορά συμμόρφωσης: ${overallScore.toFixed(1)}% — ${gapList.length} κενά, ${timelineRisks.length} χρονικοί κίνδυνοι`,
      },
    });

    return {
      overallScore,
      categoryBreakdowns,
      gapList,
      timelineRisks,
      comparisonInsights,
    };
  }

  // ─── Private Helpers ──────────────────────────────────────

  private async loadCompanyAssets(
    tenantId: string,
    tenderId: string
  ): Promise<CompanyAssets> {
    const [certificates, legalDocs, projects, contentItems, generatedDocs] =
      await Promise.all([
        db.certificate.findMany({ where: { tenantId } }),
        db.legalDocument.findMany({ where: { tenantId } }),
        db.project.findMany({ where: { tenantId } }),
        db.contentLibraryItem.findMany({ where: { tenantId } }),
        db.generatedDocument.findMany({ where: { tenderId } }),
      ]);

    return { certificates, legalDocs, projects, contentItems, generatedDocs };
  }

  /**
   * Use AI to find matching evidence for a requirement.
   * Falls back to rule-based matching on AI failure.
   */
  private async findMatchingEvidence(
    requirement: TenderRequirement & { mappings: Array<{ id: string }> },
    assets: CompanyAssets
  ): Promise<EvidenceRef[]> {
    const evidenceRefs: EvidenceRef[] = [];

    try {
      const result = await ai().complete({
        messages: [
          {
            role: 'system',
            content: `Είσαι ειδικός στη συμμόρφωση δημοσίων διαγωνισμών (Ν.4412/2016).
Σου δίνεται μια απαίτηση διαγωνισμού και τα διαθέσιμα εταιρικά έγγραφα/πιστοποιητικά.
Βρες ποια έγγραφα/πιστοποιητικά/έργα ταιριάζουν με αυτή την απαίτηση.
Για κάθε αντιστοίχιση δώσε ένα confidence score (0-1).

Απάντησε ΜΟΝΟ σε JSON array: [{ "docId": "...", "docType": "certificate|legalDocument|project|contentLibrary|generatedDocument", "confidence": 0.0-1.0, "section": "optional section reference" }]
Αν δεν υπάρχει αντιστοίχιση, απάντησε κενό array: []`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              requirement: {
                text: requirement.text,
                category: requirement.category,
                type: requirement.type,
                mandatory: requirement.mandatory,
              },
              availableAssets: {
                certificates: assets.certificates.map((c) => ({
                  id: c.id,
                  type: c.type,
                  title: c.title,
                  issuer: c.issuer,
                  expiryDate: c.expiryDate,
                })),
                legalDocuments: assets.legalDocs.map((d) => ({
                  id: d.id,
                  type: d.type,
                  title: d.title,
                  expiryDate: d.expiryDate,
                })),
                projects: assets.projects.map((p) => ({
                  id: p.id,
                  title: p.title,
                  client: p.client,
                  contractAmount: p.contractAmount,
                  category: p.category,
                })),
                contentLibrary: assets.contentItems.map((c) => ({
                  id: c.id,
                  category: c.category,
                  title: c.title,
                  tags: c.tags,
                })),
                generatedDocuments: assets.generatedDocs.map((d) => ({
                  id: d.id,
                  type: d.type,
                  title: d.title,
                  status: d.status,
                })),
              },
            }),
          },
        ],
        maxTokens: 1000,
        temperature: 0.1,
        responseFormat: 'json',
      });

      const matches: Array<{
        docId: string;
        docType: EvidenceRef['docType'];
        confidence: number;
        section?: string;
      }> = parseAIResponse<Array<{
        docId: string;
        docType: EvidenceRef['docType'];
        confidence: number;
        section?: string;
      }>>(result.content, [], 'findMatchingEvidence');

      for (const match of matches) {
        evidenceRefs.push({
          docId: match.docId,
          docType: match.docType,
          confidence: Math.max(0, Math.min(1, match.confidence)),
          section: match.section,
        });
      }
    } catch {
      // Fallback to rule-based matching
      return this.ruleBasedMatching(requirement, assets);
    }

    return evidenceRefs;
  }

  /**
   * Rule-based fallback matching when AI is unavailable.
   */
  private ruleBasedMatching(
    requirement: TenderRequirement & { mappings: Array<{ id: string }> },
    assets: CompanyAssets
  ): EvidenceRef[] {
    const refs: EvidenceRef[] = [];
    const text = requirement.text.toLowerCase();

    // Match certificates
    for (const cert of assets.certificates) {
      const certType = cert.type.toLowerCase();
      const certTitle = cert.title.toLowerCase();
      if (text.includes(certType) || text.includes(certTitle)) {
        refs.push({
          docId: cert.id,
          docType: 'certificate',
          confidence: 0.8,
        });
      }
    }

    // Match legal documents
    const legalKeywords: Record<string, string[]> = {
      TAX_CLEARANCE: ['φορολογικ', 'ενημερότητα φορολογικ'],
      SOCIAL_SECURITY_CLEARANCE: ['ασφαλιστικ', 'ενημερότητα ασφαλιστικ'],
      GEMI_CERTIFICATE: ['γεμη', 'γ.ε.μη', 'εμπορικό μητρώο'],
      CRIMINAL_RECORD: ['ποινικ', 'μητρώο ποινικ'],
      JUDICIAL_CERTIFICATE: ['δικαστικ', 'πτώχευ', 'εκκαθάρισ'],
    };

    for (const doc of assets.legalDocs) {
      const keywords = legalKeywords[doc.type] || [];
      if (keywords.some((kw) => text.includes(kw))) {
        const isValid = !doc.expiryDate || new Date(doc.expiryDate) > new Date();
        refs.push({
          docId: doc.id,
          docType: 'legalDocument',
          confidence: isValid ? 0.85 : 0.3,
        });
      }
    }

    // Match projects for experience requirements
    if (requirement.type === 'EXPERIENCE' || text.includes('εμπειρί') || text.includes('έργ')) {
      for (const project of assets.projects) {
        refs.push({
          docId: project.id,
          docType: 'project',
          confidence: 0.6,
        });
      }
    }

    // Match content library
    for (const item of assets.contentItems) {
      const tagMatch = item.tags.some((tag) => text.includes(tag.toLowerCase()));
      const titleMatch = text.includes(item.title.toLowerCase());
      if (tagMatch || titleMatch) {
        refs.push({
          docId: item.id,
          docType: 'contentLibrary',
          confidence: 0.65,
        });
      }
    }

    return refs;
  }

  /**
   * Fallback checklist generation when AI is unavailable.
   */
  private generateFallbackChecklist(
    tender: {
      platform: string;
      requirements: Array<{
        text: string;
        category: string;
        type: string;
        mandatory: boolean;
        coverageStatus: string;
      }>;
      generatedDocuments: Array<{ type: string; title: string; status: string }>;
      attachedDocuments: Array<{ fileName: string; category: string | null }>;
    }
  ): ChecklistCategory[] {
    const categories: ChecklistCategory[] = [];

    // Group requirements by category
    const catMap = new Map<string, ChecklistItem[]>();
    for (const req of tender.requirements) {
      const catName = this.getCategoryDisplayName(req.category);
      if (!catMap.has(catName)) catMap.set(catName, []);
      catMap.get(catName)!.push({
        description: req.text.substring(0, 150),
        required: req.mandatory,
        status: req.coverageStatus === 'COVERED' || req.coverageStatus === 'MANUAL_OVERRIDE'
          ? 'ready'
          : req.coverageStatus === 'GAP'
            ? 'missing'
            : 'pending',
      });
    }

    catMap.forEach((items, category) => {
      categories.push({ category, items });
    });

    // Platform-specific
    const platformItems: ChecklistItem[] = [];
    if (tender.platform === 'ESIDIS') {
      platformItems.push(
        { description: 'Ψηφιακή υπογραφή σε όλα τα PDF', required: true, status: 'pending' },
        { description: 'Δομή φακέλων ΕΣΗΔΗΣ (Δικαιολογητικά, Τεχνική, Οικονομική)', required: true, status: 'pending' },
        { description: 'Μέγεθος αρχείου < 50MB ανά αρχείο', required: true, status: 'pending' }
      );
    } else if (tender.platform === 'COSMOONE') {
      platformItems.push(
        { description: 'Μεταφόρτωση ανά κατηγορία στο cosmoONE', required: true, status: 'pending' },
        { description: 'PDF ή DOCX μορφότυπο', required: true, status: 'pending' }
      );
    }

    if (platformItems.length > 0) {
      categories.push({ category: 'ΜΟΡΦΟΠΟΙΗΣΗ & ΠΛΑΤΦΟΡΜΑ', items: platformItems });
    }

    return categories;
  }

  private getCategoryDisplayName(category: string): string {
    const names: Record<string, string> = {
      PARTICIPATION_CRITERIA: 'ΔΙΚΑΙΟΛΟΓΗΤΙΚΑ ΣΥΜΜΕΤΟΧΗΣ',
      EXCLUSION_CRITERIA: 'ΚΡΙΤΗΡΙΑ ΑΠΟΚΛΕΙΣΜΟΥ',
      TECHNICAL_REQUIREMENTS: 'ΤΕΧΝΙΚΕΣ ΑΠΑΙΤΗΣΕΙΣ',
      FINANCIAL_REQUIREMENTS: 'ΟΙΚΟΝΟΜΙΚΕΣ ΑΠΑΙΤΗΣΕΙΣ',
      DOCUMENTATION_REQUIREMENTS: 'ΤΕΚΜΗΡΙΩΤΙΚΑ ΕΓΓΡΑΦΑ',
      CONTRACT_TERMS: 'ΟΡΟΙ ΣΥΜΒΑΣΗΣ',
    };
    return names[category] || category;
  }

  private getFallbackRemediation(type: string, category: string): string {
    const remediations: Record<string, string> = {
      CERTIFICATE: 'Εξασφαλίστε το απαιτούμενο πιστοποιητικό ή ανανεώστε υπάρχον.',
      DOCUMENT: 'Συγκεντρώστε και επισυνάψτε το απαιτούμενο έγγραφο.',
      EXPERIENCE: 'Συλλέξτε βεβαιώσεις καλής εκτέλεσης από σχετικά έργα.',
      DECLARATION: 'Ετοιμάστε την απαιτούμενη υπεύθυνη δήλωση (Ν.1599/1986).',
      FINANCIAL: 'Προετοιμάστε τα οικονομικά στοιχεία ή/και εγγυητική επιστολή.',
      TECHNICAL: 'Δημιουργήστε τεχνική τεκμηρίωση ή πίνακα συμμόρφωσης.',
    };
    return remediations[type] || 'Απαιτείται εξέταση και ενέργεια για την κάλυψη αυτής της απαίτησης.';
  }
}

export const aiCompliance = new AIComplianceService();
