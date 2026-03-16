/**
 * Tender Discovery Service
 * Automatically finds new tenders from Greek procurement platforms
 * matching the company's KAD codes and CPV codes.
 *
 * Sources (with stubs for real implementation):
 * - ΚΗΜΔΗΣ (Κεντρικό Ηλεκτρονικό Μητρώο Δημοσίων Συμβάσεων)
 * - Diavgeia (Δι@ύγεια) RSS feeds
 * - TED (Tenders Electronic Daily) API
 * - ΕΣΗΔΗΣ scraping (via RSS)
 */

import { db } from '@/lib/db';

// ─── Types ──────────────────────────────────────────────────

export interface DiscoveredTender {
  title: string;
  referenceNumber: string;
  contractingAuthority: string;
  platform: 'KIMDIS' | 'DIAVGEIA' | 'TED' | 'ESIDIS';
  budget?: number;
  submissionDeadline?: Date;
  cpvCodes: string[];
  sourceUrl: string;
  summary?: string;
  publishedAt: Date;
}

export interface TenderSearchParams {
  cpvCodes?: string[];
  kadCodes?: string[];
  keywords?: string[];
  minBudget?: number;
  maxBudget?: number;
  platforms?: Array<'KIMDIS' | 'DIAVGEIA' | 'TED' | 'ESIDIS'>;
}

interface CompanySearchProfile {
  kadCodes: string[];
  description: string | null;
  legalName: string;
}

// ─── KAD-to-CPV Mapping ────────────────────────────────────
// Partial mapping for common IT, construction, and services KAD codes.
// KAD codes are the Greek equivalent of NACE codes; CPV codes are used
// in EU public procurement. This mapping is approximate and should be
// extended for production use.

const KAD_TO_CPV_MAP: Record<string, string[]> = {
  // IT & Software
  '62.01': ['72210000-0', '72211000-7', '72212000-4'], // Software development
  '62.02': ['72220000-3', '72221000-0', '72222000-7'], // IT consulting
  '62.03': ['72250000-2', '72253000-3'],               // IT infrastructure management
  '62.09': ['72260000-5', '72261000-2'],               // Other IT services
  '63.11': ['72310000-1', '72314000-9', '72315000-6'], // Data processing / hosting
  '58.29': ['48000000-8', '48600000-4', '48900000-7'], // Software publishing
  '61.10': ['64210000-1', '64212000-5'],               // Wired telecommunications
  '61.20': ['64212000-5'],                             // Wireless telecommunications

  // Construction
  '41.10': ['45000000-7', '45210000-2'],               // Building construction
  '41.20': ['45211000-9', '45211100-0'],               // Residential / non-residential
  '42.11': ['45233100-0', '45233120-6'],               // Roads & motorways
  '42.12': ['45221000-2', '45221100-3'],               // Bridges & tunnels
  '42.21': ['45231000-5', '45232000-2'],               // Utility projects
  '42.22': ['45232200-4', '45232220-0'],               // Electricity networks
  '42.91': ['45240000-1'],                             // Hydraulic engineering
  '43.11': ['45111000-8', '45112000-5'],               // Demolition
  '43.21': ['45310000-3', '45311000-0'],               // Electrical installations
  '43.22': ['45330000-9', '45331000-6'],               // Plumbing & HVAC
  '43.29': ['45340000-2', '45343000-3'],               // Other installations
  '43.31': ['45410000-4', '45421000-4'],               // Plastering
  '43.32': ['45420000-7', '45421000-4'],               // Joinery
  '43.33': ['45430000-0', '45431000-7'],               // Floor and wall covering
  '43.34': ['45440000-3', '45442000-7'],               // Painting & glazing
  '43.39': ['45450000-6'],                             // Other finishing

  // Engineering & Architecture
  '71.11': ['71200000-0', '71210000-3'],               // Architectural services
  '71.12': ['71300000-1', '71310000-4', '71320000-7'], // Engineering services
  '71.20': ['71600000-4', '71610000-7'],               // Technical testing

  // Cleaning & Facility services
  '81.21': ['90910000-9', '90911000-6'],               // Building cleaning
  '81.22': ['90911200-8', '90919000-2'],               // Industrial cleaning
  '81.10': ['70310000-7', '70320000-0'],               // Facility management

  // Security
  '80.10': ['79710000-4', '79711000-1'],               // Private security
  '80.20': ['79720000-7'],                             // Investigation services

  // Consulting
  '70.22': ['79400000-8', '79410000-1', '79411000-8'], // Management consulting
  '70.21': ['79410000-1'],                             // PR & communications consulting
  '73.20': ['73200000-4', '73210000-7'],               // Market research

  // Training & Education
  '85.59': ['80500000-9', '80510000-2', '80530000-8'], // Other education
  '85.60': ['80600000-0'],                             // Educational support

  // Transport & Logistics
  '49.31': ['60112000-6'],                             // Urban passenger transport
  '49.41': ['60100000-9'],                             // Freight transport
  '52.29': ['63520000-0'],                             // Forwarding services

  // Environmental & Waste
  '38.11': ['90500000-2', '90510000-5'],               // Waste collection
  '38.21': ['90510000-5', '90513000-6'],               // Waste treatment
  '39.00': ['90720000-0'],                             // Environmental remediation

  // Catering & Food services
  '56.21': ['55520000-1', '55521000-8'],               // Event catering
  '56.29': ['55300000-3', '55320000-9'],               // Other food service
};

/**
 * Maps KAD codes to their corresponding CPV codes.
 * KAD codes can be given as full (e.g. "62.01.10") or prefix ("62.01").
 * We match on the 4-char prefix (group level).
 */
function mapKadToCpv(kadCodes: string[]): string[] {
  const cpvSet = new Set<string>();

  for (const kad of kadCodes) {
    // Try exact match first (e.g. "62.01")
    if (KAD_TO_CPV_MAP[kad]) {
      KAD_TO_CPV_MAP[kad].forEach((cpv) => cpvSet.add(cpv));
      continue;
    }

    // Try prefix match: "62.01.10" -> "62.01"
    const prefix = kad.substring(0, 5); // "XX.XX"
    if (KAD_TO_CPV_MAP[prefix]) {
      KAD_TO_CPV_MAP[prefix].forEach((cpv) => cpvSet.add(cpv));
      continue;
    }

    // Try 2-digit group: "62.01" -> look for "62.*"
    const group = kad.substring(0, 2);
    for (const [key, cpvs] of Object.entries(KAD_TO_CPV_MAP)) {
      if (key.startsWith(group)) {
        cpvs.forEach((cpv) => cpvSet.add(cpv));
      }
    }
  }

  return Array.from(cpvSet);
}

// ─── Mock Data Generators ───────────────────────────────────

/**
 * Fetches latest tenders from ΚΗΜΔΗΣ.
 *
 * TODO: Real implementation would:
 * 1. Call the ΚΗΜΔΗΣ API at https://www.eprocurement.gov.gr/kimds2/unprotected/searchNotices.htm
 * 2. Parse the XML/JSON response
 * 3. Filter by CPV codes and date range
 * 4. Map the response to DiscoveredTender[]
 *
 * ΚΗΜΔΗΣ provides a search API that supports filtering by:
 * - CPV codes (primary and supplementary)
 * - Publication date range
 * - Contracting authority
 * - Budget range
 * - Contract type (services, supplies, works)
 */
async function getLatestFromKIMDIS(cpvCodes?: string[]): Promise<DiscoveredTender[]> {
  // Stub: Return realistic mock data
  const mockTenders: DiscoveredTender[] = [
    {
      title: 'Προμήθεια και εγκατάσταση εξοπλισμού πληροφορικής για τη Γενική Γραμματεία Ψηφιακής Διακυβέρνησης',
      referenceNumber: 'ΚΗΜΔΗΣ-2024-0234567',
      contractingAuthority: 'Υπουργείο Ψηφιακής Διακυβέρνησης',
      platform: 'KIMDIS',
      budget: 450000,
      submissionDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      cpvCodes: ['72210000-0', '48000000-8', '30200000-1'],
      sourceUrl: 'https://www.eprocurement.gov.gr/kimds2/unprotected/viewNotice.htm?id=234567',
      summary: 'Προμήθεια servers, storage, και λογισμικού για τη νέα υποδομή cloud. Περιλαμβάνει εγκατάσταση, παραμετροποίηση και εκπαίδευση.',
      publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      title: 'Υπηρεσίες ανάπτυξης λογισμικού διαχείρισης αιτημάτων πολιτών - Δήμος Θεσσαλονίκης',
      referenceNumber: 'ΚΗΜΔΗΣ-2024-0234890',
      contractingAuthority: 'Δήμος Θεσσαλονίκης',
      platform: 'KIMDIS',
      budget: 180000,
      submissionDeadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      cpvCodes: ['72210000-0', '72211000-7', '72212000-4'],
      sourceUrl: 'https://www.eprocurement.gov.gr/kimds2/unprotected/viewNotice.htm?id=234890',
      summary: 'Ανάπτυξη web εφαρμογής για τη διαχείριση αιτημάτων πολιτών και την ηλεκτρονική εξυπηρέτηση.',
      publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
    {
      title: 'Κατασκευή δικτύου οπτικών ινών - Δήμος Ηρακλείου',
      referenceNumber: 'ΚΗΜΔΗΣ-2024-0235012',
      contractingAuthority: 'Δήμος Ηρακλείου',
      platform: 'KIMDIS',
      budget: 2800000,
      submissionDeadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      cpvCodes: ['45231000-5', '45232200-4', '64210000-1'],
      sourceUrl: 'https://www.eprocurement.gov.gr/kimds2/unprotected/viewNotice.htm?id=235012',
      summary: 'Κατασκευή δικτύου οπτικών ινών FTTH σε 3 δημοτικές ενότητες. Περιλαμβάνει εκσκαφές, πόντιση καλωδίων και εγκατάσταση ενεργού εξοπλισμού.',
      publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  ];

  if (cpvCodes && cpvCodes.length > 0) {
    return mockTenders.filter((t) =>
      t.cpvCodes.some((code) => cpvCodes.some((search) => code.startsWith(search.substring(0, 5))))
    );
  }

  return mockTenders;
}

/**
 * Fetches latest tenders from Diavgeia (Δι@ύγεια).
 *
 * TODO: Real implementation would:
 * 1. Call Diavgeia OpenData API: https://diavgeia.gov.gr/api/decisions
 * 2. Filter by decisionType (e.g. "Δ.1" for procurement decisions)
 * 3. Parse JSON response with decision metadata
 * 4. Extract ADA (unique decision ID), subject, organization
 * 5. Cross-reference with ΚΗΜΔΗΣ for full tender details
 *
 * Diavgeia API supports:
 * - GET /api/decisions?decisionType=Δ.1&from_date=2024-01-01
 * - Filtering by organization, subject keyword, date range
 * - Pagination with page/size params
 */
async function getLatestFromDiavgeia(cpvCodes?: string[]): Promise<DiscoveredTender[]> {
  const mockTenders: DiscoveredTender[] = [
    {
      title: 'Παροχή υπηρεσιών καθαρισμού κτιριακών εγκαταστάσεων Νοσοκομείου Ευαγγελισμός',
      referenceNumber: 'ΑΔΑ-ΨΗΦΛ469Η26-Κ7Ω',
      contractingAuthority: 'ΓΝΑ Ευαγγελισμός',
      platform: 'DIAVGEIA',
      budget: 320000,
      submissionDeadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      cpvCodes: ['90910000-9', '90911000-6'],
      sourceUrl: 'https://diavgeia.gov.gr/decision/view/ΨΗΦΛ469Η26-Κ7Ω',
      summary: 'Ετήσια σύμβαση καθαρισμού για τις κτιριακές εγκαταστάσεις του νοσοκομείου, 5 ημέρες/εβδομάδα.',
      publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
    {
      title: 'Προμήθεια υπηρεσιών φύλαξης - Πανεπιστήμιο Πατρών',
      referenceNumber: 'ΑΔΑ-ΩΞΓΤ469Β7Θ-ΜΚ2',
      contractingAuthority: 'Πανεπιστήμιο Πατρών',
      platform: 'DIAVGEIA',
      budget: 250000,
      submissionDeadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      cpvCodes: ['79710000-4', '79711000-1'],
      sourceUrl: 'https://diavgeia.gov.gr/decision/view/ΩΞΓΤ469Β7Θ-ΜΚ2',
      summary: 'Υπηρεσίες φύλαξης πανεπιστημιακών χώρων, 24/7 κάλυψη, 12μηνη σύμβαση.',
      publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    },
    {
      title: 'Σύμβαση παροχής υπηρεσιών συμβούλου για ψηφιακό μετασχηματισμό - Περιφέρεια Αττικής',
      referenceNumber: 'ΑΔΑ-6ΛΩΝ7Λ7-ΘΤΞ',
      contractingAuthority: 'Περιφέρεια Αττικής',
      platform: 'DIAVGEIA',
      budget: 520000,
      submissionDeadline: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
      cpvCodes: ['72220000-3', '72221000-0', '79400000-8'],
      sourceUrl: 'https://diavgeia.gov.gr/decision/view/6ΛΩΝ7Λ7-ΘΤΞ',
      summary: 'Παροχή συμβουλευτικών υπηρεσιών για τον ψηφιακό μετασχηματισμό της Περιφέρειας. Περιλαμβάνει μελέτη υφιστάμενης κατάστασης, σχεδιασμό στρατηγικής, και υλοποίηση πιλοτικών δράσεων.',
      publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  ];

  if (cpvCodes && cpvCodes.length > 0) {
    return mockTenders.filter((t) =>
      t.cpvCodes.some((code) => cpvCodes.some((search) => code.startsWith(search.substring(0, 5))))
    );
  }

  return mockTenders;
}

/**
 * Fetches latest tenders from TED (Tenders Electronic Daily).
 *
 * TODO: Real implementation would:
 * 1. Call TED API v3: https://api.ted.europa.eu/v3/notices/search
 * 2. Filter by:
 *    - country: "GR" (Greece)
 *    - CPV codes
 *    - Publication date range
 *    - Notice type (contract notice, prior information notice)
 * 3. Parse the response (JSON-LD format)
 * 4. Map to DiscoveredTender[]
 *
 * TED API requires API key registration at:
 * https://ted.europa.eu/en/simap/api
 *
 * Query example:
 * POST /v3/notices/search
 * { "query": "TD=3 AND CY=GR AND PC=72210000", "page": 1, "limit": 50 }
 */
async function getLatestFromTED(cpvCodes?: string[]): Promise<DiscoveredTender[]> {
  const mockTenders: DiscoveredTender[] = [
    {
      title: 'Design, development and maintenance of a national digital platform for public services - Hellenic Republic',
      referenceNumber: '2024/S 089-276543',
      contractingAuthority: 'Ministry of Digital Governance - Hellenic Republic',
      platform: 'TED',
      budget: 3500000,
      submissionDeadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      cpvCodes: ['72210000-0', '72212000-4', '72310000-1'],
      sourceUrl: 'https://ted.europa.eu/en/notice/-/detail/2024-276543',
      summary: 'Design, development, and 3-year maintenance of a national platform for digital public services. Includes UX design, full-stack development, cloud infrastructure, and citizen portal.',
      publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
    {
      title: 'Construction of wastewater treatment plant - Municipality of Chania, Crete',
      referenceNumber: '2024/S 091-281234',
      contractingAuthority: 'ΔΕΥΑ Χανίων',
      platform: 'TED',
      budget: 12000000,
      submissionDeadline: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000),
      cpvCodes: ['45232420-2', '45252000-8', '45240000-1'],
      sourceUrl: 'https://ted.europa.eu/en/notice/-/detail/2024-281234',
      summary: 'Construction of a new wastewater treatment plant serving 50,000 inhabitants. Includes civil works, mechanical equipment, and SCADA system.',
      publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
  ];

  if (cpvCodes && cpvCodes.length > 0) {
    return mockTenders.filter((t) =>
      t.cpvCodes.some((code) => cpvCodes.some((search) => code.startsWith(search.substring(0, 5))))
    );
  }

  return mockTenders;
}

// ─── Relevance Scoring ──────────────────────────────────────

/**
 * Scores how relevant a discovered tender is to a company profile.
 * Returns a score from 0-100.
 *
 * Scoring criteria:
 * - CPV code match (0-50 points): Direct CPV code overlap
 * - Keyword match in title (0-30 points): Keywords from company description found in tender title
 * - Budget range fit (0-20 points): Tender budget within company's typical range
 */
function scoreTenderRelevance(
  tender: DiscoveredTender,
  profile: CompanySearchProfile
): number {
  let score = 0;

  // ── CPV Match (0-50 points) ────────────────────────────────
  const companyCpvCodes = mapKadToCpv(profile.kadCodes);
  if (companyCpvCodes.length > 0) {
    const matchingCpvCount = tender.cpvCodes.filter((tenderCpv) =>
      companyCpvCodes.some((companyCpv) => {
        // Match on 5-char CPV prefix (division level) for broad match
        const tenderPrefix = tenderCpv.substring(0, 5);
        const companyPrefix = companyCpv.substring(0, 5);
        return tenderPrefix === companyPrefix;
      })
    ).length;

    if (matchingCpvCount > 0) {
      // At least one match = 30 points, each additional adds 10 up to 50
      score += Math.min(50, 30 + (matchingCpvCount - 1) * 10);
    }
  }

  // ── Keyword Match in Title (0-30 points) ───────────────────
  if (profile.description) {
    // Extract meaningful keywords from company description (words > 4 chars)
    const keywords = profile.description
      .toLowerCase()
      .split(/[\s,.\-;:()]+/)
      .filter((word) => word.length > 4)
      .filter((word) => !GREEK_STOP_WORDS.has(word));

    const titleLower = tender.title.toLowerCase();
    const summaryLower = (tender.summary || '').toLowerCase();
    const combinedText = `${titleLower} ${summaryLower}`;

    const matchingKeywords = keywords.filter((kw) => combinedText.includes(kw));
    if (matchingKeywords.length > 0) {
      score += Math.min(30, matchingKeywords.length * 10);
    }
  }

  // ── Budget Range (0-20 points) ─────────────────────────────
  // Default: tenders between 50k-5M get full points (typical SME range)
  if (tender.budget !== undefined) {
    if (tender.budget >= 50000 && tender.budget <= 5000000) {
      score += 20;
    } else if (tender.budget > 5000000 && tender.budget <= 15000000) {
      score += 10;
    } else if (tender.budget < 50000 && tender.budget >= 10000) {
      score += 10;
    }
    // Very large (>15M) or very small (<10k) tenders get 0 budget points
  } else {
    // No budget info - give benefit of the doubt
    score += 10;
  }

  return Math.min(100, score);
}

// Common Greek stop words to ignore in keyword matching
const GREEK_STOP_WORDS = new Set([
  'είναι', 'αυτό', 'αυτή', 'αυτές', 'αυτοί', 'αυτά',
  'στην', 'στον', 'στο', 'στις', 'στους', 'στα',
  'από', 'για', 'προς', 'μετά', 'μεταξύ', 'κατά',
  'μέσω', 'πάνω', 'κάτω', 'δίπλα', 'μέσα', 'πριν',
  'μπορεί', 'πρέπει', 'θέλει', 'έχει', 'κάνει',
  'ότι', 'όπως', 'πώς', 'πότε', 'γιατί', 'τότε',
  'επίσης', 'ακόμα', 'πολύ', 'λίγο', 'σχεδόν',
]);

// ─── Main Service ───────────────────────────────────────────

class TenderDiscoveryService {
  /**
   * Search tenders across all platforms with optional filters.
   */
  async searchTenders(params: TenderSearchParams = {}): Promise<DiscoveredTender[]> {
    const {
      cpvCodes,
      kadCodes,
      keywords,
      minBudget,
      maxBudget,
      platforms,
    } = params;

    // Resolve CPV codes from KAD codes if needed
    let effectiveCpvCodes = cpvCodes || [];
    if (kadCodes && kadCodes.length > 0) {
      const mappedCpv = mapKadToCpv(kadCodes);
      effectiveCpvCodes = Array.from(new Set([...effectiveCpvCodes, ...mappedCpv]));
    }

    const cpvFilter = effectiveCpvCodes.length > 0 ? effectiveCpvCodes : undefined;

    // Fetch from all active platforms in parallel
    const activePlatforms = platforms || ['KIMDIS', 'DIAVGEIA', 'TED', 'ESIDIS'];
    const fetchers: Promise<DiscoveredTender[]>[] = [];

    if (activePlatforms.includes('KIMDIS')) {
      fetchers.push(getLatestFromKIMDIS(cpvFilter));
    }
    if (activePlatforms.includes('DIAVGEIA')) {
      fetchers.push(getLatestFromDiavgeia(cpvFilter));
    }
    if (activePlatforms.includes('TED')) {
      fetchers.push(getLatestFromTED(cpvFilter));
    }
    // TODO: Add ESIDIS fetcher when implemented
    // if (activePlatforms.includes('ESIDIS')) {
    //   fetchers.push(getLatestFromESIDIS(cpvFilter));
    // }

    const results = await Promise.allSettled(fetchers);
    let allTenders: DiscoveredTender[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allTenders.push(...result.value);
      } else {
        console.error('Failed to fetch from platform:', result.reason);
      }
    }

    // Apply keyword filter
    if (keywords && keywords.length > 0) {
      allTenders = allTenders.filter((t) => {
        const text = `${t.title} ${t.summary || ''}`.toLowerCase();
        return keywords.some((kw) => text.includes(kw.toLowerCase()));
      });
    }

    // Apply budget filter
    if (minBudget !== undefined) {
      allTenders = allTenders.filter((t) => t.budget === undefined || t.budget >= minBudget);
    }
    if (maxBudget !== undefined) {
      allTenders = allTenders.filter((t) => t.budget === undefined || t.budget <= maxBudget);
    }

    // Sort by publication date (newest first)
    allTenders.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

    return allTenders;
  }

  /**
   * Match and score tenders for a specific tenant based on their company profile.
   * Loads the tenant's CompanyProfile, maps KAD to CPV codes, searches tenders,
   * and scores each result by relevance.
   */
  async matchTendersForTenant(
    tenantId: string
  ): Promise<Array<DiscoveredTender & { relevanceScore: number }>> {
    // Load company profile
    const companyProfile = await db.companyProfile.findUnique({
      where: { tenantId },
    });

    if (!companyProfile) {
      // No profile set up - return unscored results
      const tenders = await this.searchTenders();
      return tenders.map((t) => ({ ...t, relevanceScore: 0 }));
    }

    const profile: CompanySearchProfile = {
      kadCodes: companyProfile.kadCodes,
      description: companyProfile.description,
      legalName: companyProfile.legalName,
    };

    // Map KAD codes to CPV for searching
    const cpvCodes = mapKadToCpv(profile.kadCodes);

    // Extract keywords from company description
    const keywords = profile.description
      ? profile.description
          .split(/[\s,.\-;:()]+/)
          .filter((w) => w.length > 4)
          .filter((w) => !GREEK_STOP_WORDS.has(w.toLowerCase()))
          .slice(0, 10) // Limit to top 10 keywords
      : [];

    // Search with the derived parameters
    const tenders = await this.searchTenders({
      cpvCodes,
      keywords: keywords.length > 0 ? keywords : undefined,
    });

    // Score each tender
    const scoredTenders = tenders
      .map((tender) => ({
        ...tender,
        relevanceScore: scoreTenderRelevance(tender, profile),
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    return scoredTenders;
  }
}

export const tenderDiscovery = new TenderDiscoveryService();
