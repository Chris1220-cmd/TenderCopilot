// Typed registry of ALL tender discovery sources
// Used by both backend (fetcher dispatch) and frontend (source selector UI)

export interface TenderSource {
  id: string;
  name: string;
  category: 'public' | 'deko' | 'eu' | 'eu_member' | 'private';
  categoryLabel: string;
  url: string;
  country: string; // ISO 2-letter: 'GR', 'EU', 'FR', 'IT', 'GB', 'PL', 'NL', 'ES', 'DE', 'FI', 'CH', 'CZ', 'PT', 'SE', 'UA'
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

  // ── EU Member States ─────────────────────────────────────
  // API-based
  { id: 'boamp',         name: 'BOAMP (Γαλλία)',           category: 'eu_member', categoryLabel: 'Ευρωπαϊκές Χώρες', url: 'https://boamp-datadila.opendatasoft.com', country: 'FR', defaultEnabled: true,  supportsCpvFilter: true },
  { id: 'anac',          name: 'ANAC (Ιταλία)',            category: 'eu_member', categoryLabel: 'Ευρωπαϊκές Χώρες', url: 'https://dati.anticorruzione.it',          country: 'IT', defaultEnabled: true,  supportsCpvFilter: true },
  { id: 'fts_uk',        name: 'Find a Tender (UK)',       category: 'eu_member', categoryLabel: 'Ευρωπαϊκές Χώρες', url: 'https://www.find-tender.service.gov.uk',  country: 'GB', defaultEnabled: true,  supportsCpvFilter: true },
  { id: 'ezamowienia',   name: 'e-Zamówienia (Πολωνία)',   category: 'eu_member', categoryLabel: 'Ευρωπαϊκές Χώρες', url: 'https://ezamowienia.gov.pl',             country: 'PL', defaultEnabled: true,  supportsCpvFilter: false },
  { id: 'tenderned',     name: 'TenderNed (Ολλανδία)',     category: 'eu_member', categoryLabel: 'Ευρωπαϊκές Χώρες', url: 'https://www.tenderned.nl',               country: 'NL', defaultEnabled: false, supportsCpvFilter: true },
  { id: 'prozorro',      name: 'ProZorro (Ουκρανία)',      category: 'eu_member', categoryLabel: 'Ευρωπαϊκές Χώρες', url: 'https://prozorro.gov.ua',                country: 'UA', defaultEnabled: false, supportsCpvFilter: true },
  // Scraping-based
  { id: 'placsp',        name: 'PLACSP (Ισπανία)',         category: 'eu_member', categoryLabel: 'Ευρωπαϊκές Χώρες', url: 'https://contrataciondelestado.es/sindicacion/sindicacion_1143/licitacionesPerique.atom', country: 'ES', defaultEnabled: true,  supportsCpvFilter: false },
  { id: 'bund_de',       name: 'Bund.de (Γερμανία)',       category: 'eu_member', categoryLabel: 'Ευρωπαϊκές Χώρες', url: 'https://www.service.bund.de/IMPORTE/Ausschreibungen/editor/Vergabe/index.html', country: 'DE', defaultEnabled: true,  supportsCpvFilter: false },
  { id: 'hilma',         name: 'Hilma (Φινλανδία)',        category: 'eu_member', categoryLabel: 'Ευρωπαϊκές Χώρες', url: 'https://www.hankintailmoitukset.fi/en/',  country: 'FI', defaultEnabled: false, supportsCpvFilter: false },
  { id: 'simap_ch',      name: 'simap.ch (Ελβετία)',       category: 'eu_member', categoryLabel: 'Ευρωπαϊκές Χώρες', url: 'https://www.simap.ch/shabforms/COMMON/search/searchresultList.jsf', country: 'CH', defaultEnabled: false, supportsCpvFilter: false },
  { id: 'vestnik_cz',    name: 'Věstník (Τσεχία)',         category: 'eu_member', categoryLabel: 'Ευρωπαϊκές Χώρες', url: 'https://vvestnik.cz/',                   country: 'CZ', defaultEnabled: false, supportsCpvFilter: false },
  { id: 'base_pt',       name: 'BASE.gov (Πορτογαλία)',    category: 'eu_member', categoryLabel: 'Ευρωπαϊκές Χώρες', url: 'https://www.base.gov.pt/Base4/en/Pesquisa/Search', country: 'PT', defaultEnabled: false, supportsCpvFilter: false },
  { id: 'mercell',       name: 'Mercell (Σκανδιναβία)',    category: 'eu_member', categoryLabel: 'Ευρωπαϊκές Χώρες', url: 'https://www.mercell.com/en/tenders/search', country: 'SE', defaultEnabled: false, supportsCpvFilter: false },

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
  { id: 'eu_member',  label: 'Ευρωπαϊκές Χώρες' },
  { id: 'private',    label: 'Ιδιωτικοί & Aggregators' },
] as const;

export function getDefaultEnabledSourceIds(): string[] {
  return TENDER_SOURCES.filter(s => s.defaultEnabled).map(s => s.id);
}

export function getSourceById(id: string): TenderSource | undefined {
  return TENDER_SOURCES.find(s => s.id === id);
}
