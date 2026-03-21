import { db } from '@/lib/db';
import { ai, checkTokenBudget, logTokenUsage } from '@/server/ai';
import { requireDocuments } from '@/server/services/document-reader';
import { ANALYSIS_RULES, parseAIResponse, FINANCIAL_CRITICAL_FIELDS, NOT_FOUND, shouldChunk, chunkText } from './ai-prompts';
import type { RequirementCategory, RequirementType } from '@prisma/client';

/**
 * AI Financial Modeller — Acts as the Finance Director.
 * Extracts financial requirements from tenders,
 * checks company eligibility, suggests pricing strategies,
 * and calculates win probability at different price points.
 */

// ─── Types ──────────────────────────────────────────────────

interface FinancialRequirementData {
  minimumTurnover?: { amount: number; years: number; description: string };
  minimumEquity?: { amount: number; description: string };
  participationGuarantee?: { percentage: number; fixedAmount?: number; description: string };
  performanceGuarantee?: { percentage: number; description: string };
  advancePaymentGuarantee?: { percentage?: number; description: string };
  paymentTerms?: { days: number; description: string };
  penalties?: { percentPerDay?: number; percentPerWeek?: number; maxPenalty?: number; description: string };
  insuranceRequirements?: Array<{ type: string; minCoverage?: number; description: string }>;
  financialRatios?: Array<{ ratio: string; threshold: number; description: string }>;
  bankLetterOfCredit?: { required: boolean; description: string };
  retentionPercentage?: number;
}

interface ExtractedFinancialRequirement {
  text: string;
  articleReference?: string;
  mandatory: boolean;
  type: 'FINANCIAL';
  confidence: number;
  structuredData: Partial<FinancialRequirementData>;
}

interface EligibilityCheck {
  criterion: string;
  required: string;
  actual: string;
  passed: boolean;
  explanation: string;
}

interface EligibilityResult {
  eligible: boolean;
  status: 'ELIGIBLE' | 'BORDERLINE' | 'NOT_ELIGIBLE';
  checks: EligibilityCheck[];
}

interface CostInputs {
  labor?: number;
  materials?: number;
  subcontracting?: number;
  overhead?: number;
  other?: number;
}

interface PricingScenarioData {
  name: string;
  baseCosts: CostInputs;
  margin: number;
  totalPrice: number;
  winProbability: number;
  comments: string;
}

interface FinancialRiskFactor {
  name: string;
  impact: number; // 0-25
  details: string;
}

interface FinancialRiskResult {
  score: number; // 0-100, higher = riskier
  factors: FinancialRiskFactor[];
}

// ─── Service ────────────────────────────────────────────────

class AIFinancialService {
  // ── extractFinancialRequirements ────────────────────────────

  /**
   * Reads tender docs, extracts financial criteria: minimum turnover,
   * equity, guarantees, payment terms, penalties, insurance, ratios.
   * Updates TenderRequirement records with category=FINANCIAL_REQUIREMENTS
   * and stores structured data in evidenceRefs JSON.
   */
  async extractFinancialRequirements(tenderId: string, language: 'el' | 'en' = 'el'): Promise<ExtractedFinancialRequirement[]> {
    await requireDocuments(tenderId);
    const tender = await db.tender.findUniqueOrThrow({
      where: { id: tenderId },
      include: {
        attachedDocuments: true,
        requirements: {
          where: { category: 'FINANCIAL_REQUIREMENTS' },
        },
      },
    });

    // Gather all requirement text for context (all categories)
    const allRequirements = await db.tenderRequirement.findMany({
      where: { tenderId },
    });

    const existingTexts = allRequirements.map((r) => r.text).join('\n');
    const docList = tender.attachedDocuments.map((d) => d.fileName).join(', ');
    const docsWithText = await db.attachedDocument.findMany({
      where: { tenderId, extractedText: { not: null } },
      select: { fileName: true, extractedText: true },
    });
    let documentText = docsWithText
      .map((d) => `\n--- ${d.fileName} ---\n${d.extractedText}`)
      .join('\n');
    if (documentText.length > 80000) {
      documentText = documentText.slice(0, 80000) + '\n\n[...κείμενο περικόπηκε λόγω μεγέθους]';
    }

    // Token budget check
    const budget = await checkTokenBudget(tender.tenantId);
    if (!budget.allowed) {
      throw new Error(`Ξεπεράσατε το ημερήσιο όριο AI (${budget.used.toLocaleString()}/${budget.limit.toLocaleString()} tokens). Δοκιμάστε αύριο.`);
    }

    // Language instruction
    const langInstruction = language === 'en'
      ? 'Respond entirely in English.'
      : 'Απάντησε εξ ολοκλήρου στα ελληνικά.';

    // If document text is very large, chunk it and merge results
    const fullUserContent = JSON.stringify({
      tenderTitle: tender.title,
      referenceNumber: tender.referenceNumber,
      contractingAuthority: tender.contractingAuthority,
      attachedDocuments: docList,
      documentText,
      existingRequirementTexts: existingTexts,
    });

    if (documentText && shouldChunk(fullUserContent)) {
      // Process document in chunks
      const chunks = chunkText(documentText);
      const allExtracted: ExtractedFinancialRequirement[] = [];
      let allMissingInfo: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunkContent = JSON.stringify({
          tenderTitle: tender.title,
          referenceNumber: tender.referenceNumber,
          contractingAuthority: tender.contractingAuthority,
          attachedDocuments: docList,
          documentText: chunks[i],
          existingRequirementTexts: existingTexts,
          chunkInfo: `Τμήμα ${i + 1}/${chunks.length}`,
        });

        const chunkResult = await ai().complete({
          messages: [
            { role: 'system', content: this.getFinancialExtractionPrompt() + `\n\n${langInstruction}` },
            { role: 'user', content: chunkContent },
          ],
          maxTokens: 8000,
          temperature: 0.1,
          responseFormat: 'json',
        });

        await logTokenUsage(tenderId, `financial_extract_chunk_${i + 1}`, {
          input: chunkResult.inputTokens || 0,
          output: chunkResult.outputTokens || 0,
          total: chunkResult.totalTokens || 0,
        });

        try {
          const parsed = parseAIResponse<{ requirements: ExtractedFinancialRequirement[]; missingInfo?: string[] }>(
            chunkResult.content, ['requirements'], `financial chunk ${i + 1}`
          );
          if (Array.isArray(parsed.requirements)) allExtracted.push(...parsed.requirements);
          if (parsed.missingInfo) allMissingInfo.push(...parsed.missingInfo);
        } catch (err) {
          console.warn(`[Financial] Chunk ${i + 1} parse error, skipping:`, err);
        }
      }

      // Deduplicate missing info
      allMissingInfo = Array.from(new Set(allMissingInfo));

      return this.persistFinancialRequirements(tenderId, tender, allExtracted, allMissingInfo);
    }

    const result = await ai().complete({
      messages: [
        {
          role: 'system',
          content: `Είσαι οικονομικός σύμβουλος δημοσίων συμβάσεων εξειδικευμένος στον Ν.4412/2016.

${ANALYSIS_RULES}

Εξάγαγε τις οικονομικές απαιτήσεις αποκλειστικά από το παρεχόμενο κείμενο. ΜΗΝ εφαρμόζεις default τιμές — αν μια απαίτηση δεν αναφέρεται ρητά, μην την συμπεριλάβεις.

Για κάθε οικονομική απαίτηση που ΒΡΙΣΚΕΤΑΙ στο κείμενο, εντόπισε:
1. **Ελάχιστος κύκλος εργασιών** (τελευταία 3 έτη) — Άρθρο 75 παρ. 3 Ν.4412/2016
2. **Ελάχιστα ίδια κεφάλαια** — κριτήριο φερεγγυότητας
3. **Εγγυητική συμμετοχής** — % του προϋπολογισμού — Άρθρο 72
4. **Εγγυητική καλής εκτέλεσης** — % της σύμβασης — Άρθρο 72 παρ. 1β
5. **Εγγυητική προκαταβολής** — αν προβλέπεται ρητά
6. **Όροι πληρωμής** — ημέρες, τμηματική/εφάπαξ, παρακράτηση
7. **Ρήτρες/Ποινικές** — % ανά ημέρα/εβδομάδα καθυστέρησης, μέγιστο % ποινικών
8. **Ασφαλιστικές απαιτήσεις** — τύπος, ελάχιστη κάλυψη
9. **Χρηματοοικονομικοί δείκτες** — ρευστότητα, δανειοληψία κλπ.
10. **Τραπεζικές βεβαιώσεις/πιστωτικές γραμμές**

ΜΟΡΦΗ ΑΠΑΝΤΗΣΗΣ: JSON object:
{
  "requirements": [
    {
      "text": "πλήρες κείμενο απαίτησης στα ελληνικά",
      "articleReference": "Άρθρο XX Ν.XXXX/XXXX" | null,
      "mandatory": true/false,
      "type": "FINANCIAL",
      "confidence": 0.0-1.0,
      "structuredData": {
        "minimumTurnover": { "amount": number, "years": 3, "description": "..." } | null,
        "minimumEquity": { "amount": number, "description": "..." } | null,
        "participationGuarantee": { "percentage": number, "fixedAmount": number | null, "description": "..." } | null,
        "performanceGuarantee": { "percentage": number, "description": "..." } | null,
        "advancePaymentGuarantee": { "percentage": number, "description": "..." } | null,
        "paymentTerms": { "days": number, "description": "..." } | null,
        "penalties": { "percentPerDay": number | null, "percentPerWeek": number | null, "maxPenalty": number | null, "description": "..." } | null,
        "insuranceRequirements": [{ "type": "...", "minCoverage": number | null, "description": "..." }] | null,
        "financialRatios": [{ "ratio": "...", "threshold": number, "description": "..." }] | null,
        "bankLetterOfCredit": { "required": true, "description": "..." } | null,
        "retentionPercentage": number | null
      }
    }
  ],
  "missingInfo": ["Δεν βρέθηκε: Προϋπολογισμός", "Δεν βρέθηκε: Ποσοστό εγγυητικής"]
}

Στο "missingInfo" συμπερίλαβε κάθε κρίσιμο πεδίο από: [${FINANCIAL_CRITICAL_FIELDS.join(', ')}] που ΔΕΝ αναφέρεται στο κείμενο.
Απάντησε ΜΟΝΟ με valid JSON object.

${langInstruction}`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            tenderTitle: tender.title,
            referenceNumber: tender.referenceNumber,
            contractingAuthority: tender.contractingAuthority,
            attachedDocuments: docList,
            documentText,
            existingRequirementTexts: existingTexts,
          }),
        },
      ],
      maxTokens: 8000,
      temperature: 0.1,
      responseFormat: 'json',
    });

    await logTokenUsage(tenderId, 'financial_extract', {
      input: result.inputTokens || 0,
      output: result.outputTokens || 0,
      total: result.totalTokens || 0,
    });

    interface ExtractFinancialResponse {
      requirements: ExtractedFinancialRequirement[];
      missingInfo?: string[];
    }

    let extracted: ExtractedFinancialRequirement[];
    let missingInfo: string[] = [];
    try {
      const parsed = parseAIResponse<ExtractFinancialResponse>(
        result.content,
        ['requirements'],
        'extractFinancialRequirements'
      );
      extracted = Array.isArray(parsed.requirements) ? parsed.requirements : [];
      // Collect missingInfo from AI response, supplementing with any critical fields not present
      missingInfo = parsed.missingInfo ?? [];
      // Also flag critical fields that the AI found as NOT_FOUND in requirements text
      for (const field of FINANCIAL_CRITICAL_FIELDS) {
        const alreadyFlagged = missingInfo.some((m) => m.includes(field));
        if (!alreadyFlagged) {
          const mentionedInRequirements = extracted.some((r) =>
            r.text.includes(field) && !r.text.includes(NOT_FOUND)
          );
          // Only add if nothing was extracted about this field
          if (!mentionedInRequirements && extracted.length === 0) {
            missingInfo.push(`${NOT_FOUND}: ${field}`);
          }
        }
      }
    } catch {
      throw new Error('Η AI ανάλυση οικονομικών απέτυχε. Δοκιμάστε ξανά.');
    }

    // Persist to DB: upsert TenderRequirement records with category=FINANCIAL_REQUIREMENTS
    for (const req of extracted) {
      // Check if a similar requirement already exists (avoid duplicates)
      const existingReq = tender.requirements.find(
        (r) => r.text.substring(0, 50) === req.text.substring(0, 50)
      );

      if (existingReq) {
        // Update evidenceRefs with structured data
        await db.tenderRequirement.update({
          where: { id: existingReq.id },
          data: {
            evidenceRefs: req.structuredData as any,
            aiConfidence: req.confidence,
            criticality: this.computeFinancialCriticality(req),
          },
        });
      } else {
        await db.tenderRequirement.create({
          data: {
            tenderId,
            text: req.text,
            category: 'FINANCIAL_REQUIREMENTS' as RequirementCategory,
            articleReference: req.articleReference || null,
            mandatory: req.mandatory,
            type: 'FINANCIAL' as RequirementType,
            coverageStatus: 'UNMAPPED',
            aiConfidence: req.confidence,
            criticality: this.computeFinancialCriticality(req),
            evidenceRefs: req.structuredData as any,
          },
        });
      }
    }

    // Log activity
    await db.activity.create({
      data: {
        tenderId,
        action: 'financial_requirements_extracted',
        details: `AI Financial Modeller εξήγαγε ${extracted.length} οικονομικές απαιτήσεις`,
      },
    });

    return extracted;
  }

  // ── checkEligibility ───────────────────────────────────────

  /**
   * Loads FinancialProfile records for tenant (last 3 years) and
   * compares against extracted requirements.
   */
  async checkEligibility(tenderId: string, tenantId: string): Promise<EligibilityResult> {
    // Load financial profiles for the last 3 years
    const currentYear = new Date().getFullYear();
    const profiles = await db.financialProfile.findMany({
      where: {
        tenantId,
        year: { gte: currentYear - 3 },
      },
      orderBy: { year: 'desc' },
    });

    // Load financial requirements with structured data
    const financialReqs = await db.tenderRequirement.findMany({
      where: {
        tenderId,
        category: 'FINANCIAL_REQUIREMENTS',
      },
    });

    const tender = await db.tender.findUniqueOrThrow({
      where: { id: tenderId },
    });

    // Aggregate structured data from evidenceRefs
    const aggregated: Partial<FinancialRequirementData> = {};
    for (const req of financialReqs) {
      if (req.evidenceRefs && typeof req.evidenceRefs === 'object') {
        Object.assign(aggregated, req.evidenceRefs);
      }
    }

    // ── Guard: no FinancialProfile → cannot check eligibility ─
    if (profiles.length === 0) {
      await db.activity.create({
        data: {
          tenderId,
          action: 'financial_eligibility_check',
          details: 'Αξιολόγηση επιλεξιμότητας: BORDERLINE — Λείπουν τα οικονομικά στοιχεία εταιρείας',
        },
      });
      return {
        eligible: false,
        status: 'BORDERLINE',
        checks: [],
        missingInfo: ['Λείπουν τα οικονομικά στοιχεία εταιρείας'],
      } as EligibilityResult & { missingInfo: string[] };
    }

    const checks: EligibilityCheck[] = [];

    // ── Check 1: Minimum Turnover ──────────────────────────────
    if (aggregated.minimumTurnover) {
      const yearsToCheck = aggregated.minimumTurnover.years || 3;
      const requiredAmount = aggregated.minimumTurnover.amount;
      const relevantProfiles = profiles.slice(0, yearsToCheck);
      const avgTurnover =
        relevantProfiles.length > 0
          ? relevantProfiles.reduce((sum, p) => sum + (p.turnover ?? 0), 0) / relevantProfiles.length
          : 0;

      checks.push({
        criterion: `Ελάχιστος μέσος κύκλος εργασιών (${yearsToCheck} έτη)`,
        required: `${this.formatCurrency(requiredAmount)}`,
        actual: relevantProfiles.length > 0
          ? `${this.formatCurrency(avgTurnover)} (μ.ό. ${relevantProfiles.length} ετών)`
          : 'Δεν υπάρχουν οικονομικά στοιχεία',
        passed: avgTurnover >= requiredAmount,
        explanation: avgTurnover >= requiredAmount
          ? `Ο μέσος κύκλος εργασιών (${this.formatCurrency(avgTurnover)}) υπερβαίνει το ελάχιστο (${this.formatCurrency(requiredAmount)}).`
          : `Ο μέσος κύκλος εργασιών (${this.formatCurrency(avgTurnover)}) υπολείπεται του ελάχιστου (${this.formatCurrency(requiredAmount)}).`,
      });
      // If no explicit minimum turnover in documents, skip — do NOT fabricate a default
    }

    // ── Check 2: Minimum Equity ────────────────────────────────
    if (aggregated.minimumEquity) {
      const requiredEquity = aggregated.minimumEquity.amount;
      const latestProfile = profiles[0];
      const actualEquity = latestProfile?.equity ?? 0;

      checks.push({
        criterion: 'Ελάχιστα ίδια κεφάλαια',
        required: this.formatCurrency(requiredEquity),
        actual: latestProfile
          ? this.formatCurrency(actualEquity)
          : 'Δεν υπάρχουν στοιχεία',
        passed: actualEquity >= requiredEquity,
        explanation: actualEquity >= requiredEquity
          ? `Τα ίδια κεφάλαια (${this.formatCurrency(actualEquity)}) πληρούν την απαίτηση.`
          : `Τα ίδια κεφάλαια (${this.formatCurrency(actualEquity)}) υπολείπονται του ελάχιστου (${this.formatCurrency(requiredEquity)}).`,
      });
    }

    // ── Check 3: Participation Guarantee ───────────────────────
    if (aggregated.participationGuarantee) {
      const guaranteeAmount = aggregated.participationGuarantee.fixedAmount
        ?? (tender.budget ? tender.budget * (aggregated.participationGuarantee.percentage / 100) : 0);

      checks.push({
        criterion: 'Εγγυητική συμμετοχής',
        required: `${this.formatCurrency(guaranteeAmount)} (${aggregated.participationGuarantee.percentage}%)`,
        actual: 'Απαιτείται τραπεζική εγγυητική',
        passed: true, // Eligibility check only — whether company can obtain is separate
        explanation: `Εγγυητική συμμετοχής ${aggregated.participationGuarantee.percentage}% = ${this.formatCurrency(guaranteeAmount)}. Ελέγξτε τη δυνατότητα έκδοσης με την τράπεζα.`,
      });
    }

    // ── Check 4: Performance Guarantee ─────────────────────────
    if (aggregated.performanceGuarantee) {
      const perfAmount = tender.budget
        ? tender.budget * (aggregated.performanceGuarantee.percentage / 100)
        : 0;

      checks.push({
        criterion: 'Εγγυητική καλής εκτέλεσης',
        required: `${aggregated.performanceGuarantee.percentage}% (${this.formatCurrency(perfAmount)})`,
        actual: 'Θα απαιτηθεί μετά την κατακύρωση',
        passed: true,
        explanation: `Εγγυητική καλής εκτέλεσης ${aggregated.performanceGuarantee.percentage}% = ${this.formatCurrency(perfAmount)}.`,
      });
    }

    // ── Check 5: Financial Ratios ──────────────────────────────
    if (aggregated.financialRatios && aggregated.financialRatios.length > 0) {
      const latestProfile = profiles[0];
      for (const ratio of aggregated.financialRatios) {
        let actualValue = 0;
        let ratioName = ratio.ratio;

        if (latestProfile) {
          if (ratio.ratio.toLowerCase().includes('δανει') || ratio.ratio.toLowerCase().includes('debt')) {
            // Debt-to-turnover ratio: only calculate if turnover is available
            if (latestProfile.turnover && latestProfile.turnover > 0) {
              actualValue = (latestProfile.debt ?? 0) / latestProfile.turnover;
              ratioName = 'Δείκτης δανεισμού (Δανεισμός / Κύκλος Εργασιών)';
            } else {
              ratioName = ratio.ratio;
            }
          }
          // Note: current ratio (κυκλοφοριακή ρευστότητα) requires current assets / current liabilities
          // which are not stored in FinancialProfile — skip auto-calculation to avoid wrong approximations
        }

        checks.push({
          criterion: ratioName,
          required: `>= ${ratio.threshold}`,
          actual: latestProfile ? `${actualValue.toFixed(2)}` : 'Δεν υπάρχουν στοιχεία',
          passed: actualValue >= ratio.threshold,
          explanation: ratio.description,
        });
      }
    }

    // ── Check 6: Insurance ─────────────────────────────────────
    if (aggregated.insuranceRequirements && aggregated.insuranceRequirements.length > 0) {
      for (const ins of aggregated.insuranceRequirements) {
        checks.push({
          criterion: `Ασφαλιστική κάλυψη: ${ins.type}`,
          required: ins.minCoverage ? this.formatCurrency(ins.minCoverage) : 'Απαιτείται',
          actual: 'Χειροκίνητος έλεγχος απαιτείται',
          passed: true, // Cannot auto-check — flagged for manual review
          explanation: ins.description,
        });
      }
    }

    // ── Check 7: Bank Rating ───────────────────────────────────
    const latestProfile = profiles[0];
    if (latestProfile?.bankRating) {
      checks.push({
        criterion: 'Τραπεζική αξιολόγηση',
        required: 'Θετική',
        actual: latestProfile.bankRating,
        passed: !latestProfile.bankRating.toLowerCase().includes('negative')
          && !latestProfile.bankRating.toLowerCase().includes('αρνητικ'),
        explanation: `Τρέχουσα τραπεζική αξιολόγηση: ${latestProfile.bankRating}`,
      });
    }

    // ── Determine overall status ───────────────────────────────
    const failedCount = checks.filter((c) => !c.passed).length;
    const totalMandatory = checks.length;

    let status: EligibilityResult['status'];
    if (failedCount === 0) {
      status = 'ELIGIBLE';
    } else if (failedCount <= Math.ceil(totalMandatory * 0.2)) {
      status = 'BORDERLINE';
    } else {
      status = 'NOT_ELIGIBLE';
    }

    const eligibilityResult: EligibilityResult = {
      eligible: status === 'ELIGIBLE',
      status,
      checks,
    };

    // Log activity
    await db.activity.create({
      data: {
        tenderId,
        action: 'financial_eligibility_check',
        details: `Αξιολόγηση επιλεξιμότητας: ${status} — ${checks.filter((c) => c.passed).length}/${checks.length} κριτήρια πληρούνται`,
      },
    });

    return eligibilityResult;
  }

  // ── suggestPricingScenarios ────────────────────────────────

  /**
   * Uses budget from tender, historical pricing data, and cost inputs
   * to generate 3 scenarios: Conservative, Balanced, Aggressive.
   * Creates PricingScenario records.
   */
  async suggestPricingScenarios(
    tenderId: string,
    costInputs?: CostInputs
  ): Promise<PricingScenarioData[]> {
    const tender = await db.tender.findUniqueOrThrow({
      where: { id: tenderId },
    });

    // Load historical pricing from won/lost tenders of same tenant
    const historicalTenders = await db.tender.findMany({
      where: {
        tenantId: tender.tenantId,
        status: { in: ['WON', 'LOST', 'SUBMITTED'] },
        id: { not: tenderId },
        budget: { not: null },
      },
      include: {
        pricingScenarios: {
          where: { isSelected: true },
        },
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    const historicalData = historicalTenders.map((t) => ({
      title: t.title,
      budget: t.budget,
      status: t.status,
      selectedPrice: t.pricingScenarios[0]?.totalPrice ?? null,
      margin: t.pricingScenarios[0]?.margin ?? null,
    }));

    // Guard: no confirmed budget → cannot generate valid pricing scenarios
    if (!tender.budget || tender.budget <= 0) {
      await db.activity.create({
        data: {
          tenderId,
          action: 'pricing_scenarios_generated',
          details: 'Αδυναμία δημιουργίας σεναρίων τιμολόγησης: δεν βρέθηκε επιβεβαιωμένος προϋπολογισμός στα έγγραφα',
        },
      });
      return [];
    }

    const budget = tender.budget;
    const costs = costInputs ?? {};
    const totalCosts =
      (costs.labor ?? 0) +
      (costs.materials ?? 0) +
      (costs.subcontracting ?? 0) +
      (costs.overhead ?? 0) +
      (costs.other ?? 0);

    // Only use actual cost inputs — do NOT assume 70% of budget
    const hasCostInputs = totalCosts > 0;

    const result = await ai().complete({
      messages: [
        {
          role: 'system',
          content: `Είσαι Οικονομικός Διευθυντής (CFO) ελληνικής εταιρείας. Δημιουργείς σενάρια τιμολόγησης για δημόσιους διαγωνισμούς.

ΚΑΝΟΝΕΣ:
- Στους ελληνικούς δημόσιους διαγωνισμούς, η τιμή ΔΕΝ μπορεί να υπερβαίνει τον προϋπολογισμό
- Ασυνήθιστα χαμηλές προσφορές (<70% του budget) μπορεί να απορριφθούν (Άρθρο 88 Ν.4412/2016)
- Κριτήρια ανάθεσης: "χαμηλότερη τιμή" ή "βέλτιστη σχέση ποιότητας-τιμής"
- Η πιθανότητα νίκης εξαρτάται από: απόσταση από budget, ανταγωνισμό, ιστορικά δεδομένα
- ΑΠΑΓΟΡΕΥΕΤΑΙ totalPrice > budget

Δημιούργησε 3 σενάρια:
1. **Συντηρητικό (Conservative)**: Υψηλό περιθώριο (20-25%), χαμηλότερη πιθανότητα νίκης
2. **Ισορροπημένο (Balanced)**: Μεσαίο περιθώριο (12-18%), μέτρια πιθανότητα νίκης
3. **Επιθετικό (Aggressive)**: Χαμηλό περιθώριο (5-10%), υψηλότερη πιθανότητα νίκης

ΜΟΡΦΗ ΑΠΑΝΤΗΣΗΣ: JSON array 3 objects:
[{
  "name": "Συντηρητικό" | "Ισορροπημένο" | "Επιθετικό",
  "baseCosts": { "labor": number, "materials": number, "subcontracting": number, "overhead": number, "other": number },
  "margin": number (percentage, e.g. 22.5),
  "totalPrice": number,
  "winProbability": number (0-100),
  "comments": "string with analysis in Greek"
}]

Σημαντικό: totalPrice = totalBaseCosts * (1 + margin/100). Πρέπει totalPrice <= budget.`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            tenderTitle: tender.title,
            budget,
            awardCriteria: tender.awardCriteria ?? 'χαμηλότερη τιμή',
            costInputs: hasCostInputs ? costs : null,
            totalEstimatedCosts: hasCostInputs ? totalCosts : null,
            note: hasCostInputs
              ? 'Χρησιμοποίησε τα παρεχόμενα κόστη ως βάση.'
              : 'Δεν παρασχέθηκαν στοιχεία κόστους. Δημιούργησε σενάρια βάσει μόνο του budget.',
            historicalData,
          }),
        },
      ],
      maxTokens: 6000,
      temperature: 0.3,
      responseFormat: 'json',
    });

    await logTokenUsage(tenderId, 'pricing_scenarios', {
      input: result.inputTokens || 0,
      output: result.outputTokens || 0,
      total: result.totalTokens || 0,
    });

    let scenarios: PricingScenarioData[];
    try {
      const parsed = parseAIResponse<PricingScenarioData[] | { scenarios: PricingScenarioData[] }>(result.content, [], 'suggestPricingScenarios');
      scenarios = Array.isArray(parsed) ? parsed : parsed.scenarios || [];
    } catch {
      throw new Error('Η AI ανάλυση οικονομικών απέτυχε. Δοκιμάστε ξανά.');
    }

    // Validate and clamp values — totalPrice must not exceed confirmed budget
    scenarios = scenarios.map((s) => ({
      ...s,
      margin: Math.max(0, Math.min(50, s.margin)),
      winProbability: Math.max(0, Math.min(100, s.winProbability)),
      totalPrice: Math.min(s.totalPrice, budget),
    }));

    // Delete existing non-selected scenarios for this tender
    await db.pricingScenario.deleteMany({
      where: { tenderId, isSelected: false },
    });

    // Persist scenarios to DB
    for (const scenario of scenarios) {
      await db.pricingScenario.create({
        data: {
          tenderId,
          name: scenario.name,
          baseCosts: scenario.baseCosts as any,
          margin: scenario.margin,
          totalPrice: scenario.totalPrice,
          winProbability: scenario.winProbability,
          comments: scenario.comments,
          isSelected: false,
        },
      });
    }

    // Log activity
    await db.activity.create({
      data: {
        tenderId,
        action: 'pricing_scenarios_generated',
        details: `AI Financial Modeller δημιούργησε ${scenarios.length} σενάρια τιμολόγησης (${scenarios.map((s) => `${s.name}: ${this.formatCurrency(s.totalPrice)}`).join(', ')})`,
      },
    });

    return scenarios;
  }

  // ── getFinancialRiskScore ──────────────────────────────────

  /**
   * Analyzes penalties, payment terms, guarantees, insurance.
   * Returns 0-100 score with breakdown.
   */
  async getFinancialRiskScore(tenderId: string): Promise<FinancialRiskResult> {
    const tender = await db.tender.findUniqueOrThrow({
      where: { id: tenderId },
    });

    const financialReqs = await db.tenderRequirement.findMany({
      where: {
        tenderId,
        category: 'FINANCIAL_REQUIREMENTS',
      },
    });

    // Load legal clauses related to financial risk
    const legalClauses = await db.legalClause.findMany({
      where: {
        tenderId,
        category: { in: ['PENALTIES', 'PAYMENT_TERMS', 'GUARANTEES', 'INSURANCE', 'LIABILITY'] },
      },
    });

    const result = await ai().complete({
      messages: [
        {
          role: 'system',
          content: `Είσαι Οικονομικός Αναλυτής Κινδύνου σε ελληνικούς δημόσιους διαγωνισμούς.

Αξιολόγησε τον οικονομικό κίνδυνο ενός διαγωνισμού σε κλίμακα 0-100 (0=μηδενικός, 100=ακραίος).

Παράγοντες κινδύνου (κάθε ένας 0-25 impact):

1. **Ποινικές ρήτρες & κυρώσεις** (0-25):
   - >0.1%/ημέρα ή >10% max penalty = υψηλός κίνδυνος
   - Μη-καθορισμένο ανώτατο όριο = πολύ υψηλός κίνδυνος

2. **Όροι πληρωμής & ταμειακές ροές** (0-25):
   - >90 ημέρες πληρωμής = υψηλός κίνδυνος
   - Μεγάλη προκαταβολή χωρίς εγγυήσεις = κίνδυνος
   - Παρακράτηση >10% = αυξημένος κίνδυνος

3. **Εγγυήσεις & δεσμεύσεις κεφαλαίου** (0-25):
   - Εγγυητική >5% = αυξημένος κίνδυνος
   - Πολλαπλές εγγυητικές ταυτόχρονα = υψηλός κίνδυνος

4. **Ασφάλεια & ευθύνη** (0-25):
   - Απεριόριστη ευθύνη = πολύ υψηλός κίνδυνος
   - Ασφαλιστικές απαιτήσεις >5% σύμβασης = αυξημένος κίνδυνος

ΜΟΡΦΗ ΑΠΑΝΤΗΣΗΣ: JSON
{
  "score": number (0-100),
  "factors": [
    { "name": "string", "impact": number (0-25), "details": "string in Greek" }
  ]
}`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            tenderTitle: tender.title,
            budget: tender.budget,
            financialRequirements: financialReqs.map((r) => ({
              text: r.text,
              evidenceRefs: r.evidenceRefs,
            })),
            legalClauses: legalClauses.map((c) => ({
              text: c.clauseText,
              category: c.category,
              riskLevel: c.riskLevel,
            })),
          }),
        },
      ],
      maxTokens: 2000,
      temperature: 0.2,
      responseFormat: 'json',
    });

    await logTokenUsage(tenderId, 'financial_risk_score', {
      input: result.inputTokens || 0,
      output: result.outputTokens || 0,
      total: result.totalTokens || 0,
    });

    let riskResult: FinancialRiskResult;
    try {
      riskResult = parseAIResponse<FinancialRiskResult>(result.content, [], 'getFinancialRiskScore');
      // Clamp score
      riskResult.score = Math.max(0, Math.min(100, riskResult.score));
      riskResult.factors = (riskResult.factors || []).map((f) => ({
        ...f,
        impact: Math.max(0, Math.min(25, f.impact)),
      }));
    } catch {
      throw new Error('Η AI ανάλυση οικονομικών απέτυχε. Δοκιμάστε ξανά.');
    }

    // Log activity
    await db.activity.create({
      data: {
        tenderId,
        action: 'financial_risk_scored',
        details: `Οικονομικός κίνδυνος: ${riskResult.score}/100 — ${riskResult.factors.map((f) => `${f.name}: ${f.impact}/25`).join(', ')}`,
      },
    });

    return riskResult;
  }

  // ─── Private Helpers ─────────────────────────────────────────

  private computeFinancialCriticality(req: ExtractedFinancialRequirement): number {
    // 5 = highest criticality
    if (req.mandatory && req.confidence > 0.9) return 5;
    if (req.mandatory) return 4;
    if (req.confidence > 0.8) return 3;
    if (req.confidence > 0.5) return 2;
    return 1;
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount);
  }

  /** Shared system prompt for financial extraction */
  private getFinancialExtractionPrompt(): string {
    return `Είσαι οικονομικός σύμβουλος δημοσίων συμβάσεων εξειδικευμένος στον Ν.4412/2016.

${ANALYSIS_RULES}

Εξάγαγε τις οικονομικές απαιτήσεις αποκλειστικά από το παρεχόμενο κείμενο. ΜΗΝ εφαρμόζεις default τιμές — αν μια απαίτηση δεν αναφέρεται ρητά, μην την συμπεριλάβεις.

Για κάθε οικονομική απαίτηση που ΒΡΙΣΚΕΤΑΙ στο κείμενο, εντόπισε:
1. **Ελάχιστος κύκλος εργασιών** (τελευταία 3 έτη) — Άρθρο 75 παρ. 3 Ν.4412/2016
2. **Ελάχιστα ίδια κεφάλαια** — κριτήριο φερεγγυότητας
3. **Εγγυητική συμμετοχής** — % του προϋπολογισμού — Άρθρο 72
4. **Εγγυητική καλής εκτέλεσης** — % της σύμβασης — Άρθρο 72 παρ. 1β
5. **Εγγυητική προκαταβολής** — αν προβλέπεται ρητά
6. **Όροι πληρωμής** — ημέρες, τμηματική/εφάπαξ, παρακράτηση
7. **Ρήτρες/Ποινικές** — % ανά ημέρα/εβδομάδα καθυστέρησης, μέγιστο % ποινικών
8. **Ασφαλιστικές απαιτήσεις** — τύπος, ελάχιστη κάλυψη
9. **Χρηματοοικονομικοί δείκτες** — ρευστότητα, δανειοληψία κλπ.
10. **Τραπεζικές βεβαιώσεις/πιστωτικές γραμμές**

ΜΟΡΦΗ ΑΠΑΝΤΗΣΗΣ: JSON object:
{
  "requirements": [
    {
      "text": "πλήρες κείμενο απαίτησης στα ελληνικά",
      "articleReference": "Άρθρο XX Ν.XXXX/XXXX",
      "mandatory": true,
      "type": "FINANCIAL",
      "confidence": 0.9,
      "structuredData": {}
    }
  ],
  "missingInfo": ["Δεν βρέθηκε: ..."]
}

Στο "missingInfo" συμπερίλαβε κάθε κρίσιμο πεδίο από: [${FINANCIAL_CRITICAL_FIELDS.join(', ')}] που ΔΕΝ αναφέρεται στο κείμενο.
Απάντησε ΜΟΝΟ με valid JSON object.`;
  }

  /** Persist extracted financial requirements to DB */
  private async persistFinancialRequirements(
    tenderId: string,
    tender: { requirements: Array<{ id: string; text: string }> },
    extracted: ExtractedFinancialRequirement[],
    missingInfo: string[]
  ): Promise<ExtractedFinancialRequirement[]> {
    for (const req of extracted) {
      const existingReq = tender.requirements.find(
        (r) => r.text.substring(0, 50) === req.text.substring(0, 50)
      );

      if (existingReq) {
        await db.tenderRequirement.update({
          where: { id: existingReq.id },
          data: {
            evidenceRefs: req.structuredData as any,
            aiConfidence: req.confidence,
            criticality: this.computeFinancialCriticality(req),
          },
        });
      } else {
        await db.tenderRequirement.create({
          data: {
            tenderId,
            text: req.text,
            category: 'FINANCIAL_REQUIREMENTS' as RequirementCategory,
            articleReference: req.articleReference || null,
            mandatory: req.mandatory,
            type: 'FINANCIAL' as RequirementType,
            coverageStatus: 'UNMAPPED',
            aiConfidence: req.confidence,
            criticality: this.computeFinancialCriticality(req),
            evidenceRefs: req.structuredData as any,
          },
        });
      }
    }

    await db.activity.create({
      data: {
        tenderId,
        action: 'financial_requirements_extracted',
        details: `AI Financial Modeller εξήγαγε ${extracted.length} οικονομικές απαιτήσεις`,
      },
    });

    return extracted;
  }
}

export const aiFinancial = new AIFinancialService();
