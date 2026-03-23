/**
 * Tender Discovery Service
 * Finds real tenders from Greek & EU procurement platforms.
 *
 * Live sources:
 * - Διαύγεια (Diavgeia) OpenData API — procurement decisions
 * - TED (Tenders Electronic Daily) — EU-wide, expert search API v3
 * - ΚΗΜΔΗΣ OpenData REST API — contract notices with CPV filtering
 * - ΔΕΚΟ — ΔΕΗ, ΔΕΔΔΗΕ, ΑΔΜΗΕ, ΕΥΔΑΠ, ΕΥΑΘ, ΔΕΠΑ, ΟΣΕ, ΟΑΣΑ, Μετρό, ΕΡΤ, ΕΦΚΑ, Cosmote
 * - Ιδιωτικοί — contracts.gr, iSupplies, DDA, ΤΕΕ, Ελλάδα 2.0, promitheies.gr, Google
 */

import { db } from '@/lib/db';
import { kadToCpv } from '@/lib/kad-cpv-map';
import { TENDER_SOURCES, getSourceById, getDefaultEnabledSourceIds } from '@/data/tender-sources';

/** Safe date parser — returns fallback (now) if value is invalid */
function safeDate(value: unknown, fallback?: Date): Date {
  if (!value) return fallback ?? new Date();
  const d = new Date(String(value).split('+')[0]);
  return isNaN(d.getTime()) ? (fallback ?? new Date()) : d;
}

function safeDateOrUndefined(value: unknown): Date | undefined {
  if (!value) return undefined;
  const d = new Date(String(value).split('+')[0]);
  return isNaN(d.getTime()) ? undefined : d;
}

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
  sources?: string[];  // source IDs from TENDER_SOURCES registry
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
        'κήρυξης ως άγον', 'κηρυξης ως αγον',         // failed auction
        'εκμίσθωση', 'εκμισθωση',                      // lease/rental
        'κυλικείο', 'κυλικειο',                         // canteen lease
        'μίσθωση', 'μισθωση',                           // rental
        'απευθείας ανάθεση', 'απευθειας αναθεση',       // direct award (decided)
        'έγκριση δαπάνης', 'εγκριση δαπανης',           // expense approval
        'ανάληψη υποχρέωσης', 'αναληψη υποχρεωσης',     // commitment
        'πρόσληψη', 'προσληψη',                         // hiring
        'αποδοχή παραίτησης', 'αποδοχη παραιτησης',     // resignation
        // Job postings & appointments (NOT procurement tenders)
        'διορισμ',                                       // διορισμός, διορισμού
        'μετάταξη', 'μεταταξη',                          // staff transfer
        'μονίμου προσωπικού', 'μονιμου προσωπικου',      // permanent staff
        'μόνιμου προσωπικού', 'μονιμου προσωπικου',
        'πλήρωση θέσ', 'πληρωση θεσ',                   // filling job positions
        'κάλυψη θέσ', 'καλυψη θεσ',                     // covering positions
        'προκήρυξη θέσ', 'προκηρυξη θεσ',               // job posting
        'θέσης επικεφαλ', 'θεσης επικεφαλ',             // head of unit position
        'θέσης διευθυντ', 'θεσης διευθυντ',             // director position
        'θέσης προϊστ', 'θεσης προιστ',                 // supervisor position
        'επιλογή προϊστ', 'επιλογη προιστ',             // selecting supervisor
        'κατάταξη', 'καταταξη',                          // staff ranking
        'απόσπαση', 'αποσπαση',                          // secondment
        'τοποθέτηση', 'τοποθετηση',                      // staff placement
        'υπαλλήλ', 'υπαλληλ',                            // employee matters
      ];
      if (excludeTerms.some(term => subject.includes(term))) return false;

      // Must contain a procurement-specific keyword (not just any public decision)
      const tenderKeywords = [
        'διακήρυξη', 'διακηρυξη',
        'διαγωνισμ',                                 // διαγωνισμός/ού
        'πρόσκληση υποβολής', 'προσκληση υποβολης',
        'πρόσκληση εκδήλωσης', 'προσκληση εκδηλωσης',
        'δημοπρασί',                                 // δημοπρασία/ίας
        'προμήθεια', 'προμηθεια',
        'παροχή υπηρεσ', 'παροχη υπηρεσ',
        'δημόσι', 'δημοσι',                          // δημόσιος διαγωνισμός
        'ανοικτ',                                    // ανοικτός διαγωνισμός
        'σύμβαση προμήθει', 'συμβαση προμηθει',      // supply contract (not any contract)
        'σύμβαση παροχής', 'συμβαση παροχης',        // service contract
        'σύμβαση έργου', 'συμβαση εργου',            // works contract (not job contract)
        'cpv', 'CPV',                                // CPV codes = procurement
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
          publishedAt: safeDate(d.issueDate),
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
async function getLatestFromTED(cpvCodes?: string[], countryFilter: 'GR' | 'EU' = 'GR'): Promise<DiscoveredTender[]> {
  try {
    // TED API v3 — expert search syntax
    // buyer-country=GRC for Greek tenders, publication-date>=YYYYMMDD for recent
    // Fields are REQUIRED — use notice-title, publication-number, publication-date, deadline
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const dateStr = threeMonthsAgo.toISOString().slice(0, 10).replace(/-/g, '');

    let query = `publication-date>=${dateStr}`;
    if (countryFilter === 'GR') {
      query += ' and buyer-country=GRC';
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
          fields: [
            'notice-title',
            'publication-number',
            'publication-date',
            'deadline-receipt-tender-date-lot',
          ],
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

      // Extract title — notice-title is a dict of language codes
      const titleObj = n['notice-title'] || {};
      const title = titleObj['ELL'] || titleObj['ENG'] || Object.values(titleObj)[0] as string || `TED ${pubNumber}`;

      // Extract deadline — array of dates (format: "2026-05-05+03:00")
      const deadlineArr = n['deadline-receipt-tender-date-lot'];
      const deadline = Array.isArray(deadlineArr) && deadlineArr.length > 0
        ? safeDateOrUndefined(deadlineArr[0])
        : undefined;

      const pubDate = safeDate(n['publication-date']);

      return {
        title: typeof title === 'string' ? title.slice(0, 300) : `TED ${pubNumber}`,
        referenceNumber: pubNumber,
        contractingAuthority: '',
        platform: 'TED' as const,
        budget: undefined,
        submissionDeadline: deadline,
        cpvCodes: [],
        sourceUrl: htmlLink,
        summary: pdfLink ? `PDF: ${pdfLink}` : undefined,
        publishedAt: pubDate,
        country: countryFilter === 'GR' ? 'GR' : 'EU',
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
    // ΚΗΜΔΗΣ OpenData REST API — POST /khmdhs-opendata/notice
    // Docs: https://cerpp.eprocurement.gov.gr/khmdhs-opendata/help
    // Rate limit: 350 req/min
    const body: Record<string, any> = {};

    if (cpvCodes && cpvCodes.length > 0) {
      body.cpvCodes = cpvCodes.slice(0, 5).map(c => c.split('-')[0]);
    }

    const res = await fetch(
      'https://cerpp.eprocurement.gov.gr/khmdhs-opendata/notice?page=0',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) {
      console.error(`[KIMDIS] API error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const notices = data.content || data.notices || data.data || [];

    return notices.slice(0, 15).map((n: any) => {
      // Extract CPV codes from objectDetails[].cpvs[].key
      const cpvCodes: string[] = [];
      if (Array.isArray(n.objectDetails)) {
        for (const obj of n.objectDetails) {
          if (Array.isArray(obj.cpvs)) {
            for (const cpv of obj.cpvs) {
              if (cpv.key && !cpvCodes.includes(cpv.key)) cpvCodes.push(cpv.key);
            }
          }
        }
      }

      return {
        title: n.title || n.subject || 'ΚΗΜΔΗΣ Notice',
        referenceNumber: n.referenceNumber || '',
        contractingAuthority: n.organization?.value || '',
        platform: 'KIMDIS' as const,
        budget: n.totalCostWithoutVAT ?? n.totalCostWithVAT ?? undefined,
        submissionDeadline: safeDateOrUndefined(n.finalSubmissionDate),
        cpvCodes,
        sourceUrl: `https://cerpp.eprocurement.gov.gr/kimds2/unprotected/searchNotices.htm?noticeId=${n.referenceNumber || ''}`,
        summary: n.objectDetails?.[0]?.shortDescription || n.title || undefined,
        publishedAt: safeDate(n.submissionDate),
        country: 'GR',
        sourceLabel: 'ΚΗΜΔΗΣ',
        isPrivate: false,
      };
    });
  } catch (err) {
    console.error('[KIMDIS] Fetch error:', err);
    return [];
  }
}

// ─── ΔΕΚΟ / HTML Scraper ─────────────────────────────────────

/**
 * Generic HTML scraper for ΔΕΚΟ and other organizations.
 * Fetches the page, finds links with tender-related keywords.
 */
async function scrapeDEKOSource(source: { id: string; name: string; url: string }): Promise<DiscoveredTender[]> {
  try {
    // Try direct fetch first, fallback to Jina Reader for WAF-protected/slow sites
    let html = '';
    try {
      const response = await fetch(source.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'el,en;q=0.9',
        },
        signal: AbortSignal.timeout(12000),
      });
      if (response.ok) {
        html = await response.text();
      }
    } catch {
      // Direct fetch failed (timeout/blocked) — try Jina Reader
    }

    if (!html) {
      try {
        const jinaRes = await fetch(`https://r.jina.ai/${source.url}`, {
          headers: { 'Accept': 'text/html', 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(20000),
        });
        if (jinaRes.ok) {
          html = await jinaRes.text();
          console.log(`[DEKO] ${source.name}: Jina fallback succeeded`);
        }
      } catch {
        console.warn(`[DEKO] ${source.name}: both direct and Jina failed`);
        return [];
      }
    }

    if (!html) return [];

    const results: DiscoveredTender[] = [];
    const linkRegex = /<a[^>]+href="([^"]*)"[^>]*>([^<]{8,300})<\/a>/gi;
    let match: RegExpExecArray | null;

    const tenderKeywords = [
      'διαγωνισμ', 'προκήρυξ', 'προκηρυξ', 'διακήρυξ', 'διακηρυξ',
      'πρόσκληση', 'προσκληση', 'προμήθει', 'προμηθει',
      'δημοπρασ', 'tender', 'rfp', 'rfq', 'procurement',
      'σύμβαση', 'συμβαση', 'ανοικτ', 'ηλεκτρονικ',
    ];

    while ((match = linkRegex.exec(html)) !== null) {
      const [, href, text] = match;
      const lowerText = text.toLowerCase();
      if (tenderKeywords.some(kw => lowerText.includes(kw))) {
        const fullUrl = href.startsWith('http') ? href : new URL(href, source.url).href;
        if (results.length >= 15) break;
        results.push({
          title: text.trim().replace(/\s+/g, ' '),
          referenceNumber: '',
          contractingAuthority: source.name,
          platform: 'PRIVATE',
          cpvCodes: [],
          sourceUrl: fullUrl,
          publishedAt: new Date(),
          country: 'GR',
          sourceLabel: source.name,
          isPrivate: false,
        });
      }
    }

    return results;
  } catch (err) {
    console.warn(`[DEKO] ${source.name} scrape failed:`, (err as Error).message);
    return [];
  }
}

// ─── promitheies.gr Aggregator ───────────────────────────

async function scrapePromitheies(): Promise<DiscoveredTender[]> {
  try {
    const response = await fetch('https://www.promitheies.gr/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'el,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return [];
    const html = await response.text();

    const results: DiscoveredTender[] = [];
    const linkRegex = /<a[^>]+href="([^"]*)"[^>]*>([^<]{10,300})<\/a>/gi;
    let match: RegExpExecArray | null;

    const tenderKeywords = [
      'διαγωνισμ', 'προκήρυξ', 'διακήρυξ', 'πρόσκληση',
      'προμήθει', 'δημοπρασ', 'σύμβαση',
    ];

    while ((match = linkRegex.exec(html)) !== null && results.length < 15) {
      const [, href, text] = match;
      const lowerText = text.toLowerCase();
      if (tenderKeywords.some(kw => lowerText.includes(kw))) {
        const fullUrl = href.startsWith('http') ? href : `https://www.promitheies.gr${href}`;
        results.push({
          title: text.trim().replace(/\s+/g, ' '),
          referenceNumber: '',
          contractingAuthority: 'promitheies.gr',
          platform: 'PRIVATE',
          cpvCodes: [],
          sourceUrl: fullUrl,
          publishedAt: new Date(),
          country: 'GR',
          sourceLabel: 'promitheies.gr',
          isPrivate: false,
        });
      }
    }

    return results;
  } catch (err) {
    console.warn('[Discovery] promitheies.gr scrape failed:', (err as Error).message);
    return [];
  }
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
      const errorBody = await res.text().catch(() => '');
      console.error(`[Google] API error: ${res.status} - ${errorBody}`);
      // Common fixes:
      // 403 = Custom Search API not enabled, or API key restricted to wrong project
      // 429 = quota exceeded (100 queries/day free tier)
      // Go to console.cloud.google.com → APIs & Services → Enable "Custom Search API"
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

// ─── Main Service ───────────────────────────────────────────

class TenderDiscoveryService {
  async searchTenders(params: TenderSearchParams = {}): Promise<DiscoveredTender[]> {
    const {
      cpvCodes, kadCodes, keywords, minBudget, maxBudget, sources, showAll,
      tenantId,
    } = params;

    let effectiveCpvCodes = cpvCodes || [];
    if (kadCodes && kadCodes.length > 0) {
      const mappedCpv = kadToCpv(kadCodes);
      effectiveCpvCodes = Array.from(new Set([...effectiveCpvCodes, ...mappedCpv]));
    }

    // If showAll is true, skip CPV filtering so all tenders are returned
    const cpvFilter = showAll ? undefined : (effectiveCpvCodes.length > 0 ? effectiveCpvCodes : undefined);

    // Determine which source IDs to search
    const activeSourceIds = sources && sources.length > 0
      ? sources
      : getDefaultEnabledSourceIds();

    const fetchers: Promise<DiscoveredTender[]>[] = [];

    for (const sourceId of activeSourceIds) {
      const source = getSourceById(sourceId);
      if (!source) continue;

      switch (sourceId) {
        case 'kimdis':
          fetchers.push(getLatestFromKIMDIS(cpvFilter));
          break;
        case 'diavgeia':
          fetchers.push(getLatestFromDiavgeia(cpvFilter));
          break;
        case 'esidis':
          fetchers.push(scrapeDEKOSource({ id: source.id, name: source.name, url: source.url }));
          break;
        case 'ted_gr':
          fetchers.push(getLatestFromTED(cpvFilter, 'GR'));
          break;
        case 'ted_eu':
          fetchers.push(getLatestFromTED(cpvFilter, 'EU'));
          break;
        case 'google':
          fetchers.push(searchGoogleCustomSearch(keywords || [], cpvFilter));
          break;
        case 'promitheies':
          fetchers.push(scrapePromitheies());
          break;
        default:
          // All DEKO and private sources use the generic scraper
          if (source.category === 'deko' || source.category === 'private') {
            fetchers.push(scrapeDEKOSource({ id: source.id, name: source.name, url: source.url }));
          }
          break;
      }
    }

    // Custom private sources from DB (tenant-specific)
    if (tenantId) {
      const customSources = await db.privateTenderSource.findMany({
        where: { tenantId, active: true },
      });
      for (const source of customSources) {
        fetchers.push(scrapeDEKOSource({ id: source.id, name: source.name, url: source.url }));
      }
    }

    console.log(`[Discovery] Running ${fetchers.length} fetchers, sources: ${activeSourceIds.join(',')}`);
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

    // ── Filter out irrelevant tender types ──────────────────────
    // Exclude: job postings, auctions, real estate, personnel hiring, scholarships
    const IRRELEVANT_PATTERNS = [
      /πρόσληψη|προσλήψεις|πρόσληψ/i,
      /πλειστηριασμ/i,
      /ακίνητ|μίσθωση\s+ακινήτ/i,
      /θέσ[εη]\s+εργασίας|προκήρυξη\s+θέσ/i,
      /υποτροφ/i,
      /διορισμ/i,
      /επιλογή\s+προσωπικού/i,
      /σύμβαση\s+εργασίας/i,
      /ΑΣΕΠ|ΣΟΧ|ΣΜΕ/,
      /personnel|recruitment|hiring|job\s+post/i,
      /auction|foreclosure/i,
    ];

    allTenders = allTenders.filter((t) => {
      const text = `${t.title} ${t.summary || ''}`;
      return !IRRELEVANT_PATTERNS.some((pattern) => pattern.test(text));
    });

    // TED tenders: keep all — EU tenders are relevant for international bidding

    console.log(`[Discovery] After relevance filter: ${allTenders.length} tenders`);

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
      // No profile = return all tenders, limited to 30
      const tenders = await this.searchTenders();
      return tenders.slice(0, 30).map((t) => ({ ...t, relevanceScore: 0 }));
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
