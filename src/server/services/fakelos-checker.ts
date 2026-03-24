import { db } from '@/lib/db';
import { ai } from '@/server/ai';
import type {
  RequirementCategory,
} from '@prisma/client';

// ─── Types ──────────────────────────────────────────────────

export interface FakelosItem {
  itemType: 'requirement' | 'subcontractor';
  requirementId: string;
  title: string;
  description: string;
  articleReference: string;
  status: 'COVERED' | 'GAP' | 'EXPIRING' | 'IN_PROGRESS' | 'MANUAL_OVERRIDE'; // EXPIRING is computed at runtime, not persisted
  urgency: 'CRITICAL' | 'WARNING' | 'OK';
  mandatory: boolean;
  matchedAsset?: {
    type: 'certificate' | 'legalDocument' | 'project' | 'contentLibrary' | 'generatedDocument';
    id: string;
    name: string;
    expiryDate?: string;
  };
  guidance?: string;
  actionLabel?: string;
  estimatedCost?: string;
  estimatedTime?: string;
  expiryDate?: string;
  daysUntilExpiry?: number;
  aiConfidence?: number;
  sourceText?: string;
}

export interface FakelosEnvelope {
  id: 'A' | 'B' | 'C' | 'D';
  title: string;
  totalItems: number;
  coveredItems: number;
  score: number;
  items: FakelosItem[];
}

export interface FakelosReport {
  readinessScore: number;
  status: 'READY' | 'AT_RISK' | 'NOT_READY';
  statusMessage: string;
  lastCheckedAt: string;
  deadline: string | null;
  daysUntilDeadline: number | null;
  envelopes: FakelosEnvelope[];
  criticalGaps: FakelosItem[];
  expiringItems: FakelosItem[];
  vaultEmpty: boolean;
}

// ─── Envelope Classification ────────────────────────────────

function classifyEnvelope(category: RequirementCategory): 'A' | 'B' | 'C' {
  switch (category) {
    case 'PARTICIPATION_CRITERIA':
    case 'EXCLUSION_CRITERIA':
    case 'DOCUMENTATION_REQUIREMENTS':
    case 'CONTRACT_TERMS':
      return 'A';
    case 'TECHNICAL_REQUIREMENTS':
      return 'B';
    case 'FINANCIAL_REQUIREMENTS':
      return 'C';
    default:
      return 'A';
  }
}

const ENVELOPE_TITLES: Record<'A' | 'B' | 'C' | 'D', string> = {
  A: 'Φάκελος Α — Δικαιολογητικά Συμμετοχής',
  B: 'Φάκελος Β — Τεχνική Προσφορά',
  C: 'Φάκελος Γ — Οικονομική Προσφορά',
  D: 'Φάκελος Δ — Υπεργολάβοι & Προμηθευτές',
};

// ─── Service ────────────────────────────────────────────────

class FakelosChecker {
  /**
   * Run full dossier completeness check for a tender.
   */
  async runCheck(tenderId: string, tenantId: string): Promise<FakelosReport> {
    // 1. Load tender with requirements and mappings
    const tender = await db.tender.findUnique({
      where: { id: tenderId },
      include: {
        requirements: {
          include: {
            mappings: {
              include: {
                certificate: true,
                legalDocument: true,
                project: true,
                contentLibraryItem: true,
              },
            },
          },
        },
      },
    });

    if (!tender) throw new Error('Tender not found');

    // 2. Load company assets
    const [certificates, legalDocs, projects, contentItems] = await Promise.all([
      db.certificate.findMany({ where: { tenantId } }),
      db.legalDocument.findMany({ where: { tenantId } }),
      db.project.findMany({ where: { tenantId } }),
      db.contentLibraryItem.findMany({ where: { tenantId } }),
    ]);

    const vaultEmpty =
      certificates.length === 0 &&
      legalDocs.length === 0 &&
      projects.length === 0 &&
      contentItems.length === 0;

    // 2b. Load subcontractor needs
    const subcontractorNeeds = await db.subcontractorNeed.findMany({
      where: { tenderId },
    });

    // 3. Calculate deadline info
    const deadline = tender.submissionDeadline;
    const daysUntilDeadline = deadline
      ? Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / 86400000))
      : null;

    // 4. Classify requirements into envelopes and determine status
    const envelopeMap: Record<'A' | 'B' | 'C' | 'D', FakelosItem[]> = { A: [], B: [], C: [], D: [] };

    for (const req of tender.requirements) {
      const envelope = classifyEnvelope(req.category);

      // Determine status from existing coverage
      let status: FakelosItem['status'] = 'GAP';
      let matchedAsset: FakelosItem['matchedAsset'] = undefined;
      let expiryDate: string | undefined;
      let daysUntilExpiry: number | undefined;

      if (req.coverageStatus === 'COVERED') {
        status = 'COVERED';
        // Find matched asset from mappings
        const mapping = req.mappings[0];
        if (mapping) {
          if (mapping.certificate) {
            matchedAsset = {
              type: 'certificate',
              id: mapping.certificate.id,
              name: mapping.certificate.title,
              expiryDate: mapping.certificate.expiryDate?.toISOString(),
            };
            // Check expiry
            if (mapping.certificate.expiryDate && deadline) {
              if (mapping.certificate.expiryDate < deadline) {
                status = 'EXPIRING';
                expiryDate = mapping.certificate.expiryDate.toISOString();
                daysUntilExpiry = Math.max(
                  0,
                  Math.ceil((mapping.certificate.expiryDate.getTime() - Date.now()) / 86400000)
                );
              }
            }
          } else if (mapping.legalDocument) {
            matchedAsset = {
              type: 'legalDocument',
              id: mapping.legalDocument.id,
              name: mapping.legalDocument.title,
              expiryDate: mapping.legalDocument.expiryDate?.toISOString(),
            };
            if (mapping.legalDocument.expiryDate && deadline) {
              if (mapping.legalDocument.expiryDate < deadline) {
                status = 'EXPIRING';
                expiryDate = mapping.legalDocument.expiryDate.toISOString();
                daysUntilExpiry = Math.max(
                  0,
                  Math.ceil((mapping.legalDocument.expiryDate.getTime() - Date.now()) / 86400000)
                );
              }
            }
          } else if (mapping.project) {
            matchedAsset = {
              type: 'project',
              id: mapping.project.id,
              name: mapping.project.title,
            };
          } else if (mapping.contentLibraryItem) {
            matchedAsset = {
              type: 'contentLibrary',
              id: mapping.contentLibraryItem.id,
              name: mapping.contentLibraryItem.title,
            };
          }
        }
      } else if (req.coverageStatus === 'IN_PROGRESS') {
        status = 'IN_PROGRESS';
      } else if (req.coverageStatus === 'MANUAL_OVERRIDE') {
        status = 'MANUAL_OVERRIDE';
      }

      // Determine urgency
      let urgency: FakelosItem['urgency'] = 'OK';
      if (status === 'GAP' && req.mandatory) urgency = 'CRITICAL';
      else if (status === 'GAP') urgency = 'WARNING';
      else if (status === 'EXPIRING') urgency = 'WARNING';
      else if (status === 'IN_PROGRESS') urgency = 'WARNING';

      const item: FakelosItem = {
        itemType: 'requirement',
        requirementId: req.id,
        title: req.text.slice(0, 80), // Will be replaced by AI-generated title for GAPs
        description: req.text,
        articleReference: req.articleReference || '',
        status,
        urgency,
        mandatory: req.mandatory,
        matchedAsset,
        expiryDate,
        daysUntilExpiry,
        aiConfidence: req.aiConfidence ?? undefined,
        sourceText: req.text.slice(0, 120),
      };

      envelopeMap[envelope].push(item);
    }

    // 4b. Build Envelope Δ from subcontractor needs
    for (const need of subcontractorNeeds) {
      let status: FakelosItem['status'] = 'GAP';
      if (need.status === 'COVERED') status = 'COVERED';
      else if (need.status === 'IN_PROGRESS') status = 'IN_PROGRESS';

      let urgency: FakelosItem['urgency'] = 'OK';
      if (status === 'GAP' && need.isMandatory) urgency = 'CRITICAL';
      else if (status === 'GAP') urgency = 'WARNING';
      else if (status === 'IN_PROGRESS') urgency = 'WARNING';

      const certsArray = Array.isArray(need.requiredCerts) ? need.requiredCerts as string[] : [];
      const kindLabel = need.kind === 'SUPPLIER' ? 'Προμηθευτής' : 'Υπεργολάβος';

      envelopeMap.D.push({
        itemType: 'subcontractor',
        requirementId: need.id,
        title: `${need.specialty} (${kindLabel})`,
        description: need.reason || need.specialty,
        articleReference: '',
        status,
        urgency,
        mandatory: need.isMandatory,
        matchedAsset: need.assignedName
          ? { type: 'subcontractor' as any, id: need.id, name: need.assignedName }
          : undefined,
        guidance: need.guidance || undefined,
        aiConfidence: undefined,
        sourceText: certsArray.length > 0
          ? `Απαιτούμενα: ${certsArray.join(', ')}`
          : undefined,
      });
    }

    // 5. Generate AI guidance for GAP and EXPIRING items
    const gapItems = Object.values(envelopeMap)
      .flat()
      .filter((item) => item.status === 'GAP' || item.status === 'EXPIRING');

    if (gapItems.length > 0 && gapItems.length <= 30) {
      await this.generateGuidance(gapItems);
    }

    // 6. Build envelopes with sorting (CRITICAL first)
    const envelopes: FakelosEnvelope[] = (['A', 'B', 'C', 'D'] as const).map((id) => {
      const items = envelopeMap[id].sort((a, b) => {
        const urgencyOrder = { CRITICAL: 0, WARNING: 1, OK: 2 };
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      });

      const coveredItems = items.filter(
        (i) => i.status === 'COVERED' || i.status === 'MANUAL_OVERRIDE'
      ).length;

      return {
        id,
        title: ENVELOPE_TITLES[id],
        totalItems: items.length,
        coveredItems,
        score: items.length > 0 ? Math.round((coveredItems / items.length) * 100) : 100,
        items,
      };
    });

    // 7. Calculate weighted readiness score
    const readinessScore = this.calculateReadinessScore(envelopes);

    // 8. Determine status
    let status: FakelosReport['status'] = 'NOT_READY';
    if (readinessScore >= 95) status = 'READY';
    else if (readinessScore >= 80) status = 'AT_RISK';

    // 9. Collect critical gaps and expiring items
    const allItems = envelopes.flatMap((e) => e.items);
    const criticalGaps = allItems.filter((i) => i.urgency === 'CRITICAL');
    const expiringItems = allItems.filter((i) => i.status === 'EXPIRING');

    // 10. Generate status message
    const statusMessage = this.generateStatusMessage(
      readinessScore,
      criticalGaps.length,
      expiringItems.length,
      gapItems.length
    );

    const report: FakelosReport = {
      readinessScore,
      status,
      statusMessage,
      lastCheckedAt: new Date().toISOString(),
      deadline: deadline?.toISOString() ?? null,
      daysUntilDeadline,
      envelopes,
      criticalGaps,
      expiringItems,
      vaultEmpty,
    };

    // 11. Cache report
    await db.tender.update({
      where: { id: tenderId },
      data: {
        fakelosReport: report as any,
        fakelosCheckedAt: new Date(),
      },
    });

    return report;
  }

  /**
   * Generate plain-Greek guidance for GAP/EXPIRING items via AI.
   */
  private async generateGuidance(items: FakelosItem[]): Promise<void> {
    const itemDescriptions = items
      .map(
        (item, i) =>
          `[${i}] Απαίτηση: "${item.description.slice(0, 200)}"
Άρθρο: ${item.articleReference || 'N/A'}
Υποχρεωτικό: ${item.mandatory ? 'ΝΑΙ' : 'ΟΧΙ'}
Κατάσταση: ${item.status === 'EXPIRING' ? 'ΛΗΓΕΙ ΣΥΝΤΟΜΑ' : 'ΛΕΙΠΕΙ'}`
      )
      .join('\n\n');

    const prompt = `Είσαι σύμβουλος δημοσίων συμβάσεων με 20 χρόνια εμπειρία στην Ελλάδα.
Ένας πελάτης σου (που ΔΕΝ ξέρει από διαγωνισμούς) ετοιμάζει φάκελο. Του λείπουν τα παρακάτω:

${itemDescriptions}

Για ΚΑΘΕ item, απάντησε σε JSON array. Κάθε στοιχείο:
{
  "index": 0,
  "title": "σύντομος τίτλος 5-8 λέξεις στα ελληνικά",
  "guidance": "2-3 προτάσεις σε απλά ελληνικά: τι είναι, πώς το αποκτά, αν είναι υποχρεωτικό τόνισε ότι θα αποκλειστεί",
  "actionLabel": "Ανέβασε Αρχείο",
  "estimatedCost": "~€X.XXX" ή null,
  "estimatedTime": "X ημέρες/μήνες" ή null
}

Απάντησε ΜΟΝΟ JSON array, χωρίς markdown ή backticks.`;

    try {
      const result = await ai().complete({
        messages: [
          { role: 'system', content: 'Απαντάς ΜΟΝΟ σε JSON. Χωρίς markdown, χωρίς backticks, χωρίς εξήγηση.' },
          { role: 'user', content: prompt },
        ],
        maxTokens: 4000,
        temperature: 0.3,
        responseFormat: 'json',
      });

      // Parse response
      let guidanceList: Array<{
        index: number;
        title: string;
        guidance: string;
        actionLabel: string;
        estimatedCost: string | null;
        estimatedTime: string | null;
      }> = [];

      try {
        const cleaned = result.content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        guidanceList = JSON.parse(cleaned);
      } catch {
        // If JSON parse fails, skip guidance — items will show raw requirement text
        return;
      }

      // Apply guidance to items
      for (const g of guidanceList) {
        const item = items[g.index];
        if (item) {
          item.title = g.title || item.title;
          item.guidance = g.guidance || undefined;
          item.actionLabel = g.actionLabel || 'Ανέβασε Αρχείο';
          item.estimatedCost = g.estimatedCost || undefined;
          item.estimatedTime = g.estimatedTime || undefined;
        }
      }
    } catch {
      // AI failure is non-fatal — items will show without guidance
    }
  }

  /**
   * Calculate weighted readiness score.
   * Mandatory items weight 3x, optional 1x.
   */
  private calculateReadinessScore(envelopes: FakelosEnvelope[]): number {
    let totalWeight = 0;
    let coveredWeight = 0;

    for (const envelope of envelopes) {
      for (const item of envelope.items) {
        const weight = item.mandatory ? 3 : 1;
        totalWeight += weight;
        if (item.status === 'COVERED' || item.status === 'MANUAL_OVERRIDE') {
          coveredWeight += weight;
        }
      }
    }

    if (totalWeight === 0) return 100;
    return Math.round((coveredWeight / totalWeight) * 100);
  }

  /**
   * Generate human-readable status message in Greek.
   */
  private generateStatusMessage(
    score: number,
    criticalCount: number,
    expiringCount: number,
    totalGaps: number
  ): string {
    if (score >= 95 && criticalCount === 0) {
      return 'Ο φάκελός σας είναι έτοιμος για υποβολή.';
    }

    const parts: string[] = [];

    if (totalGaps > 0) {
      parts.push(`Σας λείπουν ${totalGaps} δικαιολογητικά`);
    }

    if (criticalCount > 0) {
      parts.push(`${criticalCount} είναι κρίσιμα — χωρίς αυτά θα αποκλειστείτε`);
    }

    if (expiringCount > 0) {
      parts.push(`${expiringCount} λήγουν σύντομα`);
    }

    return parts.join('. ') + '.';
  }

  /**
   * Get war room data for all active tenders of a tenant.
   */
  async getWarRoomData(tenantId: string) {
    const tenders = await db.tender.findMany({
      where: {
        tenantId,
        status: { notIn: ['WON', 'LOST'] },
      },
      select: {
        id: true,
        title: true,
        referenceNumber: true,
        submissionDeadline: true,
        status: true,
        fakelosReport: true,
        fakelosCheckedAt: true,
      },
      orderBy: { submissionDeadline: 'asc' },
    });

    return tenders.map((tender) => {
      const report = tender.fakelosReport as FakelosReport | null;
      const deadline = tender.submissionDeadline;
      const daysUntilDeadline = deadline
        ? Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / 86400000))
        : null;

      return {
        tenderId: tender.id,
        title: tender.title,
        referenceNumber: tender.referenceNumber,
        tenderStatus: tender.status,
        deadline: deadline?.toISOString() ?? null,
        daysUntilDeadline,
        readinessScore: report?.readinessScore ?? -1,
        status: report?.status ?? ('UNCHECKED' as const),
        criticalGaps: report?.criticalGaps?.length ?? 0,
        totalGaps: report
          ? report.envelopes.reduce((sum, e) => sum + (e.totalItems - e.coveredItems), 0)
          : 0,
        lastCheckedAt: tender.fakelosCheckedAt?.toISOString() ?? null,
      };
    });
  }
}

export const fakelosChecker = new FakelosChecker();
