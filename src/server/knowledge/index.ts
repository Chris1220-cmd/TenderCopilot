/**
 * Smart Knowledge Retriever - TenderCopilot
 * Αναλύει ερωτήσεις χρηστών και επιστρέφει σχετική γνώση
 * από τη βάση δεδομένων Ν.4412/2016
 */

import { LAW_4412_ARTICLES, type LawArticle } from './law-4412';
import { LEAD_TIMES, type LeadTime } from './lead-times';
import { COMMON_MISTAKES, type CommonMistake } from './common-mistakes';
import { TENDER_CHECKLISTS } from './checklists';
import { ESIDIS_GUIDE } from './esidis-guide';
import { classifyTenderType, type TenderClassification } from './tender-classifier';

// Re-export everything
export { LAW_4412_ARTICLES } from './law-4412';
export { LEAD_TIMES } from './lead-times';
export { COMMON_MISTAKES } from './common-mistakes';
export { TENDER_CHECKLISTS } from './checklists';
export { ESIDIS_GUIDE } from './esidis-guide';
export { classifyTenderType } from './tender-classifier';
export type { TenderClassification } from './tender-classifier';

// --- Keyword maps for matching ---

interface KeywordMatch {
  keyword: string;
  topics: KnowledgeTopic[];
}

type KnowledgeTopic =
  | 'guarantees'
  | 'exclusion'
  | 'documents'
  | 'deadlines'
  | 'evaluation'
  | 'esidis'
  | 'checklist'
  | 'eligibility'
  | 'appeals'
  | 'contracts'
  | 'mistakes'
  | 'lead_times';

const KEYWORD_MAP: KeywordMatch[] = [
  // Εγγυητικές
  { keyword: 'εγγυητικ', topics: ['guarantees', 'mistakes', 'lead_times'] },
  { keyword: 'εγγύηση', topics: ['guarantees', 'lead_times'] },
  { keyword: 'bank guarantee', topics: ['guarantees', 'lead_times'] },
  { keyword: 'τράπεζα', topics: ['guarantees', 'lead_times'] },
  { keyword: '2%', topics: ['guarantees'] },
  { keyword: '4%', topics: ['guarantees', 'contracts'] },
  // Αποκλεισμός
  { keyword: 'αποκλεισμ', topics: ['exclusion', 'mistakes'] },
  { keyword: 'αποκλείω', topics: ['exclusion', 'mistakes'] },
  { keyword: 'ποινικ', topics: ['exclusion', 'documents', 'lead_times'] },
  { keyword: 'φορολογικ', topics: ['exclusion', 'documents', 'lead_times'] },
  { keyword: 'ασφαλιστικ', topics: ['exclusion', 'documents', 'lead_times'] },
  { keyword: 'ΕΦΚΑ', topics: ['exclusion', 'documents', 'lead_times'] },
  { keyword: 'εφκα', topics: ['exclusion', 'documents', 'lead_times'] },
  { keyword: 'ενημερότητα', topics: ['exclusion', 'documents', 'lead_times'] },
  // Έγγραφα
  { keyword: 'ΕΕΕΣ', topics: ['documents', 'lead_times', 'mistakes'] },
  { keyword: 'εεεσ', topics: ['documents', 'lead_times', 'mistakes'] },
  { keyword: 'ESPD', topics: ['documents', 'lead_times'] },
  { keyword: 'ΤΕΥΔ', topics: ['documents', 'lead_times'] },
  { keyword: 'τευδ', topics: ['documents', 'lead_times'] },
  { keyword: 'δικαιολογητικ', topics: ['documents', 'checklist'] },
  { keyword: 'πιστοποιητικ', topics: ['documents', 'lead_times'] },
  { keyword: 'ΓΕΜΗ', topics: ['documents', 'lead_times'] },
  { keyword: 'γεμη', topics: ['documents', 'lead_times'] },
  { keyword: 'ISO', topics: ['documents', 'lead_times'] },
  { keyword: 'iso', topics: ['documents', 'lead_times'] },
  { keyword: 'υπεύθυνη δήλωση', topics: ['documents', 'mistakes'] },
  { keyword: 'ψηφιακή υπογραφή', topics: ['documents', 'esidis', 'mistakes'] },
  // Προθεσμίες
  { keyword: 'προθεσμ', topics: ['deadlines', 'lead_times'] },
  { keyword: 'ημερομηνία', topics: ['deadlines'] },
  { keyword: 'καταληκτικ', topics: ['deadlines', 'esidis'] },
  { keyword: 'πότε', topics: ['deadlines', 'lead_times'] },
  { keyword: 'χρόνος', topics: ['deadlines', 'lead_times'] },
  { keyword: 'ημέρες', topics: ['deadlines', 'lead_times'] },
  { keyword: 'deadline', topics: ['deadlines', 'lead_times'] },
  // Αξιολόγηση
  { keyword: 'αξιολόγηση', topics: ['evaluation'] },
  { keyword: 'βαθμολογ', topics: ['evaluation'] },
  { keyword: 'κριτήρι', topics: ['evaluation', 'eligibility'] },
  { keyword: 'χαμηλότερη τιμή', topics: ['evaluation'] },
  { keyword: 'συμφερότερη', topics: ['evaluation'] },
  // ΕΣΗΔΗΣ
  { keyword: 'ΕΣΗΔΗΣ', topics: ['esidis', 'mistakes'] },
  { keyword: 'εσηδησ', topics: ['esidis', 'mistakes'] },
  { keyword: 'promitheus', topics: ['esidis'] },
  { keyword: 'ηλεκτρονικ', topics: ['esidis'] },
  { keyword: 'υποβολή', topics: ['esidis', 'deadlines', 'mistakes'] },
  { keyword: 'upload', topics: ['esidis'] },
  { keyword: 'ανέβασμα', topics: ['esidis'] },
  { keyword: 'μεταφόρτωση', topics: ['esidis'] },
  // Checklist
  { keyword: 'checklist', topics: ['checklist'] },
  { keyword: 'τι χρειάζ', topics: ['checklist', 'lead_times'] },
  { keyword: 'τι πρέπει', topics: ['checklist', 'lead_times'] },
  { keyword: 'λίστα', topics: ['checklist'] },
  { keyword: 'απαιτ', topics: ['checklist', 'documents'] },
  // Τύπος διαγωνισμού
  { keyword: 'ανοικτ', topics: ['eligibility', 'checklist'] },
  { keyword: 'κλειστ', topics: ['eligibility', 'checklist'] },
  { keyword: 'απευθείας', topics: ['eligibility', 'checklist'] },
  { keyword: 'συνοπτικ', topics: ['eligibility', 'checklist'] },
  { keyword: 'πλαίσιο', topics: ['eligibility', 'checklist'] },
  { keyword: 'framework', topics: ['eligibility', 'checklist'] },
  // Λάθη
  { keyword: 'λάθ', topics: ['mistakes'] },
  { keyword: 'σφάλμα', topics: ['mistakes'] },
  { keyword: 'κίνδυνο', topics: ['mistakes'] },
  { keyword: 'προσοχή', topics: ['mistakes'] },
  { keyword: 'αποφυγ', topics: ['mistakes'] },
  { keyword: 'mistake', topics: ['mistakes'] },
  { keyword: 'error', topics: ['mistakes'] },
  // Ενστάσεις
  { keyword: 'ένσταση', topics: ['appeals'] },
  { keyword: 'προσφυγ', topics: ['appeals'] },
  { keyword: 'ΑΕΠΠ', topics: ['appeals'] },
  { keyword: 'αεππ', topics: ['appeals'] },
  { keyword: 'παράβολο', topics: ['appeals'] },
  // Σύμβαση
  { keyword: 'σύμβαση', topics: ['contracts'] },
  { keyword: 'κατακύρωση', topics: ['contracts', 'documents'] },
  { keyword: 'ανάδοχος', topics: ['contracts'] },
  { keyword: 'τροποποίηση', topics: ['contracts'] },
  // Τεχνική/Οικονομική
  { keyword: 'τεχνική προσφορά', topics: ['documents', 'mistakes', 'lead_times'] },
  { keyword: 'οικονομική προσφορά', topics: ['documents', 'mistakes', 'lead_times'] },
  { keyword: 'τιμ', topics: ['evaluation', 'mistakes'] },
  // Χρόνοι
  { keyword: 'πόσες μέρες', topics: ['lead_times', 'deadlines'] },
  { keyword: 'πόσο χρόνο', topics: ['lead_times'] },
  { keyword: 'πόσο καιρό', topics: ['lead_times'] },
  { keyword: 'εργάσιμ', topics: ['lead_times'] },
  // Κοινοπραξία
  { keyword: 'κοινοπραξ', topics: ['documents', 'mistakes'] },
  { keyword: 'ένωση', topics: ['documents', 'mistakes'] },
  // Κατώτατα
  { keyword: 'κατώτατ', topics: ['eligibility'] },
  { keyword: 'όρι', topics: ['eligibility'] },
  { keyword: 'threshold', topics: ['eligibility'] },
  { keyword: '60.000', topics: ['eligibility'] },
  { keyword: '30.000', topics: ['eligibility'] },
  { keyword: 'ΚΗΜΔΗΣ', topics: ['esidis', 'documents'] },
  { keyword: 'κημδησ', topics: ['esidis', 'documents'] },
];

/**
 * Detect which topics are relevant to the question
 */
function detectTopics(question: string): Map<KnowledgeTopic, number> {
  const topicScores = new Map<KnowledgeTopic, number>();
  const lowerQ = question.toLowerCase();

  for (const { keyword, topics } of KEYWORD_MAP) {
    if (lowerQ.includes(keyword.toLowerCase())) {
      for (const topic of topics) {
        topicScores.set(topic, (topicScores.get(topic) || 0) + 1);
      }
    }
  }

  return topicScores;
}

/**
 * Format law articles for output
 */
function formatArticles(articles: LawArticle[], maxItems = 3): string {
  return articles
    .slice(0, maxItems)
    .map(
      (a) =>
        `[Άρθρο ${a.articleNumber}] ${a.title}: ${a.summary}`
    )
    .join('\n\n');
}

/**
 * Format lead times for output
 */
function formatLeadTimes(items: LeadTime[], maxItems = 4): string {
  return items
    .slice(0, maxItems)
    .map(
      (lt) =>
        `- ${lt.document}: ${lt.minDays}-${lt.maxDays} εργάσιμες (${lt.source})\n  Tip: ${lt.tips[0]}`
    )
    .join('\n');
}

/**
 * Format common mistakes for output
 */
function formatMistakes(items: CommonMistake[], maxItems = 4): string {
  return items
    .slice(0, maxItems)
    .map(
      (m) =>
        `⚠ [${m.severity.toUpperCase()}] ${m.title}: ${m.description}\n  Πρόληψη: ${m.prevention}`
    )
    .join('\n\n');
}

/**
 * Get relevant articles based on topics
 */
function getRelevantArticles(
  topics: Map<KnowledgeTopic, number>,
  question: string
): LawArticle[] {
  const lowerQ = question.toLowerCase();

  // Score each article
  const scored = LAW_4412_ARTICLES.map((article) => {
    let score = 0;

    // Topic match
    const topicCategories: Record<string, KnowledgeTopic[]> = {
      eligibility: ['eligibility'],
      guarantees: ['guarantees'],
      deadlines: ['deadlines'],
      evaluation: ['evaluation'],
      documents: ['documents'],
      exclusion: ['exclusion'],
      appeals: ['appeals'],
      contracts: ['contracts'],
    };

    for (const [cat, topicList] of Object.entries(topicCategories)) {
      if (article.category === cat) {
        for (const t of topicList) {
          score += (topics.get(t) || 0) * 3;
        }
      }
    }

    // Keyword match in question
    for (const kw of article.keywords) {
      if (lowerQ.includes(kw.toLowerCase())) {
        score += 5;
      }
    }

    return { article, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.article);
}

/**
 * Get relevant lead times based on question
 */
function getRelevantLeadTimes(question: string): LeadTime[] {
  const lowerQ = question.toLowerCase();

  const scored = LEAD_TIMES.map((lt) => {
    let score = 0;
    const words = lt.document.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length > 3 && lowerQ.includes(word)) {
        score += 3;
      }
    }
    return { lt, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.lt);
}

/**
 * Get relevant mistakes based on topics and question
 */
function getRelevantMistakes(
  topics: Map<KnowledgeTopic, number>,
  question: string
): CommonMistake[] {
  const lowerQ = question.toLowerCase();

  const topicToCategoryMap: Record<string, MistakeCategoryFilter[]> = {
    guarantees: ['guarantees'],
    documents: ['documents'],
    submission: ['submission'],
    esidis: ['submission'],
    technical: ['technical'],
    financial: ['financial'],
    legal: ['legal'],
    mistakes: [], // match all
  };

  type MistakeCategoryFilter =
    | 'guarantees'
    | 'documents'
    | 'submission'
    | 'technical'
    | 'financial'
    | 'legal'
    | 'procedural';

  const relevantCategories = new Set<string>();
  topics.forEach((_score, topic) => {
    const cats = topicToCategoryMap[topic];
    if (cats) {
      for (const c of cats) relevantCategories.add(c);
    }
  });

  // If "mistakes" topic is detected, show top critical ones
  const showAll = topics.has('mistakes') && relevantCategories.size === 0;

  const scored = COMMON_MISTAKES.map((m) => {
    let score = 0;

    if (showAll) {
      score = m.severity === 'critical' ? 3 : m.severity === 'high' ? 2 : 1;
    } else if (relevantCategories.has(m.category)) {
      score += 3;
    }

    // Keyword match
    const titleWords = m.title.toLowerCase().split(/\s+/);
    for (const word of titleWords) {
      if (word.length > 3 && lowerQ.includes(word)) {
        score += 2;
      }
    }

    // Severity bonus
    if (score > 0 && m.severity === 'critical') score += 2;

    return { m, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.m);
}

/**
 * Get checklist info based on tender type
 */
function getChecklistInfo(tenderType?: string): string | null {
  if (!tenderType) return null;

  const typeMap: Record<string, string> = {
    open_above: 'open_above_threshold',
    open_below: 'open_below_threshold',
    open_above_threshold: 'open_above_threshold',
    open_below_threshold: 'open_below_threshold',
    direct: 'direct_award',
    direct_award: 'direct_award',
    restricted: 'restricted',
    framework: 'framework',
  };

  const key = typeMap[tenderType];
  if (!key || !TENDER_CHECKLISTS[key]) return null;

  const cl = TENDER_CHECKLISTS[key];
  const mandatoryDocs = cl.requiredDocuments
    .filter((d) => d.mandatory)
    .map((d) => `  - ${d.name} (${d.leadTimeDays} ημέρες, ${d.legalBasis})`)
    .join('\n');

  const tips = cl.tips.slice(0, 3).map((t) => `  - ${t}`).join('\n');

  return `📋 ${cl.label}\n${cl.description}\n\nΥποχρεωτικά έγγραφα:\n${mandatoryDocs}\n\nΣυμβουλές:\n${tips}`;
}

/**
 * Get ESIDIS tips based on question
 */
function getEsidisInfo(question: string): string | null {
  const lowerQ = question.toLowerCase();

  const parts: string[] = [];

  // Check for specific step questions
  if (
    lowerQ.includes('βήμα') ||
    lowerQ.includes('πώς') ||
    lowerQ.includes('πως') ||
    lowerQ.includes('διαδικασία υποβολής')
  ) {
    const relevantSteps = ESIDIS_GUIDE.steps
      .slice(0, 4)
      .map((s) => `${s.order}. ${s.title}: ${s.description}`)
      .join('\n');
    parts.push(`Βήματα υποβολής ΕΣΗΔΗΣ:\n${relevantSteps}`);
  }

  // Format/file questions
  if (
    lowerQ.includes('format') ||
    lowerQ.includes('αρχεί') ||
    lowerQ.includes('pdf') ||
    lowerQ.includes('μέγεθος') ||
    lowerQ.includes('τύπος αρχείου')
  ) {
    const formats = ESIDIS_GUIDE.formats
      .filter((f) => f.accepted)
      .map((f) => `  ${f.extension}: max ${f.maxSizeMB}MB - ${f.notes}`)
      .join('\n');
    parts.push(`Αποδεκτές μορφές αρχείων ΕΣΗΔΗΣ:\n${formats}`);
  }

  // General gotchas
  if (parts.length === 0) {
    const gotchas = ESIDIS_GUIDE.gotchas
      .slice(0, 4)
      .map((g) => `  - ${g}`)
      .join('\n');
    parts.push(`Προσοχή στο ΕΣΗΔΗΣ:\n${gotchas}`);
  }

  return parts.length > 0 ? parts.join('\n\n') : null;
}

/**
 * MAIN FUNCTION: Get relevant knowledge for a question
 *
 * @param intent - The detected intent of the question (e.g., 'ask_law', 'checklist', 'deadline')
 * @param question - The user's question in Greek
 * @param tenderType - Optional tender type for targeted answers
 * @returns Formatted knowledge string (max ~2000 chars)
 */
export function getRelevantKnowledge(
  intent: string,
  question: string,
  tenderType?: string
): string {
  const topics = detectTopics(question);
  const sections: string[] = [];
  let totalLength = 0;
  const MAX_LENGTH = 2000;

  const addSection = (title: string, content: string) => {
    if (totalLength + content.length > MAX_LENGTH) return false;
    sections.push(`--- ${title} ---\n${content}`);
    totalLength += content.length + title.length + 10;
    return true;
  };

  // 1. Law articles (always try)
  const articles = getRelevantArticles(topics, question);
  if (articles.length > 0) {
    addSection('Νομοθεσία (Ν.4412/2016)', formatArticles(articles, 2));
  }

  // 2. Checklist (if tender type available or asked)
  if (
    tenderType ||
    topics.has('checklist') ||
    intent === 'checklist'
  ) {
    const checklistInfo = getChecklistInfo(tenderType || guessTypeFromQuestion(question));
    if (checklistInfo) {
      addSection('Checklist', checklistInfo);
    }
  }

  // 3. Lead times (if relevant)
  if (topics.has('lead_times') || topics.has('deadlines') || intent === 'deadline') {
    const leadTimes = getRelevantLeadTimes(question);
    if (leadTimes.length > 0) {
      addSection('Χρόνοι Προετοιμασίας', formatLeadTimes(leadTimes, 3));
    }
  }

  // 4. Common mistakes (if relevant)
  if (topics.has('mistakes') || topics.has('guarantees') || topics.has('documents')) {
    const mistakes = getRelevantMistakes(topics, question);
    if (mistakes.length > 0) {
      addSection('Συνήθη Λάθη', formatMistakes(mistakes, 3));
    }
  }

  // 5. ESIDIS info (if relevant)
  if (topics.has('esidis')) {
    const esidisInfo = getEsidisInfo(question);
    if (esidisInfo) {
      addSection('ΕΣΗΔΗΣ', esidisInfo);
    }
  }

  // If nothing matched, provide general guidance
  if (sections.length === 0) {
    // Try broader matching - return top articles by category
    const generalArticles = LAW_4412_ARTICLES.slice(0, 2);
    addSection('Γενική Πληροφόρηση (Ν.4412/2016)', formatArticles(generalArticles, 2));

    const topMistakes = COMMON_MISTAKES.filter((m) => m.severity === 'critical').slice(0, 2);
    if (topMistakes.length > 0) {
      addSection('Κρίσιμα Σημεία', formatMistakes(topMistakes, 2));
    }
  }

  return sections.join('\n\n');
}

/**
 * Guess tender type from question keywords
 */
function guessTypeFromQuestion(question: string): string | undefined {
  const lower = question.toLowerCase();

  if (lower.includes('απευθείας') || lower.includes('30.000') || lower.includes('30000'))
    return 'direct';
  if (lower.includes('συνοπτικ') || lower.includes('60.000') || lower.includes('60000'))
    return 'open_below';
  if (lower.includes('κλειστ') || lower.includes('προεπιλογ'))
    return 'restricted';
  if (lower.includes('πλαίσιο') || lower.includes('framework'))
    return 'framework';
  if (lower.includes('ανοικτ') || lower.includes('διεθν'))
    return 'open_above';

  return undefined;
}
