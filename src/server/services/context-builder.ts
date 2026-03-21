/**
 * Intelligent context builder for the Smart AI Assistant.
 * Classifies question intent, gathers relevant context from multiple sources,
 * and assembles a focused context within token budget.
 */

import { db } from '@/lib/db';
import { searchDocumentChunks, type SearchResult } from './embedding-service';
import { getRelevantKnowledge, classifyTenderType } from '@/server/knowledge';

// ─── Intent Classification ──────────────────────────────────

export type QuestionIntent = 'document_lookup' | 'legal_question' | 'status_check' | 'guidance' | 'mixed';

const INTENT_PATTERNS: Record<Exclude<QuestionIntent, 'mixed'>, RegExp[]> = {
  document_lookup: [
    /εγγυητικ/i, /πιστοποιητικ/i, /ζητ(ά|αν|ούν)/i, /χρειάζ/i,
    /απαιτ/i, /προθεσμ/i, /budget/i, /ποσό/i, /δικαιολογητικ/i,
    /προϋπολογισμ/i, /κριτήρι/i, /βαθμολ/i, /ημερομηνία/i,
  ],
  legal_question: [
    /νόμος/i, /άρθρο/i, /εσπδ/i, /ν\.?\s*4412/i, /κανονισμ/i,
    /νομικ/i, /νομοθεσ/i, /αποκλεισμ/i,
  ],
  status_check: [
    /πόσα/i, /τι μένει/i, /progress/i, /κατάσταση/i, /έτοιμ/i,
    /ολοκληρ/i, /λείπ/i, /ποσοστό/i, /compliance/i,
  ],
  guidance: [
    /πώς/i, /τι πρέπει/i, /βήματ/i, /βοήθ/i, /οδηγ/i,
    /συμβουλ/i, /τι κάν/i, /πώς φτιάχ/i, /τι χρειάζ/i,
  ],
};

export function classifyIntent(question: string): QuestionIntent {
  const scores: Record<string, number> = {};

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    scores[intent] = patterns.filter((p) => p.test(question)).length;
  }

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'mixed';

  const topIntents = Object.entries(scores).filter(([, s]) => s >= maxScore * 0.7);
  if (topIntents.length > 1) return 'mixed';

  return topIntents[0][0] as QuestionIntent;
}

// ─── Context Assembly ────────────────────────────────────────

export interface AssembledContext {
  systemPrompt: string;
  contextText: string;
  sources: ContextSource[];
  intent: QuestionIntent;
}

export interface ContextSource {
  type: 'document' | 'structured_data' | 'knowledge_base';
  reference: string;
  content: string;
}

/**
 * Build focused context for an AI question.
 */
export async function buildContext(
  tenderId: string,
  tenantId: string,
  question: string
): Promise<AssembledContext> {
  const intent = classifyIntent(question);
  const sources: ContextSource[] = [];
  const contextParts: string[] = [];

  // 1. Always include tender metadata
  const tender = await db.tender.findUnique({
    where: { id: tenderId },
    include: {
      brief: true,
    },
  });

  if (tender) {
    const metaText = [
      `ΤΙΤΛΟΣ: ${tender.title}`,
      tender.referenceNumber ? `ΑΡ. ΔΙΑΚΗΡΥΞΗΣ: ${tender.referenceNumber}` : null,
      tender.contractingAuthority ? `ΑΝΑΘΕΤΟΥΣΑ: ${tender.contractingAuthority}` : null,
      tender.budget ? `ΠΡΟΫΠΟΛΟΓΙΣΜΟΣ: €${tender.budget.toLocaleString('el-GR')}` : null,
      tender.submissionDeadline ? `ΠΡΟΘΕΣΜΙΑ: ${new Date(tender.submissionDeadline).toLocaleDateString('el-GR')}` : null,
      tender.cpvCodes?.length ? `CPV: ${tender.cpvCodes.join(', ')}` : null,
      tender.status ? `ΚΑΤΑΣΤΑΣΗ: ${tender.status}` : null,
      tender.brief?.summaryText ? `\nΠΕΡΙΛΗΨΗ:\n${tender.brief.summaryText}` : null,
    ].filter(Boolean).join('\n');

    contextParts.push(`=== ΣΤΟΙΧΕΙΑ ΔΙΑΓΩΝΙΣΜΟΥ ===\n${metaText}`);
  }

  // 2. Document search (for document_lookup, legal_question, guidance, mixed)
  if (intent !== 'status_check') {
    try {
      const chunks = await searchDocumentChunks(tenderId, tenantId, question, 5);
      if (chunks.length > 0) {
        const docIds = Array.from(new Set(chunks.map((c) => c.documentId)));
        const docs = await db.attachedDocument.findMany({
          where: { id: { in: docIds } },
          select: { id: true, fileName: true },
        });
        const docNameMap = new Map(docs.map((d) => [d.id, d.fileName]));

        const docContext = chunks
          .map((chunk, i) => {
            const docName = docNameMap.get(chunk.documentId) || 'Άγνωστο';
            sources.push({
              type: 'document',
              reference: docName,
              content: chunk.content.slice(0, 200),
            });
            return `--- Απόσπασμα ${i + 1} (${docName}, similarity: ${chunk.similarity.toFixed(2)}) ---\n${chunk.content}`;
          })
          .join('\n\n');

        contextParts.push(`=== ΣΧΕΤΙΚΑ ΑΠΟΣΠΑΣΜΑΤΑ ΕΓΓΡΑΦΩΝ ===\n${docContext}`);
      }
    } catch (err) {
      console.warn('[ContextBuilder] Document search failed, skipping:', err);
    }
  }

  // 3. Structured data (for status_check, mixed)
  if (intent === 'status_check' || intent === 'mixed') {
    const [tasks, requirements] = await Promise.all([
      db.task.findMany({
        where: { tenderId },
        select: { title: true, status: true, priority: true, dueDate: true },
      }),
      db.tenderRequirement.findMany({
        where: { tenderId },
        select: { text: true, category: true, coverageStatus: true, mandatory: true },
      }),
    ]);

    if (tasks.length > 0) {
      const todo = tasks.filter((t) => t.status === 'TODO').length;
      const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
      const done = tasks.filter((t) => t.status === 'DONE').length;
      const overdue = tasks.filter(
        (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE'
      ).length;

      contextParts.push(
        `=== ΚΑΤΑΣΤΑΣΗ ΕΡΓΑΣΙΩΝ ===\nΣύνολο: ${tasks.length} | Εκκρεμή: ${todo} | Σε εξέλιξη: ${inProgress} | Ολοκληρωμένα: ${done} | Εκπρόθεσμα: ${overdue}`
      );
      sources.push({ type: 'structured_data', reference: 'Tasks', content: `${tasks.length} tasks` });
    }

    if (requirements.length > 0) {
      const covered = requirements.filter((r) => r.coverageStatus === 'COVERED').length;
      const gaps = requirements.filter((r) => r.coverageStatus === 'GAP').length;
      const unmapped = requirements.filter((r) => r.coverageStatus === 'UNMAPPED').length;

      contextParts.push(
        `=== ΑΠΑΙΤΗΣΕΙΣ ===\nΣύνολο: ${requirements.length} | Καλυμμένες: ${covered} | Κενά: ${gaps} | Μη αντιστοιχισμένες: ${unmapped}`
      );
      sources.push({ type: 'structured_data', reference: 'Requirements', content: `${requirements.length} requirements` });
    }
  }

  // 4. Knowledge Base injection — domain expertise per intent
  try {
    // Classify tender type from metadata for targeted knowledge
    const tenderText = tender
      ? `${tender.title} ${tender.brief?.summaryText || ''}`
      : '';
    const tenderClass = tenderText ? classifyTenderType(tenderText) : undefined;
    const tenderType = tenderClass?.type !== 'unknown' ? tenderClass?.type : undefined;

    const knowledge = getRelevantKnowledge(intent, question, tenderType);
    if (knowledge) {
      contextParts.push(`=== ΓΝΩΣΗ ΕΙΔΙΚΟΥ (Ν.4412/2016 & ΕΜΠΕΙΡΙΑ) ===\n${knowledge}`);
      sources.push({ type: 'knowledge_base' as any, reference: 'Βάση Γνώσεων Ν.4412/2016', content: 'Domain expertise' });
    }
  } catch (err) {
    console.warn('[ContextBuilder] Knowledge retrieval failed:', err);
  }

  const systemPrompt = buildSmartSystemPrompt(intent);

  return {
    systemPrompt,
    contextText: contextParts.join('\n\n'),
    sources,
    intent,
  };
}

// ─── System Prompt ───────────────────────────────────────────

function buildSmartSystemPrompt(intent: QuestionIntent): string {
  const intentTips: Record<QuestionIntent, string> = {
    document_lookup: 'Ο χρηστης ψαχνει κατι συγκεκριμενο στα εγγραφα. Βρες το και δωσε ακριβη απαντηση.',
    legal_question: 'Νομικο ερωτημα. Αναφερσου στα εγγραφα και στον Ν.4412/2016. Αν ειναι σοβαρο, προτεινε νομικο.',
    status_check: 'Ο χρηστης θελει να ξερει που βρισκεται η προσφορα. Δωσε συντομη εικονα.',
    guidance: 'Ο χρηστης ζηταει καθοδηγηση. Δωσε πρακτικα βηματα, σαν να μιλας σε συναδελφο.',
    mixed: 'Γενικη ερωτηση. Απαντησε φυσικα, χρησιμοποιωντας οτι βρεις στα εγγραφα.',
  };

  return `Εισαι ο Bid Manager του TenderCopilot. Σκεψου τον εαυτο σου σαν εμπειρο συναδελφο σε εταιρεια δημοσιων εργων, με 15+ χρονια στους ελληνικους διαγωνισμους.

ΧΑΡΑΚΤΗΡΑΣ:
- Μιλας φυσικα, σαν σε meeting — οχι σαν εγχειριδιο η robot
- Εισαι ζεστος αλλα ακριβης. Απλα ελληνικα, χωρις εταιρικη γλωσσα
- Αν κατι ειναι κρισιμο, το τονιζεις χωρις υπερβολη: "Προσεξε εδω:" αντι "ΠΡΟΣΟΧΗ!"
- Αν δεν ξερεις, το λες ειλικρινα: "Δεν το βρισκω στα εγγραφα — μπορει να ειναι σε παραρτημα που λειπει"
- Κανεις παρατηρησεις που ενας εμπειρος θα εκανε: "Αυτο μου φαινεται τυπικο για ΕΣΗΔΗΣ..." η "Εδω θελει προσοχη γιατι συνηθως..."
- ΔΕΝ ξεκινας με "Συμφωνα με τα εγγραφα..." — πηγαινε κατευθειαν στο θεμα

ΠΑΡΑΔΕΙΓΜΑΤΑ ΥΦΟΥΣ:
Κακο: "Συμφωνα με το εγγραφο document_1.pdf, η προθεσμια υποβολης οριζεται στις 15/04/2026."
Καλο: "Η προθεσμια ειναι 15 Απριλιου. Βαλε reminder τουλαχιστον 3 μερες πριν — το ΕΣΗΔΗΣ κολλαει τελευταια στιγμη."

Κακο: "Δεν βρεθηκαν πληροφοριες σχετικα με το εν λογω θεμα στα διαθεσιμα εγγραφα."
Καλο: "Δεν το βρισκω στα εγγραφα που ανεβασες. Τσεκαρε αν υπαρχει ξεχωριστο παραρτημα η τευχος τεχνικων προδιαγραφων."

CONTEXT: ${intentTips[intent]}

ΚΑΝΟΝΕΣ ΑΚΡΙΒΕΙΑΣ (αυτα δεν αλλαζουν):
1. Ποτε μην επινοεις αριθμους, ημερομηνιες, ποσα — αν δεν τα βρισκεις, πες το
2. Αν κατι ειναι συμπερασμα δικο σου, πες "απο οτι βλεπω" η "φαινεται οτι"
3. Αν δυο σημεια αντιφασκουν, αναφερε και τα δυο
4. Για σοβαρα νομικα/οικονομικα: "καλο θα ηταν να ρωτησεις και τον νομικο/λογιστη σας"

ΜΟΡΦΗ ΑΠΑΝΤΗΣΗΣ (JSON):
{
  "answer": "η απαντηση σου — φυσικη, συντομη, με ουσια",
  "confidence": "verified | inferred | general",
  "sources": [
    {
      "type": "document | law | knowledge_base",
      "reference": "ονομα αρχειου η νομος",
      "quote": "ακριβες αποσπασμα αν υπαρχει"
    }
  ],
  "highlights": [
    { "label": "label", "value": "τιμη", "status": "ok | warning | critical" }
  ],
  "caveats": ["πρακτικες παρατηρησεις — σαν tips, οχι σαν disclaimers"]
}

CONFIDENCE:
- "verified": το βρηκες αυτολεξει στο εγγραφο
- "inferred": συνδυασμος στοιχειων — προσθεσε ενα "τσεκαρε το κι εσυ"
- "general": γενικη γνωση/νομοθεσια — "ελεγξτε τη διακηρυξη, μπορει να διαφερει"

Απαντησε σε ελληνικα.`;
}
