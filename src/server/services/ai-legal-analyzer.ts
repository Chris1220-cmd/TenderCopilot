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
import { ai } from '@/server/ai';
import type { LegalClauseCategory, RiskLevel } from '@prisma/client';

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

// ─── Mock Data Generators ───────────────────────────────────

/**
 * Produces realistic mock extracted clauses when AI_PROVIDER=mock.
 */
function mockExtractedClauses(): ExtractedClause[] {
  return [
    {
      clauseText: 'Ο ανάδοχος ευθύνεται αλληλεγγύως και εις ολόκληρον για κάθε ζημία ' +
        'που προκαλείται στην αναθέτουσα αρχή ή σε τρίτους από πράξεις ή παραλείψεις ' +
        'αυτού ή των υπεργολάβων του, χωρίς περιορισμό ποσού.',
      category: 'LIABILITY',
      articleRef: 'Άρθρο 218 Ν.4412/2016',
      pageNumber: 34,
    },
    {
      clauseText: 'Σε περίπτωση καθυστέρησης εκτέλεσης του έργου πέραν των συμβατικών ' +
        'χρονοδιαγραμμάτων, επιβάλλεται ρήτρα 1% επί του συνολικού συμβατικού τιμήματος ' +
        'ανά εβδομάδα καθυστέρησης, μέχρι μέγιστο 20% του τιμήματος.',
      category: 'PENALTIES',
      articleRef: 'Άρθρο 15 παρ. 3 Σύμβασης',
      pageNumber: 18,
    },
    {
      clauseText: 'Η αναθέτουσα αρχή δικαιούται να καταγγείλει μονομερώς τη σύμβαση ' +
        'χωρίς αποζημίωση του αναδόχου, εφόσον κρίνει ότι ο ανάδοχος δεν εκπληρώνει ' +
        'τις υποχρεώσεις του. Η κρίση ανήκει αποκλειστικά στην αναθέτουσα αρχή.',
      category: 'TERMINATION',
      articleRef: 'Άρθρο 22 παρ. 1 Σύμβασης',
      pageNumber: 22,
    },
    {
      clauseText: 'Η πληρωμή του αναδόχου θα γίνεται εντός 60 ημερών από την παραλαβή ' +
        'του τιμολογίου, υπό την προϋπόθεση προηγούμενης πιστοποίησης του φυσικού αντικειμένου ' +
        'από τριμελή επιτροπή.',
      category: 'PAYMENT_TERMS',
      articleRef: 'Άρθρο 200 Ν.4412/2016',
      pageNumber: 25,
    },
    {
      clauseText: 'Όλα τα πνευματικά δικαιώματα επί των παραδοτέων (λογισμικό, ' +
        'τεχνική τεκμηρίωση, σχέδια) μεταβιβάζονται πλήρως και αμετάκλητα στην ' +
        'αναθέτουσα αρχή από τη στιγμή παράδοσης, χωρίς πρόσθετο αντάλλαγμα.',
      category: 'IP_RIGHTS',
      articleRef: 'Άρθρο 17 παρ. 2 Σύμβασης',
      pageNumber: 20,
    },
    {
      clauseText: 'Ο ανάδοχος υποχρεούται σε ασφαλιστική κάλυψη αστικής ευθύνης ' +
        'ποσού ίσου τουλάχιστον με το διπλάσιο του συμβατικού τιμήματος, ' +
        'καθ\' όλη τη διάρκεια της σύμβασης και για 2 έτη μετά τη λήξη της.',
      category: 'INSURANCE',
      articleRef: 'Άρθρο 19 Σύμβασης',
      pageNumber: 21,
    },
    {
      clauseText: 'Ο ανάδοχος υποχρεούται να παρέχει εγγύηση καλής εκτέλεσης ίση ' +
        'με 4% του συνολικού συμβατικού τιμήματος (συμπεριλαμβανομένου ΦΠΑ) ' +
        'σύμφωνα με το Άρθρο 72 Ν.4412/2016.',
      category: 'GUARANTEES',
      articleRef: 'Άρθρο 72 Ν.4412/2016',
      pageNumber: 15,
    },
    {
      clauseText: 'Η υπεργολαβία επιτρέπεται μέχρι ποσοστό 30% του συμβατικού ' +
        'τιμήματος, κατόπιν έγγραφης έγκρισης της αναθέτουσας αρχής. ' +
        'Ο ανάδοχος παραμένει αποκλειστικά υπεύθυνος έναντι της αναθέτουσας αρχής.',
      category: 'SUBCONTRACTING',
      articleRef: 'Άρθρο 131 Ν.4412/2016',
      pageNumber: 28,
    },
    {
      clauseText: 'Ο ανάδοχος υποχρεούται να τηρεί τον Γενικό Κανονισμό Προστασίας ' +
        'Δεδομένων (GDPR) και να λαμβάνει όλα τα αναγκαία τεχνικά και οργανωτικά μέτρα ' +
        'για την προστασία των δεδομένων. Παραβίαση συνεπάγεται αυτοδίκαιη καταγγελία.',
      category: 'DATA_PROTECTION',
      articleRef: 'Άρθρο 21 Σύμβασης',
      pageNumber: 23,
    },
    {
      clauseText: 'Δεν αναγνωρίζονται ως λόγοι ανωτέρας βίας οι απεργίες ' +
        'του προσωπικού του αναδόχου, οι βλάβες εξοπλισμού, ή η αδυναμία ' +
        'εξεύρεσης υλικών ή υπεργολάβων.',
      category: 'FORCE_MAJEURE',
      articleRef: 'Άρθρο 24 Σύμβασης',
      pageNumber: 26,
    },
    {
      clauseText: 'Κάθε διαφορά που αναφύεται από τη σύμβαση υπάγεται στα ' +
        'δικαστήρια της Αθήνας. Εξαιρούνται διαφορές από πρόστιμα, οι οποίες ' +
        'κρίνονται αμετάκλητα από μονομελή επιτροπή.',
      category: 'DISPUTE_RESOLUTION',
      articleRef: 'Άρθρο 30 Σύμβασης',
      pageNumber: 32,
    },
    {
      clauseText: 'Ο ανάδοχος δεσμεύεται να διατηρεί αυστηρή εμπιστευτικότητα ' +
        'ως προς κάθε πληροφορία που περιέρχεται σε γνώση του κατά την εκτέλεση ' +
        'της σύμβασης, τόσο κατά τη διάρκεια όσο και μετά τη λήξη αυτής.',
      category: 'CONFIDENTIALITY',
      articleRef: 'Άρθρο 20 Σύμβασης',
      pageNumber: 22,
    },
  ];
}

/**
 * Produces mock risk assessments for clauses when AI_PROVIDER=mock.
 */
function mockRiskAssessments(clauses: Array<{ id: string; category: LegalClauseCategory; clauseText: string }>): ClauseRiskAssessment[] {
  const riskMap: Record<string, { riskLevel: RiskLevel; riskReason: string; recommendation: string }> = {
    LIABILITY: {
      riskLevel: 'CRITICAL',
      riskReason: 'Απεριόριστη ευθύνη χωρίς ανώτατο πλαφόν. Ο όρος "χωρίς περιορισμό ποσού" εκθέτει ' +
        'την εταιρεία σε δυσανάλογο κίνδυνο σε σχέση με το συμβατικό τίμημα.',
      recommendation: 'Ζητήστε περιορισμό ευθύνης στο 100% ή 200% του συμβατικού τιμήματος. ' +
        'Εναλλακτικά, εξασφαλίστε ασφαλιστική κάλυψη αντίστοιχου ύψους.',
    },
    PENALTIES: {
      riskLevel: 'HIGH',
      riskReason: 'Ρήτρα 1%/εβδομάδα είναι υπέρμετρα υψηλή. Τυπική ρήτρα σε δημόσιους ' +
        'διαγωνισμούς είναι 0.5%/εβδομάδα. Μέγιστο 20% σημαίνει ότι 20 εβδομάδες ' +
        'καθυστέρηση εξαντλούν το πλαφόν.',
      recommendation: 'Υποβάλετε ερώτημα διευκρίνισης για μείωση σε 0.5%/εβδομάδα (σύμφωνα ' +
        'με τη συνήθη πρακτική Ν.4412/2016). Εναλλακτικά, ενσωματώστε grace period 2 εβδομάδων.',
    },
    TERMINATION: {
      riskLevel: 'CRITICAL',
      riskReason: 'Μονομερής καταγγελία χωρίς αποζημίωση και με υποκειμενικά κριτήρια ' +
        '("κρίνει") αντιβαίνει στις αρχές αναλογικότητας του Ν.4412/2016. ' +
        'Ο ανάδοχος δεν έχει δικαίωμα ακρόασης ούτε αντίρρησης.',
      recommendation: 'Ζητήστε: 1) Αντικειμενικά κριτήρια καταγγελίας, 2) Δικαίωμα ακρόασης ' +
        '10 ημερών πριν τη καταγγελία, 3) Αποζημίωση για εκτελεσθέν φυσικό αντικείμενο. ' +
        'Σύμφωνα με Άρθρο 133 Ν.4412/2016.',
    },
    PAYMENT_TERMS: {
      riskLevel: 'HIGH',
      riskReason: 'Πληρωμή σε 60 ημέρες αντί 30, πλέον εξαρτάται από πιστοποίηση τριμελούς ' +
        'επιτροπής που μπορεί να καθυστερήσει επιπλέον. Πρακτικά η πληρωμή μπορεί ' +
        'να φτάσει 90-120 ημέρες.',
      recommendation: 'Ζητήστε τροποποίηση σε 30 ημέρες (σύμφωνα με Οδηγία 2011/7/ΕΕ για ' +
        'καθυστερήσεις πληρωμών). Εξασφαλίστε ότι η πιστοποίηση γίνεται εντός 15 ημερών ' +
        'από την αίτηση πληρωμής.',
    },
    IP_RIGHTS: {
      riskLevel: 'HIGH',
      riskReason: 'Πλήρης και αμετάκλητη μεταβίβαση IP χωρίς πρόσθετο αντάλλαγμα. ' +
        'Αυτό περιλαμβάνει πιθανώς pre-existing IP και εργαλεία που χρησιμοποιεί η εταιρεία. ' +
        'Κίνδυνος απώλειας πολύτιμου λογισμικού/τεχνογνωσίας.',
      recommendation: 'Ζητήστε διαχωρισμό: 1) Τα νέα παραδοτέα μεταβιβάζονται, 2) Τα pre-existing ' +
        'εργαλεία/βιβλιοθήκες παραμένουν στον ανάδοχο με άδεια χρήσης. ' +
        'Εξαιρέστε ρητά τα εργαλεία τρίτων (open source, licensed software).',
    },
    INSURANCE: {
      riskLevel: 'MEDIUM',
      riskReason: 'Ασφάλιση διπλάσια του τιμήματος + 2 χρόνια μετά τη λήξη είναι ' +
        'σημαντικό κόστος αλλά εντός λογικών ορίων. Χρειάζεται κοστολόγηση.',
      recommendation: 'Κοστολογήστε το ασφάλιστρο (εκτίμηση: 1-2% του ασφαλιζόμενου ποσού/έτος). ' +
        'Ενσωματώστε στην οικονομική προσφορά. Ζητήστε αποδεκτή η κάλυψη ίση με 100% αντί 200%.',
    },
    GUARANTEES: {
      riskLevel: 'LOW',
      riskReason: 'Τυπική εγγύηση καλής εκτέλεσης 4% σύμφωνα με Άρθρο 72 Ν.4412/2016. ' +
        'Ωστόσο, η βάση υπολογισμού περιλαμβάνει ΦΠΑ, κάτι που δεν είναι πάντα η πρακτική.',
      recommendation: 'Κανονικό. Επιβεβαιώστε ότι η βάση περιλαμβάνει ΦΠΑ (αυξάνει κατά ~24% ' +
        'το ποσό εγγυητικής). Ζητήστε από τράπεζα εγκαίρως.',
    },
    SUBCONTRACTING: {
      riskLevel: 'MEDIUM',
      riskReason: 'Όριο 30% υπεργολαβίας μπορεί να είναι περιοριστικό αν η εταιρεία ' +
        'δεν καλύπτει εσωτερικά ειδικότητες (π.χ. εξειδικευμένες εργασίες). ' +
        'Η έγκριση "κατόπιν αιτήματος" μπορεί να καθυστερήσει.',
      recommendation: 'Εάν σκοπεύετε σε υπεργολαβία >30%, υποβάλετε ερώτημα διευκρίνισης. ' +
        'Δηλώστε υπεργολάβους στο ΤΕΥΔ/ΕΕΕΣ. Σύμφωνα με Άρθρο 131 Ν.4412/2016 ' +
        'η αναθέτουσα αρχή δεν μπορεί να απαγορεύσει τελείως την υπεργολαβία.',
    },
    DATA_PROTECTION: {
      riskLevel: 'MEDIUM',
      riskReason: 'Αυτοδίκαιη καταγγελία για παραβίαση GDPR είναι δυσανάλογη ' +
        'αν αφορά ήσσονος σημασίας παράβαση. Δεν ορίζεται grace period ' +
        'ούτε διαδικασία αποκατάστασης.',
      recommendation: 'Ζητήστε: 1) Ορισμό "ουσιώδους παραβίασης" ως βάση καταγγελίας, ' +
        '2) Δυνατότητα αποκατάστασης εντός 30 ημερών, 3) Διαβαθμισμένες κυρώσεις ' +
        'ανάλογα με σοβαρότητα. Βεβαιωθείτε ότι ικανοποιεί GDPR DPA.',
    },
    FORCE_MAJEURE: {
      riskLevel: 'HIGH',
      riskReason: 'Πολύ στενός ορισμός ανωτέρας βίας. Αποκλείει απεργίες, βλάβες ' +
        'εξοπλισμού και αδυναμία εύρεσης υλικών/υπεργολάβων — γεγονότα που ' +
        'είναι ρεαλιστικοί κίνδυνοι στην εκτέλεση μεγάλων έργων.',
      recommendation: 'Υποβάλετε ερώτημα για διεύρυνση ανωτέρας βίας. Ζητήστε ένταξη: ' +
        'γενικές απεργίες, πανδημίες, κυρώσεις, σοβαρές ελλείψεις υλικών αγοράς. ' +
        'Αναφερθείτε στα Άρθρα 132 & 206 Ν.4412/2016.',
    },
    DISPUTE_RESOLUTION: {
      riskLevel: 'MEDIUM',
      riskReason: 'Δικαστήρια Αθήνας: κανονικό. Ωστόσο, η "αμετάκλητη κρίση μονομελούς ' +
        'επιτροπής" για πρόστιμα στερεί το δικαίωμα δικαστικής προστασίας, ' +
        'κάτι που μπορεί να αμφισβητηθεί νομικά.',
      recommendation: 'Ζητήστε δικαίωμα προσφυγής στα τακτικά δικαστήρια και για πρόστιμα. ' +
        'Εναλλακτικά, προτείνετε τριμελή επιτροπή ή διαμεσολάβηση (Ν.4640/2019) ' +
        'πριν τη δικαστική οδό.',
    },
    CONFIDENTIALITY: {
      riskLevel: 'LOW',
      riskReason: 'Τυπικός όρος εμπιστευτικότητας. Δεν ορίζεται χρονικό πλαίσιο μετά ' +
        'τη λήξη ("μετά τη λήξη αυτής" — αόριστα).',
      recommendation: 'Ζητήστε ορισμό χρονικού ορίου εμπιστευτικότητας μετά τη λήξη ' +
        '(π.χ. 3-5 έτη). Αποδεκτός κατά τα λοιπά.',
    },
  };

  return clauses.map((clause) => {
    const mapping = riskMap[clause.category] || {
      riskLevel: 'LOW' as RiskLevel,
      riskReason: 'Τυπικός συμβατικός όρος χωρίς ιδιαίτερο κίνδυνο.',
      recommendation: 'Κανονικός. Δεν απαιτείται ενέργεια.',
    };

    return {
      clauseId: clause.id,
      riskLevel: mapping.riskLevel,
      riskReason: mapping.riskReason,
      recommendation: mapping.recommendation,
    };
  });
}

/**
 * Produces mock clarification questions for high-risk clauses when AI_PROVIDER=mock.
 */
function mockClarifications(
  clauses: Array<{ id: string; category: LegalClauseCategory; riskLevel: RiskLevel; clauseText: string }>
): DraftClarification[] {
  const questionTemplates: Record<string, string> = {
    LIABILITY: 'Παρακαλούμε επιβεβαιώστε αν η ευθύνη του αναδόχου δύναται να περιοριστεί ' +
      'στο ύψος του συμβατικού τιμήματος, σύμφωνα με τη συνήθη πρακτική των δημοσίων συμβάσεων ' +
      'και τις αρχές αναλογικότητας του Ν.4412/2016.',
    PENALTIES: 'Σχετικά με τη ρήτρα καθυστέρησης 1%/εβδομάδα: α) Προβλέπεται grace period πριν ' +
      'την επιβολή ρητρών; β) Είναι δυνατή η μείωση σε 0.5%/εβδομάδα σύμφωνα με τη ' +
      'συνήθη πρακτική; γ) Τι συμβαίνει σε περίπτωση καθυστέρησης λόγω υπαιτιότητας ' +
      'της αναθέτουσας αρχής;',
    TERMINATION: 'Σχετικά με τη μονομερή καταγγελία (Άρθρο 22 παρ. 1): α) Ποια είναι ' +
      'τα αντικειμενικά κριτήρια βάσει των οποίων κρίνεται η μη εκπλήρωση; ' +
      'β) Προβλέπεται δικαίωμα ακρόασης/αντίρρησης του αναδόχου; ' +
      'γ) Καταβάλλεται αμοιβή για το ήδη εκτελεσθέν φυσικό αντικείμενο;',
    PAYMENT_TERMS: 'Σχετικά με τους όρους πληρωμής: α) Είναι δυνατή η πληρωμή εντός 30 ημερών ' +
      'σύμφωνα με την Οδηγία 2011/7/ΕΕ; β) Σε πόσες ημέρες γίνεται η πιστοποίηση ' +
      'από την επιτροπή; γ) Προβλέπονται τόκοι υπερημερίας σε περίπτωση καθυστέρησης;',
    IP_RIGHTS: 'Σχετικά με τη μεταβίβαση πνευματικών δικαιωμάτων: α) Αφορά μόνο τα νέα ' +
      'παραδοτέα ή και pre-existing IP/εργαλεία; β) Ο ανάδοχος διατηρεί δικαίωμα ' +
      'χρήσης για δικούς του σκοπούς; γ) Πώς αντιμετωπίζονται λογισμικά τρίτων ' +
      '(open source, licensed);',
    FORCE_MAJEURE: 'Σχετικά με τον ορισμό ανωτέρας βίας: α) Εντάσσονται πανδημίες, ' +
      'γενικές απεργίες και κυρώσεις τρίτων χωρών; β) Πώς αντιμετωπίζεται η σοβαρή ' +
      'έλλειψη υλικών στην αγορά (supply chain disruption); γ) Ποια είναι η διαδικασία ' +
      'επίκλησης ανωτέρας βίας;',
  };

  return clauses
    .filter(c => c.riskLevel === 'HIGH' || c.riskLevel === 'CRITICAL')
    .map((clause, index) => ({
      clauseId: clause.id,
      questionText: questionTemplates[clause.category] ||
        `Σχετικά με τον όρο "${clause.clauseText.substring(0, 80)}...": ` +
        'Παρακαλούμε διευκρινίστε τους ακριβείς όρους εφαρμογής και αν είναι δυνατή ' +
        'τροποποίηση σύμφωνα με τις αρχές αναλογικότητας του Ν.4412/2016.',
      priority: clause.riskLevel === 'CRITICAL' ? 5 : 4,
    }));
}

// ─── System Prompts ─────────────────────────────────────────

const EXTRACT_CLAUSES_SYSTEM_PROMPT = `Είσαι εξειδικευμένος νομικός σύμβουλος δημοσίων συμβάσεων με ειδίκευση στον Ν.4412/2016.
Αναλύεις τα έγγραφα του διαγωνισμού (σύμβαση, γενικοί/ειδικοί όροι, διακήρυξη) και
εντοπίζεις νομικές ρήτρες/όρους.

Για κάθε ρήτρα εντόπισε:
- clauseText: Ακριβές κείμενο ρήτρας (στα ελληνικά)
- category: Μία από τις κατηγορίες:
  LIABILITY, TERMINATION, IP_RIGHTS, CONFIDENTIALITY, PENALTIES, INSURANCE,
  DATA_PROTECTION, GUARANTEES, SUBCONTRACTING, FORCE_MAJEURE, PAYMENT_TERMS,
  DISPUTE_RESOLUTION, OTHER
- articleRef: Αναφορά άρθρου (π.χ. "Άρθρο 218 Ν.4412/2016", "Άρθρο 15 Σύμβασης")
- pageNumber: Σελίδα εγγράφου (αν αναγνωρίζεται), αλλιώς null

Εστίασε ιδιαίτερα σε:
- Ευθύνη (liability) - περιορισμοί ή απουσία ανώτατου ορίου
- Ρήτρες καθυστέρησης/ποινικές ρήτρες
- Όρους καταγγελίας σύμβασης
- Πνευματική ιδιοκτησία παραδοτέων
- Εγγυήσεις (συμμετοχής, καλής εκτέλεσης, λειτουργίας)
- Ασφαλιστική κάλυψη
- Υπεργολαβία - ποσοστό/όρια
- Προστασία δεδομένων (GDPR)
- Ανωτέρα βία - ορισμός και εξαιρέσεις
- Πληρωμές - χρονοδιάγραμμα, τρόπος
- Επίλυση διαφορών
- Εμπιστευτικότητα

Απάντησε ΜΟΝΟ σε JSON:
{
  "clauses": [
    {
      "clauseText": "...",
      "category": "...",
      "articleRef": "..." | null,
      "pageNumber": number | null
    }
  ]
}`;

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
  async extractClauses(tenderId: string) {
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

    // Add document names for context
    if (tender.attachedDocuments.length > 0) {
      contextParts.push('\n--- Συνημμένα Έγγραφα ---');
      for (const doc of tender.attachedDocuments) {
        contextParts.push(`- ${doc.fileName} (${doc.category || 'N/A'})`);
      }
    }

    const contextText = contextParts.join('\n');

    // Call AI
    const aiResult = await ai().complete({
      messages: [
        { role: 'system', content: EXTRACT_CLAUSES_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Εντόπισε τις νομικές ρήτρες/όρους από τα ακόλουθα έγγραφα διαγωνισμού:\n\n${contextText}`,
        },
      ],
      maxTokens: 4000,
      temperature: 0.2,
      responseFormat: 'json',
    });

    let extractedClauses: ExtractedClause[];
    try {
      const parsed = JSON.parse(aiResult.content);
      extractedClauses = parsed.clauses || parsed;
    } catch {
      // Fallback to mock
      extractedClauses = mockExtractedClauses();
    }

    // Validate and sanitize
    if (!Array.isArray(extractedClauses) || extractedClauses.length === 0) {
      extractedClauses = mockExtractedClauses();
    }

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
   * Uses AI (or mock) to evaluate clauses against Greek procurement law (N.4412/2016).
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
      maxTokens: 4000,
      temperature: 0.2,
      responseFormat: 'json',
    });

    let assessments: ClauseRiskAssessment[];
    try {
      const parsed = JSON.parse(aiResult.content);
      assessments = parsed.assessments || parsed;
    } catch {
      // Fallback to mock
      assessments = mockRiskAssessments(clauses);
    }

    // Validate and create a lookup map
    if (!Array.isArray(assessments) || assessments.length === 0) {
      assessments = mockRiskAssessments(clauses);
    }

    const assessmentMap = new Map<string, ClauseRiskAssessment>();
    for (const assessment of assessments) {
      if (assessment.clauseId) {
        assessmentMap.set(assessment.clauseId, assessment);
      }
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

        const updated = await db.legalClause.update({
          where: { id: clause.id },
          data: {
            riskLevel,
            riskReason: assessment.riskReason || null,
            recommendation: assessment.recommendation || null,
          },
        });

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
      maxTokens: 3000,
      temperature: 0.4,
      responseFormat: 'json',
    });

    let draftQuestions: DraftClarification[];
    try {
      const parsed = JSON.parse(aiResult.content);
      draftQuestions = parsed.questions || parsed;
    } catch {
      // Fallback to mock
      draftQuestions = mockClarifications(clauses);
    }

    // Validate
    if (!Array.isArray(draftQuestions) || draftQuestions.length === 0) {
      draftQuestions = mockClarifications(clauses);
    }

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
      // Verify clauseId exists
      const clauseExists = clauses.find(c => c.id === q.clauseId);

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

    return {
      totalClauses: clauses.length,
      byRiskLevel,
      topRisks,
      overallRiskScore,
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
