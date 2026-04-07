import type { CountryPromptContext } from './types';

export const grPromptContext: CountryPromptContext = {
  code: 'GR',

  lawReference: 'Ν.4412/2016',
  lawDescription: 'Ν.4412/2016 — Δημόσιες Συμβάσεις Έργων, Προμηθειών και Υπηρεσιών',
  euDirectives: ['2014/24/EU', '2014/25/EU'],

  platforms: ['ΕΣΗΔΗΣ', 'ΚΗΜΔΗΣ'],
  eProcurementPlatform: 'ΕΣΗΔΗΣ',

  expertiseDescription: '15 χρόνια εμπειρία σε ελληνικούς δημόσιους διαγωνισμούς (Ν.4412/2016, ΕΣΗΔΗΣ)',

  docTypeKeywords: {
    TAX_CLEARANCE: ['φορολογικ', 'ενημερότητα φορολογικ', 'tax clearance'],
    SOCIAL_SECURITY_CLEARANCE: ['ασφαλιστικ', 'ενημερότητα ασφαλιστικ', 'social security'],
    GEMI_CERTIFICATE: ['γεμη', 'γ.ε.μη', 'εμπορικό μητρώο', 'gemi'],
    CRIMINAL_RECORD: ['ποινικ', 'μητρώο ποινικ', 'criminal record'],
    JUDICIAL_CERTIFICATE: ['δικαστικ', 'πτώχευ', 'εκκαθάρισ'],
  },

  legalFieldKeywords: {
    'Εγγυητική συμμετοχής': ['εγγυητικ', 'εγγυηση', 'guarantee', 'bank guarantee', 'τραπεζ', 'εγγυοδοσ'],
    'Δικαιολογητικά συμμετοχής': [
      'δικαιολογητικ', 'επισυναπτ', 'προσκομι', 'υπευθυνη δηλωση', 'πιστοποιητικ',
      'βεβαιωση', 'προσφορα πρεπει', 'συνημμεν', 'υποβαλλ', 'κατατεθ',
      'οικοδομικ', 'αδεια', 'συμμετοχ', 'δηλωση', 'εγγραφ',
      'φακελ', 'απαιτουμεν', 'προαπαιτουμ',
    ],
    'Κριτήρια αποκλεισμού': ['αποκλεισμ', 'αποκλει', 'exclusion', 'ακαταλληλ', 'απορριψ', 'δεν γινονται δεκτ', 'λογοι αποκλεισμ'],
    'Κριτήρια ανάθεσης': ['κριτηρι', 'αναθεσ', 'award', 'μειοδοτ', 'χαμηλοτερη τιμη', 'βαθμολογ', 'αξιολογ', 'πλεον συμφερ', 'οικονομικ προσφορ'],
  },

  paymentTermReference: 'Οδηγία 2011/7/ΕΕ',

  proposalSections: [
    {
      id: 'understanding',
      title: 'Κατανόηση Αντικειμένου',
      titleEn: 'Understanding of Requirements',
      ordering: 1,
      promptContext: `Understanding of Requirements (Κατανόηση Αντικειμένου):
Αναλυτική περιγραφή κατανόησης του αντικειμένου του διαγωνισμού.
Περιλαμβάνει: αναγνώριση βασικών στόχων, πεδίο εφαρμογής, ωφελούμενοι,
κρίσιμα σημεία, σύνδεση με ευρύτερο πλαίσιο (θεσμικό, τεχνολογικό).`,
    },
    {
      id: 'methodology',
      title: 'Μεθοδολογία Υλοποίησης',
      titleEn: 'Implementation Methodology',
      ordering: 2,
      promptContext: `Implementation Methodology (Μεθοδολογία Υλοποίησης):
Αναλυτική μεθοδολογία υλοποίησης βήμα-βήμα. Περιλαμβάνει:
φάσεις έργου, πακέτα εργασίας, παραδοτέα ανά φάση, milestones,
εργαλεία και τεχνικές, πρότυπα που ακολουθούνται (ISO, PRINCE2, Agile).`,
    },
    {
      id: 'team',
      title: 'Ομάδα Έργου',
      titleEn: 'Project Team',
      ordering: 3,
      promptContext: `Project Team (Ομάδα Έργου):
Παρουσίαση ομάδας έργου: ρόλοι, αρμοδιότητες, προσόντα,
εμπειρία σε σχετικά έργα. Οργανόγραμμα, αναφορές,
μηχανισμός αντικατάστασης, εκπαίδευση ομάδας.`,
    },
    {
      id: 'timeline',
      title: 'Χρονοδιάγραμμα',
      titleEn: 'Timeline',
      ordering: 4,
      promptContext: `Timeline / Gantt (Χρονοδιάγραμμα):
Αναλυτικό χρονοδιάγραμμα υλοποίησης. Φάσεις, πακέτα εργασίας,
διάρκεια, εξαρτήσεις, milestones, κρίσιμη διαδρομή (critical path).`,
    },
    {
      id: 'risk',
      title: 'Διαχείριση Κινδύνων',
      titleEn: 'Risk Management',
      ordering: 5,
      promptContext: `Risk Management (Διαχείριση Κινδύνων):
Πλαίσιο διαχείρισης κινδύνων: μεθοδολογία αναγνώρισης,
μητρώο κινδύνων, πιθανότητα x επίπτωση, μέτρα αντιμετώπισης,
contingency plans, escalation matrix.`,
    },
    {
      id: 'quality',
      title: 'Διασφάλιση Ποιότητας',
      titleEn: 'Quality Assurance',
      ordering: 6,
      promptContext: `Quality Assurance (Διασφάλιση Ποιότητας):
Σχέδιο Διασφάλισης Ποιότητας: πρότυπα ISO, μετρήσιμοι δείκτες (KPIs),
διαδικασίες ελέγχου, testing methodology, acceptance criteria.`,
    },
    {
      id: 'support',
      title: 'Υποστήριξη & Εγγύηση',
      titleEn: 'Support & Warranty',
      ordering: 7,
      promptContext: `Support & Warranty (Υποστήριξη & Εγγύηση):
Πλαίσιο υποστήριξης: SLA, χρόνοι απόκρισης, help desk,
εγγύηση καλής λειτουργίας, συντήρηση, εκπαίδευση χρηστών.`,
    },
  ],
};
