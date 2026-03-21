/**
 * AI Bid Orchestrator -- Acts as the Bid Manager.
 * Summarizes tenders, makes Go/No-Go recommendations,
 * generates work plans, and answers status questions.
 *
 * This service coordinates all bid-preparation activities,
 * acting as the AI equivalent of an experienced bid director
 * who understands Greek public procurement (N.4412/2016).
 */

import { db } from '@/lib/db';
import { ai, checkTokenBudget, logTokenUsage } from '@/server/ai';
import { readTenderDocuments, requireDocuments } from '@/server/services/document-reader';
import { ANALYSIS_RULES, parseAIResponse, chunkText, shouldChunk, BRIEF_CRITICAL_FIELDS, NOT_FOUND } from './ai-prompts';
import type { TenderStatus } from '@prisma/client';

// ─── Types ──────────────────────────────────────────────────

/** Structured summary produced by the AI for a tender brief. */
interface TenderBriefData {
  summaryText: string;
  keyPoints: {
    sector: string;
    mandatoryCriteria: string[];
    awardType: string;
    duration: string;
    deadlines: Array<{ label: string; date: string }>;
    estimatedBudget?: number | null;
    cpvCodes?: string[];
    specialConditions?: string[];
    missingInfo?: string[];
  };
  sector: string;
  awardType: string;
  duration: string;
  missingInfo?: string[];
}

/** Single scoring factor in the Go/No-Go analysis. */
interface GoNoGoFactor {
  factor: string;
  score: number;       // 0-100
  weight: number;      // 0-1
  explanation: string;
}

/** Full Go/No-Go analysis result from the AI. */
interface GoNoGoAnalysisResult {
  decision: 'GO' | 'NO_GO' | 'BORDERLINE';
  overallScore: number;
  factors: GoNoGoFactor[];
  recommendation: string;
}

/** A task definition for the generated work plan. */
interface WorkPlanTask {
  title: string;
  description: string;
  assigneeRole: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dayOffsetStart: number;
  dayOffsetEnd: number;
  phase: string;
}

/** AI-extracted team requirement from the tender. */
interface ExtractedTeamRequirement {
  role: string;
  qualifications: string;
  minExperience: number;
  count: number;
  isMandatory: boolean;
}

/** Status answer result from the AI. */
interface StatusAnswer {
  answer: string;
  highlights: Array<{ label: string; value: string; status: 'ok' | 'warning' | 'critical' }>;
}

// ─── Work Plan Phase Definitions ────────────────────────────

/** Standard bid preparation phases with relative day offsets from deadline. */
const WORK_PLAN_PHASES: WorkPlanTask[] = [
  // Phase 1: Document Collection (day 1-3)
  {
    title: 'Συγκέντρωση εγγράφων διαγωνισμού',
    description: 'Λήψη και αρχειοθέτηση όλων των εγγράφων διαγωνισμού (Διακήρυξη, Παραρτήματα, Τεχνικές Προδιαγραφές, ΤΕΥΔ/ΕΕΕΣ)',
    assigneeRole: 'admin',
    priority: 'HIGH',
    dayOffsetStart: 1,
    dayOffsetEnd: 2,
    phase: 'Document Collection',
  },
  {
    title: 'Εξασφάλιση φορολογικής ενημερότητας',
    description: 'Λήψη ενημερωμένης φορολογικής ενημερότητας από ΑΑΔΕ',
    assigneeRole: 'financial',
    priority: 'HIGH',
    dayOffsetStart: 1,
    dayOffsetEnd: 3,
    phase: 'Document Collection',
  },
  {
    title: 'Εξασφάλιση ασφαλιστικής ενημερότητας',
    description: 'Λήψη ενημερωμένης ασφαλιστικής ενημερότητας (ΕΦΚΑ)',
    assigneeRole: 'financial',
    priority: 'HIGH',
    dayOffsetStart: 1,
    dayOffsetEnd: 3,
    phase: 'Document Collection',
  },
  {
    title: 'Έλεγχος ισχύος πιστοποιητικών (ISO, κλπ)',
    description: 'Επαλήθευση ότι όλα τα ISO πιστοποιητικά και λοιπά σχετικά πιστοποιητικά είναι σε ισχύ',
    assigneeRole: 'compliance',
    priority: 'MEDIUM',
    dayOffsetStart: 1,
    dayOffsetEnd: 3,
    phase: 'Document Collection',
  },

  // Phase 2: Legal Review (day 2-5)
  {
    title: 'Νομικός έλεγχος όρων σύμβασης',
    description: 'Ανάλυση όρων σύμβασης, ρητρών, υποχρεώσεων, εγγυήσεων. Εντοπισμός κινδύνων σύμφωνα με Ν.4412/2016',
    assigneeRole: 'legal',
    priority: 'HIGH',
    dayOffsetStart: 2,
    dayOffsetEnd: 5,
    phase: 'Legal Review',
  },
  {
    title: 'Σύνταξη ερωτημάτων διευκρινίσεων',
    description: 'Κατάρτιση ερωτημάτων για ασαφή ή επικίνδυνα σημεία σύμβασης/διακήρυξης',
    assigneeRole: 'legal',
    priority: 'MEDIUM',
    dayOffsetStart: 3,
    dayOffsetEnd: 5,
    phase: 'Legal Review',
  },
  {
    title: 'Σύνταξη Υπεύθυνης Δήλωσης Ν.1599/86',
    description: 'Σύνταξη υπεύθυνης δήλωσης περί μη αποκλεισμού (Άρθρα 73-74 Ν.4412/2016)',
    assigneeRole: 'legal',
    priority: 'HIGH',
    dayOffsetStart: 3,
    dayOffsetEnd: 5,
    phase: 'Legal Review',
  },

  // Phase 3: Technical Drafting (day 3-10)
  {
    title: 'Σύνταξη Τεχνικής Προσφοράς - Μεθοδολογία',
    description: 'Ανάπτυξη μεθοδολογίας υλοποίησης, χρονοδιαγράμματος, ομάδας έργου',
    assigneeRole: 'technical',
    priority: 'URGENT',
    dayOffsetStart: 3,
    dayOffsetEnd: 10,
    phase: 'Technical Drafting',
  },
  {
    title: 'Πίνακας Τεχνικής Συμμόρφωσης',
    description: 'Συμπλήρωση πίνακα τεχνικής συμμόρφωσης σύμφωνα με τις τεχνικές προδιαγραφές',
    assigneeRole: 'technical',
    priority: 'HIGH',
    dayOffsetStart: 4,
    dayOffsetEnd: 9,
    phase: 'Technical Drafting',
  },
  {
    title: 'Συγκέντρωση βιογραφικών ομάδας έργου',
    description: 'Συλλογή και μορφοποίηση CV στελεχών σύμφωνα με τις απαιτήσεις του διαγωνισμού',
    assigneeRole: 'technical',
    priority: 'HIGH',
    dayOffsetStart: 3,
    dayOffsetEnd: 8,
    phase: 'Technical Drafting',
  },
  {
    title: 'Τεκμηρίωση εμπειρίας (reference projects)',
    description: 'Προετοιμασία αποδεικτικών σχετικής εμπειρίας: βεβαιώσεις καλής εκτέλεσης, συμβάσεις, πρωτόκολλα παραλαβής',
    assigneeRole: 'technical',
    priority: 'HIGH',
    dayOffsetStart: 3,
    dayOffsetEnd: 7,
    phase: 'Technical Drafting',
  },

  // Phase 4: Financial Modeling (day 5-8)
  {
    title: 'Κοστολόγηση - Ανάλυση τιμών',
    description: 'Κοστολόγηση εργασίας, υλικών, υπεργολαβιών, γενικών εξόδων. Υπολογισμός κέρδους και τελικής τιμής',
    assigneeRole: 'financial',
    priority: 'HIGH',
    dayOffsetStart: 5,
    dayOffsetEnd: 8,
    phase: 'Financial Modeling',
  },
  {
    title: 'Σύνταξη Οικονομικής Προσφοράς',
    description: 'Συμπλήρωση εντύπου οικονομικής προσφοράς σύμφωνα με το υπόδειγμα του Παραρτήματος',
    assigneeRole: 'financial',
    priority: 'HIGH',
    dayOffsetStart: 6,
    dayOffsetEnd: 8,
    phase: 'Financial Modeling',
  },
  {
    title: 'Εγγυητική Επιστολή Συμμετοχής',
    description: 'Επικοινωνία με τράπεζα για έκδοση εγγυητικής επιστολής (2% του προϋπολογισμού)',
    assigneeRole: 'financial',
    priority: 'URGENT',
    dayOffsetStart: 5,
    dayOffsetEnd: 8,
    phase: 'Financial Modeling',
  },

  // Phase 5: Compliance Check (day 8-12)
  {
    title: 'Εσωτερικός έλεγχος πληρότητας φακέλου',
    description: 'Διασταύρωση κάθε απαίτησης διακήρυξης με αντίστοιχο έγγραφο. Checklist πληρότητας',
    assigneeRole: 'compliance',
    priority: 'HIGH',
    dayOffsetStart: 8,
    dayOffsetEnd: 12,
    phase: 'Compliance Check',
  },
  {
    title: 'Συμπλήρωση ΤΕΥΔ/ΕΕΕΣ',
    description: 'Πλήρης συμπλήρωση Τυποποιημένου Εντύπου Υπεύθυνης Δήλωσης (ΤΕΥΔ) ή ΕΕΕΣ/ESPD',
    assigneeRole: 'compliance',
    priority: 'HIGH',
    dayOffsetStart: 8,
    dayOffsetEnd: 10,
    phase: 'Compliance Check',
  },
  {
    title: 'Έλεγχος ψηφιακών υπογραφών',
    description: 'Επαλήθευση ότι όλα τα έγγραφα που απαιτούν ψηφιακή υπογραφή είναι σωστά υπογεγραμμένα',
    assigneeRole: 'compliance',
    priority: 'MEDIUM',
    dayOffsetStart: 10,
    dayOffsetEnd: 12,
    phase: 'Compliance Check',
  },

  // Phase 6: QA Review (day 10-14)
  {
    title: 'Ανασκόπηση Τεχνικής Προσφοράς',
    description: 'Peer review τεχνικής προσφοράς: ορθογραφία, πληρότητα, συνοχή, alignment με κριτήρια αξιολόγησης',
    assigneeRole: 'technical',
    priority: 'HIGH',
    dayOffsetStart: 10,
    dayOffsetEnd: 13,
    phase: 'QA Review',
  },
  {
    title: 'Ανασκόπηση Οικονομικής Προσφοράς',
    description: 'Επαλήθευση αριθμητικών, ΦΠΑ, αθροισμάτων, συνέπεια με τεχνική προσφορά',
    assigneeRole: 'financial',
    priority: 'HIGH',
    dayOffsetStart: 10,
    dayOffsetEnd: 13,
    phase: 'QA Review',
  },

  // Phase 7: Management Approval (day 13-15)
  {
    title: 'Έγκριση Διοίκησης',
    description: 'Παρουσίαση τελικής προσφοράς στη διοίκηση. Τελική τιμή και στρατηγική. Υπογραφή εξουσιοδοτήσεων',
    assigneeRole: 'admin',
    priority: 'URGENT',
    dayOffsetStart: 13,
    dayOffsetEnd: 14,
    phase: 'Management Approval',
  },
  {
    title: 'Υπογραφές νομίμου εκπροσώπου',
    description: 'Ψηφιακή υπογραφή όλων των εγγράφων από τον νόμιμο εκπρόσωπο',
    assigneeRole: 'admin',
    priority: 'URGENT',
    dayOffsetStart: 14,
    dayOffsetEnd: 15,
    phase: 'Management Approval',
  },

  // Phase 8: Packaging (day 14-16)
  {
    title: 'Δημιουργία πακέτου υποβολής',
    description: 'Οργάνωση εγγράφων σε φακέλους σύμφωνα με τη δομή ΕΣΗΔΗΣ/πλατφόρμας',
    assigneeRole: 'admin',
    priority: 'URGENT',
    dayOffsetStart: 14,
    dayOffsetEnd: 15,
    phase: 'Packaging',
  },
  {
    title: 'Ανέβασμα στην πλατφόρμα',
    description: 'Upload εγγράφων στο ΕΣΗΔΗΣ/πλατφόρμα. Επαλήθευση ότι όλα τα αρχεία ανέβηκαν σωστά',
    assigneeRole: 'admin',
    priority: 'URGENT',
    dayOffsetStart: 15,
    dayOffsetEnd: 16,
    phase: 'Packaging',
  },
  {
    title: 'Τελική υποβολή',
    description: 'Οριστική ηλεκτρονική υποβολή στο σύστημα. Εκτύπωση αποδεικτικού υποβολής',
    assigneeRole: 'admin',
    priority: 'URGENT',
    dayOffsetStart: 16,
    dayOffsetEnd: 16,
    phase: 'Packaging',
  },
];

// ─── System Prompts ─────────────────────────────────────────

const SUMMARIZE_SYSTEM_PROMPT = `Είσαι ειδικός σύμβουλος δημοσίων συμβάσεων. Αναλύεις κείμενα διαγωνισμών σύμφωνα με τον Ν.4412/2016 και τον Ν.3130/2003 (στεγάσεις).

${ANALYSIS_RULES}

ΣΗΜΑΝΤΙΚΟ: Διάβασε ΟΛΟΚΛΗΡΟ το κείμενο. Ψάξε σε κάθε παράγραφο, άρθρο και πίνακα.
Για μειοδοτικές δημοπρασίες μίσθωσης: το "ανώτατο μηνιαίο μίσθωμα" = estimatedBudget.

Αναλύσε το κείμενο και εξάγαγε τις πληροφορίες σε μορφή JSON:

{
  "summaryText": "Σύνοψη 200-300 λέξεις",
  "keyPoints": {
    "contractingAuthority": "πλήρης επωνυμία αναθέτουσας αρχής (π.χ. Κτηματική Υπηρεσία Χίου)",
    "sector": "τομέας",
    "mandatoryCriteria": ["κριτήριο 1", "κριτήριο 2"],
    "awardType": "lowest_price ή best_value",
    "duration": "διάρκεια σύμβασης — αν δεν αναφέρεται συγκεκριμένη διάρκεια, γράψε ακριβώς τι αναφέρει το κείμενο (π.χ. 'εντός 30 ημερών από θέση σε ισχύ', '12 μήνες', '2 έτη')",
    "deadlines": [{"label": "Προθεσμία υποβολής", "date": "ISO date αν υπάρχει συγκεκριμένη ημερομηνία, ΑΛΛΙΩΣ γράψε ακριβώς τι αναφέρει το κείμενο (π.χ. 'εντός 5 εργασίμων ημερών από ανάρτηση στο ΚΗΜΔΗΣ')"}],
    "estimatedBudget": 5416.00,
    "budgetPeriod": "monthly ή total",
    "cpvCodes": [],
    "specialConditions": [],
    "guaranteeRequired": "περιγραφή εγγυητικής αν αναφέρεται",
    "eligibilityCriteria": ["κριτήριο 1"],
    "technicalSpecs": "σύντομη περίληψη τεχνικών απαιτήσεων"
  },
  "sector": "τομέας",
  "awardType": "lowest_price ή best_value",
  "duration": "διάρκεια",
  "missingInfo": ["Δεν βρέθηκε: πεδίο"]
}

ΠΡΟΣΟΧΗ: Μην απαντάς "ΔΕΝ ΑΝΑΦΕΡΕΤΑΙ" αν η πληροφορία υπάρχει κάπου στο κείμενο. Ψάξε τα πάντα.`;

const GO_NO_GO_SYSTEM_PROMPT = `Είσαι στρατηγικός σύμβουλος δημοσίων διαγωνισμών (Bid Director) με 20+ χρόνια εμπειρία
στην Ελλάδα (Ν.4412/2016). Αξιολογείς αν μια εταιρεία πρέπει να συμμετάσχει σε διαγωνισμό.

Βαθμολόγησε τους παρακάτω 6 παράγοντες (0-100, με τα αντίστοιχα βάρη):
1. Στρατηγική Συμβατότητα (CPV/KAD match) - βάρος 0.15
2. Τεχνική Ικανότητα (projects, certifications) - βάρος 0.25
3. Οικονομική Επιλεξιμότητα (turnover, equity vs requirements) - βάρος 0.20
4. Διαθεσιμότητα Ομάδας (ρόλοι vs απαιτήσεις) - βάρος 0.15
5. Πιθανότητα Νίκης (ανταγωνισμός, ιστορικό) - βάρος 0.15
6. Εκτίμηση Κινδύνων (νομικό, χρονοδιάγραμμα, πολυπλοκότητα) - βάρος 0.10

Κανόνες απόφασης:
- GO: overallScore >= 70
- BORDERLINE: 55 <= overallScore < 70
- NO_GO: overallScore < 55

Απάντησε ΜΟΝΟ σε JSON:
{
  "decision": "GO" | "NO_GO" | "BORDERLINE",
  "overallScore": number,
  "factors": [
    { "factor": "...", "score": number, "weight": number, "explanation": "..." }
  ],
  "recommendation": "..."
}`;

const TEAM_REQUIREMENTS_SYSTEM_PROMPT = `Είσαι ειδικός σε ανθρώπινο δυναμικό δημοσίων διαγωνισμών (Ν.4412/2016).
Αναλύεις τα έγγραφα του διαγωνισμού και εντοπίζεις τις απαιτήσεις σε στελέχη/ρόλους.

Για κάθε ρόλο που απαιτείται, εξάγεις:
- role: τίτλος ρόλου (π.χ. "Υπεύθυνος Έργου", "Senior Developer")
- qualifications: απαιτούμενα τυπικά προσόντα (πτυχία, πιστοποιήσεις)
- minExperience: ελάχιστα έτη εμπειρίας
- count: πόσα άτομα χρειάζονται σε αυτό τον ρόλο
- isMandatory: αν είναι υποχρεωτικό κριτήριο αξιολόγησης

Πρόσεχε ιδιαίτερα:
- Κριτήρια ποιοτικής επιλογής (Άρθρο 75 Ν.4412/2016) — τεχνική/επαγγελματική ικανότητα
- Βαθμολογούμενα κριτήρια τεχνικής αξιολόγησης σχετικά με ομάδα έργου
- Ελάχιστες απαιτήσεις εκπαίδευσης/εμπειρίας

Απάντησε ΜΟΝΟ σε JSON:
{
  "requirements": [
    {
      "role": "...",
      "qualifications": "...",
      "minExperience": number,
      "count": number,
      "isMandatory": boolean
    }
  ]
}`;

const STATUS_SYSTEM_PROMPT = `Είσαι ο AI Bid Manager του TenderCopilot. Απαντάς σε ερωτήσεις κατάστασης
σχετικά με τη διαδικασία προετοιμασίας προσφοράς. Μιλάς ελληνικά, σύντομα
και περιεκτικά, σαν να μιλάς σε meeting ομάδας.

Σου δίνονται δομημένα δεδομένα (tasks, requirements, compliance, risks, team gaps)
και πρέπει να απαντήσεις σε φυσική γλώσσα.

Τυπικές ερωτήσεις:
- "Τι λείπει;" / "Ποια κενά υπάρχουν;"
- "Είμαστε έτοιμοι;" / "Πόσο έτοιμοι είμαστε;"
- "Ποιες εργασίες καθυστερούν;"
- "Τι πρέπει να γίνει πρώτα;"
- "Ποια είναι η κατάσταση;"

Απάντησε σε JSON:
{
  "answer": "...",
  "highlights": [
    { "label": "...", "value": "...", "status": "ok" | "warning" | "critical" }
  ]
}`;

// ─── Service Class ──────────────────────────────────────────

class AIBidOrchestrator {
  /**
   * Summarize a tender by loading its attached documents and using AI
   * to produce a structured brief. Creates or updates the TenderBrief record.
   *
   * @param tenderId - The ID of the tender to summarize
   * @returns The created/updated TenderBrief record
   */
  async summarizeTender(tenderId: string, language: 'el' | 'en' = 'el') {
    const _t0 = Date.now();
    const _log = (step: string) => console.log(`[summarizeTender] ${step}: ${Date.now() - _t0}ms`);

    _log('START');
    await requireDocuments(tenderId);
    _log('requireDocuments done');
    // ── Concurrency guard (auto-reset after 2 min to prevent stuck state) ──
    const tenderCheck = await db.tender.findUniqueOrThrow({ where: { id: tenderId } });
    if (tenderCheck.analysisInProgress) {
      const stuckThreshold = 2 * 60 * 1000; // 2 minutes
      const timeSinceUpdate = Date.now() - new Date(tenderCheck.updatedAt).getTime();
      if (timeSinceUpdate < stuckThreshold) {
        throw new Error('Η ανάλυση βρίσκεται ήδη σε εξέλιξη');
      }
      // Auto-reset stuck flag
      console.warn(`[BidOrchestrator] Resetting stuck analysisInProgress for tender ${tenderId}`);
    }

    // ── Token budget check ────────────────────────────────────
    const budget = await checkTokenBudget(tenderCheck.tenantId);
    if (!budget.allowed) {
      throw new Error(`Ξεπεράσατε το ημερήσιο όριο AI (${budget.used.toLocaleString()}/${budget.limit.toLocaleString()} tokens). Δοκιμάστε αύριο.`);
    }

    await db.tender.update({ where: { id: tenderId }, data: { analysisInProgress: true } });

    try {
      const tender = await db.tender.findUniqueOrThrow({
        where: { id: tenderId },
        include: {
          attachedDocuments: true,
          requirements: true,
          brief: true,
        },
      });

      // ── Collect tender metadata ───────────────────────────────
      const textParts: string[] = [];
      textParts.push(`Τίτλος: ${tender.title}`);
      if (tender.referenceNumber) textParts.push(`Αρ. Αναφοράς: ${tender.referenceNumber}`);
      if (tender.contractingAuthority) textParts.push(`Αναθέτουσα Αρχή: ${tender.contractingAuthority}`);
      if (tender.budget) textParts.push(`Προϋπολογισμός: ${tender.budget.toLocaleString('el-GR')}€`);
      if (tender.submissionDeadline) textParts.push(`Προθεσμία: ${tender.submissionDeadline.toISOString()}`);
      if (tender.cpvCodes.length > 0) textParts.push(`CPV: ${tender.cpvCodes.join(', ')}`);
      if (tender.awardCriteria) textParts.push(`Κριτήριο Ανάθεσης: ${tender.awardCriteria}`);
      if (tender.notes) textParts.push(`Σημειώσεις: ${tender.notes}`);

      if (tender.requirements.length > 0) {
        textParts.push('\n--- Εξαχθείσες Απαιτήσεις ---');
        for (const req of tender.requirements) {
          textParts.push(`[${req.category}] ${req.text}${req.articleReference ? ` (${req.articleReference})` : ''}`);
        }
      }

      if (tender.attachedDocuments.length > 0) {
        textParts.push('\n--- Συνημμένα Έγγραφα ---');
        for (const doc of tender.attachedDocuments) {
          textParts.push(`- ${doc.fileName} (${doc.category || 'other'})`);
        }
      }

      const metadataText = textParts.join('\n');

      // ── Read document content from DB cache (fast) ─────────────
      _log('reading documents from DB');
      const docsWithText = await db.attachedDocument.findMany({
        where: { tenderId, extractedText: { not: null } },
        select: { fileName: true, extractedText: true },
      });
      let documentText = docsWithText
        .map((d) => `\n--- ${d.fileName} ---\n${d.extractedText}`)
        .join('\n');
      // Limit to 80K chars to avoid Vercel 60s timeout
      if (documentText.length > 80000) {
        documentText = documentText.slice(0, 80000) + '\n\n[...κείμενο περικόπηκε λόγω μεγέθους]';
      }
      _log(`documents read: ${documentText.length} chars`);
      const fullText = documentText
        ? `${metadataText}\n\n=== ΚΕΙΜΕΝΟ ΕΓΓΡΑΦΩΝ ===\n${documentText}`
        : metadataText;

      // ── Language instruction ─────────────────────────────────
      const langInstruction = language === 'en'
        ? 'Respond entirely in English.'
        : 'Απάντησε εξ ολοκλήρου στα ελληνικά.';

      // ── AI call (with chunking if text is too long) ───────────
      _log(`AI call starting, fullText=${fullText.length} chars, shouldChunk=${shouldChunk(fullText)}`);
      let briefData: TenderBriefData;

      if (shouldChunk(fullText)) {
        const chunks = chunkText(fullText);
        console.log(`[BidOrchestrator] Chunking document into ${chunks.length} parts for brief analysis`);

        // Process each chunk and collect partial results
        const partialResults: TenderBriefData[] = [];
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const result = await ai().complete({
            messages: [
              { role: 'system', content: SUMMARIZE_SYSTEM_PROMPT + `\n\n${langInstruction}` },
              {
                role: 'user',
                content: `Ανάλυσε το παρακάτω τμήμα (${i + 1}/${chunks.length}) του διαγωνισμού:\n\n${chunk}`,
              },
            ],
            maxTokens: 6000,
            temperature: 0.2,
            responseFormat: 'json',
          });

          await logTokenUsage(tenderId, `brief_chunk_${i + 1}`, {
            input: result.inputTokens || 0,
            output: result.outputTokens || 0,
            total: result.totalTokens || 0,
          });

          try {
            const partial = parseAIResponse<TenderBriefData>(result.content, ['summaryText', 'keyPoints'], `brief chunk ${i + 1}`);
            partialResults.push(partial);
          } catch (err) {
            console.warn(`[BidOrchestrator] Chunk ${i + 1} parse error, skipping:`, err);
          }
        }

        if (partialResults.length === 0) {
          throw new Error('Η AI ανάλυση απέτυχε σε όλα τα τμήματα του εγγράφου.');
        }

        // Merge partial results — use first chunk's summary, merge arrays from all chunks
        const merged = partialResults[0];
        for (let i = 1; i < partialResults.length; i++) {
          const p = partialResults[i];
          // Merge mandatoryCriteria
          if (p.keyPoints?.mandatoryCriteria?.length) {
            merged.keyPoints.mandatoryCriteria = Array.from(
              new Set([...(merged.keyPoints.mandatoryCriteria || []), ...p.keyPoints.mandatoryCriteria])
            );
          }
          // Merge deadlines
          if (p.keyPoints?.deadlines?.length) {
            merged.keyPoints.deadlines = [...(merged.keyPoints.deadlines || []), ...p.keyPoints.deadlines];
          }
          // Merge CPV codes
          if (p.keyPoints?.cpvCodes?.length) {
            merged.keyPoints.cpvCodes = Array.from(
              new Set([...(merged.keyPoints.cpvCodes || []), ...p.keyPoints.cpvCodes])
            );
          }
          // Merge special conditions
          if (p.keyPoints?.specialConditions?.length) {
            merged.keyPoints.specialConditions = Array.from(
              new Set([...(merged.keyPoints.specialConditions || []), ...p.keyPoints.specialConditions])
            );
          }
          // Merge missingInfo
          if (p.missingInfo?.length) {
            merged.missingInfo = Array.from(
              new Set([...(merged.missingInfo || []), ...p.missingInfo])
            );
          }
          // Take non-NOT_FOUND values from later chunks if first chunk had NOT_FOUND
          if (!merged.sector || merged.sector === NOT_FOUND) merged.sector = p.sector;
          if (!merged.awardType || merged.awardType === NOT_FOUND) merged.awardType = p.awardType;
          if (!merged.duration || merged.duration === NOT_FOUND) merged.duration = p.duration;
          if (merged.keyPoints.estimatedBudget == null && p.keyPoints?.estimatedBudget != null) {
            merged.keyPoints.estimatedBudget = p.keyPoints.estimatedBudget;
          }
        }

        briefData = merged;
      } else {
        // Single call for normal-sized documents
        const result = await ai().complete({
          messages: [
            { role: 'system', content: SUMMARIZE_SYSTEM_PROMPT + `\n\n${langInstruction}` },
            {
              role: 'user',
              content: `Ανάλυσε τον παρακάτω διαγωνισμό και δημιούργησε δομημένη σύνοψη (brief):\n\n${fullText}`,
            },
          ],
          maxTokens: 6000,
          temperature: 0.2,
          responseFormat: 'json',
        });

        await logTokenUsage(tenderId, 'brief_analysis', {
          input: result.inputTokens || 0,
          output: result.outputTokens || 0,
          total: result.totalTokens || 0,
        });

        briefData = parseAIResponse<TenderBriefData>(result.content, ['summaryText', 'keyPoints'], 'brief');
      }

      // ── Missing info detection ────────────────────────────────
      const missingInfo: string[] = briefData.missingInfo || [];

      // Map critical field names to where they appear in the parsed data
      const fieldValueMap: Record<string, string | null | undefined> = {
        'Τίτλος διαγωνισμού': tender.title || briefData.summaryText,
        'Προϋπολογισμός': tender.budget != null
          ? String(tender.budget)
          : briefData.keyPoints?.estimatedBudget != null
          ? String(briefData.keyPoints.estimatedBudget)
          : null,
        'Προθεσμία υποβολής': tender.submissionDeadline
          ? tender.submissionDeadline.toISOString()
          : briefData.keyPoints?.deadlines?.[0]?.date || null,
        'Αναθέτουσα αρχή': tender.contractingAuthority || (briefData.keyPoints as any)?.contractingAuthority || null,
        'CPV κωδικοί': tender.cpvCodes.length > 0
          ? tender.cpvCodes.join(', ')
          : briefData.keyPoints?.cpvCodes?.length
          ? briefData.keyPoints.cpvCodes.join(', ')
          : null,
      };

      // Build a map of "relative" textual values the AI may have returned
      // instead of structured dates/numbers (e.g. "εντός 5 εργασίμων ημερών")
      const relativeTextMap: Record<string, string | null | undefined> = {
        'Προθεσμία υποβολής': briefData.keyPoints?.deadlines?.[0]?.date || null,
        'διάρκεια': briefData.duration || (briefData.keyPoints as any)?.duration || null,
      };

      for (const field of BRIEF_CRITICAL_FIELDS) {
        const value = fieldValueMap[field];
        const isNotFound =
          value == null ||
          value === '' ||
          value === NOT_FOUND ||
          String(value).includes('ΔΕΝ ΑΝΑΦΕΡΕΤΑΙ');

        const alreadyReported = missingInfo.some(m =>
          m.toLowerCase().includes(field.toLowerCase())
        );

        if (isNotFound && !alreadyReported) {
          // Check if the AI returned a relative/textual description instead
          const relativeText = relativeTextMap[field];
          const hasRelativeText = relativeText &&
            relativeText !== NOT_FOUND &&
            !relativeText.includes('ΔΕΝ ΑΝΑΦΕΡΕΤΑΙ') &&
            !/^\d{4}-\d{2}-\d{2}/.test(relativeText); // not a valid ISO date

          if (hasRelativeText) {
            missingInfo.push(`${field}: δεν αναφέρεται συγκεκριμένη ημερομηνία — αναφέρεται: "${relativeText}"`);
          } else {
            missingInfo.push(`Δεν βρέθηκε: ${field}`);
          }
        }
      }

      // Also check duration separately (not in BRIEF_CRITICAL_FIELDS but useful to show)
      const durationValue = briefData.duration || (briefData.keyPoints as any)?.duration;
      const hasDuration = durationValue &&
        durationValue !== NOT_FOUND &&
        !String(durationValue).includes('ΔΕΝ ΑΝΑΦΕΡΕΤΑΙ');
      const durationReported = missingInfo.some(m => m.toLowerCase().includes('διάρκεια'));
      if (!hasDuration && !durationReported) {
        missingInfo.push('Δεν βρέθηκε: διάρκεια');
      } else if (hasDuration && durationReported) {
        // Replace generic "Δεν βρέθηκε: διάρκεια" with the actual text
        const idx = missingInfo.findIndex(m => m.toLowerCase().includes('διάρκεια') && m.startsWith('Δεν βρέθηκε'));
        if (idx >= 0) {
          missingInfo[idx] = `διάρκεια: ${durationValue}`;
        }
      }

      // Store missingInfo inside keyPoints JSON (no separate DB column)
      const keyPointsWithMissing = {
        ...briefData.keyPoints,
        missingInfo: missingInfo.length > 0 ? missingInfo : undefined,
      };

      // ── Upsert TenderBrief ────────────────────────────────────
      const normalizeNotFound = (val: string | null | undefined): string | null => {
        if (!val || val === NOT_FOUND || val.includes('ΔΕΝ ΑΝΑΦΕΡΕΤΑΙ')) return null;
        return val;
      };

      const brief = await db.tenderBrief.upsert({
        where: { tenderId },
        create: {
          tenderId,
          summaryText: briefData.summaryText,
          keyPoints: keyPointsWithMissing as any,
          sector: normalizeNotFound(briefData.sector || briefData.keyPoints?.sector),
          awardType: normalizeNotFound(briefData.awardType || briefData.keyPoints?.awardType),
          duration: normalizeNotFound(briefData.duration || briefData.keyPoints?.duration),
        },
        update: {
          summaryText: briefData.summaryText,
          keyPoints: keyPointsWithMissing as any,
          sector: normalizeNotFound(briefData.sector || briefData.keyPoints?.sector),
          awardType: normalizeNotFound(briefData.awardType || briefData.keyPoints?.awardType),
          duration: normalizeNotFound(briefData.duration || briefData.keyPoints?.duration),
        },
      });

      // ── Backfill tender fields from AI extraction ────────────
      // If the AI found budget, deadlines, authority etc. that are missing from
      // the tender record, write them back so the overview cards are populated.
      const tenderUpdate: Record<string, unknown> = { analysisLanguage: language };

      // Title — update from keyPoints or summary if still "Untitled Tender"
      if (tender.title === 'Untitled Tender') {
        const kp = briefData.keyPoints as any;
        const extractedTitle = kp?.tenderTitle || kp?.title;
        if (extractedTitle && typeof extractedTitle === 'string' && extractedTitle.length > 5) {
          tenderUpdate.title = extractedTitle.slice(0, 200);
        } else if (briefData.summaryText) {
          const firstSentence = briefData.summaryText.match(/^[^.!;]+[.!;]/);
          if (firstSentence) {
            tenderUpdate.title = firstSentence[0].trim().slice(0, 200);
          }
        }
      }

      // Budget
      if (!tender.budget && briefData.keyPoints?.estimatedBudget != null) {
        tenderUpdate.budget = Number(briefData.keyPoints.estimatedBudget);
      }

      // Contracting authority — check multiple possible locations in AI response,
      // then fall back to regex-based extraction from document text.
      if (!tender.contractingAuthority) {
        const kp = briefData.keyPoints as any;
        const candidateAuthority =
          kp?.contractingAuthority ||
          kp?.awardingAuthority ||
          kp?.authority ||
          kp?.anathetousa ||
          (briefData as any)?.contractingAuthority;

        let authority: string | undefined;

        if (candidateAuthority && typeof candidateAuthority === 'string' && !candidateAuthority.includes('ΔΕΝ ΑΝΑΦ') && candidateAuthority !== NOT_FOUND) {
          authority = candidateAuthority;
        }

        // If not found in keyPoints, try to regex-match from the summary text
        if (!authority && briefData.summaryText) {
          // Try explicit "αναθέτουσα αρχή:" pattern first
          const authorityMatch = briefData.summaryText.match(
            /(?:αναθέτουσα\s*αρχή|φορέας)[:\s]*([^\n,.;]{3,80})/i
          );
          if (authorityMatch?.[1]) {
            authority = authorityMatch[1].trim();
          }
          // Also try "Η <Name> προκηρύσσει/διακηρύσσει" pattern (common in Greek summaries)
          if (!authority) {
            const subjectMatch = briefData.summaryText.match(
              /(?:^|[.]\s+)(?:Η|Ο|Το)\s+((?:Κτηματικ[ήη]\s+Υπηρεσ[ίι]α|Δ[ήη]μος|Υπουργε[ίι]ο|Περιφ[έε]ρεια|Πανεπιστ[ήη]μιο|Νοσοκομε[ίι]ο|ΑΑΔΕ|ΔΕΥΑ|ΔΕΗ|ΕΦΚΑ)\s+[^\n,.;]{1,60}?)(?:\s+(?:προκηρ[υύ]σσει|διακηρ[υύ]σσει|αναθ[έε]τει|διενεργε[ίι]|προβα[ίι]νει))/i
            );
            if (subjectMatch?.[1]) {
              authority = subjectMatch[1].trim();
            }
          }
        }

        // If still not found, search the raw document text for common Greek authority patterns
        if (!authority && documentText) {
          const authorityPatterns = [
            /(?:Κτηματικ[ήη]\s+Υπηρεσ[ίι]α\s+\S+)/i,
            /(?:Δ[ήη]μος\s+\S+(?:\s+\S+)?)/i,
            /(?:Υπουργε[ίι]ο\s+\S+(?:\s+\S+){0,3})/i,
            /(?:ΑΑΔΕ|Α\.Α\.Δ\.Ε\.)/,
            /(?:Περιφ[έε]ρεια\s+\S+(?:\s+\S+)?)/i,
            /(?:Αποκεντρωμ[έε]νη\s+Διο[ίι]κηση\s+\S+(?:\s+\S+){0,2})/i,
            /(?:Ν\.Π\.Δ\.Δ\.\s+\S+(?:\s+\S+){0,2})/i,
            /(?:Ο\.Τ\.Α\.\s+\S+(?:\s+\S+)?)/i,
            /(?:Πανεπιστ[ήη]μιο\s+\S+(?:\s+\S+)?)/i,
            /(?:Νοσοκομε[ίι]ο\s+\S+(?:\s+\S+)?)/i,
            /(?:ΕΦΚΑ|Ε\.Φ\.Κ\.Α\.)/,
            /(?:ΔΕΥΑ\s+\S+)/i,
            /(?:ΔΕΗ|Δ\.Ε\.Η\.)/,
            /(?:ΕΥΔΑΠ|Ε\.ΥΔ\.Α\.Π\.)/,
          ];
          for (const pattern of authorityPatterns) {
            const match = documentText.match(pattern);
            if (match?.[0]) {
              authority = match[0].trim();
              break;
            }
          }
        }

        if (authority) {
          tenderUpdate.contractingAuthority = authority;
        }
      }

      // Submission deadline
      if (!tender.submissionDeadline && briefData.keyPoints?.deadlines?.length) {
        const firstDeadline = briefData.keyPoints.deadlines[0];
        if (firstDeadline?.date && firstDeadline.date !== NOT_FOUND && !firstDeadline.date.includes('ΔΕΝ')) {
          try {
            const parsed = new Date(firstDeadline.date);
            if (!isNaN(parsed.getTime())) {
              tenderUpdate.submissionDeadline = parsed;
            }
          } catch { /* ignore */ }
        }
      }

      // CPV codes
      if (tender.cpvCodes.length === 0 && briefData.keyPoints?.cpvCodes?.length) {
        tenderUpdate.cpvCodes = briefData.keyPoints.cpvCodes;
      }

      // Award criteria
      if (!tender.awardCriteria) {
        const awardType = briefData.awardType || briefData.keyPoints?.awardType;
        if (awardType && awardType !== NOT_FOUND && !awardType.includes('ΔΕΝ')) {
          tenderUpdate.awardCriteria = awardType;
        }
      }

      await db.tender.update({ where: { id: tenderId }, data: tenderUpdate });

      // ── Log activity ──────────────────────────────────────────
      const missingCount = missingInfo.length;
      await db.activity.create({
        data: {
          tenderId,
          action: 'tender_summarized',
          details: `Δημιουργήθηκε σύνοψη διαγωνισμού (brief) — Τομέας: ${briefData.sector || 'N/A'}, Ανάθεση: ${briefData.awardType || 'N/A'}${missingCount > 0 ? `, Ελλείποντα πεδία: ${missingCount}` : ''}`,
        },
      });

      return brief;
    } finally {
      // Always reset the concurrency guard
      await db.tender.update({ where: { id: tenderId }, data: { analysisInProgress: false } });
    }
  }

  /**
   * Perform a Go/No-Go analysis for a tender by evaluating the company's
   * fitness across 6 weighted factors. Creates a GoNoGoDecision record.
   *
   * @param tenderId - The ID of the tender to analyze
   * @param tenantId - The tenant (company) ID for loading company data
   * @returns The created GoNoGoDecision record
   */
  async goNoGoAnalysis(tenderId: string, tenantId: string, language: 'el' | 'en' = 'el') {
    await requireDocuments(tenderId);
    // Load all relevant data in parallel
    const [
      tender,
      companyProfile,
      certificates,
      projects,
      financialProfiles,
      pastTenders,
      teamRequirements,
    ] = await Promise.all([
      db.tender.findUniqueOrThrow({
        where: { id: tenderId },
        include: {
          requirements: true,
          brief: true,
          legalClauses: true,
        },
      }),
      db.companyProfile.findUnique({ where: { tenantId } }),
      db.certificate.findMany({ where: { tenantId } }),
      db.project.findMany({ where: { tenantId }, orderBy: { endDate: 'desc' } }),
      db.financialProfile.findMany({ where: { tenantId }, orderBy: { year: 'desc' }, take: 3 }),
      db.tender.findMany({
        where: {
          tenantId,
          status: { in: ['WON', 'LOST', 'SUBMITTED'] as TenderStatus[] },
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
      db.teamRequirement.findMany({ where: { tenderId } }),
    ]);

    // Build context for AI
    const contextParts: string[] = [];

    // Tender info
    contextParts.push('=== ΣΤΟΙΧΕΙΑ ΔΙΑΓΩΝΙΣΜΟΥ ===');
    contextParts.push(`Τίτλος: ${tender.title}`);
    contextParts.push(`CPV: ${tender.cpvCodes.join(', ') || 'N/A'}`);
    contextParts.push(`Προϋπολογισμός: ${tender.budget ? `${tender.budget.toLocaleString('el-GR')}€` : 'N/A'}`);
    contextParts.push(`Προθεσμία: ${tender.submissionDeadline?.toISOString() || 'N/A'}`);
    if (tender.brief) {
      contextParts.push(`Σύνοψη: ${tender.brief.summaryText}`);
    }
    contextParts.push(`Απαιτήσεις: ${tender.requirements.length} (${tender.requirements.filter(r => r.mandatory).length} υποχρεωτικές)`);

    // Company profile
    contextParts.push('\n=== ΕΤΑΙΡΙΚΟ ΠΡΟΦΙΛ ===');
    if (companyProfile) {
      contextParts.push(`Επωνυμία: ${companyProfile.legalName}`);
      contextParts.push(`ΑΦΜ: ${companyProfile.taxId}`);
      contextParts.push(`ΚΑΔ: ${companyProfile.kadCodes.join(', ') || 'N/A'}`);
      if (companyProfile.description) contextParts.push(`Περιγραφή: ${companyProfile.description}`);
    } else {
      contextParts.push('Δεν υπάρχει εταιρικό προφίλ.');
    }

    // Certificates
    contextParts.push('\n=== ΠΙΣΤΟΠΟΙΗΣΕΙΣ ===');
    if (certificates.length > 0) {
      for (const cert of certificates) {
        const validity = cert.expiryDate
          ? (new Date(cert.expiryDate) > new Date() ? 'Σε ισχύ' : 'ΛΗΓΜΕΝΟ')
          : 'Χωρίς ημ/νία λήξης';
        contextParts.push(`- ${cert.type}: ${cert.title} (${validity})`);
      }
    } else {
      contextParts.push('Καμία πιστοποίηση καταχωρημένη.');
    }

    // Projects
    contextParts.push('\n=== ΕΡΓΑ / ΕΜΠΕΙΡΙΑ ===');
    if (projects.length > 0) {
      const recentProjects = projects.slice(0, 10);
      for (const proj of recentProjects) {
        contextParts.push(
          `- ${proj.title} | ${proj.client || 'N/A'} | ${proj.contractAmount ? `${proj.contractAmount.toLocaleString('el-GR')}€` : 'N/A'} | ${proj.category || 'N/A'}`
        );
      }
      contextParts.push(`Σύνολο: ${projects.length} έργα`);
    } else {
      contextParts.push('Κανένα έργο καταχωρημένο.');
    }

    // Financial profiles
    contextParts.push('\n=== ΟΙΚΟΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ ===');
    if (financialProfiles.length > 0) {
      for (const fp of financialProfiles) {
        contextParts.push(
          `Έτος ${fp.year}: Κύκλος Εργασιών=${fp.turnover ? `${fp.turnover.toLocaleString('el-GR')}€` : 'N/A'}, ` +
          `EBITDA=${fp.ebitda ? `${fp.ebitda.toLocaleString('el-GR')}€` : 'N/A'}, ` +
          `Ίδια Κεφάλαια=${fp.equity ? `${fp.equity.toLocaleString('el-GR')}€` : 'N/A'}, ` +
          `Υποχρεώσεις=${fp.debt ? `${fp.debt.toLocaleString('el-GR')}€` : 'N/A'}, ` +
          `Εργαζόμενοι=${fp.employees ?? 'N/A'}`
        );
      }
    } else {
      contextParts.push('Κανένα οικονομικό στοιχείο καταχωρημένο.');
    }

    // Past tender history
    contextParts.push('\n=== ΙΣΤΟΡΙΚΟ ΔΙΑΓΩΝΙΣΜΩΝ ===');
    if (pastTenders.length > 0) {
      const won = pastTenders.filter(t => t.status === 'WON').length;
      const lost = pastTenders.filter(t => t.status === 'LOST').length;
      const submitted = pastTenders.filter(t => t.status === 'SUBMITTED').length;
      contextParts.push(`Κερδισμένοι: ${won}, Χαμένοι: ${lost}, Υποβληθέντες: ${submitted}`);
      if (won + lost > 0) {
        contextParts.push(`Win rate: ${((won / (won + lost)) * 100).toFixed(0)}%`);
      }
    } else {
      contextParts.push('Κανένα ιστορικό διαγωνισμών.');
    }

    // Team requirements
    if (teamRequirements.length > 0) {
      contextParts.push('\n=== ΑΠΑΙΤΗΣΕΙΣ ΟΜΑΔΑΣ ===');
      for (const tr of teamRequirements) {
        contextParts.push(
          `- ${tr.role}: ${tr.count} άτομα, ` +
          `${tr.minExperience ? `${tr.minExperience}+ χρόνια` : 'N/A'}, ` +
          `${tr.isMandatory ? 'ΥΠΟΧΡΕΩΤΙΚΟ' : 'Προαιρετικό'}, ` +
          `Κατάσταση: ${tr.status}${tr.mappedStaffName ? ` (${tr.mappedStaffName})` : ''}`
        );
      }
    }

    // Legal clauses summary
    if (tender.legalClauses.length > 0) {
      contextParts.push('\n=== ΝΟΜΙΚΟΙ ΚΙΝΔΥΝΟΙ ===');
      const highRisk = tender.legalClauses.filter(c => c.riskLevel === 'HIGH' || c.riskLevel === 'CRITICAL');
      contextParts.push(`Σύνολο ρητρών: ${tender.legalClauses.length}, Υψηλού κινδύνου: ${highRisk.length}`);
      for (const clause of highRisk.slice(0, 5)) {
        contextParts.push(`- [${clause.riskLevel}] ${clause.category}: ${clause.clauseText.substring(0, 150)}...`);
      }
    }

    const contextText = contextParts.join('\n');

    // Read ACTUAL document content for AI analysis
    const documentText = await readTenderDocuments(tenderId);

    // Language instruction
    const langInstruction = language === 'en'
      ? 'Respond entirely in English.'
      : 'Απάντησε εξ ολοκλήρου στα ελληνικά.';

    // Call AI
    const aiResult = await ai().complete({
      messages: [
        { role: 'system', content: GO_NO_GO_SYSTEM_PROMPT + `\n\n${langInstruction}` },
        {
          role: 'user',
          content: `Αξιολόγησε αν η εταιρεία πρέπει να συμμετάσχει στον ακόλουθο διαγωνισμό:\n\n${contextText}${documentText ? `\n\n=== ΚΕΙΜΕΝΟ ΕΓΓΡΑΦΩΝ ===\n${documentText}` : ''}`,
        },
      ],
      maxTokens: 6000,
      temperature: 0.3,
      responseFormat: 'json',
    });

    await logTokenUsage(tenderId, 'go_no_go', {
      input: aiResult.inputTokens || 0,
      output: aiResult.outputTokens || 0,
      total: aiResult.totalTokens || 0,
    });

    let analysisResult: GoNoGoAnalysisResult;
    try {
      analysisResult = JSON.parse(aiResult.content);
    } catch (err) {
      console.error('[BidOrchestrator] AI parse error:', err);
      throw new Error('Η AI ανάλυση απέτυχε. Βεβαιωθείτε ότι υπάρχουν συνημμένα έγγραφα με αναγνώσιμο κείμενο.');
    }

    // Validate decision
    const validDecisions = ['GO', 'NO_GO', 'BORDERLINE'] as const;
    const decision = validDecisions.includes(analysisResult.decision as any)
      ? analysisResult.decision
      : (analysisResult.overallScore >= 70 ? 'GO' : analysisResult.overallScore >= 55 ? 'BORDERLINE' : 'NO_GO');

    // Upsert GoNoGoDecision record — one decision per tender, no duplicates
    const goNoGoDecision = await db.goNoGoDecision.upsert({
      where: { tenderId },
      create: {
        tenderId,
        decision,
        overallScore: analysisResult.overallScore,
        reasons: analysisResult.factors as any,
        recommendation: analysisResult.recommendation,
      },
      update: {
        decision,
        overallScore: analysisResult.overallScore,
        reasons: analysisResult.factors as any,
        recommendation: analysisResult.recommendation,
        approvedAt: null,      // Reset approval on re-analysis
        approvedById: null,
      },
    });

    // Log activity
    await db.activity.create({
      data: {
        tenderId,
        action: 'go_no_go_analysis',
        details: `Ανάλυση Go/No-Go: ${decision} (Score: ${analysisResult.overallScore.toFixed(1)}/100) — ${analysisResult.recommendation?.substring(0, 200) || ''}`,
      },
    });

    return goNoGoDecision;
  }

  /**
   * Generate a work plan with tasks, roles, and due dates working backwards
   * from the submission deadline. Creates Task records in the database.
   *
   * Standard phases:
   * - Document Collection (day 1-3)
   * - Legal Review (day 2-5)
   * - Technical Drafting (day 3-10)
   * - Financial Modeling (day 5-8)
   * - Compliance Check (day 8-12)
   * - QA Review (day 10-14)
   * - Management Approval (day 13-15)
   * - Packaging (day 14-16)
   *
   * @param tenderId - The ID of the tender to generate a work plan for
   * @returns Array of created Task records
   */
  async generateWorkPlan(tenderId: string) {
    const tender = await db.tender.findUniqueOrThrow({
      where: { id: tenderId },
    });

    // Determine total available working days
    const deadline = tender.submissionDeadline || new Date(Date.now() + 30 * 86400000);
    const now = new Date();
    const totalDaysAvailable = Math.max(
      Math.ceil((deadline.getTime() - now.getTime()) / 86400000),
      16 // minimum 16 days even if deadline is closer
    );

    // Scale factor: if we have more/fewer days than the standard 16, scale proportionally
    const scaleFactor = totalDaysAvailable / 16;

    /**
     * Calculate actual date from a day offset, accounting for weekends.
     * Day 1 = tomorrow.
     */
    function offsetToDate(dayOffset: number): Date {
      const scaledOffset = Math.round(dayOffset * scaleFactor);
      const date = new Date(now);
      let daysAdded = 0;

      while (daysAdded < scaledOffset) {
        date.setDate(date.getDate() + 1);
        const dayOfWeek = date.getDay();
        // Skip weekends (0=Sunday, 6=Saturday)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          daysAdded++;
        }
      }

      return date;
    }

    // Delete existing AI-generated tasks for this tender (to allow re-generation)
    await db.task.deleteMany({
      where: {
        tenderId,
        isAiGenerated: true,
      },
    });

    // Create tasks
    const createdTasks = [];

    for (const template of WORK_PLAN_PHASES) {
      const dueDate = offsetToDate(template.dayOffsetEnd);

      // Ensure due date does not exceed deadline
      if (dueDate > deadline) {
        dueDate.setTime(deadline.getTime() - 86400000); // 1 day before deadline
      }

      const task = await db.task.create({
        data: {
          tenderId,
          title: template.title,
          description: `[${template.phase}] ${template.description}`,
          status: 'TODO',
          priority: template.priority,
          dueDate,
          assigneeRole: template.assigneeRole,
          isAiGenerated: true,
        },
      });

      createdTasks.push(task);
    }

    // Log activity
    await db.activity.create({
      data: {
        tenderId,
        action: 'work_plan_generated',
        details: `Δημιουργήθηκε πλάνο εργασίας: ${createdTasks.length} εργασίες σε 8 φάσεις ` +
          `(${totalDaysAvailable} ημέρες μέχρι προθεσμία, scale factor: ${scaleFactor.toFixed(2)})`,
      },
    });

    return createdTasks;
  }

  /**
   * Analyze the tender documents to identify team/staffing requirements.
   * Uses AI to extract roles, qualifications, and experience thresholds,
   * then creates TeamRequirement records.
   *
   * @param tenderId - The ID of the tender to analyze
   * @returns Array of created TeamRequirement records
   */
  async analyzeTeamRequirements(tenderId: string) {
    const tender = await db.tender.findUniqueOrThrow({
      where: { id: tenderId },
      include: {
        requirements: true,
        brief: true,
        attachedDocuments: true,
      },
    });

    // Build context for AI
    const contextParts: string[] = [];
    contextParts.push(`Τίτλος Διαγωνισμού: ${tender.title}`);
    if (tender.brief) {
      contextParts.push(`Σύνοψη: ${tender.brief.summaryText}`);
    }

    if (tender.requirements.length > 0) {
      contextParts.push('\n--- Απαιτήσεις Διαγωνισμού ---');
      for (const req of tender.requirements) {
        contextParts.push(`[${req.category}${req.mandatory ? ', ΥΠΟΧΡΕΩΤΙΚΟ' : ''}] ${req.text}`);
      }
    }

    const contextText = contextParts.join('\n');

    // Call AI
    const aiResult = await ai().complete({
      messages: [
        { role: 'system', content: TEAM_REQUIREMENTS_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Εξάγαγε τις απαιτήσεις στελέχωσης ομάδας έργου από τον διαγωνισμό:\n\n${contextText}`,
        },
      ],
      maxTokens: 2000,
      temperature: 0.2,
      responseFormat: 'json',
    });

    let extractedRequirements: ExtractedTeamRequirement[];
    try {
      const parsed = JSON.parse(aiResult.content);
      extractedRequirements = parsed.requirements || parsed;
      if (!Array.isArray(extractedRequirements) || extractedRequirements.length === 0) {
        throw new Error('AI returned empty or invalid requirements array');
      }
    } catch (err) {
      console.error('[BidOrchestrator] AI parse error:', err);
      throw new Error('Η AI ανάλυση απέτυχε. Βεβαιωθείτε ότι υπάρχουν συνημμένα έγγραφα με αναγνώσιμο κείμενο.');
    }

    // Delete existing AI-generated team requirements (allow re-analysis)
    await db.teamRequirement.deleteMany({
      where: {
        tenderId,
        mappedStaffName: null, // only delete unmapped ones (not manually assigned)
      },
    });

    // Create TeamRequirement records
    const createdRequirements = [];

    for (const req of extractedRequirements) {
      const teamReq = await db.teamRequirement.create({
        data: {
          tenderId,
          role: req.role || 'Unknown Role',
          qualifications: req.qualifications || null,
          minExperience: typeof req.minExperience === 'number' ? req.minExperience : null,
          count: typeof req.count === 'number' && req.count > 0 ? req.count : 1,
          isMandatory: req.isMandatory ?? true,
          status: 'UNMAPPED',
        },
      });

      createdRequirements.push(teamReq);
    }

    // Log activity
    await db.activity.create({
      data: {
        tenderId,
        action: 'team_requirements_analyzed',
        details: `Εντοπίστηκαν ${createdRequirements.length} ρόλοι ομάδας (${createdRequirements.filter(r => r.isMandatory).length} υποχρεωτικοί)`,
      },
    });

    return createdRequirements;
  }

  /**
   * Answer natural-language status questions about the tender preparation.
   * Loads all structured data and uses AI to provide a contextual answer.
   *
   * Supports questions in Greek like:
   * - "Τι λείπει;"
   * - "Είμαστε έτοιμοι;"
   * - "Ποιες εργασίες καθυστερούν;"
   * - "Τι πρέπει να γίνει πρώτα;"
   *
   * @param tenderId - The ID of the tender
   * @param question - The natural-language question (Greek or English)
   * @returns An answer object with text and highlighted key facts
   */
  async answerStatusQuestion(tenderId: string, question: string): Promise<StatusAnswer> {
    // Load all relevant data in parallel
    const [
      tender,
      tasks,
      requirements,
      teamRequirements,
      legalClauses,
      goNoGoDecision,
      recentActivities,
    ] = await Promise.all([
      db.tender.findUniqueOrThrow({
        where: { id: tenderId },
        include: { brief: true },
      }),
      db.task.findMany({
        where: { tenderId },
        orderBy: { dueDate: 'asc' },
      }),
      db.tenderRequirement.findMany({
        where: { tenderId },
      }),
      db.teamRequirement.findMany({
        where: { tenderId },
      }),
      db.legalClause.findMany({
        where: { tenderId },
      }),
      db.goNoGoDecision.findFirst({
        where: { tenderId },
        orderBy: { createdAt: 'desc' },
      }),
      db.activity.findMany({
        where: { tenderId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    // Build structured context
    const now = new Date();
    const daysToDeadline = tender.submissionDeadline
      ? Math.ceil((tender.submissionDeadline.getTime() - now.getTime()) / 86400000)
      : null;

    const tasksDone = tasks.filter(t => t.status === 'DONE').length;
    const tasksInProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;
    const tasksTodo = tasks.filter(t => t.status === 'TODO').length;
    const overdueTasks = tasks.filter(t => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < now);

    const mandatoryReqs = requirements.filter(r => r.mandatory);
    const coveredReqs = mandatoryReqs.filter(r => r.coverageStatus === 'COVERED' || r.coverageStatus === 'MANUAL_OVERRIDE');
    const gapReqs = mandatoryReqs.filter(r => r.coverageStatus === 'GAP');
    const unmappedReqs = mandatoryReqs.filter(r => r.coverageStatus === 'UNMAPPED');

    const teamGaps = teamRequirements.filter(t => t.status === 'UNMAPPED' || t.status === 'GAP');
    const teamCovered = teamRequirements.filter(t => t.status === 'COVERED' || t.status === 'MANUAL_OVERRIDE');

    const highRiskClauses = legalClauses.filter(c => c.riskLevel === 'HIGH' || c.riskLevel === 'CRITICAL');

    const contextParts: string[] = [];
    contextParts.push(`=== ΔΙΑΓΩΝΙΣΜΟΣ: ${tender.title} ===`);
    contextParts.push(`Κατάσταση: ${tender.status}`);
    contextParts.push(`Compliance Score: ${tender.complianceScore?.toFixed(1) ?? 'N/A'}%`);
    contextParts.push(`Ημέρες μέχρι προθεσμία: ${daysToDeadline ?? 'Χωρίς προθεσμία'}`);

    if (goNoGoDecision) {
      contextParts.push(`\nGo/No-Go: ${goNoGoDecision.decision} (Score: ${goNoGoDecision.overallScore?.toFixed(1) ?? 'N/A'}/100)`);
    }

    contextParts.push(`\n=== ΕΡΓΑΣΙΕΣ (${tasks.length} σύνολο) ===`);
    contextParts.push(`Ολοκληρωμένες: ${tasksDone}, Σε εξέλιξη: ${tasksInProgress}, Εκκρεμούν: ${tasksTodo}`);
    if (overdueTasks.length > 0) {
      contextParts.push(`ΚΑΘΥΣΤΕΡΗΜΕΝΕΣ (${overdueTasks.length}):`);
      for (const t of overdueTasks.slice(0, 5)) {
        contextParts.push(`  - ${t.title} (προθεσμία: ${t.dueDate?.toLocaleDateString('el-GR')}, ρόλος: ${t.assigneeRole || 'N/A'})`);
      }
    }

    contextParts.push(`\n=== ΑΠΑΙΤΗΣΕΙΣ (${mandatoryReqs.length} υποχρεωτικές) ===`);
    contextParts.push(`Καλυπτόμενες: ${coveredReqs.length}, Κενά: ${gapReqs.length}, Μη αντιστοιχισμένες: ${unmappedReqs.length}`);
    if (gapReqs.length > 0) {
      contextParts.push(`ΚΕΝΑ:`);
      for (const r of gapReqs.slice(0, 5)) {
        contextParts.push(`  - [${r.category}] ${r.text.substring(0, 100)}`);
      }
    }

    contextParts.push(`\n=== ΟΜΑΔΑ (${teamRequirements.length} ρόλοι) ===`);
    contextParts.push(`Καλυπτόμενοι: ${teamCovered.length}, Κενά: ${teamGaps.length}`);
    if (teamGaps.length > 0) {
      for (const t of teamGaps) {
        contextParts.push(`  - ${t.role} (${t.isMandatory ? 'ΥΠΟΧΡΕΩΤΙΚΟ' : 'Προαιρετικό'}) — ${t.status}`);
      }
    }

    contextParts.push(`\n=== ΝΟΜΙΚΟΙ ΚΙΝΔΥΝΟΙ ===`);
    contextParts.push(`Σύνολο ρητρών: ${legalClauses.length}, Υψηλού κινδύνου: ${highRiskClauses.length}`);
    if (highRiskClauses.length > 0) {
      for (const c of highRiskClauses.slice(0, 3)) {
        contextParts.push(`  - [${c.riskLevel}] ${c.category}: ${c.clauseText.substring(0, 100)}...`);
      }
    }

    contextParts.push(`\n=== ΠΡΟΣΦΑΤΗ ΔΡΑΣΤΗΡΙΟΤΗΤΑ ===`);
    for (const a of recentActivities.slice(0, 5)) {
      contextParts.push(`  - ${a.createdAt.toLocaleDateString('el-GR')} ${a.action}: ${a.details?.substring(0, 80) || ''}`);
    }

    const contextText = contextParts.join('\n');

    // Call AI
    const aiResult = await ai().complete({
      messages: [
        { role: 'system', content: STATUS_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Ερώτηση: "${question}"\n\nΔεδομένα κατάστασης:\n${contextText}`,
        },
      ],
      maxTokens: 1500,
      temperature: 0.4,
      responseFormat: 'json',
    });

    let answer: StatusAnswer;
    try {
      answer = JSON.parse(aiResult.content);
    } catch (err) {
      console.error('[BidOrchestrator] AI parse error:', err);
      throw new Error('Η AI ανάλυση απέτυχε. Βεβαιωθείτε ότι υπάρχουν συνημμένα έγγραφα με αναγνώσιμο κείμενο.');
    }

    // Log activity
    await db.activity.create({
      data: {
        tenderId,
        action: 'status_question',
        details: `Ερώτηση: "${question.substring(0, 100)}" — Απάντηση: ${answer.answer.substring(0, 200)}...`,
      },
    });

    return answer;
  }
}

/** Singleton instance of the AI Bid Orchestrator service. */
export const aiBidOrchestrator = new AIBidOrchestrator();
