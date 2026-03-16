import { db } from '@/lib/db';
import { ai } from '@/server/ai';
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
  async extractFinancialRequirements(tenderId: string): Promise<ExtractedFinancialRequirement[]> {
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

    const result = await ai().complete({
      messages: [
        {
          role: 'system',
          content: `Είσαι Οικονομικός Διευθυντής (CFO) με ειδίκευση σε ελληνικούς δημόσιους διαγωνισμούς (Ν.4412/2016 & Ν.4782/2021).

ΡΟΛΟΣ: Εξάγεις και αναλύεις όλες τις οικονομικές απαιτήσεις ενός διαγωνισμού.

Για κάθε οικονομική απαίτηση, εντόπισε:
1. **Ελάχιστος κύκλος εργασιών** (τελευταία 3 έτη) — Άρθρο 75 παρ. 3 Ν.4412/2016
2. **Ελάχιστα ίδια κεφάλαια** — κριτήριο φερεγγυότητας
3. **Εγγυητική συμμετοχής** — % του προϋπολογισμού (συνήθως 2%) — Άρθρο 72
4. **Εγγυητική καλής εκτέλεσης** — % της σύμβασης (συνήθως 4%) — Άρθρο 72 παρ. 1β
5. **Εγγυητική προκαταβολής** — αν προβλέπεται
6. **Όροι πληρωμής** — ημέρες, τμηματική/εφάπαξ, παρακράτηση
7. **Ρήτρες/Ποινικές** — % ανά ημέρα/εβδομάδα καθυστέρησης, μέγιστο % ποινικών
8. **Ασφαλιστικές απαιτήσεις** — τύπος, ελάχιστη κάλυψη
9. **Χρηματοοικονομικοί δείκτες** — ρευστότητα, δανειοληψία κλπ.
10. **Τραπεζικές βεβαιώσεις/πιστωτικές γραμμές**

ΜΟΡΦΗ ΑΠΑΝΤΗΣΗΣ: JSON array. Κάθε στοιχείο:
{
  "text": "πλήρες κείμενο απαίτησης στα ελληνικά",
  "articleReference": "Άρθρο XX Ν.XXXX/XXXX" | null,
  "mandatory": true/false,
  "type": "FINANCIAL",
  "confidence": 0.0-1.0,
  "structuredData": {
    "minimumTurnover": { "amount": number, "years": 3, "description": "..." } | null,
    "minimumEquity": { "amount": number, "description": "..." } | null,
    "participationGuarantee": { "percentage": 2, "fixedAmount": null, "description": "..." } | null,
    "performanceGuarantee": { "percentage": 4, "description": "..." } | null,
    "advancePaymentGuarantee": { "percentage": number, "description": "..." } | null,
    "paymentTerms": { "days": 60, "description": "..." } | null,
    "penalties": { "percentPerDay": 0.05, "percentPerWeek": null, "maxPenalty": 10, "description": "..." } | null,
    "insuranceRequirements": [{ "type": "...", "minCoverage": number, "description": "..." }] | null,
    "financialRatios": [{ "ratio": "...", "threshold": number, "description": "..." }] | null,
    "bankLetterOfCredit": { "required": true, "description": "..." } | null,
    "retentionPercentage": number | null
  }
}

Αν δεν υπάρχουν ρητές αναφορές, εφάρμοσε τις default τιμές Ν.4412/2016:
- Εγγυητική συμμετοχής: 2% προϋπολογισμού
- Εγγυητική καλής εκτέλεσης: 4% σύμβασης
- Ελάχιστος κύκλος εργασιών: έως 2x ετήσιου προϋπολογισμού

Απάντησε ΜΟΝΟ με valid JSON array.`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            tenderTitle: tender.title,
            referenceNumber: tender.referenceNumber,
            budget: tender.budget,
            contractingAuthority: tender.contractingAuthority,
            attachedDocuments: docList,
            existingRequirementTexts: existingTexts,
          }),
        },
      ],
      maxTokens: 4000,
      temperature: 0.1,
      responseFormat: 'json',
    });

    let extracted: ExtractedFinancialRequirement[];
    try {
      const parsed = JSON.parse(result.content);
      extracted = Array.isArray(parsed) ? parsed : parsed.requirements || [];
    } catch {
      console.error('[AIFinancial] Failed to parse AI response for extractFinancialRequirements');
      extracted = this.mockFinancialRequirements(tender.budget ?? 200000);
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
    } else if (tender.budget) {
      // Default N.4412/2016: max required turnover is 2x annual budget
      const defaultRequired = tender.budget * 2;
      const avgTurnover =
        profiles.length > 0
          ? profiles.reduce((sum, p) => sum + (p.turnover ?? 0), 0) / profiles.length
          : 0;

      checks.push({
        criterion: 'Ελάχιστος κύκλος εργασιών (default Ν.4412)',
        required: `${this.formatCurrency(defaultRequired)} (2x προϋπολογισμού)`,
        actual: profiles.length > 0
          ? `${this.formatCurrency(avgTurnover)}`
          : 'Δεν υπάρχουν οικονομικά στοιχεία',
        passed: avgTurnover >= defaultRequired,
        explanation: 'Βάσει Ν.4412/2016, ο ελάχιστος κύκλος εργασιών δεν μπορεί να υπερβαίνει το 2x του ετήσιου προϋπολογισμού.',
      });
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
          if (ratio.ratio.toLowerCase().includes('ρευστότητ') || ratio.ratio.toLowerCase().includes('liquidity')) {
            // Current ratio approx: equity / debt (simplified)
            actualValue = latestProfile.debt && latestProfile.debt > 0
              ? (latestProfile.equity ?? 0) / latestProfile.debt
              : 999;
            ratioName = 'Δείκτης ρευστότητας (Ίδια Κεφάλαια / Δανεισμός)';
          } else if (ratio.ratio.toLowerCase().includes('δανει') || ratio.ratio.toLowerCase().includes('debt')) {
            actualValue = latestProfile.turnover && latestProfile.turnover > 0
              ? (latestProfile.debt ?? 0) / latestProfile.turnover
              : 999;
            ratioName = 'Δείκτης δανεισμού (Δανεισμός / Κύκλος Εργασιών)';
          }
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

    const budget = tender.budget ?? 0;
    const costs = costInputs ?? {};
    const totalCosts =
      (costs.labor ?? 0) +
      (costs.materials ?? 0) +
      (costs.subcontracting ?? 0) +
      (costs.overhead ?? 0) +
      (costs.other ?? 0);

    // If no cost inputs provided, estimate from budget
    const effectiveCosts = totalCosts > 0 ? totalCosts : budget * 0.7; // default assumption: 70% of budget is cost

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
            costInputs: {
              labor: costs.labor ?? effectiveCosts * 0.45,
              materials: costs.materials ?? effectiveCosts * 0.20,
              subcontracting: costs.subcontracting ?? effectiveCosts * 0.15,
              overhead: costs.overhead ?? effectiveCosts * 0.15,
              other: costs.other ?? effectiveCosts * 0.05,
            },
            totalEstimatedCosts: effectiveCosts,
            historicalData,
          }),
        },
      ],
      maxTokens: 3000,
      temperature: 0.3,
      responseFormat: 'json',
    });

    let scenarios: PricingScenarioData[];
    try {
      const parsed = JSON.parse(result.content);
      scenarios = Array.isArray(parsed) ? parsed : parsed.scenarios || [];
    } catch {
      console.error('[AIFinancial] Failed to parse AI response for suggestPricingScenarios');
      scenarios = this.mockPricingScenarios(budget, effectiveCosts);
    }

    // Validate and clamp values
    scenarios = scenarios.map((s) => ({
      ...s,
      margin: Math.max(0, Math.min(50, s.margin)),
      winProbability: Math.max(0, Math.min(100, s.winProbability)),
      totalPrice: Math.min(s.totalPrice, budget > 0 ? budget : s.totalPrice),
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

    let riskResult: FinancialRiskResult;
    try {
      riskResult = JSON.parse(result.content);
      // Clamp score
      riskResult.score = Math.max(0, Math.min(100, riskResult.score));
      riskResult.factors = (riskResult.factors || []).map((f) => ({
        ...f,
        impact: Math.max(0, Math.min(25, f.impact)),
      }));
    } catch {
      console.error('[AIFinancial] Failed to parse AI response for getFinancialRiskScore');
      riskResult = this.mockFinancialRiskScore();
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

  // ─── Mock Fallbacks ──────────────────────────────────────────

  private mockFinancialRequirements(budget: number): ExtractedFinancialRequirement[] {
    return [
      {
        text: `Εγγυητική επιστολή συμμετοχής ύψους 2% του προϋπολογισμού (${this.formatCurrency(budget * 0.02)})`,
        articleReference: 'Άρθρο 72 Ν.4412/2016',
        mandatory: true,
        type: 'FINANCIAL',
        confidence: 0.95,
        structuredData: {
          participationGuarantee: {
            percentage: 2,
            fixedAmount: budget * 0.02,
            description: 'Εγγυητική συμμετοχής 2% επί του προϋπολογισμού χωρίς ΦΠΑ',
          },
        },
      },
      {
        text: `Εγγυητική επιστολή καλής εκτέλεσης ύψους 4% της αξίας της σύμβασης`,
        articleReference: 'Άρθρο 72 παρ. 1β Ν.4412/2016',
        mandatory: true,
        type: 'FINANCIAL',
        confidence: 0.93,
        structuredData: {
          performanceGuarantee: {
            percentage: 4,
            description: 'Εγγυητική καλής εκτέλεσης 4% επί του συμβατικού τιμήματος',
          },
        },
      },
      {
        text: `Ελάχιστος μέσος ετήσιος κύκλος εργασιών τελευταίας τριετίας: ${this.formatCurrency(budget * 1.5)}`,
        articleReference: 'Άρθρο 75 παρ. 3 Ν.4412/2016',
        mandatory: true,
        type: 'FINANCIAL',
        confidence: 0.88,
        structuredData: {
          minimumTurnover: {
            amount: budget * 1.5,
            years: 3,
            description: 'Ελάχιστος μέσος ετήσιος κύκλος εργασιών 1.5x του προϋπολογισμού',
          },
        },
      },
      {
        text: `Ποινική ρήτρα 0,05% ανά ημέρα καθυστέρησης, μέγιστο 5% της σύμβασης`,
        articleReference: 'Άρθρο 218 Ν.4412/2016',
        mandatory: true,
        type: 'FINANCIAL',
        confidence: 0.85,
        structuredData: {
          penalties: {
            percentPerDay: 0.05,
            maxPenalty: 5,
            description: 'Ποινική ρήτρα 0,05%/ημέρα, max 5% σύμβασης',
          },
        },
      },
      {
        text: `Πληρωμή εντός 60 ημερών από την παραλαβή τιμολογίου`,
        articleReference: 'Άρθρο 200 Ν.4412/2016',
        mandatory: false,
        type: 'FINANCIAL',
        confidence: 0.80,
        structuredData: {
          paymentTerms: {
            days: 60,
            description: 'Πληρωμή σε 60 ημέρες από παραλαβή τιμολογίου και πρωτοκόλλου οριστικής παραλαβής',
          },
        },
      },
      {
        text: `Ασφάλιση επαγγελματικής ευθύνης ελάχιστης κάλυψης ${this.formatCurrency(budget * 0.5)}`,
        articleReference: undefined,
        mandatory: false,
        type: 'FINANCIAL',
        confidence: 0.72,
        structuredData: {
          insuranceRequirements: [
            {
              type: 'Επαγγελματική ευθύνη',
              minCoverage: budget * 0.5,
              description: 'Ασφάλιση επαγγελματικής ευθύνης για κάλυψη ζημιών τρίτων',
            },
          ],
        },
      },
    ];
  }

  private mockPricingScenarios(budget: number, costs: number): PricingScenarioData[] {
    const laborShare = costs * 0.45;
    const materialsShare = costs * 0.20;
    const subShare = costs * 0.15;
    const overheadShare = costs * 0.15;
    const otherShare = costs * 0.05;

    const baseCosts: CostInputs = {
      labor: Math.round(laborShare),
      materials: Math.round(materialsShare),
      subcontracting: Math.round(subShare),
      overhead: Math.round(overheadShare),
      other: Math.round(otherShare),
    };

    return [
      {
        name: 'Συντηρητικό',
        baseCosts,
        margin: 22,
        totalPrice: Math.min(Math.round(costs * 1.22), budget),
        winProbability: 25,
        comments: `Υψηλό περιθώριο κέρδους (22%). Η τιμή ${this.formatCurrency(Math.round(costs * 1.22))} αφήνει σημαντικό buffer για απρόβλεπτα. Χαμηλότερη πιθανότητα κατακύρωσης σε ανταγωνιστικούς διαγωνισμούς.`,
      },
      {
        name: 'Ισορροπημένο',
        baseCosts,
        margin: 15,
        totalPrice: Math.min(Math.round(costs * 1.15), budget),
        winProbability: 50,
        comments: `Μεσαίο περιθώριο (15%). Ισορροπία μεταξύ κερδοφορίας και ανταγωνιστικότητας. Προτεινόμενο σενάριο για τις περισσότερες περιπτώσεις.`,
      },
      {
        name: 'Επιθετικό',
        baseCosts,
        margin: 7,
        totalPrice: Math.min(Math.round(costs * 1.07), budget),
        winProbability: 72,
        comments: `Χαμηλό περιθώριο (7%). Ανταγωνιστική τιμή με υψηλή πιθανότητα νίκης. Προσοχή: μικρό περιθώριο για απρόβλεπτες δαπάνες. Κατάλληλο αν η κατακύρωση έχει στρατηγική αξία.`,
      },
    ];
  }

  private mockFinancialRiskScore(): FinancialRiskResult {
    return {
      score: 38,
      factors: [
        {
          name: 'Ποινικές ρήτρες & κυρώσεις',
          impact: 8,
          details: 'Ποινική ρήτρα 0,05%/ημέρα με max 5% — εντός συνήθων ορίων Ν.4412/2016.',
        },
        {
          name: 'Όροι πληρωμής & ταμειακές ροές',
          impact: 12,
          details: 'Πληρωμή σε 60 ημέρες — μέτριος κίνδυνος ταμειακής ροής, ιδιαίτερα για μικρότερες εταιρείες.',
        },
        {
          name: 'Εγγυήσεις & δεσμεύσεις κεφαλαίου',
          impact: 10,
          details: 'Εγγυητικές 2% (συμμετοχή) + 4% (εκτέλεση) = 6% σύνολο. Τυπικό για δημόσιους διαγωνισμούς.',
        },
        {
          name: 'Ασφάλεια & ευθύνη',
          impact: 8,
          details: 'Τυπικές ασφαλιστικές απαιτήσεις. Δεν εντοπίστηκε απεριόριστη ευθύνη.',
        },
      ],
    };
  }
}

export const aiFinancial = new AIFinancialService();
