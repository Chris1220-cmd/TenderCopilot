import type { CountryConfig } from './types';

// Dutch holidays — Easter-based (Western, not Orthodox) + fixed
function westernEaster(year: number): Date {
  // Anonymous Gregorian algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function dutchHolidays(year: number): Date[] {
  const easter = westernEaster(year);

  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);

  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);

  const ascension = new Date(easter);
  ascension.setDate(easter.getDate() + 39);

  const whitMonday = new Date(easter);
  whitMonday.setDate(easter.getDate() + 50);

  // King's Day: April 27, or April 26 if April 27 is Sunday
  let kingsDay = new Date(year, 3, 27);
  if (kingsDay.getDay() === 0) {
    kingsDay = new Date(year, 3, 26);
  }

  // Liberation Day: May 5 (national holiday every year since 1990)
  const liberationDay = new Date(year, 4, 5);

  return [
    new Date(year, 0, 1),   // Nieuwjaarsdag (New Year's Day)
    goodFriday,              // Goede Vrijdag
    easter,                  // Eerste Paasdag (Easter Sunday)
    easterMonday,            // Tweede Paasdag (Easter Monday)
    kingsDay,                // Koningsdag (King's Day)
    liberationDay,           // Bevrijdingsdag (Liberation Day)
    ascension,               // Hemelvaartsdag (Ascension Day)
    whitMonday,              // Tweede Pinksterdag (Whit Monday)
    new Date(year, 11, 25), // Eerste Kerstdag (Christmas Day)
    new Date(year, 11, 26), // Tweede Kerstdag (Boxing Day)
  ];
}

export const nlConfig: CountryConfig = {
  code: 'NL',
  name: 'Nederland',
  nameEn: 'Netherlands',
  defaultLanguage: 'nl',
  currency: 'EUR',

  legalFramework: {
    name: 'Aanbestedingswet 2012',
    description: 'Dutch Public Procurement Act 2012, implementing EU Directives 2014/24/EU and 2014/25/EU',
    systems: ['TenderNed', 'PIANOo'],
  },

  documentTypes: [
    { type: 'KVK_EXTRACT', label: 'KvK-uittreksel', labelEn: 'Chamber of Commerce extract', required: true, validityDays: 180 },
    { type: 'TAX_CLEARANCE', label: 'Verklaring betalingsgedrag', labelEn: 'Tax compliance certificate', required: true, validityDays: 180 },
    { type: 'SOCIAL_SECURITY_CLEARANCE', label: 'Verklaring sociale verzekeringen', labelEn: 'Social security clearance', required: true, validityDays: 180 },
    { type: 'CRIMINAL_RECORD', label: 'Gedragsverklaring aanbesteden (GVA)', labelEn: 'Certificate of conduct for public procurement', required: true, validityDays: 730 },
    { type: 'UEA_FORM', label: 'Uniform Europees Aanbestedingsdocument', labelEn: 'European Single Procurement Document (ESPD)', required: true },
    { type: 'INSURANCE_CERTIFICATE', label: 'Verzekeringscertificaat', labelEn: 'Insurance certificate', required: false },
    { type: 'BANK_GUARANTEE', label: 'Bankgarantie', labelEn: 'Bank guarantee', required: false },
  ],

  defaultSourceIds: ['tenderned', 'ted_eu'],

  holidays: dutchHolidays,
};
