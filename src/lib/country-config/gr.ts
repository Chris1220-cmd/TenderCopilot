import type { CountryConfig } from './types';

// Orthodox Easter (Meeus algorithm)
function orthodoxEaster(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  const julian = new Date(year, month - 1, day);
  julian.setDate(julian.getDate() + 13); // Julian -> Gregorian
  return julian;
}

const FIXED_HOLIDAYS: { month: number; day: number }[] = [
  { month: 0, day: 1 },   // Πρωτοχρονιά
  { month: 0, day: 6 },   // Θεοφάνεια
  { month: 2, day: 25 },  // 25η Μαρτίου
  { month: 4, day: 1 },   // Πρωτομαγιά
  { month: 7, day: 15 },  // Κοίμηση Θεοτόκου
  { month: 9, day: 28 },  // Ημέρα του ΟΧΙ
  { month: 11, day: 25 }, // Χριστούγεννα
  { month: 11, day: 26 }, // Σύναξη Θεοτόκου
];

function greekHolidays(year: number): Date[] {
  const easter = orthodoxEaster(year);

  const cleanMonday = new Date(easter);
  cleanMonday.setDate(easter.getDate() - 48);

  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);

  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);

  const whitMonday = new Date(easter);
  whitMonday.setDate(easter.getDate() + 50);

  const fixed = FIXED_HOLIDAYS.map(h => new Date(year, h.month, h.day));
  return [...fixed, cleanMonday, goodFriday, easterMonday, whitMonday];
}

export const grConfig: CountryConfig = {
  code: 'GR',
  name: 'Ελλάδα',
  nameEn: 'Greece',
  defaultLanguage: 'el',
  currency: 'EUR',

  legalFramework: {
    name: 'Ν.4412/2016',
    description: 'Δημόσιες Συμβάσεις Έργων, Προμηθειών και Υπηρεσιών (προσαρμογή στις Οδηγίες 2014/24/ΕΕ και 2014/25/ΕΕ)',
    systems: ['ΕΣΗΔΗΣ', 'ΚΗΜΔΗΣ'],
  },

  documentTypes: [
    { type: 'CRIMINAL_RECORD', label: 'Απόσπασμα Ποινικού Μητρώου', labelEn: 'Criminal Record Extract', required: true, validityDays: 90 },
    { type: 'TAX_CLEARANCE', label: 'Αποδεικτικό Φορολογικής Ενημερότητας', labelEn: 'Tax Clearance Certificate', required: true, validityDays: 30 },
    { type: 'SOCIAL_SECURITY_CLEARANCE', label: 'Ασφαλιστική Ενημερότητα (e-ΕΦΚΑ)', labelEn: 'Social Security Clearance', required: true, validityDays: 180 },
    { type: 'JUDICIAL_CERTIFICATE', label: 'Ενιαίο Πιστοποιητικό Δικαστικής Φερεγγυότητας', labelEn: 'Unified Court Solvency Certificate', required: true, validityDays: 30 },
    { type: 'GEMI_CERTIFICATE', label: 'Πιστοποιητικό ΓΕΜΗ', labelEn: 'GEMI Certificate', required: true, validityDays: 60 },
    { type: 'GUARANTEE_LETTER', label: 'Εγγυητική Επιστολή Συμμετοχής', labelEn: 'Participation Guarantee Letter', required: false },
    { type: 'CHAMBER_CERTIFICATE', label: 'Πιστοποιητικό Εγγραφής Επιμελητηρίου', labelEn: 'Chamber Registration Certificate', required: true, validityDays: 180 },
    { type: 'ESPD', label: 'ΕΕΕΣ / ESPD', labelEn: 'European Single Procurement Document', required: true },
    { type: 'SOLEMN_DECLARATION', label: 'Υπεύθυνη Δήλωση (Ν.1599/86)', labelEn: 'Solemn Declaration', required: true },
    { type: 'TECHNICAL_PROPOSAL', label: 'Τεχνική Προσφορά', labelEn: 'Technical Proposal', required: true },
    { type: 'FINANCIAL_PROPOSAL', label: 'Οικονομική Προσφορά', labelEn: 'Financial Proposal', required: true },
    { type: 'INTERNAL_REVIEW', label: 'Εσωτερικός Έλεγχος', labelEn: 'Internal Review', required: false },
  ],

  defaultSourceIds: [
    'kimdis', 'diavgeia', 'esidis',
    'dei', 'deddie', 'admie', 'eydap',
    'ted_gr',
    'boamp', 'anac', 'fts_uk', 'ezamowienia', 'placsp', 'bund_de',
    'contracts', 'isupplies', 'tee', 'greece20', 'google',
  ],

  holidays: greekHolidays,
};
