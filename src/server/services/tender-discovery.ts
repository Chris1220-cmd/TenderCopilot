/**
 * Tender Discovery Service
 * Finds real tenders from Greek & EU procurement platforms.
 *
 * Live sources:
 * - Διαύγεια (Diavgeia) OpenData API — procurement decisions
 * - TED (Tenders Electronic Daily) — EU-wide, filtered for Greece
 * - ΚΗΜΔΗΣ placeholder (no public API yet)
 * - Private Sector — b2b.gr, eprocurement.gr, ypodomes.com
 */

import { db } from '@/lib/db';
import { kadToCpv } from '@/lib/kad-cpv-map';
import builtinPrivateSources from '@/data/private-sources.json';

// ─── Types ──────────────────────────────────────────────────

export interface DiscoveredTender {
  title: string;
  referenceNumber: string;
  contractingAuthority: string;
  platform: 'KIMDIS' | 'DIAVGEIA' | 'TED' | 'ESIDIS' | 'PRIVATE' | 'GOOGLE';
  budget?: number;
  submissionDeadline?: Date;
  cpvCodes: string[];
  sourceUrl: string;
  source?: string;
  summary?: string;
  publishedAt: Date;
  country?: string;
  sourceLabel?: string;
  isPrivate?: boolean;
}

export interface TenderSearchParams {
  cpvCodes?: string[];
  kadCodes?: string[];
  keywords?: string[];
  minBudget?: number;
  maxBudget?: number;
  platforms?: Array<'KIMDIS' | 'DIAVGEIA' | 'TED' | 'ESIDIS' | 'OTHER' | 'PRIVATE' | 'GOOGLE'>;
  showAll?: boolean;
  country?: 'GR' | 'EU' | 'international' | 'all';
  entityType?: 'public' | 'private' | 'all';
  relevanceOnly?: boolean;
  tenantId?: string;
}

// Merge two duplicate tenders, keeping the most complete data
function mergeTenders(existing: DiscoveredTender, incoming: DiscoveredTender): DiscoveredTender {
  return {
    ...existing,
    title: existing.title.length >= incoming.title.length ? existing.title : incoming.title,
    budget: existing.budget ?? incoming.budget,
    submissionDeadline: existing.submissionDeadline ?? incoming.submissionDeadline,
    contractingAuthority: existing.contractingAuthority || incoming.contractingAuthority,
    summary: existing.summary || incoming.summary,
    cpvCodes: Array.from(new Set([...existing.cpvCodes, ...incoming.cpvCodes])),
    // Keep source info from both
    sourceLabel: existing.sourceLabel
      ? `${existing.sourceLabel}, ${incoming.platform}`
      : `${existing.platform}, ${incoming.platform}`,
  };
}

interface CompanySearchProfile {
  kadCodes: string[];
  description: string | null;
  legalName: string;
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
    // Use LUMINAPI with subject filter for REAL tenders (not payment orders)
    // Search terms: "διακήρυξη" (tender notice), "προκήρυξη" (procurement notice),
    // "διαγωνισμός" (competition/tender)
    // Only search for actual tender types — NOT αναθέσεις/αποφάσεις
    const searchTerms = ['ΔΙΑΚΗΡΥΞΗ', 'ΠΡΟΚΗΡΥΞΗ', 'ΠΕΡΙΛΗΨΗ_ΔΙΑΚΗΡΥΞΗΣ'];

    // If CPV codes provided, also add them as keywords
    const cpvKeywords = cpvCodes && cpvCodes.length > 0
      ? cpvCodes.slice(0, 3).map(c => c.split('-')[0])
      : [];

    const allResults: any[] = [];

    for (const term of searchTerms) {
      try {
        const params = new URLSearchParams({
          subject: term,
          size: '15',
          page: '0',
        });

        // Add CPV as additional query if available
        if (cpvKeywords.length > 0) {
          params.set('q', cpvKeywords.join(' OR '));
        }

        const res = await fetch(
          `https://diavgeia.gov.gr/luminapi/opendata/search?${params.toString()}`,
          {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(8000),
          }
        );

        if (res.ok) {
          const data = await res.json();
          if (data.decisions) {
            allResults.push(...data.decisions);
          }
        }
      } catch {
        // Continue with other search terms
      }
    }

    // Deduplicate by ADA
    const seen = new Set<string>();
    const filteredDecisions = allResults.filter(d => {
      if (!d.ada || seen.has(d.ada)) return false;
      seen.add(d.ada);
      // Must have meaningful subject
      const subject = (d.subject || '').toLowerCase();
      if (subject.length < 15) return false;
      // Exclude non-tender decisions that slip through
      const excludeTerms = [
        'εντολή πληρωμής', 'εντολη πληρωμης',
        'οριστικοποίηση πληρωμής', 'οριστικοποιηση πληρωμης',
        'χρηματικό ένταλμα', 'χρηματικο ενταλμα',
        'κήρυξης ως άγον', 'κηρυξης ως αγον',       // "Κήρυξη ως άγονος" = failed auction, not a tender
        'εκμίσθωση', 'εκμισθωση',                    // lease/rental, not procurement
        'κυλικείο', 'κυλικειο',                       // canteen lease
        'μίσθωση', 'μισθωση',                         // rental
        'απευθείας ανάθεση', 'απευθειας αναθεση',     // direct award (already decided)
        'έγκριση δαπάνης', 'εγκριση δαπανης',         // expense approval
        'ανάληψη υποχρέωσης', 'αναληψη υποχρεωσης',   // commitment
        'πρόσληψη', 'προσληψη',                       // hiring
        'αποδοχή παραίτησης', 'αποδοχη παραιτησης',   // resignation acceptance
      ];
      if (excludeTerms.some(term => subject.includes(term))) return false;

      // Must contain a tender-like keyword
      const tenderKeywords = [
        'διακήρυξη', 'διακηρυξη',
        'προκήρυξη', 'προκηρυξη',
        'διαγωνισμ', // covers διαγωνισμός, διαγωνισμού, etc.
        'πρόσκληση υποβολής', 'προσκληση υποβολης',
        'πρόσκληση εκδήλωσης', 'προσκληση εκδηλωσης',
        'δημοπρασί', // covers δημοπρασία, δημοπρασίας
        'σύμβαση', 'συμβαση',
        'προμήθεια', 'προμηθεια',
        'παροχή υπηρεσ', 'παροχη υπηρεσ',
        'έργο', 'εργο',
      ];
      if (!tenderKeywords.some(kw => subject.includes(kw))) return false;

      return true;
    });

    return filteredDecisions
      .slice(0, 15)
      .map((d: any) => {
        // Extract organization name from extraFieldValues.org or top-level fields
        const orgName =
          d.extraFieldValues?.org?.name ||
          d.organizationLabel ||
          d.unitLabel ||
          'Άγνωστος φορέας';

        // Extract budget from sponsor expenses
        const sponsors = d.extraFieldValues?.sponsor;
        let budget: number | undefined;
        if (Array.isArray(sponsors) && sponsors.length > 0) {
          const amount = sponsors[0]?.expenseAmount?.amount;
          if (amount) budget = parseFloat(amount);
        } else if (d.extraFieldValues?.amount?.amount) {
          budget = parseFloat(d.extraFieldValues.amount.amount);
        }

        // CPV codes
        const cpvRaw = d.extraFieldValues?.cpv;
        const cpvCodes = cpvRaw
          ? (Array.isArray(cpvRaw) ? cpvRaw : [cpvRaw])
          : [];

        return {
          title: d.subject || 'Χωρίς τίτλο',
          referenceNumber: d.ada || d.protocolNumber || '',
          contractingAuthority: orgName,
          platform: 'DIAVGEIA' as const,
          budget,
          submissionDeadline: undefined,
          cpvCodes,
          sourceUrl: `https://diavgeia.gov.gr/decision/view/${d.ada}`,
          summary: d.subject,
          publishedAt: d.issueDate ? new Date(d.issueDate) : new Date(),
          country: 'GR',
          sourceLabel: 'Διαύγεια',
          isPrivate: false,
        };
      });
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
    // TED API v3 — new endpoint as of 2025+
    // Country code is ISO 3166-1 alpha-3: GRC (not GR)
    // TD=3 = Contract notices
    let query = 'TD=3 AND CY=GRC';
    if (cpvCodes && cpvCodes.length > 0) {
      const cpvQuery = cpvCodes
        .slice(0, 5)
        .map((c) => `PC=${c.split('-')[0]}`)
        .join(' OR ');
      query += ` AND (${cpvQuery})`;
    }

    const res = await fetch(
      'https://api.ted.europa.eu/v3/notices/search',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query,
          limit: 20,
          page: 1,
          fields: ['notice-identifier', 'deadline-receipt-tender-date-lot'],
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[TED] API error: ${res.status}, body: ${body.slice(0, 200)}`);
      return [];
    }

    const data = await res.json();
    const notices = data.notices || [];

    return notices.slice(0, 15).map((n: any) => {
      const pubNumber = n['publication-number'] || '';
      const htmlLink = n.links?.html?.ELL || n.links?.html?.ENG
        || `https://ted.europa.eu/el/notice/-/detail/${pubNumber}`;
      const pdfLink = n.links?.pdf?.ELL || n.links?.pdf?.ENG || undefined;

      return {
        title: `TED ${pubNumber}`,
        referenceNumber: pubNumber,
        contractingAuthority: '',
        platform: 'TED' as const,
        budget: undefined,
        submissionDeadline: undefined,
        cpvCodes: [],
        sourceUrl: htmlLink,
        summary: pdfLink ? `PDF: ${pdfLink}` : undefined,
        publishedAt: new Date(),
        country: 'GR',
        sourceLabel: 'TED',
        isPrivate: false,
      };
    });
  } catch (err) {
    console.error('[TED] Fetch error:', err);
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
      signal: AbortSignal.timeout(8000),
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

// ─── Private Sector Discovery ────────────────────────────────

/**
 * Search for private sector tenders/procurement opportunities.
 * Searches Greek B2B marketplaces and business directories.
 */
async function searchPrivateSector(
  keywords: string[],
  kadCodes: string[],
): Promise<DiscoveredTender[]> {
  const results: DiscoveredTender[] = [];

  // Build search terms from KAD codes and keywords
  const searchTerms = [
    ...keywords,
    ...kadCodes.map(kad => `KAD ${kad}`),
  ].filter(Boolean);

  if (searchTerms.length === 0) return results;

  const query = searchTerms.slice(0, 5).join(' ');

  // ── Search b2b.gr ──────────────────────────────────────
  try {
    const response = await fetch(
      `https://www.b2b.gr/el/search?q=${encodeURIComponent(query + ' διαγωνισμός')}&type=tenders`,
      {
        headers: {
          'Accept': 'text/html',
          'Accept-Language': 'el,en;q=0.9',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (response.ok) {
      const html = await response.text();
      // Parse results using simple regex (cheerio not available here by default)
      const titleRegex = /<h[23][^>]*class="[^"]*title[^"]*"[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
      let match;
      while ((match = titleRegex.exec(html)) !== null && results.length < 10) {
        const href = match[1];
        const title = match[2].trim();
        if (title.length > 10) {
          results.push({
            title,
            referenceNumber: '',
            contractingAuthority: 'b2b.gr',
            source: 'b2b.gr (Ιδιωτικός Τομέας)',
            platform: 'PRIVATE',
            cpvCodes: [],
            sourceUrl: href.startsWith('http') ? href : `https://www.b2b.gr${href}`,
            publishedAt: new Date(),
            country: 'GR',
            sourceLabel: 'b2b.gr',
            isPrivate: true,
          });
        }
      }
    }
  } catch (err) {
    console.warn('[Discovery] b2b.gr search failed:', (err as Error).message);
  }

  // ── Search eprocurement.gr ─────────────────────────────
  try {
    const response = await fetch(
      `https://www.eprocurement.gr/search?q=${encodeURIComponent(query)}&category=private`,
      {
        headers: {
          'Accept': 'text/html',
          'Accept-Language': 'el,en;q=0.9',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (response.ok) {
      const html = await response.text();
      const titleRegex = /<a[^>]+href="([^"]+\/tender\/[^"]+)"[^>]*>([^<]{10,})<\/a>/gi;
      let match;
      while ((match = titleRegex.exec(html)) !== null && results.length < 15) {
        const href = match[1];
        const title = match[2].trim();
        results.push({
          title,
          referenceNumber: '',
          contractingAuthority: 'eprocurement.gr',
          source: 'eprocurement.gr (Ιδιωτικός Τομέας)',
          platform: 'PRIVATE',
          cpvCodes: [],
          sourceUrl: href.startsWith('http') ? href : `https://www.eprocurement.gr${href}`,
          publishedAt: new Date(),
          country: 'GR',
          sourceLabel: 'eprocurement.gr',
          isPrivate: true,
        });
      }
    }
  } catch (err) {
    console.warn('[Discovery] eprocurement.gr search failed:', (err as Error).message);
  }

  // ── Search ypodomes.com for infrastructure projects ────
  try {
    const response = await fetch(
      `https://www.ypodomes.com/search?q=${encodeURIComponent(query)}`,
      {
        headers: {
          'Accept': 'text/html',
          'Accept-Language': 'el',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (response.ok) {
      const html = await response.text();
      const titleRegex = /<a[^>]+href="([^"]+\/erga\/[^"]+)"[^>]*>([^<]{10,})<\/a>/gi;
      let match;
      while ((match = titleRegex.exec(html)) !== null && results.length < 20) {
        const href = match[1];
        const title = match[2].trim();
        results.push({
          title,
          referenceNumber: '',
          contractingAuthority: 'ypodomes.com',
          source: 'ypodomes.com (Ιδιωτικός Τομέας)',
          platform: 'PRIVATE',
          cpvCodes: [],
          sourceUrl: href.startsWith('http') ? href : `https://www.ypodomes.com${href}`,
          publishedAt: new Date(),
          country: 'GR',
          sourceLabel: 'ypodomes.com',
          isPrivate: true,
        });
      }
    }
  } catch (err) {
    console.warn('[Discovery] ypodomes.com search failed:', (err as Error).message);
  }

  return results;
}

// ─── Google Custom Search ────────────────────────────────────

/**
 * Searches for Greek procurement tenders via Google Custom Search API.
 * Requires GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID env vars.
 * Returns empty array if env vars are missing (graceful degradation).
 */
async function searchGoogleCustomSearch(
  keywords: string[],
  cpvCodes?: string[],
): Promise<DiscoveredTender[]> {
  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !engineId) {
    console.log('[Google] Missing GOOGLE_CUSTOM_SEARCH_API_KEY or GOOGLE_SEARCH_ENGINE_ID, skipping');
    return [];
  }

  try {
    // Build search query: combine keywords with Greek procurement terms
    const greekTerms = 'διαγωνισμός OR προκήρυξη OR διακήρυξη';
    const keywordPart = keywords.length > 0 ? keywords.slice(0, 5).join(' ') : '';
    const cpvPart = cpvCodes && cpvCodes.length > 0
      ? cpvCodes.slice(0, 3).map(c => `CPV ${c}`).join(' OR ')
      : '';

    const queryParts = [keywordPart, cpvPart, greekTerms].filter(Boolean);
    const query = queryParts.join(' ');

    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('cx', engineId);
    url.searchParams.set('q', query);
    url.searchParams.set('num', '10');

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error(`[Google] API error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const items = data.items || [];

    return items.slice(0, 10).map((item: any) => {
      const resultUrl = item.link || '';
      const platform = detectPlatformFromResultUrl(resultUrl);

      return {
        title: item.title || 'Google Result',
        referenceNumber: '',
        contractingAuthority: item.displayLink || '',
        platform,
        cpvCodes: [],
        sourceUrl: resultUrl,
        source: 'google',
        summary: item.snippet || undefined,
        publishedAt: new Date(),
        country: 'GR',
        sourceLabel: 'Google Search',
        isPrivate: false,
      };
    });
  } catch (err) {
    console.error('[Google] Search failed:', err);
    return [];
  }
}

/**
 * Detect the platform from a Google search result URL using known patterns.
 */
function detectPlatformFromResultUrl(url: string): DiscoveredTender['platform'] {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('diavgeia.gov.gr')) return 'DIAVGEIA';
    if (hostname.includes('ted.europa.eu')) return 'TED';
    if (hostname.includes('promitheus.gov.gr') || hostname.includes('eprocurement.gov.gr')) return 'KIMDIS';
    if (hostname.includes('esidis.gr')) return 'ESIDIS';
    if (
      hostname.includes('b2b.gr') ||
      hostname.includes('ypodomes.com') ||
      hostname.includes('eprocurement.gr')
    ) return 'PRIVATE';
  } catch {
    // Invalid URL
  }
  return 'GOOGLE';
}

// ─── Relevance Scoring ──────────────────────────────────────

/**
 * Score a tender's relevance against a list of company CPV codes.
 * Returns a score from 0–100.
 */
export function scoreTenderRelevance(
  tender: DiscoveredTender,
  companyCpvCodes: string[],
): number {
  let score = 0;
  const exactMatch = tender.cpvCodes.some(c => companyCpvCodes.includes(c));
  if (exactMatch) score += 40;
  const companyCategories = companyCpvCodes.map(c => c.slice(0, 2));
  const categoryMatch = tender.cpvCodes.some(c => companyCategories.includes(c.slice(0, 2)));
  if (categoryMatch && !exactMatch) score += 20;
  if (tender.submissionDeadline) {
    const daysLeft = Math.ceil((tender.submissionDeadline.getTime() - Date.now()) / 86400000);
    if (daysLeft >= 15) score += 15;
    else if (daysLeft >= 5) score += Math.round(15 * (daysLeft - 5) / 10);
  }
  return Math.min(100, score);
}

/** Internal overload that accepts a full CompanySearchProfile for richer scoring */
function scoreTenderRelevanceInternal(
  tender: DiscoveredTender,
  profile: CompanySearchProfile
): number {
  let score = 0;

  // CPV Match (0-50 points)
  const companyCpvCodes = kadToCpv(profile.kadCodes);
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

// ─── Private Source Scraper ──────────────────────────────────

async function scrapePrivateSource(source: { name: string; url: string; country: string }): Promise<DiscoveredTender[]> {
  try {
    const response = await fetch(source.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TenderCopilot/1.0)' },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return [];
    const html = await response.text();

    const results: DiscoveredTender[] = [];
    const linkRegex = /<a[^>]+href="([^"]*)"[^>]*>([^<]{5,200})<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null) {
      const [, href, text] = match;
      const lowerText = text.toLowerCase();
      if (
        lowerText.includes('διαγωνισμ') ||
        lowerText.includes('προμήθει') ||
        lowerText.includes('tender') ||
        lowerText.includes('rfp') ||
        lowerText.includes('rfq')
      ) {
        const fullUrl = href.startsWith('http') ? href : new URL(href, source.url).href;
        results.push({
          title: text.trim(),
          referenceNumber: '',
          contractingAuthority: source.name,
          platform: 'PRIVATE',
          cpvCodes: [],
          sourceUrl: fullUrl,
          publishedAt: new Date(),
          country: source.country,
          sourceLabel: source.name,
          isPrivate: true,
        });
      }
    }

    return results.slice(0, 10);
  } catch (err) {
    console.error(`[Discovery] Private source ${source.name} error:`, err);
    return [];
  }
}

// ─── Main Service ───────────────────────────────────────────

class TenderDiscoveryService {
  async searchTenders(params: TenderSearchParams = {}): Promise<DiscoveredTender[]> {
    const {
      cpvCodes, kadCodes, keywords, minBudget, maxBudget, platforms, showAll,
      country, entityType, relevanceOnly, tenantId,
    } = params;

    let effectiveCpvCodes = cpvCodes || [];
    if (kadCodes && kadCodes.length > 0) {
      const mappedCpv = kadToCpv(kadCodes);
      effectiveCpvCodes = Array.from(new Set([...effectiveCpvCodes, ...mappedCpv]));
    }

    // If showAll is true, skip CPV filtering so all tenders are returned
    const cpvFilter = showAll ? undefined : (effectiveCpvCodes.length > 0 ? effectiveCpvCodes : undefined);

    // Determine active platforms based on entityType filter
    let activePlatforms = platforms || ['DIAVGEIA', 'TED', 'KIMDIS', 'PRIVATE'];
    if (entityType === 'private') {
      activePlatforms = activePlatforms.filter(p => p === 'PRIVATE');
    } else if (entityType === 'public') {
      activePlatforms = activePlatforms.filter(p => p !== 'PRIVATE');
    }

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
    if (activePlatforms.includes('PRIVATE')) {
      fetchers.push(searchPrivateSector(keywords || [], kadCodes || []));
    }

    // Built-in private sources
    if (activePlatforms.includes('PRIVATE') || entityType === 'private' || entityType === 'all') {
      const activeSources = builtinPrivateSources.filter(s => s.active);
      for (const source of activeSources) {
        fetchers.push(scrapePrivateSource(source));
      }
    }

    // Google Custom Search
    if (activePlatforms.includes('GOOGLE')) {
      fetchers.push(searchGoogleCustomSearch(keywords || [], cpvFilter));
    }

    // Custom private sources from DB (tenant-specific)
    if (tenantId && (entityType === 'private' || entityType === 'all' || activePlatforms.includes('PRIVATE'))) {
      const customSources = await db.privateTenderSource.findMany({
        where: { tenantId, active: true },
      });
      for (const source of customSources) {
        fetchers.push(scrapePrivateSource(source));
      }
    }

    console.log(`[Discovery] Running ${fetchers.length} fetchers, platforms: ${activePlatforms.join(',')}`);
    const results = await Promise.allSettled(fetchers);
    let allTenders: DiscoveredTender[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        console.log(`[Discovery] Fetcher ${i} returned ${result.value.length} results`);
        allTenders.push(...result.value);
      } else {
        console.error(`[Discovery] Fetcher ${i} FAILED:`, result.reason?.message || result.reason);
      }
    }
    console.log(`[Discovery] Total before dedup: ${allTenders.length} tenders`);

    // ── Cross-platform deduplication ──────────────────────────
    // Same tender can appear in Diavgeia + TED + Google with different titles.
    // Deduplicate by: (1) exact sourceUrl, (2) referenceNumber, (3) fuzzy title match
    {
      const seen = new Map<string, number>(); // key → index in deduped array
      const deduped: DiscoveredTender[] = [];

      for (const tender of allTenders) {
        // Key 1: exact URL match
        const urlKey = tender.sourceUrl?.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').toLowerCase();
        if (urlKey && seen.has(`url:${urlKey}`)) {
          // Merge: keep the one with more data (higher relevanceScore or budget info)
          const existingIdx = seen.get(`url:${urlKey}`)!;
          deduped[existingIdx] = mergeTenders(deduped[existingIdx], tender);
          continue;
        }

        // Key 2: reference number match (if both have one)
        const refKey = tender.referenceNumber?.replace(/[\s\-\/\.]/g, '').toLowerCase();
        if (refKey && refKey.length > 3 && seen.has(`ref:${refKey}`)) {
          const existingIdx = seen.get(`ref:${refKey}`)!;
          deduped[existingIdx] = mergeTenders(deduped[existingIdx], tender);
          continue;
        }

        // Key 3: fuzzy title match — normalize and compare
        const titleKey = tender.title
          .toLowerCase()
          .replace(/[^a-zα-ωά-ώ0-9]/g, '')
          .slice(0, 60);
        if (titleKey.length > 20 && seen.has(`title:${titleKey}`)) {
          const existingIdx = seen.get(`title:${titleKey}`)!;
          deduped[existingIdx] = mergeTenders(deduped[existingIdx], tender);
          continue;
        }

        // Not a duplicate — add it
        const idx = deduped.length;
        deduped.push(tender);
        if (urlKey) seen.set(`url:${urlKey}`, idx);
        if (refKey && refKey.length > 3) seen.set(`ref:${refKey}`, idx);
        if (titleKey.length > 20) seen.set(`title:${titleKey}`, idx);
      }

      allTenders = deduped;
      console.log(`[Discovery] After dedup: ${allTenders.length} tenders`);
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

    const cpvCodes = kadToCpv(profile.kadCodes);

    const keywords = profile.description
      ? profile.description
          .split(/[\s,.\-;:()]+/)
          .filter((w) => w.length > 4)
          .filter((w) => !GREEK_STOP_WORDS.has(w.toLowerCase()))
          .slice(0, 10)
      : [];

    const tenders = await this.searchTenders({
      cpvCodes,
      kadCodes: profile.kadCodes,
      keywords: keywords.length > 0 ? keywords : undefined,
    });

    const scoredTenders = tenders
      .map((tender) => ({
        ...tender,
        relevanceScore: scoreTenderRelevanceInternal(tender, profile),
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    return scoredTenders;
  }
}

export const tenderDiscovery = new TenderDiscoveryService();
