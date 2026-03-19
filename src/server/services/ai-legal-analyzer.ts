/**
 * AI Legal Analyzer -- Acts as the Legal Counsel.
 * Extracts and classifies contract clauses,
 * assesses legal risk, proposes clarification questions.
 * Specialized in N.4412/2016 Greek procurement law.
 *
 * This service acts as a virtual legal expert who reads through
 * tender contract documents and identifies clauses that may pose
 * risk, require negotiation, or need clarification before signing.
 */

import { db } from '@/lib/db';
import { ai, checkTokenBudget, logTokenUsage } from '@/server/ai';
import { readTenderDocuments, requireDocuments } from '@/server/services/document-reader';
import type { LegalClauseCategory, RiskLevel } from '@prisma/client';
import { ANALYSIS_RULES, parseAIResponse, LEGAL_CRITICAL_FIELDS, NOT_FOUND, shouldChunk, chunkText } from './ai-prompts';

// ─── Types ──────────────────────────────────────────────────

/** A clause extracted by AI from tender documents. */
interface ExtractedClause {
  clauseText: string;
  category: LegalClauseCategory;
  articleRef: string | null;
  pageNumber: number | null;
}

/** Risk assessment for a single clause. */
interface ClauseRiskAssessment {
  clauseId: string;
  riskLevel: RiskLevel;
  riskReason: string;
  recommendation: string;
}

/** A draft clarification question generated for a risky clause. */
interface DraftClarification {
  clauseId: string;
  questionText: string;
  priority: number; // 1-5, 5 = highest
}

/** Aggregate legal risk summary for a tender. */
interface LegalRiskSummary {
  totalClauses: number;
  byRiskLevel: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    CRITICAL: number;
  };
  topRisks: Array<{
    clause: string;
    category: string;
    risk: string;
    riskLevel: string;
    recommendation: string;
  }>;
  overallRiskScore: number; // 0-100 (0=no risk, 100=extreme risk)
  missingInfo: string[];
}

// ─── Valid Categories ───────────────────────────────────────

const VALID_CATEGORIES: LegalClauseCategory[] = [
  'LIABILITY',
  'TERMINATION',
  'IP_RIGHTS',
  'CONFIDENTIALITY',
  'PENALTIES',
  'INSURANCE',
  'DATA_PROTECTION',
  'GUARANTEES',
  'SUBCONTRACTING',
  'FORCE_MAJEURE',
  'PAYMENT_TERMS',
  'DISPUTE_RESOLUTION',
  'OTHER',
];

const VALID_RISK_LEVELS: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

// ─── System Prompts ─────────────────────────────────────────

const EXTRACT_CLAUSES_SYSTEM_PROMPT = `Είσαι νομικός σύμβουλος εξειδικευμένος στο δίκαιο δημοσίων συμβάσεων (Ν.4412/2016).

${ANALYSIS_RULES}

Εξάγαγε τις νομικές ρήτρες από το κείμενο σε μορφή JSON:
{
  "clauses": [
    {
      "clauseText": "...",
      "category": "PENALTIES|PAYMENT_TERMS|GUARANTEES|INSURANCE|LIABILITY|TERMINATION|CONFIDENTIALITY|IP_RIGHTS|DISPUTE_RESOLUTION|SUBCONTRACTING|OTHER",
      "articleRef": "Άρθρο X ή null",
      "pageNumber": null
    }
  ],
  "missingInfo": ["Δεν βρέθηκε: ..."]
}

Αν δεν βρεις νομικές ρήτρες, επέστρεψε: {"clauses": [], "missingInfo": ["Δεν βρέθηκαν νομικές ρήτρες στο κείμενο"]}`;

const ASSESS_RISKS_SYSTEM_PROMPT = `Είσαι ανώτερος νομικός σύμβουλος δημοσίων διαγωνισμών με βαθιά γνώση του Ν.4412/2016
και του ευρωπαϊκού δικαίου δημοσίων συμβάσεων (Οδηγίες 2014/24/ΕΕ, 2014/25/ΕΕ).

Αξιολογείς κάθε νομική ρήτρα ως προς τον κίνδυνο για τον ανάδοχο.

Επίπεδα κινδύνου:
- LOW: Τυπικός όρος, σύμφωνος με τη νομοθεσία και την πρακτική
- MEDIUM: Μικρή απόκλιση ή αυξημένο κόστος, αλλά διαχειρίσιμο
- HIGH: Σημαντικός κίνδυνος, χρειάζεται ερώτημα/διευκρίνιση/τροποποίηση
- CRITICAL: Εξαιρετικά επικίνδυνο, πιθανώς παράνομο ή δυσανάλογο

Red flags (αυτόματα HIGH ή CRITICAL):
- Απεριόριστη ευθύνη χωρίς πλαφόν
- Πληρωμή > 30 ημέρες (παραβίαση Οδηγίας 2011/7/ΕΕ)
- Μονομερής καταγγελία χωρίς αντικειμενικά κριτήρια
- Πλήρης μεταβίβαση IP χωρίς εξαίρεση pre-existing
- Απουσία ρήτρας ανωτέρας βίας ή πολύ στενός ορισμός
- Υπέρμετρα πρόστιμα (> 0.5%/εβδομάδα)
- Αυτοδίκαιη καταγγελία χωρίς δικαίωμα αποκατάστασης (cure period)

Για κάθε ρήτρα απάντησε:
{
  "assessments": [
    {
      "clauseId": "...",
      "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "riskReason": "...",
      "recommendation": "..."
    }
  ]
}`;

const PROPOSE_CLARIFICATIONS_SYSTEM_PROMPT = `Είσαι νομικός σύμβουλος που συντάσσει ερωτήματα διευκρινίσεων σε αναθέτουσες αρχές
ελληνικών δημοσίων διαγωνισμών (Ν.4412/2016).

Για κάθε ρήτρα υψηλού/κρίσιμου κινδύνου, σύνταξε ένα επαγγελματικό ερώτημα
διευκρίνισης στα ελληνικά που:
1. Αναφέρει συγκεκριμένα τον όρο/άρθρο
2. Θέτει σαφές ερώτημα
3. Προτείνει εναλλακτική διατύπωση (αν κρίνεται)
4. Αναφέρεται σε νομοθεσία (Ν.4412/2016, Οδηγίες ΕΕ) για τεκμηρίωση

Ο τόνος πρέπει να είναι επαγγελματικός, ευγενικός, και νομικά ακριβής.

Απάντησε σε JSON:
{
  "questions": [
    {
      "clauseId": "...",
      "questionText": "...",
      "priority": number (1-5, 5=highest)
    }
  ]
}`;

// ─── Service Class ──────────────────────────────────────────

class AILegalAnalyzer {
  /**
   * Extract legal clauses from tender documents using AI.
   * Reads the tender's attached documents and requirements, then
   * uses AI to identify and classify contract clauses.
   *
   * Creates LegalClause records in the database with category and articleRef.
   *
   * @param tenderId - The ID of the tender to analyze
   * @returns Array of created LegalClause records
   */
  async extractClauses(tenderId: string, language: 'el' | 'en' = 'el') {
    await requireDocuments(tenderId);
    const tender = await db.tender.findUniqueOrThrow({
      where: { id: tenderId },
      include: {
        attachedDocuments: true,
        requirements: true,
        brief: true,
      },
    });

    // Build context from available data
    const contextParts: string[] = [];
    contextParts.push(`Τίτλος: ${tender.title}`);
    if (tender.referenceNumber) contextParts.push(`Αρ. Αναφοράς: ${tender.referenceNumber}`);
    if (tender.contractingAuthority) contextParts.push(`Αναθέτουσα Αρχή: ${tender.contractingAuthority}`);
    if (tender.brief) {
      contextParts.push(`\nΣύνοψη: ${tender.brief.summaryText}`);
    }

    // Add requirements that are CONTRACT_TERMS
    const contractTerms = tender.requirements.filter(r => r.category === 'CONTRACT_TERMS');
    if (contractTerms.length > 0) {
      contextParts.push('\n--- Συμβατικοί Όροι (Εξαχθέντες) ---');
      for (const req of contractTerms) {
        contextParts.push(`${req.articleReference ? `[${req.articleReference}] ` : ''}${req.text}`);
      }
    }

    // Add all requirements as additional context
    if (tender.requirements.length > 0) {
      contextParts.push('\n--- Πλήρης Λίστα Απαιτήσεων ---');
      for (const req of tender.requirements) {
        contextParts.push(`[${req.category}] ${req.text}`);
      }
    }

    // Read ACTUAL document content from attached files
    const documentText = await readTenderDocuments(tenderId);
    if (documentText) {
      contextParts.push('\n--- ΠΛΗΡΕΣ ΚΕΙΜΕΝΟ ΕΓΓΡΑΦΩΝ ---');
      contextParts.push(documentText);
    } else if (tender.attachedDocuments.length > 0) {
      contextParts.push('\n--- Συνημμένα Έγγραφα (δεν ήταν δυνατή η ανάγνωση) ---');
      for (const doc of tender.attachedDocuments) {
        contextParts.push(`- ${doc.fileName} (${doc.category || 'N/A'})`);
      }
    }

    const contextText = contextParts.join('\n');

    // Token budget check
    const tenderData = await db.tender.findUniqueOrThrow({ where: { id: tenderId }, select: { tenantId: true } });
    const budget = await checkTokenBudget(tenderData.tenantId);
    if (!budget.allowed) {
      throw new Error(`Ξεπεράσατε το ημερήσιο όριο AI (${budget.used.toLocaleString()}/${budget.limit.toLocaleString()} tokens). Δοκιμάστε αύριο.`);
    }

    // Language instruction
    const langInstruction = language === 'en'
      ? 'Respond entirely in English.'
      : 'Απάντησε εξ ολοκλήρου στα ελληνικά.';

    // Chunk large documents for legal analysis
    let extractedClauses: ExtractedClause[] = [];

    if (shouldChunk(contextText)) {
      const chunks = chunkText(contextText);
      for (let i = 0; i < chunks.length; i++) {
        const aiResult = await ai().complete({
          messages: [
            { role: 'system', content: EXTRACT_CLAUSES_SYSTEM_PROMPT + `\n\n${langInstruction}` },
            {
              role: 'user',
              content: `Εντόπισε τις νομικές ρήτρες/όρους από το τμήμα ${i + 1}/${chunks.length}:\n\n${chunks[i]}`,
            },
          ],
          maxTokens: 8000,
          temperature: 0.2,
          responseFormat: 'json',
        });

        await logTokenUsage(tenderId, `legal_extract_chunk_${i + 1}`, {
          input: aiResult.inputTokens || 0,
          output: aiResult.outputTokens || 0,
          total: aiResult.totalTokens || 0,
        });

        try {
          const parsed = parseAIResponse<{ clauses: ExtractedClause[]; missingInfo?: string[] }>(
            aiResult.content, ['clauses'], `extractClauses chunk ${i + 1}`
          );
          if (Array.isArray(parsed.clauses)) {
            extractedClauses.push(...parsed.clauses);
          }
        } catch (err) {
          console.warn(`[Legal] Chunk ${i + 1} parse error, skipping:`, err);
        }
      }
    } else {
      // Single call for normal-sized documents
      const aiResult = await ai().complete({
        messages: [
          { role: 'system', content: EXTRACT_CLAUSES_SYSTEM_PROMPT + `\n\n${langInstruction}` },
          {
            role: 'user',
            content: `Εντόπισε τις νομικές ρήτρες/όρους από τα ακόλουθα έγγραφα διαγωνισμού:\n\n${contextText}`,
          },
        ],
        maxTokens: 8000,
        temperature: 0.2,
        responseFormat: 'json',
      });

      await logTokenUsage(tenderId, 'legal_extract', {
        input: aiResult.inputTokens || 0,
        output: aiResult.outputTokens || 0,
        total: aiResult.totalTokens || 0,
      });

      const parsed = parseAIResponse<{ clauses: ExtractedClause[]; missingInfo?: string[] }>(
        aiResult.content, ['clauses'], 'extractClauses'
      );
      extractedClauses = Array.isArray(parsed.clauses) ? parsed.clauses : [];
    }
    // Empty result is valid — some tenders have no explicit legal clauses

    // Delete existing clauses for this tender (allow re-extraction)
    await db.legalClause.deleteMany({
      where: { tenderId },
    });

    // Create LegalClause records
    const createdClauses = [];

    for (const clause of extractedClauses) {
      // Validate category
      const category: LegalClauseCategory = VALID_CATEGORIES.includes(clause.category as LegalClauseCategory)
        ? (clause.category as LegalClauseCategory)
        : 'OTHER';

      const legalClause = await db.legalClause.create({
        data: {
          tenderId,
          clauseText: clause.clauseText || '',
          category,
          articleRef: clause.articleRef || null,
          pageNumber: typeof clause.pageNumber === 'number' ? clause.pageNumber : null,
          riskLevel: 'LOW', // Will be updated by assessRisks
          sourceDocumentId: null,
        },
      });

      createdClauses.push(legalClause);
    }

    // Log activity
    await db.activity.create({
      data: {
        tenderId,
        action: 'legal_clauses_extracted',
        details: `Εντοπίστηκαν ${createdClauses.length} νομικές ρήτρες/όροι σύμβασης ` +
          `(${Array.from(new Set(createdClauses.map(c => c.category))).join(', ')})`,
      },
    });

    return createdClauses;
  }

  /**
   * Assess the risk level of each LegalClause for a tender.
   * Uses AI to evaluate clauses against Greek procurement law (N.4412/2016).
   *
   * Flags:
   * - Excessive penalties (> 0.5%/week)
   * - Short payment terms (< 30 days)
   * - Unlimited liability
   * - Full IP transfer without pre-existing IP exclusion
   * - No force majeure clause or overly narrow definition
   * - Harsh termination clauses
   *
   * Updates LegalClause records with riskLevel, riskReason, and recommendation.
   *
   * @param tenderId - The ID of the tender whose clauses to assess
   * @returns Array of updated LegalClause records
   */
  async assessRisks(tenderId: string) {
    await requireDocuments(tenderId);
    const clauses = await db.legalClause.findMany({
      where: { tenderId },
    });

    if (clauses.length === 0) {
      return [];
    }

    // Build context for AI
    const clauseList = clauses.map((c, i) => ({
      id: c.id,
      index: i + 1,
      category: c.category,
      articleRef: c.articleRef,
      clauseText: c.clauseText,
    }));

    const aiResult = await ai().complete({
      messages: [
        { role: 'system', content: ASSESS_RISKS_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Αξιολόγησε τον κίνδυνο κάθε ρήτρας:\n\n${JSON.stringify(clauseList, null, 2)}`,
        },
      ],
      maxTokens: 8000,
      temperature: 0.2,
      responseFormat: 'json',
    });

    await logTokenUsage(tenderId, 'legal_assess_risks', {
      input: aiResult.inputTokens || 0,
      output: aiResult.outputTokens || 0,
      total: aiResult.totalTokens || 0,
    });

    const parsedAssessments = parseAIResponse<{ assessments: ClauseRiskAssessment[] }>(
      aiResult.content,
      ['assessments'],
      'assessRisks'
    );
    const assessments: ClauseRiskAssessment[] = Array.isArray(parsedAssessments.assessments)
      ? parsedAssessments.assessments
      : [];

    // Build a set of valid clause IDs from the DB query
    const validClauseIds = new Set(clauses.map(c => c.id));

    const assessmentMap = new Map<string, ClauseRiskAssessment>();
    for (const assessment of assessments) {
      if (!assessment.clauseId) continue;
      if (!validClauseIds.has(assessment.clauseId)) {
        console.warn(`[Legal] assessRisks: unknown clauseId "${assessment.clauseId}" — skipping`);
        continue;
      }
      assessmentMap.set(assessment.clauseId, assessment);
    }

    // Update clauses with risk assessments
    const updatedClauses = [];

    for (const clause of clauses) {
      const assessment = assessmentMap.get(clause.id);

      if (assessment) {
        // Validate risk level
        const riskLevel: RiskLevel = VALID_RISK_LEVELS.includes(assessment.riskLevel as RiskLevel)
          ? (assessment.riskLevel as RiskLevel)
          : 'LOW';

        // Track confidence if provided (0-1, validated by parseAIResponse)
        const confidence = typeof (assessment as any).confidence === 'number'
          ? (assessment as any).confidence
          : null;

        const updated = await db.legalClause.update({
          where: { id: clause.id },
          data: {
            riskLevel,
            riskReason: assessment.riskReason || null,
            recommendation: assessment.recommendation || null,
          },
        });

        if (confidence !== null) {
          console.info(`[Legal] clauseId=${clause.id} confidence=${confidence}`);
        }

        updatedClauses.push(updated);
      } else {
        // No assessment found — apply rule-based defaults
        const riskLevel = this.defaultRiskLevel(clause.category as LegalClauseCategory);
        const updated = await db.legalClause.update({
          where: { id: clause.id },
          data: {
            riskLevel,
            riskReason: 'Αυτόματη αξιολόγηση βάσει κατηγορίας ρήτρας.',
            recommendation: 'Απαιτείται χειροκίνητος νομικός έλεγχος.',
          },
        });
        updatedClauses.push(updated);
      }
    }

    // Count risk levels for logging
    const riskCounts = {
      LOW: updatedClauses.filter(c => c.riskLevel === 'LOW').length,
      MEDIUM: updatedClauses.filter(c => c.riskLevel === 'MEDIUM').length,
      HIGH: updatedClauses.filter(c => c.riskLevel === 'HIGH').length,
      CRITICAL: updatedClauses.filter(c => c.riskLevel === 'CRITICAL').length,
    };

    // Log activity
    await db.activity.create({
      data: {
        tenderId,
        action: 'legal_risk_assessed',
        details: `Αξιολόγηση νομικού κινδύνου: ${updatedClauses.length} ρήτρες — ` +
          `LOW: ${riskCounts.LOW}, MEDIUM: ${riskCounts.MEDIUM}, ` +
          `HIGH: ${riskCounts.HIGH}, CRITICAL: ${riskCounts.CRITICAL}`,
      },
    });

    return updatedClauses;
  }

  /**
   * Generate draft clarification questions for HIGH and CRITICAL risk clauses.
   * Creates ClarificationQuestion records with status=DRAFT.
   *
   * @param tenderId - The ID of the tender
   * @returns Array of created ClarificationQuestion records
   */
  async proposeClarifications(tenderId: string) {
    await requireDocuments(tenderId);
    const clauses = await db.legalClause.findMany({
      where: {
        tenderId,
        riskLevel: { in: ['HIGH', 'CRITICAL'] },
      },
    });

    if (clauses.length === 0) {
      return [];
    }

    // Build context for AI
    const clauseData = clauses.map(c => ({
      id: c.id,
      category: c.category,
      riskLevel: c.riskLevel,
      clauseText: c.clauseText,
      articleRef: c.articleRef,
      riskReason: c.riskReason,
    }));

    const aiResult = await ai().complete({
      messages: [
        { role: 'system', content: PROPOSE_CLARIFICATIONS_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Σύνταξε ερωτήματα διευκρινίσεων για τις παρακάτω επικίνδυνες ρήτρες:\n\n${JSON.stringify(clauseData, null, 2)}`,
        },
      ],
      maxTokens: 6000,
      temperature: 0.4,
      responseFormat: 'json',
    });

    await logTokenUsage(tenderId, 'legal_clarifications', {
      input: aiResult.inputTokens || 0,
      output: aiResult.outputTokens || 0,
      total: aiResult.totalTokens || 0,
    });

    const parsedQuestions = parseAIResponse<{ questions: DraftClarification[] }>(
      aiResult.content,
      ['questions'],
      'proposeClarifications'
    );
    const draftQuestions: DraftClarification[] = Array.isArray(parsedQuestions.questions)
      ? parsedQuestions.questions
      : [];

    // Delete existing DRAFT clarifications for this tender (allow re-generation)
    await db.clarificationQuestion.deleteMany({
      where: {
        tenderId,
        status: 'DRAFT',
      },
    });

    // Create ClarificationQuestion records
    const createdQuestions = [];

    for (const q of draftQuestions) {
      // Only link to clauses that actually exist in DB
      const clauseExists = q.clauseId ? clauses.find(c => c.id === q.clauseId) : null;
      if (q.clauseId && !clauseExists) {
        console.warn(`[Legal] proposeClarifications: clauseId "${q.clauseId}" not found — creating question without clause link`);
      }

      const clarification = await db.clarificationQuestion.create({
        data: {
          tenderId,
          clauseId: clauseExists ? q.clauseId : null,
          questionText: q.questionText || '',
          status: 'DRAFT',
          priority: typeof q.priority === 'number' ? Math.min(Math.max(q.priority, 1), 5) : 3,
        },
      });

      createdQuestions.push(clarification);
    }

    // Log activity
    await db.activity.create({
      data: {
        tenderId,
        action: 'clarifications_proposed',
        details: `Δημιουργήθηκαν ${createdQuestions.length} ερωτήματα διευκρινίσεων ` +
          `για ${clauses.length} ρήτρες υψηλού κινδύνου (${clauses.filter(c => c.riskLevel === 'CRITICAL').length} κρίσιμες)`,
      },
    });

    return createdQuestions;
  }

  /**
   * Get an aggregate legal risk summary for a tender.
   * Returns clause counts by risk level, top risks, and an overall risk score.
   *
   * The overall risk score (0-100) is calculated as:
   * - Each CRITICAL clause = 25 points
   * - Each HIGH clause = 15 points
   * - Each MEDIUM clause = 5 points
   * - Each LOW clause = 1 point
   * - Capped at 100
   *
   * @param tenderId - The ID of the tender
   * @returns LegalRiskSummary object
   */
  async getLegalRiskSummary(tenderId: string): Promise<LegalRiskSummary> {
    const clauses = await db.legalClause.findMany({
      where: { tenderId },
      orderBy: [
        { riskLevel: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    const byRiskLevel = {
      LOW: clauses.filter(c => c.riskLevel === 'LOW').length,
      MEDIUM: clauses.filter(c => c.riskLevel === 'MEDIUM').length,
      HIGH: clauses.filter(c => c.riskLevel === 'HIGH').length,
      CRITICAL: clauses.filter(c => c.riskLevel === 'CRITICAL').length,
    };

    // Calculate overall risk score
    const rawScore =
      byRiskLevel.CRITICAL * 25 +
      byRiskLevel.HIGH * 15 +
      byRiskLevel.MEDIUM * 5 +
      byRiskLevel.LOW * 1;
    const overallRiskScore = Math.min(rawScore, 100);

    // Get top risks (CRITICAL first, then HIGH)
    const topRiskClauses = clauses
      .filter(c => c.riskLevel === 'CRITICAL' || c.riskLevel === 'HIGH')
      .slice(0, 10);

    const topRisks = topRiskClauses.map(c => ({
      clause: c.clauseText.substring(0, 200) + (c.clauseText.length > 200 ? '...' : ''),
      category: c.category,
      risk: c.riskReason || 'N/A',
      riskLevel: c.riskLevel,
      recommendation: c.recommendation || 'N/A',
    }));

    // Check which LEGAL_CRITICAL_FIELDS are covered by extracted clauses
    // Use broader keyword matching (synonyms, related terms) to reduce false negatives
    const FIELD_KEYWORDS: Record<string, string[]> = {
      'Εγγυητική συμμετοχής': ['εγγυητικ', 'εγγύηση', 'guarantee', 'bank guarantee', 'τραπεζ'],
      'Δικαιολογητικά συμμετοχής': ['δικαιολογητικ', 'επισυνάπτ', 'προσκομι', 'υπεύθυνη δήλωση', 'πιστοποιητικ', 'βεβαίωση'],
      'Κριτήρια αποκλεισμού': ['αποκλεισμ', 'αποκλει', 'exclusion', 'ακατάλληλ', 'απόρριψ', 'δεν γίνονται δεκτ'],
      'Κριτήρια ανάθεσης': ['κριτήρι', 'ανάθεσ', 'award', 'μειοδοτ', 'χαμηλότερη τιμή', 'βαθμολόγ', 'αξιολόγ'],
    };

    const missingInfo: string[] = [];
    const allClauseText = clauses.map(c => c.clauseText.toLowerCase()).join(' ');

    for (const field of LEGAL_CRITICAL_FIELDS) {
      const keywords = FIELD_KEYWORDS[field] || [field.toLowerCase()];
      const isCovered = keywords.some(kw => allClauseText.includes(kw.toLowerCase()));
      if (!isCovered) {
        missingInfo.push(`${NOT_FOUND}: ${field}`);
      }
    }

    return {
      totalClauses: clauses.length,
      byRiskLevel,
      topRisks,
      overallRiskScore,
      missingInfo,
    };
  }

  /**
   * Provides a default risk level based on clause category.
   * Used as a fallback when AI assessment is unavailable for a specific clause.
   */
  private defaultRiskLevel(category: LegalClauseCategory): RiskLevel {
    const higherRiskCategories: LegalClauseCategory[] = [
      'LIABILITY',
      'TERMINATION',
      'PENALTIES',
    ];
    const mediumRiskCategories: LegalClauseCategory[] = [
      'IP_RIGHTS',
      'PAYMENT_TERMS',
      'FORCE_MAJEURE',
      'INSURANCE',
      'DATA_PROTECTION',
      'SUBCONTRACTING',
    ];

    if (higherRiskCategories.includes(category)) return 'HIGH';
    if (mediumRiskCategories.includes(category)) return 'MEDIUM';
    return 'LOW';
  }
}

/** Singleton instance of the AI Legal Analyzer service. */
export const aiLegalAnalyzer = new AILegalAnalyzer();
