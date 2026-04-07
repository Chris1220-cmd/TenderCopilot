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
import { getDefaultSourcesForCountries } from '@/lib/country-config';

// ─── Reliability: Circuit Breaker ──────────────────────────
// Track consecutive failures per source. After 3+ failures, skip source for cooldown period.

interface CircuitState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const circuitBreakers = new Map<string, CircuitState>();
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 5 * 60 * 1000; // 5 min cooldown

function checkCircuit(sourceId: string): boolean {
  const state = circuitBreakers.get(sourceId);
  if (!state || !state.isOpen) return true; // circuit closed, allow
  if (Date.now() - state.lastFailure > CIRCUIT_COOLDOWN_MS) {
    // Cooldown expired, half-open: allow one attempt
    state.isOpen = false;
    state.failures = 0;
    return true;
  }
  console.warn(`[CircuitBreaker] Source "${sourceId}" is open (${state.failures} failures), skipping`);
  return false;
}

function recordSuccess(sourceId: string): void {
  circuitBreakers.delete(sourceId);
}

function recordFailure(sourceId: string): void {
  const state = circuitBreakers.get(sourceId) || { failures: 0, lastFailure: 0, isOpen: false };
  state.failures++;
  state.lastFailure = Date.now();
  if (state.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    state.isOpen = true;
    console.warn(`[CircuitBreaker] Source "${sourceId}" tripped after ${state.failures} failures`);
  }
  circuitBreakers.set(sourceId, state);
}

// ─── Reliability: Fetch with Retry ─────────────────────────

async function fetchWithRetry(
  input: string | URL,
  init?: RequestInit & { signal?: AbortSignal },
  retries = 2,
  delayMs = 1000,
): Promise<Response> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(input, init);
      return res;
    } catch (err) {
      lastError = err as Error;
      if (attempt < retries) {
        const wait = delayMs * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }
  throw lastError;
}

/**
 * Normalize Greek text: lowercase + strip diacritics (accents).
 * Diavgeia returns ALL-CAPS without accents (ΑΚΙΝΗΤΟΥ),
 * but our filters use lowercase with accents (ακίνητ).
 * JS regex /i flag does NOT handle accent-insensitive matching.
 */
function normalizeGreek(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

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
  platform: 'KIMDIS' | 'DIAVGEIA' | 'TED' | 'ESIDIS' | 'PRIVATE' | 'GOOGLE' | 'EU_MEMBER';
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
  platforms?: Array<'KIMDIS' | 'DIAVGEIA' | 'TED' | 'ESIDIS' | 'OTHER' | 'PRIVATE' | 'GOOGLE' | 'EU_MEMBER'>;
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
          size: '50',
          page: '0',
        });

        // Add CPV as additional query if available
        if (cpvKeywords.length > 0) {
          params.set('q', cpvKeywords.join(' OR '));
        }

        const res = await fetchWithRetry(
          `https://diavgeia.gov.gr/luminapi/opendata/search?${params.toString()}`,
          {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(8000),
          },
          1
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
      const subject = normalizeGreek(d.subject || '');
      if (subject.length < 15) return false;
      // Exclude non-tender decisions that slip through
      // All terms are accent-free (normalized) since we use normalizeGreek()
      const excludeTerms = [
        'εντολη πληρωμης',
        'οριστικοποιηση πληρωμης',
        'χρηματικο ενταλμα',
        'κηρυξης ως αγον',                              // failed auction
        'εκμισθωση',                                     // lease/rental
        'κυλικειο',                                      // canteen lease
        'μισθωση ακινητ',                                // property rental
        'απευθειας αναθεση',                             // direct award (decided)
        'εγκριση δαπανης',                               // expense approval
        'αναληψη υποχρεωσης',                            // commitment
        'προσληψη',                                      // hiring
        'αποδοχη παραιτησης',                            // resignation
        'ελεγχος δηλωσης',                               // administrative check
        'οψιγενων μεταβολων',                            // late-change check
        // Property auctions (NOT procurement)
        'δημοπρασια ακινητ',                             // property auction
        'δημοπρασιας ακινητ',                            // property auction genitive
        'ακινητου',                                      // immovable property
        'ακινητων',                                      // properties
        'αγροτεμαχ',                                     // agricultural plots
        'οικοπεδ',                                       // building plots
        // Job postings & appointments (NOT procurement tenders)
        'διορισμ',                                       // appointments
        'μεταταξη',                                      // staff transfer
        'μονιμου προσωπικου',                             // permanent staff
        'πληρωση θεσ',                                   // filling job positions
        'καλυψη θεσ',                                    // covering positions
        'προκηρυξη θεσ',                                 // job posting
        'θεσης επικεφαλ',                                // head of unit position
        'θεσης διευθυντ',                                // director position
        'θεσης προιστ',                                  // supervisor position
        'επιλογη προιστ',                                // selecting supervisor
        'καταταξη',                                      // staff ranking
        'αποσπαση',                                      // secondment
        'τοποθετηση',                                    // staff placement
        'υπαλληλ',                                       // employee matters
      ];
      if (excludeTerms.some(term => subject.includes(term))) return false;

      // Must contain a procurement-specific keyword (not just any public decision)
      // All terms are accent-free (normalized) since we use normalizeGreek()
      const tenderKeywords = [
        'διακηρυξη',
        'διαγωνισμ',                                 // διαγωνισμός/ού
        'προσκληση υποβολης',
        'προσκληση εκδηλωσης',
        'προμηθεια',
        'παροχη υπηρεσ',
        'δημοσιος διαγωνισμ',                        // public tender (specific, not just δημόσι)
        'ανοικτος διαγωνισμ',                        // open tender (specific)
        'συμβαση προμηθει',                          // supply contract
        'συμβαση παροχης',                           // service contract
        'συμβαση εργου',                             // works contract
        'cpv',                                       // CPV codes = procurement
      ];
      if (!tenderKeywords.some(kw => subject.includes(kw))) return false;

      // Extra guard: "δημοπρασία" alone (no "ακινήτ" nearby) = OK, but
      // property auctions already caught by excludeTerms above

      return true;
    });

    return filteredDecisions
      .slice(0, 50)
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
          limit: 50,
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

    return notices.slice(0, 50).map((n: any) => {
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

    const res = await fetchWithRetry(
      'https://cerpp.eprocurement.gov.gr/khmdhs-opendata/notice?page=0',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      },
      1
    );

    if (!res.ok) {
      console.error(`[KIMDIS] API error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const notices = data.content || data.notices || data.data || [];

    return notices.slice(0, 50).map((n: any) => {
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
        if (results.length >= 50) break;
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
    let html = '';

    // Try direct fetch first
    try {
      const response = await fetchWithRetry('https://www.promitheies.gr/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'el,en;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
      }, 1);
      if (response.ok) html = await response.text();
    } catch {
      // Direct fetch failed — try Jina Reader
    }

    // Jina fallback for JS-rendered content
    if (!html) {
      try {
        const jinaRes = await fetch(`https://r.jina.ai/https://www.promitheies.gr/`, {
          headers: { 'Accept': 'text/html', 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(20000),
        });
        if (jinaRes.ok) {
          html = await jinaRes.text();
          console.log('[Discovery] promitheies.gr: Jina fallback succeeded');
        }
      } catch {
        console.warn('[Discovery] promitheies.gr: both direct and Jina failed');
        return [];
      }
    }

    if (!html) return [];

    const results: DiscoveredTender[] = [];
    const linkRegex = /<a[^>]+href="([^"]*)"[^>]*>([^<]{10,300})<\/a>/gi;
    let match: RegExpExecArray | null;

    const tenderKeywords = [
      'διαγωνισμ', 'προκήρυξ', 'διακήρυξ', 'πρόσκληση',
      'προμήθει', 'δημοπρασ', 'σύμβαση',
    ];

    while ((match = linkRegex.exec(html)) !== null && results.length < 50) {
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

// ─── EU Member State APIs ────────────────────────────────────

/**
 * BOAMP (France) — Bulletin Officiel des Annonces des Marchés Publics
 * OpenDataSoft API, no auth required.
 * Docs: https://boamp-datadila.opendatasoft.com/explore/dataset/boamp/api/
 */
async function getLatestFromBOAMP(cpvCodes?: string[]): Promise<DiscoveredTender[]> {
  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const dateStr = threeMonthsAgo.toISOString().slice(0, 10);

    let where = `datepublication >= '${dateStr}' AND nature IN ('APPEL_OFFRE', 'MARCHE')`;
    if (cpvCodes && cpvCodes.length > 0) {
      const cpvFilter = cpvCodes.slice(0, 3).map(c => `codecpv LIKE '${c.split('-')[0]}%'`).join(' OR ');
      where += ` AND (${cpvFilter})`;
    }

    const params = new URLSearchParams({
      rows: '50',
      sort: '-datepublication',
      where,
    });

    const res = await fetch(
      `https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/records?${params}`,
      { signal: AbortSignal.timeout(12000) }
    );

    if (!res.ok) {
      console.error(`[BOAMP] API error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const records = data.results || [];

    return records
      .filter((r: any) => r.idweb) // Skip tenders without detail URL — homepage scraping is useless
      .slice(0, 50)
      .map((r: any) => ({
        title: r.objet || r.intitule || 'BOAMP Notice',
        referenceNumber: r.idweb || r.reference || '',
        contractingAuthority: r.nomacheteur || r.denomination || '',
        platform: 'EU_MEMBER' as const,
        budget: r.montant ? parseFloat(r.montant) : undefined,
        submissionDeadline: safeDateOrUndefined(r.datelimitereponse),
        cpvCodes: r.codecpv ? [r.codecpv] : [],
        sourceUrl: `https://www.boamp.fr/avis/detail/${r.idweb}`,
        summary: r.descriptif || r.objet || undefined,
        publishedAt: safeDate(r.datepublication),
        country: 'FR',
        sourceLabel: 'BOAMP (France)',
        isPrivate: false,
      }));
  } catch (err) {
    console.error('[BOAMP] Fetch error:', err);
    return [];
  }
}

/**
 * ANAC (Italy) — Uses TED API filtered by buyer-country=ITA.
 * ANAC's own data portal only offers bulk yearly JSON files (500MB+),
 * so we use TED which indexes all Italian above-threshold tenders.
 */
async function getLatestFromANAC(cpvCodes?: string[]): Promise<DiscoveredTender[]> {
  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const dateStr = threeMonthsAgo.toISOString().slice(0, 10).replace(/-/g, '');

    let query = `publication-date>=${dateStr} and buyer-country=ITA`;
    if (cpvCodes && cpvCodes.length > 0) {
      const cpvQ = cpvCodes.slice(0, 3).map(c => `cpv=${c.split('-')[0]}*`).join(' or ');
      query += ` and (${cpvQ})`;
    }

    const res = await fetch('https://api.ted.europa.eu/v3/notices/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        query,
        limit: 50,
        page: 1,
        fields: ['notice-title', 'publication-number', 'publication-date', 'deadline-receipt-tender-date-lot'],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error(`[ANAC] TED-ITA API error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const notices = data.notices || [];

    return notices.slice(0, 50).map((n: any) => {
      const pubNumber = n['publication-number'] || '';
      const titleObj = n['notice-title'] || {};
      const title = titleObj['ITA'] || titleObj['ENG'] || Object.values(titleObj)[0] as string || `TED-IT ${pubNumber}`;
      const deadlineArr = n['deadline-receipt-tender-date-lot'];
      const deadline = Array.isArray(deadlineArr) && deadlineArr.length > 0
        ? safeDateOrUndefined(deadlineArr[0])
        : undefined;

      return {
        title: typeof title === 'string' ? title.slice(0, 300) : `TED-IT ${pubNumber}`,
        referenceNumber: pubNumber,
        contractingAuthority: '',
        platform: 'EU_MEMBER' as const,
        budget: undefined,
        submissionDeadline: deadline,
        cpvCodes: [],
        sourceUrl: `https://ted.europa.eu/en/notice/-/detail/${pubNumber}`,
        summary: undefined,
        publishedAt: safeDate(n['publication-date']),
        country: 'IT',
        sourceLabel: 'ANAC (Italy via TED)',
        isPrivate: false,
      };
    });
  } catch (err) {
    console.error('[ANAC] Fetch error:', err);
    return [];
  }
}

/**
 * Find a Tender (UK) — OCDS REST API
 * No auth required. Post-Brexit UK procurement.
 * Docs: https://www.find-tender.service.gov.uk/Developer/Documentation
 */
async function getLatestFromFTS(cpvCodes?: string[]): Promise<DiscoveredTender[]> {
  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const dateStr = threeMonthsAgo.toISOString().slice(0, 10);

    const params = new URLSearchParams({
      'publishedFrom': dateStr,
      'publishedTo': new Date().toISOString().slice(0, 10),
      'size': '20',
      'sort': 'publishedDate:desc',
    });

    if (cpvCodes && cpvCodes.length > 0) {
      params.set('cpvCodes', cpvCodes.slice(0, 5).map(c => c.split('-')[0]).join(','));
    }

    const res = await fetch(
      `https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?${params}`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(12000),
      }
    );

    if (!res.ok) {
      console.error(`[FTS-UK] API error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const releases = data.releases || [];

    return releases.slice(0, 50).map((r: any) => {
      const tender = r.tender || {};
      const buyer = r.buyer || {};

      return {
        title: tender.title || tender.description || 'UK Tender',
        referenceNumber: r.ocid || tender.id || '',
        contractingAuthority: buyer.name || '',
        platform: 'EU_MEMBER' as const,
        budget: tender.value?.amount ?? undefined,
        submissionDeadline: safeDateOrUndefined(tender.tenderPeriod?.endDate),
        cpvCodes: tender.items?.flatMap((i: any) => i.classification?.id ? [i.classification.id] : []) || [],
        sourceUrl: r.ocid
          ? `https://www.find-tender.service.gov.uk/Notice/${r.ocid.split('-').pop()}`
          : 'https://www.find-tender.service.gov.uk/',
        summary: tender.description || undefined,
        publishedAt: safeDate(r.date || r.publishedDate),
        country: 'GB',
        sourceLabel: 'Find a Tender (UK)',
        isPrivate: false,
      };
    });
  } catch (err) {
    console.error('[FTS-UK] Fetch error:', err);
    return [];
  }
}

/**
 * e-Zamówienia (Poland) — Uses TED API filtered by buyer-country=POL.
 * The native e-Zamówienia API is an internal endpoint that may require auth.
 */
async function getLatestFromEZamowienia(cpvCodes?: string[]): Promise<DiscoveredTender[]> {
  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const dateStr = threeMonthsAgo.toISOString().slice(0, 10).replace(/-/g, '');

    let query = `publication-date>=${dateStr} and buyer-country=POL`;
    if (cpvCodes && cpvCodes.length > 0) {
      const cpvQ = cpvCodes.slice(0, 3).map(c => `cpv=${c.split('-')[0]}*`).join(' or ');
      query += ` and (${cpvQ})`;
    }

    const res = await fetch('https://api.ted.europa.eu/v3/notices/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, limit: 50, page: 1, fields: ['notice-title', 'publication-number', 'publication-date', 'deadline-receipt-tender-date-lot'] }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) { console.error(`[eZam] TED-POL API error: ${res.status}`); return []; }

    const data = await res.json();
    const notices = data.notices || [];

    return notices.slice(0, 50).map((n: any) => {
      const pubNumber = n['publication-number'] || '';
      const titleObj = n['notice-title'] || {};
      const title = titleObj['POL'] || titleObj['ENG'] || Object.values(titleObj)[0] as string || `TED-PL ${pubNumber}`;
      const deadlineArr = n['deadline-receipt-tender-date-lot'];
      const deadline = Array.isArray(deadlineArr) && deadlineArr.length > 0 ? safeDateOrUndefined(deadlineArr[0]) : undefined;

      return {
        title: typeof title === 'string' ? title.slice(0, 300) : `TED-PL ${pubNumber}`,
        referenceNumber: pubNumber,
        contractingAuthority: '',
        platform: 'EU_MEMBER' as const,
        budget: undefined,
        submissionDeadline: deadline,
        cpvCodes: [],
        sourceUrl: `https://ted.europa.eu/en/notice/-/detail/${pubNumber}`,
        summary: undefined,
        publishedAt: safeDate(n['publication-date']),
        country: 'PL',
        sourceLabel: 'e-Zamówienia (Poland via TED)',
        isPrivate: false,
      };
    });
  } catch (err) {
    console.error('[eZam] Fetch error:', err);
    return [];
  }
}

/**
 * TenderNed (Netherlands) — Uses TED API filtered by buyer-country=NLD.
 * TenderNed's own API requires account credentials.
 */
async function getLatestFromTenderNed(cpvCodes?: string[]): Promise<DiscoveredTender[]> {
  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const dateStr = threeMonthsAgo.toISOString().slice(0, 10).replace(/-/g, '');

    let query = `publication-date>=${dateStr} and buyer-country=NLD`;
    if (cpvCodes && cpvCodes.length > 0) {
      const cpvQ = cpvCodes.slice(0, 3).map(c => `cpv=${c.split('-')[0]}*`).join(' or ');
      query += ` and (${cpvQ})`;
    }

    const res = await fetch('https://api.ted.europa.eu/v3/notices/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, limit: 50, page: 1, fields: ['notice-title', 'publication-number', 'publication-date', 'deadline-receipt-tender-date-lot'] }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) { console.error(`[TenderNed] TED-NLD API error: ${res.status}`); return []; }

    const data = await res.json();
    const notices = data.notices || [];

    return notices.slice(0, 50).map((n: any) => {
      const pubNumber = n['publication-number'] || '';
      const titleObj = n['notice-title'] || {};
      const title = titleObj['NLD'] || titleObj['ENG'] || Object.values(titleObj)[0] as string || `TED-NL ${pubNumber}`;
      const deadlineArr = n['deadline-receipt-tender-date-lot'];
      const deadline = Array.isArray(deadlineArr) && deadlineArr.length > 0 ? safeDateOrUndefined(deadlineArr[0]) : undefined;

      return {
        title: typeof title === 'string' ? title.slice(0, 300) : `TED-NL ${pubNumber}`,
        referenceNumber: pubNumber,
        contractingAuthority: '',
        platform: 'EU_MEMBER' as const,
        budget: undefined,
        submissionDeadline: deadline,
        cpvCodes: [],
        sourceUrl: `https://ted.europa.eu/en/notice/-/detail/${pubNumber}`,
        summary: undefined,
        publishedAt: safeDate(n['publication-date']),
        country: 'NL',
        sourceLabel: 'TenderNed (Netherlands via TED)',
        isPrivate: false,
      };
    });
  } catch (err) {
    console.error('[TenderNed] Fetch error:', err);
    return [];
  }
}

/**
 * ProZorro (Ukraine) — Uses TED API filtered by buyer-country=UKR.
 * ProZorro's own list endpoint only returns id+dateModified (no titles/budgets),
 * so we use TED which indexes Ukrainian above-threshold tenders.
 */
async function getLatestFromProZorro(cpvCodes?: string[]): Promise<DiscoveredTender[]> {
  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const dateStr = threeMonthsAgo.toISOString().slice(0, 10).replace(/-/g, '');

    let query = `publication-date>=${dateStr} and buyer-country=UKR`;
    if (cpvCodes && cpvCodes.length > 0) {
      const cpvQ = cpvCodes.slice(0, 3).map(c => `cpv=${c.split('-')[0]}*`).join(' or ');
      query += ` and (${cpvQ})`;
    }

    const res = await fetch('https://api.ted.europa.eu/v3/notices/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        query,
        limit: 50,
        page: 1,
        fields: ['notice-title', 'publication-number', 'publication-date', 'deadline-receipt-tender-date-lot'],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error(`[ProZorro] TED-UKR API error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const notices = data.notices || [];

    return notices.slice(0, 50).map((n: any) => {
      const pubNumber = n['publication-number'] || '';
      const titleObj = n['notice-title'] || {};
      const title = titleObj['UKR'] || titleObj['ENG'] || Object.values(titleObj)[0] as string || `TED-UA ${pubNumber}`;
      const deadlineArr = n['deadline-receipt-tender-date-lot'];
      const deadline = Array.isArray(deadlineArr) && deadlineArr.length > 0
        ? safeDateOrUndefined(deadlineArr[0])
        : undefined;

      return {
        title: typeof title === 'string' ? title.slice(0, 300) : `TED-UA ${pubNumber}`,
        referenceNumber: pubNumber,
        contractingAuthority: '',
        platform: 'EU_MEMBER' as const,
        budget: undefined,
        submissionDeadline: deadline,
        cpvCodes: [],
        sourceUrl: `https://ted.europa.eu/en/notice/-/detail/${pubNumber}`,
        summary: undefined,
        publishedAt: safeDate(n['publication-date']),
        country: 'UA',
        sourceLabel: 'ProZorro (Ukraine via TED)',
        isPrivate: false,
      };
    });
  } catch (err) {
    console.error('[ProZorro] Fetch error:', err);
    return [];
  }
}

// ─── TED API by country code ────────────────────────────────
// Generic function for any country via TED API — replaces unreliable HTML scrapers
// for DE, FI, CH, CZ, PT, SE and others

const COUNTRY_TO_TED: Record<string, { code: string; lang: string; label: string }> = {
  DE: { code: 'DEU', lang: 'DEU', label: 'Bund.de (Germany via TED)' },
  FI: { code: 'FIN', lang: 'FIN', label: 'Hilma (Finland via TED)' },
  CH: { code: 'CHE', lang: 'FRA', label: 'simap.ch (Switzerland via TED)' },
  CZ: { code: 'CZE', lang: 'CES', label: 'Věstník (Czech Rep via TED)' },
  PT: { code: 'PRT', lang: 'POR', label: 'BASE.gov (Portugal via TED)' },
  SE: { code: 'SWE', lang: 'SWE', label: 'Mercell (Sweden via TED)' },
};

async function getLatestFromTEDByCountry(
  countryISO: string,
  cpvCodes?: string[],
): Promise<DiscoveredTender[]> {
  const mapping = COUNTRY_TO_TED[countryISO];
  if (!mapping) return [];

  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const dateStr = threeMonthsAgo.toISOString().slice(0, 10).replace(/-/g, '');

    let query = `publication-date>=${dateStr} and buyer-country=${mapping.code}`;
    if (cpvCodes && cpvCodes.length > 0) {
      const cpvQ = cpvCodes.slice(0, 3).map(c => `cpv=${c.split('-')[0]}*`).join(' or ');
      query += ` and (${cpvQ})`;
    }

    const res = await fetchWithRetry('https://api.ted.europa.eu/v3/notices/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        query,
        limit: 50,
        page: 1,
        fields: ['notice-title', 'publication-number', 'publication-date', 'deadline-receipt-tender-date-lot'],
      }),
      signal: AbortSignal.timeout(15000),
    }, 1);

    if (!res.ok) {
      console.error(`[TED-${countryISO}] API error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const notices = data.notices || [];

    return notices.slice(0, 50).map((n: any) => {
      const pubNumber = n['publication-number'] || '';
      const titleObj = n['notice-title'] || {};
      const title = titleObj[mapping.lang] || titleObj['ENG'] || Object.values(titleObj)[0] as string || `TED-${countryISO} ${pubNumber}`;
      const deadlineArr = n['deadline-receipt-tender-date-lot'];
      const deadline = Array.isArray(deadlineArr) && deadlineArr.length > 0
        ? safeDateOrUndefined(deadlineArr[0])
        : undefined;

      return {
        title: typeof title === 'string' ? title.slice(0, 300) : `TED-${countryISO} ${pubNumber}`,
        referenceNumber: pubNumber,
        contractingAuthority: '',
        platform: 'EU_MEMBER' as const,
        budget: undefined,
        submissionDeadline: deadline,
        cpvCodes: [],
        sourceUrl: `https://ted.europa.eu/en/notice/-/detail/${pubNumber}`,
        summary: undefined,
        publishedAt: safeDate(n['publication-date']),
        country: countryISO,
        sourceLabel: mapping.label,
        isPrivate: false,
      };
    });
  } catch (err) {
    console.error(`[TED-${countryISO}] Fetch error:`, err);
    return [];
  }
}

// ─── EU Scraping Sources (fallback for sources not on TED) ──

/** Multilingual tender keywords for EU scraping */
const EU_TENDER_KEYWORDS = [
  // English
  'tender', 'procurement', 'rfp', 'rfq', 'contract notice', 'call for',
  // French
  'appel d\'offres', 'marché public', 'avis de marché',
  // German
  'ausschreibung', 'vergabe', 'öffentliche', 'bekanntmachung',
  // Italian
  'gara', 'appalto', 'bando',
  // Spanish
  'licitación', 'contratación', 'concurso',
  // Portuguese
  'concurso público', 'contratação',
  // Swedish/Nordic
  'upphandling', 'anbud',
  // Czech
  'zakázka', 'veřejná',
  // Dutch
  'aanbesteding', 'opdracht',
];

/**
 * Generic EU page scraper — uses multilingual keywords.
 * Reuses the same pattern as scrapeDEKOSource but with EU tender terms.
 */
async function scrapeEUSource(source: { id: string; name: string; url: string; country: string }): Promise<DiscoveredTender[]> {
  try {
    let html = '';
    try {
      const response = await fetch(source.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en,fr,de,es,it,nl,pt,sv,cs;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
      });
      if (response.ok) {
        html = await response.text();
      }
    } catch {
      // Direct fetch failed — try Jina Reader
    }

    if (!html) {
      try {
        const jinaRes = await fetch(`https://r.jina.ai/${source.url}`, {
          headers: { 'Accept': 'text/html', 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(20000),
        });
        if (jinaRes.ok) {
          html = await jinaRes.text();
          console.log(`[EU-Scrape] ${source.name}: Jina fallback succeeded`);
        }
      } catch {
        console.warn(`[EU-Scrape] ${source.name}: both direct and Jina failed`);
        return [];
      }
    }

    if (!html) return [];

    const results: DiscoveredTender[] = [];
    const linkRegex = /<a[^>]+href="([^"]*)"[^>]*>([^<]{8,300})<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null) {
      const [, href, text] = match;
      const lowerText = text.toLowerCase();
      if (EU_TENDER_KEYWORDS.some(kw => lowerText.includes(kw))) {
        const fullUrl = href.startsWith('http') ? href : new URL(href, source.url).href;
        if (results.length >= 50) break;
        results.push({
          title: text.trim().replace(/\s+/g, ' '),
          referenceNumber: '',
          contractingAuthority: source.name,
          platform: 'EU_MEMBER',
          cpvCodes: [],
          sourceUrl: fullUrl,
          publishedAt: new Date(),
          country: source.country,
          sourceLabel: source.name,
          isPrivate: false,
        });
      }
    }

    return results;
  } catch (err) {
    console.warn(`[EU-Scrape] ${source.name} scrape failed:`, (err as Error).message);
    return [];
  }
}

/**
 * PLACSP (Spain) — Atom/RSS feed for public procurement
 * Parses the Atom feed for recent contract notices.
 */
async function getLatestFromPLACSP(): Promise<DiscoveredTender[]> {
  try {
    const res = await fetch(
      'https://contrataciondelestado.es/sindicacion/sindicacion_1143/licitacionesPerique.atom',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/atom+xml, application/xml, text/xml',
        },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!res.ok) {
      console.error(`[PLACSP] Feed error: ${res.status}`);
      return [];
    }

    const xml = await res.text();
    const results: DiscoveredTender[] = [];

    // Parse Atom entries from XML
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    let entryMatch: RegExpExecArray | null;

    while ((entryMatch = entryRegex.exec(xml)) !== null && results.length < 50) {
      const entry = entryMatch[1];
      const title = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.trim() || '';
      const link = entry.match(/<link[^>]+href="([^"]+)"/)?.[1] || '';
      const updated = entry.match(/<updated>([\s\S]*?)<\/updated>/)?.[1]?.trim();
      const summary = entry.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1]?.trim() || '';

      if (title) {
        results.push({
          title: title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]+>/g, ''),
          referenceNumber: '',
          contractingAuthority: '',
          platform: 'EU_MEMBER',
          cpvCodes: [],
          sourceUrl: link || 'https://contrataciondelestado.es/',
          summary: summary.replace(/<[^>]+>/g, '').slice(0, 300) || undefined,
          publishedAt: safeDate(updated),
          country: 'ES',
          sourceLabel: 'PLACSP (Spain)',
          isPrivate: false,
        });
      }
    }

    return results;
  } catch (err) {
    console.error('[PLACSP] Fetch error:', err);
    return [];
  }
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
    let fallbackSourceIds: string[] | undefined;
    if (tenantId) {
      const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { countries: true } });
      if (tenant?.countries?.length) {
        fallbackSourceIds = getDefaultSourcesForCountries(tenant.countries);
      }
    }
    const activeSourceIds = sources && sources.length > 0
      ? sources
      : fallbackSourceIds && fallbackSourceIds.length > 0
        ? fallbackSourceIds
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
          // ΕΣΗΔΗΣ portal is JS-heavy; use ΚΗΜΔΗΣ API which indexes the same tenders
          fetchers.push(getLatestFromKIMDIS(cpvFilter));
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
        // ── EU Member State APIs ──
        case 'boamp':
          fetchers.push(getLatestFromBOAMP(cpvFilter));
          break;
        case 'anac':
          fetchers.push(getLatestFromANAC(cpvFilter));
          break;
        case 'fts_uk':
          fetchers.push(getLatestFromFTS(cpvFilter));
          break;
        case 'ezamowienia':
          fetchers.push(getLatestFromEZamowienia(cpvFilter));
          break;
        case 'tenderned':
          fetchers.push(getLatestFromTenderNed(cpvFilter));
          break;
        case 'prozorro':
          fetchers.push(getLatestFromProZorro(cpvFilter));
          break;
        // ── EU Scraping sources ──
        case 'placsp':
          fetchers.push(getLatestFromPLACSP());
          break;
        case 'bund_de':
        case 'hilma':
        case 'simap_ch':
        case 'vestnik_cz':
        case 'base_pt':
        case 'mercell':
          // Use TED API instead of unreliable HTML scraping for these countries
          fetchers.push(getLatestFromTEDByCountry(source.country, cpvFilter));
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

    // Filter out sources with open circuit breakers
    const activeFetchers: Array<{ sourceId: string; fetcher: Promise<DiscoveredTender[]> }> = [];
    let fetcherIdx = 0;
    for (const sourceId of activeSourceIds) {
      if (!checkCircuit(sourceId)) {
        fetcherIdx++;
        continue;
      }
      if (fetcherIdx < fetchers.length) {
        activeFetchers.push({ sourceId, fetcher: fetchers[fetcherIdx] });
      }
      fetcherIdx++;
    }

    console.log(`[Discovery] Running ${activeFetchers.length} fetchers (${fetchers.length - activeFetchers.length} circuit-broken), sources: ${activeSourceIds.join(',')}`);
    const results = await Promise.allSettled(activeFetchers.map(f => f.fetcher));
    let allTenders: DiscoveredTender[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const sourceId = activeFetchers[i]?.sourceId || `unknown-${i}`;
      if (result.status === 'fulfilled') {
        console.log(`[Discovery] ${sourceId} returned ${result.value.length} results`);
        if (result.value.length > 0) recordSuccess(sourceId);
        allTenders.push(...result.value);
      } else {
        console.error(`[Discovery] ${sourceId} FAILED:`, result.reason?.message || result.reason);
        recordFailure(sourceId);
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
    // Multilingual patterns for all EU sources
    // Greek patterns use accent-free text (we normalize before matching)
    const IRRELEVANT_GREEK_TERMS = [
      'προσληψη', 'προσληψεις',                         // hiring
      'πλειστηριασμ',                                    // forced auction
      'ακινητο', 'ακινητου', 'ακινητων',                 // real estate / property
      'μισθωση ακινητ',                                  // property rental
      'δημοπρασια ακινητ', 'δημοπρασιας ακινητ',         // property auction
      'αγροτεμαχ', 'οικοπεδ',                            // agricultural/building plots
      'θεση εργασιας', 'θεσεις εργασιας',                // job positions
      'προκηρυξη θεσ',                                   // job posting
      'υποτροφ',                                         // scholarship
      'διορισμ',                                         // appointment
      'επιλογη προσωπικου',                              // personnel selection
      'συμβαση εργασιας',                                // employment contract
      'ασεπ',                                            // civil service exam
      'μεταταξη', 'αποσπαση', 'τοποθετηση', 'υπαλληλ',  // staff matters
      'εκμισθωση', 'κυλικειο',                           // lease / canteen
      'κηρυξη ως αγον',                                  // failed auction
      'ελεγχος δηλωσης',                                 // administrative check
      'οψιγενων μεταβολων',                              // late-change check
      'εγκριση δαπανης',                                 // expense approval
      'αναληψη υποχρεωσης',                              // budget commitment
      'εντολη πληρωμης',                                 // payment order
      'χρηματικο ενταλμα',                               // payment warrant
    ];

    // Non-Greek patterns (English, French, German, Italian, Spanish, Polish, Dutch, Portuguese)
    const IRRELEVANT_INTL_PATTERNS = [
      // ── English ──
      /personnel|recruitment|hiring|job\s+post|job\s+vacancy|staff\s+position/i,
      /auction|foreclosure|real\s+estate\s+lease/i,
      /scholarship|fellowship|grant\s+for\s+student/i,
      /employment\s+contract|work\s+permit/i,
      // ── French ──
      /recrutement|embauche|poste\s+vacant|offre\s+d'emploi/i,
      /bourse\s+d'etudes|vente\s+aux\s+encheres|location\s+immobili/i,
      /contrat\s+de\s+travail|concours\s+de\s+recrutement/i,
      // ── German ──
      /stellenausschreibung|personaleinstellung|stellenangebot|arbeitsvertrag/i,
      /versteigerung|zwangsversteigerung|immobilienvermietung/i,
      /stipendium|personalrekrutierung/i,
      // ── Italian ──
      /assunzione|concorso\s+pubblico\s+per\s+personale|posto\s+vacante|offerta\s+di\s+lavoro/i,
      /asta\s+pubblica|asta\s+giudiziaria|locazione\s+immobil/i,
      /borsa\s+di\s+studio|contratto\s+di\s+lavoro/i,
      // ── Spanish ──
      /contratacion\s+de\s+personal|oferta\s+de\s+empleo|puesto\s+vacante|convocatoria\s+de\s+empleo/i,
      /subasta|ejecucion\s+hipotecaria|alquiler\s+de\s+inmueble/i,
      /beca\s+de\s+estudios|contrato\s+laboral/i,
      // ── Polish ──
      /nabor\s+na\s+stanowisko|oferta\s+pracy|zatrudnienie|rekrutacja/i,
      /licytacja|egzekucja|stypendium/i,
      // ── Dutch ──
      /vacature|personeelswerving|arbeidsovereenkomst/i,
      /veiling|executieverkoop|studiebeurs/i,
      // ── Portuguese ──
      /recrutamento|oferta\s+de\s+emprego|contrato\s+de\s+trabalho/i,
      /leilao|bolsa\s+de\s+estudo/i,
    ];

    allTenders = allTenders.filter((t) => {
      const rawText = `${t.title} ${t.summary || ''}`;
      const normalizedText = normalizeGreek(rawText);

      // Check Greek terms (accent-free matching)
      if (IRRELEVANT_GREEK_TERMS.some((term) => normalizedText.includes(term))) return false;
      // Check international patterns (regex, already accent-free in source)
      if (IRRELEVANT_INTL_PATTERNS.some((pattern) => pattern.test(normalizedText))) return false;

      return true;
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
    const companyProfile = await db.companyProfile.findFirst({
      where: { tenantId },
    });

    if (!companyProfile) {
      // No profile = return all tenders, limited to 30
      const tenders = await this.searchTenders();
      return tenders.slice(0, 100).map((t) => ({ ...t, relevanceScore: 0 }));
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
