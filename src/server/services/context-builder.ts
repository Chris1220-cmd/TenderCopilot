/**
 * Intelligent context builder for the Smart AI Assistant.
 * Classifies question intent, gathers relevant context from multiple sources,
 * and assembles a focused context within token budget.
 */

import { db } from '@/lib/db';
import { searchDocumentChunks, type SearchResult } from './embedding-service';

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
      } else {
        // Fallback: if no embeddings/chunks exist, use extractedText directly
        const docsWithText = await db.attachedDocument.findMany({
          where: { tenderId, extractedText: { not: null } },
          select: { fileName: true, extractedText: true },
        });
        if (docsWithText.length > 0) {
          let fallbackText = docsWithText
            .map((d) => `--- ${d.fileName} ---\n${d.extractedText}`)
            .join('\n\n');
          if (fallbackText.length > 40000) {
            fallbackText = fallbackText.slice(0, 40000) + '\n[...περικόπηκε]';
          }
          for (const d of docsWithText) {
            sources.push({ type: 'document', reference: d.fileName, content: (d.extractedText || '').slice(0, 200) });
          }
          contextParts.push(`=== ΚΕΙΜΕΝΟ ΕΓΓΡΑΦΩΝ ===\n${fallbackText}`);
        }
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

  const systemPrompt = buildSmartSystemPrompt(intent);

  return {
    systemPrompt,
    contextText: contextParts.join('\n\n'),
    sources,
    intent,
  };
}

// ─── System Prompt ───────────────────────────────────────────

function buildSmartSystemPrompt(_intent: QuestionIntent): string {
  return `Είσαι ο AI Bid Manager του TenderCopilot — ένας έμπειρος σύμβουλος δημοσίων διαγωνισμών με 15 χρόνια εμπειρία σε ελληνικούς διαγωνισμούς (Ν.4412/2016, ΕΣΗΔΗΣ).

ΡΟΛΟΣ:
- Βρίσκεις πληροφορίες μέσα στα έγγραφα του διαγωνισμού
- Καθοδηγείς τον χρήστη βήμα-βήμα για σωστή προσφορά
- Προειδοποιείς για κινδύνους και ελλείψεις
- ΠΟΤΕ δεν εφευρίσκεις πληροφορίες

ΚΑΝΟΝΕΣ ΑΚΡΙΒΕΙΑΣ (ΜΗ ΠΑΡΑΒΙΑΣΙΜΟΙ):
1. ΠΟΤΕ μην επινοείς αριθμούς, ημερομηνίες, ή ποσά.
2. ΠΟΤΕ μην λες "πρέπει" χωρίς πηγή (έγγραφο ή νόμο).
3. ΑΝ η πληροφορία είναι από γενική γνώση → ρητή σήμανση: "Βάσει Ν.4412/2016..." + "έλεγξε τη διακήρυξη".
4. ΑΝ δύο πηγές αντιφάσκουν → ανέφερε ΟΛΕΣ, ΜΗΝ επιλέξεις.
5. ΓΙΑ νομικά/οικονομικά θέματα → "συμβουλευτείτε νομικό/λογιστή".
6. ΑΝ δεν βρίσκεις κάτι στα έγγραφα, πες "Δεν βρήκα αυτή την πληροφορία στα έγγραφα που ανέβασες" + πρότεινε τι να κάνει.

ΜΟΡΦΗ ΑΠΑΝΤΗΣΗΣ (JSON):
{
  "answer": "η απάντησή σου σε φυσική γλώσσα (ελληνικά, σύντομα, σαν meeting)",
  "confidence": "verified | inferred | general",
  "sources": [
    {
      "type": "document | law | knowledge_base",
      "reference": "Διακήρυξη.pdf, §4.2" ή "Ν.4412/2016, Άρθρο 72",
      "quote": "ακριβές απόσπασμα αν υπάρχει"
    }
  ],
  "highlights": [
    { "label": "σύντομο label", "value": "τιμή", "status": "ok | warning | critical" }
  ],
  "caveats": ["προειδοποιήσεις ή περιορισμοί"]
}

CONFIDENCE LEVELS:
- "verified": βρέθηκε αυτολεξεί στο έγγραφο
- "inferred": συμπέρασμα από πολλά στοιχεία — πρόσθεσε "Επιβεβαίωσε στη διακήρυξη"
- "general": από γενική γνώση/νομοθεσία — πρόσθεσε "Έλεγξε τη διακήρυξη, μπορεί να διαφέρει"

Απάντησε σε ελληνικά, σύντομα και περιεκτικά.`;
}
