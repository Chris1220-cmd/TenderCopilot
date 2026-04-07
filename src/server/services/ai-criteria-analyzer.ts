import { db } from '@/lib/db';
import { ai, logTokenUsage } from '@/server/ai';
import { parseAIResponse } from './ai-prompts';

// ─── Types ──────────────────────────────────────────────

interface CriterionData {
  name: string;
  weight: number | null;
  parentName: string | null;
  sortOrder: number;
  description: string;
  guidance: string;
  evidence: string;
  suggestions: string;
}

interface CriteriaAnalysisResult {
  awardType: 'lowest_price' | 'best_value' | 'cost_effectiveness';
  criteria: CriterionData[];
}

// ─── Prompts ────────────────────────────────────────────

const SYSTEM_PROMPT_EL = `Είσαι ειδικός σε ελληνικούς δημόσιους διαγωνισμούς (Ν.4412/2016).

Ανάλυσε τα έγγραφα της διακήρυξης και εξήγαγε ΟΛΑ τα κριτήρια αξιολόγησης/ανάθεσης.

Για ΚΑΘΕ κριτήριο δώσε:
- name: Όνομα κριτηρίου (π.χ. "Μεθοδολογία Υλοποίησης")
- weight: Βάρος σε % (null αν δεν αναφέρεται)
- parentName: Όνομα γονικού κριτηρίου (null αν είναι top-level)
- sortOrder: Σειρά εμφάνισης (0, 1, 2...)
- description: Τι ΑΚΡΙΒΩΣ ζητάει η διακήρυξη για αυτό το κριτήριο — αντέγραψε τις σχετικές παραγράφους
- guidance: Προτεινόμενη δομή τεχνικής προσφοράς σε markdown. Δώσε συγκεκριμένες ενότητες και τι να γράψει ο υποψήφιος σε καθεμία. Αναφέρσου σε ISO πιστοποιήσεις, βεβαιώσεις καλής εκτέλεσης, ή CVs αν σχετίζονται.
- evidence: Τι αποδεικτικά/έγγραφα πρέπει να συμπεριληφθούν, σε markdown λίστα
- suggestions: Πρακτικά tips βασισμένα στη διακήρυξη — αναφέρσου σε συγκεκριμένα άρθρα/σελίδες αν τα βρίσκεις

Επίσης προσδιόρισε τον τύπο ανάθεσης (awardType):
- "lowest_price" αν η ανάθεση γίνεται μόνο με χαμηλότερη τιμή
- "best_value" αν υπάρχουν κριτήρια ποιότητας-τιμής
- "cost_effectiveness" αν χρησιμοποιεί κόστος κύκλου ζωής

Απάντησε ΜΟΝΟ σε JSON format:
{
  "awardType": "best_value",
  "criteria": [{ "name": "...", "weight": 30, "parentName": null, "sortOrder": 0, "description": "...", "guidance": "...", "evidence": "...", "suggestions": "..." }]
}`;

const SYSTEM_PROMPT_EN = `You are an expert in public procurement evaluation criteria.

Analyze the tender documents and extract ALL evaluation/award criteria.

For EACH criterion provide:
- name: Criterion name (e.g. "Technical Methodology")
- weight: Weight in % (null if not specified)
- parentName: Parent criterion name (null if top-level)
- sortOrder: Display order (0, 1, 2...)
- description: What EXACTLY the tender requires for this criterion — quote relevant paragraphs
- guidance: Proposed technical proposal structure in markdown. Give specific sections and what to write in each. Reference ISO certifications, reference letters, or CVs if relevant.
- evidence: What supporting documents/evidence to include, as markdown list
- suggestions: Practical tips based on the tender — reference specific articles/pages if found

Also identify the award type (awardType):
- "lowest_price" if award is based solely on lowest price
- "best_value" if there are quality-price criteria
- "cost_effectiveness" if it uses life-cycle cost analysis

Respond ONLY in JSON format:
{
  "awardType": "best_value",
  "criteria": [{ "name": "...", "weight": 30, "parentName": null, "sortOrder": 0, "description": "...", "guidance": "...", "evidence": "...", "suggestions": "..." }]
}`;

// ─── Service ────────────────────────────────────────────

class AICriteriaAnalyzer {
  async analyzeCriteria(
    tenderId: string,
    tenantId: string,
    language: 'el' | 'en' | 'nl' = 'el'
  ): Promise<{ awardType: string; count: number }> {

    // 1. Load tender with documents
    const tender = await db.tender.findUniqueOrThrow({
      where: { id: tenderId },
      include: {
        attachedDocuments: { select: { fileName: true, extractedText: true } },
        requirements: true,
      },
    });

    // 2. Build metadata context
    const meta: string[] = [];
    meta.push(`Τίτλος: ${tender.title}`);
    if (tender.referenceNumber) meta.push(`Αρ. Αναφοράς: ${tender.referenceNumber}`);
    if (tender.contractingAuthority) meta.push(`Αναθέτουσα Αρχή: ${tender.contractingAuthority}`);
    if (tender.budget) meta.push(`Προϋπολογισμός: ${tender.budget.toLocaleString('el-GR')}€`);
    if (tender.awardCriteria) meta.push(`Κριτήριο Ανάθεσης: ${tender.awardCriteria}`);
    if (tender.cpvCodes.length > 0) meta.push(`CPV: ${tender.cpvCodes.join(', ')}`);

    if (tender.requirements.length > 0) {
      meta.push('\n--- Εξαχθείσες Απαιτήσεις ---');
      for (const req of tender.requirements) {
        meta.push(`[${req.category}] ${req.text}${req.articleReference ? ` (${req.articleReference})` : ''}`);
      }
    }

    const metadataText = meta.join('\n');

    // 3. Load document texts (max 50K chars)
    const docsWithText = tender.attachedDocuments.filter(
      (d): d is typeof d & { extractedText: string } => !!d.extractedText && d.extractedText.length > 50
    );
    if (docsWithText.length === 0) {
      throw new Error('Δεν βρέθηκαν έγγραφα με κείμενο. Ανεβάστε PDF πρώτα.');
    }
    let documentText = docsWithText
      .map((d) => `\n--- ${d.fileName} ---\n${d.extractedText}`)
      .join('\n');
    if (documentText.length > 50000) {
      documentText = documentText.slice(0, 50000) + '\n\n[...κείμενο περικόπηκε λόγω μεγέθους]';
    }

    // 4. Load company certificates for cross-reference
    const certs = await db.certificate.findMany({
      where: { tenantId },
      select: { title: true, type: true, issuer: true, expiryDate: true },
    });
    const certText = certs.length > 0
      ? '\n\n--- Πιστοποιητικά Εταιρείας ---\n' +
        certs.map((c) => `- ${c.title} (${c.type})${c.issuer ? ` — ${c.issuer}` : ''}${c.expiryDate ? ` — λήξη: ${c.expiryDate.toISOString().slice(0, 10)}` : ''}`).join('\n')
      : '';

    const fullText = `${metadataText}\n\n=== ΚΕΙΜΕΝΟ ΕΓΓΡΑΦΩΝ ===\n${documentText}${certText}`;

    // 5. Call AI
    const systemPrompt = language === 'el' ? SYSTEM_PROMPT_EL : SYSTEM_PROMPT_EN;
    const result = await ai().complete({
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Ανάλυσε τα κριτήρια αξιολόγησης αυτού του διαγωνισμού:\n\n${fullText}`,
        },
      ],
      maxTokens: 8000,
      temperature: 0.2,
      responseFormat: 'json',
    });

    await logTokenUsage(tenderId, 'criteria_analysis', {
      input: result.inputTokens || 0,
      output: result.outputTokens || 0,
      total: result.totalTokens || 0,
    });

    // 6. Parse response
    const parsed = parseAIResponse<CriteriaAnalysisResult>(
      result.content,
      ['awardType', 'criteria'],
      'criteria_analysis'
    );

    // 7. Save to DB — delete old criteria first, then insert new
    await db.evaluationCriterion.deleteMany({ where: { tenderId } });

    // First pass: create top-level criteria
    const parentMap = new Map<string, string>();
    for (const c of parsed.criteria.filter((c) => !c.parentName)) {
      const created = await db.evaluationCriterion.create({
        data: {
          tenderId,
          name: c.name,
          weight: c.weight,
          sortOrder: c.sortOrder,
          description: c.description,
          guidance: c.guidance,
          evidence: c.evidence,
          suggestions: c.suggestions,
        },
      });
      parentMap.set(c.name, created.id);
    }

    // Second pass: create sub-criteria with parentId
    for (const c of parsed.criteria.filter((c) => c.parentName)) {
      const parentId = parentMap.get(c.parentName!) ?? null;
      await db.evaluationCriterion.create({
        data: {
          tenderId,
          name: c.name,
          weight: c.weight,
          parentId,
          sortOrder: c.sortOrder,
          description: c.description,
          guidance: c.guidance,
          evidence: c.evidence,
          suggestions: c.suggestions,
        },
      });
    }

    return { awardType: parsed.awardType, count: parsed.criteria.length };
  }
}

export const aiCriteriaAnalyzer = new AICriteriaAnalyzer();
