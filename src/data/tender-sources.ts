// Typed registry of ALL tender discovery sources
// Used by both backend (fetcher dispatch) and frontend (source selector UI)

export interface TenderSource {
  id: string;
  name: string;
  category: 'public' | 'deko' | 'eu' | 'private';
  categoryLabel: string;
  url: string;
  country: 'GR' | 'EU';
  defaultEnabled: boolean;
  supportsCpvFilter: boolean;
}

export const TENDER_SOURCES: TenderSource[] = [
  // ── Δημόσιος Τομέας (API-based) ──────────────────────
  { id: 'kimdis',    name: 'ΚΗΜΔΗΣ',    category: 'public', categoryLabel: 'Δημόσιος Τομέας', url: 'https://cerpp.eprocurement.gov.gr', country: 'GR', defaultEnabled: true,  supportsCpvFilter: true },
  { id: 'diavgeia',  name: 'Διαύγεια',   category: 'public', categoryLabel: 'Δημόσιος Τομέας', url: 'https://diavgeia.gov.gr',           country: 'GR', defaultEnabled: true,  supportsCpvFilter: true },
  { id: 'esidis',    name: 'ΕΣΗΔΗΣ',    category: 'public', categoryLabel: 'Δημόσιος Τομέας', url: 'https://portal.eprocurement.gov.gr', country: 'GR', defaultEnabled: true,  supportsCpvFilter: false },

  // ── ΔΕΚΟ / Δημόσιοι Οργανισμοί ────────────────────────
  { id: 'dei',       name: 'ΔΕΗ',              category: 'deko', categoryLabel: 'ΔΕΚΟ', url: 'https://eprocurement.dei.gr',                              country: 'GR', defaultEnabled: true,  supportsCpvFilter: false },
  { id: 'deddie',    name: 'ΔΕΔΔΗΕ',           category: 'deko', categoryLabel: 'ΔΕΚΟ', url: 'https://www.deddie.gr/el/tender-notice-common/',            country: 'GR', defaultEnabled: true,  supportsCpvFilter: false },
  { id: 'admie',     name: 'ΑΔΜΗΕ',            category: 'deko', categoryLabel: 'ΔΕΚΟ', url: 'https://www.admie.gr/anakoinoseis/promitheies',             country: 'GR', defaultEnabled: true,  supportsCpvFilter: false },
  { id: 'eydap',     name: 'ΕΥΔΑΠ',            category: 'deko', categoryLabel: 'ΔΕΚΟ', url: 'https://www.eydap.gr/TheCompany/Contests/ProjectNotices/',  country: 'GR', defaultEnabled: true,  supportsCpvFilter: false },
  { id: 'eyath',     name: 'ΕΥΑΘ',             category: 'deko', categoryLabel: 'ΔΕΚΟ', url: 'https://www.eyath.gr/',                                    country: 'GR', defaultEnabled: false, supportsCpvFilter: false },
  { id: 'depa',      name: 'ΔΕΠΑ',             category: 'deko', categoryLabel: 'ΔΕΚΟ', url: 'https://www.depa.gr/prokiryxis/',                           country: 'GR', defaultEnabled: false, supportsCpvFilter: false },
  { id: 'ose',       name: 'ΟΣΕ',              category: 'deko', categoryLabel: 'ΔΕΚΟ', url: 'https://ose.gr/epikoinonia/deltia-tipou/diagonismoi/',      country: 'GR', defaultEnabled: false, supportsCpvFilter: false },
  { id: 'oasa',      name: 'ΟΑΣΑ',             category: 'deko', categoryLabel: 'ΔΕΚΟ', url: 'https://www.oasa.gr/en/procurements/',                      country: 'GR', defaultEnabled: false, supportsCpvFilter: false },
  { id: 'emetro',    name: 'Ελληνικό Μετρό',    category: 'deko', categoryLabel: 'ΔΕΚΟ', url: 'https://www.emetro.gr/?page_id=8088&lang=el',              country: 'GR', defaultEnabled: false, supportsCpvFilter: false },
  { id: 'ert',       name: 'ΕΡΤ',              category: 'deko', categoryLabel: 'ΔΕΚΟ', url: 'https://www.ert.gr/diagonismoi/',                           country: 'GR', defaultEnabled: false, supportsCpvFilter: false },
  { id: 'efka',      name: 'e-ΕΦΚΑ',           category: 'deko', categoryLabel: 'ΔΕΚΟ', url: 'https://www.e-efka.gov.gr/el/diagonismoi',                 country: 'GR', defaultEnabled: false, supportsCpvFilter: false },
  { id: 'cosmote',   name: 'OTE/Cosmote',       category: 'deko', categoryLabel: 'ΔΕΚΟ', url: 'https://www.cosmote.gr/cs/otegroup/en/prokirixeis_diagonismon.html', country: 'GR', defaultEnabled: false, supportsCpvFilter: false },

  // ── Ευρωπαϊκή Ένωση ──────────────────────────────────
  { id: 'ted_gr',    name: 'TED (Ελλάδα)',   category: 'eu', categoryLabel: 'Ευρωπαϊκή Ένωση', url: 'https://api.ted.europa.eu', country: 'GR', defaultEnabled: true,  supportsCpvFilter: true },
  { id: 'ted_eu',    name: 'TED (Όλη η EU)', category: 'eu', categoryLabel: 'Ευρωπαϊκή Ένωση', url: 'https://api.ted.europa.eu', country: 'EU', defaultEnabled: false, supportsCpvFilter: true },

  // ── Ιδιωτικοί / Aggregators ──────────────────────────────
  { id: 'contracts',    name: 'contracts.gr',     category: 'private',    categoryLabel: 'Ιδιωτικοί & Aggregators', url: 'https://www.contracts.gr/',                                country: 'GR', defaultEnabled: true,  supportsCpvFilter: false },
  { id: 'isupplies',    name: 'iSupplies',        category: 'private',    categoryLabel: 'Ιδιωτικοί & Aggregators', url: 'https://www.isupplies.gr/',                                country: 'GR', defaultEnabled: true,  supportsCpvFilter: false },
  { id: 'dda',          name: 'DDA Consulting',   category: 'private',    categoryLabel: 'Ιδιωτικοί & Aggregators', url: 'https://dda.com.gr/',                                      country: 'GR', defaultEnabled: false, supportsCpvFilter: false },
  { id: 'tee',          name: 'ΤΕΕ Διαγωνισμοί',  category: 'private',    categoryLabel: 'Ιδιωτικοί & Aggregators', url: 'https://web.tee.gr/tp-tee/diagwnismoi/',                   country: 'GR', defaultEnabled: true,  supportsCpvFilter: false },
  { id: 'greece20',     name: 'Ελλάδα 2.0',       category: 'private',    categoryLabel: 'Ιδιωτικοί & Aggregators', url: 'https://greece20.gov.gr/diakirykseis-kai-diagwnismoi/',     country: 'GR', defaultEnabled: true,  supportsCpvFilter: false },
  { id: 'promitheies',  name: 'promitheies.gr',   category: 'private',    categoryLabel: 'Ιδιωτικοί & Aggregators', url: 'https://www.promitheies.gr/',                              country: 'GR', defaultEnabled: false, supportsCpvFilter: false },
  { id: 'google',       name: 'Google Search',    category: 'private',    categoryLabel: 'Ιδιωτικοί & Aggregators', url: 'https://www.googleapis.com/customsearch/v1',               country: 'GR', defaultEnabled: true,  supportsCpvFilter: true },
];

export const SOURCE_CATEGORIES = [
  { id: 'public',     label: 'Δημόσιος Τομέας' },
  { id: 'deko',       label: 'ΔΕΚΟ' },
  { id: 'eu',         label: 'Ευρωπαϊκή Ένωση' },
  { id: 'private',    label: 'Ιδιωτικοί & Aggregators' },
] as const;

export function getDefaultEnabledSourceIds(): string[] {
  return TENDER_SOURCES.filter(s => s.defaultEnabled).map(s => s.id);
}

export function getSourceById(id: string): TenderSource | undefined {
  return TENDER_SOURCES.find(s => s.id === id);
}
