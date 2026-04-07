

export interface DocumentDefault {
  type: string;
  titleEl: string;
  titleEn: string;
  leadTimeDays: number;
  validityDays: number | null;
  source: string;
  envelope: 'A' | 'B' | 'C' | null;
  isElectronic: boolean;
  govGrUrl?: string;
}

export const GREEK_DOCUMENT_DEFAULTS: DocumentDefault[] = [
  {
    type: 'CRIMINAL_RECORD',
    titleEl: 'Απόσπασμα Ποινικού Μητρώου',
    titleEn: 'Criminal Record Extract',
    leadTimeDays: 10,
    validityDays: 90,
    source: 'gov.gr',
    envelope: 'A',
    isElectronic: true,
    govGrUrl: 'https://www.gov.gr/ipiresies/dikaiosune/poiniko-metroo/antigrapho-poinikou-metroou',
  },
  {
    type: 'TAX_CLEARANCE',
    titleEl: 'Αποδεικτικό Φορολογικής Ενημερότητας',
    titleEn: 'Tax Clearance Certificate',
    leadTimeDays: 2,
    validityDays: 30,
    source: 'gov.gr / ΑΑΔΕ',
    envelope: 'A',
    isElectronic: true,
    govGrUrl: 'https://www.gov.gr/ipiresies/epikheirematike-drasterioteta/apaskholese-prosopikou/apodeiktiko-phorologikes-enemerotetas',
  },
  {
    type: 'SOCIAL_SECURITY_CLEARANCE',
    titleEl: 'Ασφαλιστική Ενημερότητα (e-ΕΦΚΑ)',
    titleEn: 'Social Security Clearance',
    leadTimeDays: 2,
    validityDays: 180,
    source: 'e-ΕΦΚΑ',
    envelope: 'A',
    isElectronic: true,
  },
  {
    type: 'JUDICIAL_CERTIFICATE',
    titleEl: 'Ενιαίο Πιστοποιητικό Δικαστικής Φερεγγυότητας',
    titleEn: 'Unified Court Solvency Certificate',
    leadTimeDays: 10,
    validityDays: 30,
    source: 'solon.gov.gr',
    envelope: 'A',
    isElectronic: true,
  },
  {
    type: 'GEMI_CERTIFICATE',
    titleEl: 'Πιστοποιητικό ΓΕΜΗ',
    titleEn: 'GEMI Certificate',
    leadTimeDays: 2,
    validityDays: 60,
    source: 'businessportal.gr',
    envelope: 'A',
    isElectronic: true,
  },
  {
    type: 'GUARANTEE_LETTER',
    titleEl: 'Εγγυητική Επιστολή Συμμετοχής',
    titleEn: 'Participation Guarantee Letter',
    leadTimeDays: 7,
    validityDays: null,
    source: 'Τράπεζα',
    envelope: 'A',
    isElectronic: false,
  },
  {
    type: 'CHAMBER_CERTIFICATE',
    titleEl: 'Πιστοποιητικό Εγγραφής Επιμελητηρίου',
    titleEn: 'Chamber Registration Certificate',
    leadTimeDays: 3,
    validityDays: 180,
    source: 'Επιμελητήριο',
    envelope: 'A',
    isElectronic: true,
  },
  {
    type: 'ESPD',
    titleEl: 'ΕΕΕΣ / ESPD',
    titleEn: 'European Single Procurement Document',
    leadTimeDays: 0,
    validityDays: null,
    source: 'ΕΣΗΔΗΣ',
    envelope: 'A',
    isElectronic: true,
  },
  {
    type: 'SOLEMN_DECLARATION',
    titleEl: 'Υπεύθυνη Δήλωση (Ν.1599/86)',
    titleEn: 'Solemn Declaration',
    leadTimeDays: 0,
    validityDays: null,
    source: 'gov.gr',
    envelope: 'A',
    isElectronic: true,
  },
  {
    type: 'TECHNICAL_PROPOSAL',
    titleEl: 'Τεχνική Προσφορά',
    titleEn: 'Technical Proposal',
    leadTimeDays: 10,
    validityDays: null,
    source: 'Εσωτερικά',
    envelope: 'B',
    isElectronic: false,
  },
  {
    type: 'FINANCIAL_PROPOSAL',
    titleEl: 'Οικονομική Προσφορά',
    titleEn: 'Financial Proposal',
    leadTimeDays: 3,
    validityDays: null,
    source: 'Εσωτερικά',
    envelope: 'C',
    isElectronic: false,
  },
  {
    type: 'INTERNAL_REVIEW',
    titleEl: 'Εσωτερικός Έλεγχος',
    titleEn: 'Internal Review',
    leadTimeDays: 3,
    validityDays: null,
    source: 'Εσωτερικά',
    envelope: null,
    isElectronic: false,
  },
];

// Maps DeadlinePlanItem.documentType → LegalDocType (for matching existing docs)
export const DOC_TYPE_TO_LEGAL_DOC_TYPE: Record<string, string | null> = {
  CRIMINAL_RECORD: 'CRIMINAL_RECORD',
  TAX_CLEARANCE: 'TAX_CLEARANCE',
  SOCIAL_SECURITY_CLEARANCE: 'SOCIAL_SECURITY_CLEARANCE',
  JUDICIAL_CERTIFICATE: 'JUDICIAL_CERTIFICATE',
  GEMI_CERTIFICATE: 'GEMI_CERTIFICATE',
  GUARANTEE_LETTER: null,
  CHAMBER_CERTIFICATE: null,
  ESPD: null,
  SOLEMN_DECLARATION: null,
  TECHNICAL_PROPOSAL: null,
  FINANCIAL_PROPOSAL: null,
  INTERNAL_REVIEW: null,
};
