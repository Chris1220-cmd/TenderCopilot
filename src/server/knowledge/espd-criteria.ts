/**
 * EU ESPD Criterion Taxonomy — Greek procurement mapping
 * Based on EU Regulation 2016/7 and N.4412/2016 Articles 73-74
 */

export const EXCLUSION_CRITERIA = [
  {
    category: 'A',
    id: 'criterion:exclusion:crime',
    titleEl: 'Ποινικά αδικήματα (Άρθρο 73 §1 Ν.4412/2016)',
    titleEn: 'Criminal convictions (Art. 73 §1)',
    subcriteria: [
      'Συμμετοχή σε εγκληματική οργάνωση',
      'Δωροδοκία / Διαφθορά',
      'Απάτη',
      'Τρομοκρατικά εγκλήματα',
      'Νομιμοποίηση εσόδων / Χρηματοδότηση τρομοκρατίας',
      'Παιδική εργασία / Εμπορία ανθρώπων',
    ],
    linkedDocType: 'CRIMINAL_RECORD',
  },
  {
    category: 'B',
    id: 'criterion:exclusion:taxes',
    titleEl: 'Καταβολή φόρων (Άρθρο 73 §2)',
    titleEn: 'Payment of taxes (Art. 73 §2)',
    subcriteria: [],
    linkedDocType: 'TAX_CLEARANCE',
  },
  {
    category: 'C',
    id: 'criterion:exclusion:social-security',
    titleEl: 'Καταβολή ασφαλιστικών εισφορών (Άρθρο 73 §2)',
    titleEn: 'Payment of social security (Art. 73 §2)',
    subcriteria: [],
    linkedDocType: 'SOCIAL_SECURITY_CLEARANCE',
  },
  {
    category: 'D',
    id: 'criterion:exclusion:environmental',
    titleEl: 'Περιβαλλοντικές, κοινωνικές, εργατικές υποχρεώσεις (Άρθρο 73 §4)',
    titleEn: 'Environmental, social, labour law (Art. 73 §4)',
    subcriteria: [],
    linkedDocType: null,
  },
  {
    category: 'E',
    id: 'criterion:exclusion:insolvency',
    titleEl: 'Πτώχευση / Αφερεγγυότητα / Εκκαθάριση (Άρθρο 73 §4)',
    titleEn: 'Insolvency / Bankruptcy (Art. 73 §4)',
    subcriteria: [],
    linkedDocType: 'GEMI_CERTIFICATE',
  },
  {
    category: 'F',
    id: 'criterion:exclusion:misconduct',
    titleEl: 'Σοβαρό επαγγελματικό παράπτωμα (Άρθρο 73 §4)',
    titleEn: 'Professional misconduct (Art. 73 §4)',
    subcriteria: [],
    linkedDocType: null,
  },
  {
    category: 'G',
    id: 'criterion:exclusion:conflict',
    titleEl: 'Σύγκρουση συμφερόντων (Άρθρο 73 §4)',
    titleEn: 'Conflict of interest (Art. 73 §4)',
    subcriteria: [],
    linkedDocType: null,
  },
  {
    category: 'H',
    id: 'criterion:exclusion:prior-involvement',
    titleEl: 'Προηγούμενη εμπλοκή στην προετοιμασία (Άρθρο 73 §4)',
    titleEn: 'Prior involvement in procurement (Art. 73 §4)',
    subcriteria: [],
    linkedDocType: null,
  },
] as const;

export const SELECTION_CRITERIA_TYPES = {
  financial: [
    { id: 'criterion:selection:turnover', titleEl: 'Γενικός ετήσιος κύκλος εργασιών', titleEn: 'General yearly turnover' },
    { id: 'criterion:selection:specific-turnover', titleEl: 'Ειδικός ετήσιος κύκλος εργασιών', titleEn: 'Specific yearly turnover' },
    { id: 'criterion:selection:financial-ratio', titleEl: 'Χρηματοοικονομικοί δείκτες', titleEn: 'Financial ratios' },
    { id: 'criterion:selection:insurance', titleEl: 'Ασφάλιση επαγγελματικού κινδύνου', titleEn: 'Professional risk indemnity' },
  ],
  technical: [
    { id: 'criterion:selection:similar-works', titleEl: 'Παρόμοια έργα / υπηρεσίες', titleEn: 'Similar works / services' },
    { id: 'criterion:selection:technical-staff', titleEl: 'Τεχνικό προσωπικό', titleEn: 'Technical staff' },
    { id: 'criterion:selection:equipment', titleEl: 'Τεχνικός εξοπλισμός', titleEn: 'Technical equipment' },
    { id: 'criterion:selection:subcontracting', titleEl: 'Υπεργολαβία', titleEn: 'Subcontracting' },
  ],
  quality: [
    { id: 'criterion:selection:iso9001', titleEl: 'ISO 9001 — Διαχείριση Ποιότητας', titleEn: 'ISO 9001 — Quality Management' },
    { id: 'criterion:selection:iso14001', titleEl: 'ISO 14001 — Περιβαλλοντική Διαχείριση', titleEn: 'ISO 14001 — Environmental Management' },
    { id: 'criterion:selection:iso45001', titleEl: 'ISO 45001 — Υγεία & Ασφάλεια', titleEn: 'ISO 45001 — Health & Safety' },
    { id: 'criterion:selection:emas', titleEl: 'EMAS', titleEn: 'EMAS' },
  ],
} as const;
