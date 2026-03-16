/**
 * Tender Discovery Service
 * Finds real tenders from Greek & EU procurement platforms.
 *
 * Live sources:
 * - Διαύγεια (Diavgeia) OpenData API — procurement decisions
 * - TED (Tenders Electronic Daily) — EU-wide, filtered for Greece
 * - ΚΗΜΔΗΣ placeholder (no public API yet)
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

const KAD_TO_CPV_MAP: Record<string, string[]> = {
  '62.01': ['72210000-0', '72211000-7', '72212000-4'],
  '62.02': ['72220000-3', '72221000-0', '72222000-7'],
  '62.03': ['72250000-2', '72253000-3'],
  '62.09': ['72260000-5', '72261000-2'],
  '63.11': ['72310000-1', '72314000-9', '72315000-6'],
  '58.29': ['48000000-8', '48600000-4', '48900000-7'],
  '61.10': ['64210000-1', '64212000-5'],
  '61.20': ['64212000-5'],
  '41.10': ['45000000-7', '45210000-2'],
  '41.20': ['45211000-9', '45211100-0'],
  '42.11': ['45233100-0', '45233120-6'],
  '42.12': ['45221000-2', '45221100-3'],
  '42.21': ['45231000-5', '45232000-2'],
  '42.22': ['45232200-4', '45232220-0'],
  '42.91': ['45240000-1'],
  '43.11': ['45111000-8', '45112000-5'],
  '43.21': ['45310000-3', '45311000-0'],
  '43.22': ['45330000-9', '45331000-6'],
  '43.29': ['45340000-2', '45343000-3'],
  '43.31': ['45410000-4', '45421000-4'],
  '43.32': ['45420000-7', '45421000-4'],
  '43.33': ['45430000-0', '45431000-7'],
  '43.34': ['45440000-3', '45442000-7'],
  '43.39': ['45450000-6'],
  '71.11': ['71200000-0', '71210000-3'],
  '71.12': ['71300000-1', '71310000-4', '71320000-7'],
  '71.20': ['71600000-4', '71610000-7'],
  '81.21': ['90910000-9', '90911000-6'],
  '81.22': ['90911200-8', '90919000-2'],
  '81.10': ['70310000-7', '70320000-0'],
  '80.10': ['79710000-4', '79711000-1'],
  '80.20': ['79720000-7'],
  '70.22': ['79400000-8', '79410000-1', '79411000-8'],
  '70.21': ['79410000-1'],
  '73.20': ['73200000-4', '73210000-7'],
  '85.59': ['80500000-9', '80510000-2', '80530000-8'],
  '85.60': ['80600000-0'],
  '49.31': ['60112000-6'],
  '49.41': ['60100000-9'],
  '52.29': ['63520000-0'],
  '38.11': ['90500000-2', '90510000-5'],
  '38.21': ['90510000-5', '90513000-6'],
  '39.00': ['90720000-0'],
  '56.21': ['55520000-1', '55521000-8'],
  '56.29': ['55300000-3', '55320000-9'],
};

function mapKadToCpv(kadCodes: string[]): string[] {
  const cpvSet = new Set<string>();
  for (const kad of kadCodes) {
    if (KAD_TO_CPV_MAP[kad]) {
      KAD_TO_CPV_MAP[kad].forEach((cpv) => cpvSet.add(cpv));
      continue;
    }
    const prefix = kad.substring(0, 5);
    if (KAD_TO_CPV_MAP[prefix]) {
      KAD_TO_CPV_MAP[prefix].forEach((cpv) => cpvSet.add(cpv));
      continue;
    }
    const group = kad.substring(0, 2);
    for (const [key, cpvs] of Object.entries(KAD_TO_CPV_MAP)) {
      if (key.startsWith(group)) {
        cpvs.forEach((cpv) => cpvSet.add(cpv));
      }
    }
  }
  return Array.from(cpvSet);
}

// ─── Real API: Διαύγεια (Diavgeia) OpenData ─────────────────

/**
 * Fetches real procurement decisions from Diavgeia OpenData API.
 * Docs: https://diavgeia.gov.gr/api/help
 *
 * Decision types for procurement:
 * - Β.1.3 = Περίληψη Διακήρυξης (Tender Notice Summary)
 * - Β.2.1 = Προκήρυξη (Procurement Notice)
 * - Δ.1  = Ανάληψη Υποχρέωσης
 */
async function getLatestFromDiavgeia(cpvCodes?: string[]): Promise<DiscoveredTender[]> {
  try {
    // Build search query from CPV codes or general procurement terms
    const keywords = cpvCodes && cpvCodes.length > 0
      ? cpvCodes.slice(0, 3).map(c => c.split('-')[0]).join(' OR ')
      : 'προμήθεια OR υπηρεσίες OR ανάπτυξη λογισμικού';

    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - 3); // Last 3 months
    const fromDateStr = fromDate.toISOString().split('T')[0];

    const params = new URLSearchParams({
      q: keywords,
      type: 'Β.2.1', // Procurement notices
      from_issue_date: fromDateStr,
      size: '20',
      page: '0',
    });

    const res = await fetch(
      `https://diavgeia.gov.gr/opendata/search.json?${params.toString()}`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) {
      console.error(`[Diavgeia] API error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const decisions = data.decisions || [];

    return decisions
      .filter((d: any) => d.subject && d.subject.length > 10)
      .slice(0, 15)
      .map((d: any) => ({
        title: d.subject || 'Χωρίς τίτλο',
        referenceNumber: d.ada || d.protocolNumber || '',
        contractingAuthority: d.organizationLabel || d.unitLabel || 'Άγνωστος φορέας',
        platform: 'DIAVGEIA' as const,
        budget: d.extraFieldValues?.amount?.amount
          ? parseFloat(d.extraFieldValues.amount.amount)
          : undefined,
        submissionDeadline: undefined, // Diavgeia doesn't always have this
        cpvCodes: d.extraFieldValues?.cpv
          ? (Array.isArray(d.extraFieldValues.cpv) ? d.extraFieldValues.cpv : [d.extraFieldValues.cpv])
          : [],
        sourceUrl: `https://diavgeia.gov.gr/decision/view/${d.ada}`,
        summary: d.subject,
        publishedAt: d.issueDate ? new Date(d.issueDate) : new Date(),
      }));
  } catch (err) {
    console.error('[Diavgeia] Fetch error:', err);
    return [];
  }
}

// ─── Real API: TED (Tenders Electronic Daily) ───────────────

/**
 * Fetches real Greek tenders from TED Europa.
 * Uses the public search API.
 * Docs: https://ted.europa.eu/en/simap/api
 */
async function getLatestFromTED(cpvCodes?: string[]): Promise<DiscoveredTender[]> {
  try {
    // Build TED search query
    // TD=3 = Contract notices, CY=GR = Greece
    let query = 'TD=3 AND CY=GR';
    if (cpvCodes && cpvCodes.length > 0) {
      const cpvQuery = cpvCodes
        .slice(0, 5)
        .map((c) => `PC=${c.split('-')[0]}`)
        .join(' OR ');
      query += ` AND (${cpvQuery})`;
    }

    const res = await fetch(
      'https://ted.europa.eu/api/v3.0/notices/search',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query,
          pageSize: 20,
          pageNum: 1,
          scope: 2, // Active notices
          sortField: 'ND',
          sortOrder: 'desc',
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!res.ok) {
      console.error(`[TED] API error: ${res.status}`);
      // Try fallback: TED public search RSS/XML
      return await getLatestFromTEDFallback(cpvCodes);
    }

    const data = await res.json();
    const notices = data.results || data.notices || [];

    return notices.slice(0, 15).map((n: any) => ({
      title: n.title?.['en'] || n.title?.['el'] || n.titleText || 'No title',
      referenceNumber: n.documentNumber || n.tedNoticeId || '',
      contractingAuthority: n.buyerName?.['en'] || n.buyerName?.['el'] || n.authorityName || '',
      platform: 'TED' as const,
      budget: n.estimatedTotalValue?.amount ? parseFloat(n.estimatedTotalValue.amount) : undefined,
      submissionDeadline: n.deadlineReceiptTenders ? new Date(n.deadlineReceiptTenders) : undefined,
      cpvCodes: n.cpvCodes || (n.cpvCode ? [n.cpvCode] : []),
      sourceUrl: `https://ted.europa.eu/en/notice/-/detail/${n.documentNumber || n.tedNoticeId}`,
      summary: n.shortDescription?.['en'] || n.shortDescription?.['el'] || undefined,
      publishedAt: n.publicationDate ? new Date(n.publicationDate) : new Date(),
    }));
  } catch (err) {
    console.error('[TED] Fetch error:', err);
    return await getLatestFromTEDFallback(cpvCodes);
  }
}

/**
 * TED fallback: scrape the public search page RSS feed
 */
async function getLatestFromTEDFallback(cpvCodes?: string[]): Promise<DiscoveredTender[]> {
  try {
    const cpvParam = cpvCodes && cpvCodes.length > 0
      ? cpvCodes.slice(0, 3).map(c => c.split('-')[0]).join(',')
      : '';

    const searchUrl = cpvParam
      ? `https://ted.europa.eu/api/v2.0/notices/search?countryCode=GR&cpvCode=${cpvParam}&scope=2&limit=15`
      : `https://ted.europa.eu/api/v2.0/notices/search?countryCode=GR&scope=2&limit=15`;

    const res = await fetch(searchUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error(`[TED fallback] API error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const results = data.results || data.notices || [];

    return results.slice(0, 10).map((n: any) => ({
      title: n.title || n['title-en'] || n['title-el'] || 'TED Notice',
      referenceNumber: n.documentNumber || n.noDocOjs || '',
      contractingAuthority: n.buyerName || n.caName || '',
      platform: 'TED' as const,
      budget: undefined,
      submissionDeadline: n.deadline ? new Date(n.deadline) : undefined,
      cpvCodes: n.cpvCodes || [],
      sourceUrl: `https://ted.europa.eu/en/notice/-/detail/${n.documentNumber || n.noDocOjs}`,
      summary: n.summary || undefined,
      publishedAt: n.publicationDate ? new Date(n.publicationDate) : new Date(),
    }));
  } catch (err) {
    console.error('[TED fallback] Error:', err);
    return [];
  }
}

// ─── ΚΗΜΔΗΣ — Promitheus search ─────────────────────────────

/**
 * Searches ΚΗΜΔΗΣ/Promitheus for procurement notices.
 * Uses the public search page with JSON output.
 */
async function getLatestFromKIMDIS(cpvCodes?: string[]): Promise<DiscoveredTender[]> {
  try {
    const cpvParam = cpvCodes && cpvCodes.length > 0
      ? cpvCodes.slice(0, 3).map(c => c.split('-')[0]).join(',')
      : '';

    // ΚΗΜΔΗΣ search endpoint
    const searchUrl = new URL('https://cerpp.eprocurement.gov.gr/kimds2/unprotected/searchNotices.htm');
    searchUrl.searchParams.set('type', 'json');
    searchUrl.searchParams.set('pageSize', '15');
    if (cpvParam) {
      searchUrl.searchParams.set('cpv', cpvParam);
    }

    const res = await fetch(searchUrl.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error(`[KIMDIS] API error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const notices = data.notices || data.data || data.results || [];

    return notices.slice(0, 15).map((n: any) => ({
      title: n.subject || n.title || 'ΚΗΜΔΗΣ Notice',
      referenceNumber: n.ada || n.noticeId || n.id || '',
      contractingAuthority: n.organizationName || n.authority || '',
      platform: 'KIMDIS' as const,
      budget: n.estimatedValue ? parseFloat(n.estimatedValue) : undefined,
      submissionDeadline: n.deadline ? new Date(n.deadline) : undefined,
      cpvCodes: n.cpvCodes || [],
      sourceUrl: n.url || `https://cerpp.eprocurement.gov.gr/kimds2/unprotected/viewNotice.htm?id=${n.noticeId || n.id}`,
      summary: n.description || n.subject || undefined,
      publishedAt: n.publicationDate ? new Date(n.publicationDate) : new Date(),
    }));
  } catch (err) {
    console.error('[KIMDIS] Fetch error:', err);
    return [];
  }
}

// ─── Relevance Scoring ──────────────────────────────────────

function scoreTenderRelevance(
  tender: DiscoveredTender,
  profile: CompanySearchProfile
): number {
  let score = 0;

  // CPV Match (0-50 points)
  const companyCpvCodes = mapKadToCpv(profile.kadCodes);
  if (companyCpvCodes.length > 0 && tender.cpvCodes.length > 0) {
    const matchingCpvCount = tender.cpvCodes.filter((tenderCpv) =>
      companyCpvCodes.some((companyCpv) => {
        const tenderPrefix = tenderCpv.substring(0, 5);
        const companyPrefix = companyCpv.substring(0, 5);
        return tenderPrefix === companyPrefix;
      })
    ).length;

    if (matchingCpvCount > 0) {
      score += Math.min(50, 30 + (matchingCpvCount - 1) * 10);
    }
  }

  // Keyword Match in Title (0-30 points)
  if (profile.description) {
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

  // Budget Range (0-20 points)
  if (tender.budget !== undefined) {
    if (tender.budget >= 50000 && tender.budget <= 5000000) {
      score += 20;
    } else if (tender.budget > 5000000 && tender.budget <= 15000000) {
      score += 10;
    } else if (tender.budget < 50000 && tender.budget >= 10000) {
      score += 10;
    }
  } else {
    score += 10;
  }

  return Math.min(100, score);
}

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
  async searchTenders(params: TenderSearchParams = {}): Promise<DiscoveredTender[]> {
    const { cpvCodes, kadCodes, keywords, minBudget, maxBudget, platforms } = params;

    let effectiveCpvCodes = cpvCodes || [];
    if (kadCodes && kadCodes.length > 0) {
      const mappedCpv = mapKadToCpv(kadCodes);
      effectiveCpvCodes = Array.from(new Set([...effectiveCpvCodes, ...mappedCpv]));
    }

    const cpvFilter = effectiveCpvCodes.length > 0 ? effectiveCpvCodes : undefined;
    const activePlatforms = platforms || ['DIAVGEIA', 'TED', 'KIMDIS'];
    const fetchers: Promise<DiscoveredTender[]>[] = [];

    if (activePlatforms.includes('DIAVGEIA')) {
      fetchers.push(getLatestFromDiavgeia(cpvFilter));
    }
    if (activePlatforms.includes('TED')) {
      fetchers.push(getLatestFromTED(cpvFilter));
    }
    if (activePlatforms.includes('KIMDIS')) {
      fetchers.push(getLatestFromKIMDIS(cpvFilter));
    }

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

  async matchTendersForTenant(
    tenantId: string
  ): Promise<Array<DiscoveredTender & { relevanceScore: number }>> {
    const companyProfile = await db.companyProfile.findUnique({
      where: { tenantId },
    });

    if (!companyProfile) {
      const tenders = await this.searchTenders();
      return tenders.map((t) => ({ ...t, relevanceScore: 0 }));
    }

    const profile: CompanySearchProfile = {
      kadCodes: companyProfile.kadCodes,
      description: companyProfile.description,
      legalName: companyProfile.legalName,
    };

    const cpvCodes = mapKadToCpv(profile.kadCodes);

    const keywords = profile.description
      ? profile.description
          .split(/[\s,.\-;:()]+/)
          .filter((w) => w.length > 4)
          .filter((w) => !GREEK_STOP_WORDS.has(w.toLowerCase()))
          .slice(0, 10)
      : [];

    const tenders = await this.searchTenders({
      cpvCodes,
      keywords: keywords.length > 0 ? keywords : undefined,
    });

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
