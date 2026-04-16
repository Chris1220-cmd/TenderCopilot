/**
 * Award Fetcher — fetches award/κατακύρωση data from ΔΙΑΥΓΕΙΑ and ΚΗΜΔΗΣ.
 * Separate from tender-discovery.ts which fetches NEW procurement notices.
 * This fetches PAST award decisions for intelligence/analytics.
 */

// ─── Types ──────────────────────────────────────────────

export interface AwardResult {
  title: string;
  winner: string;
  amount: number | null;
  authority: string;
  date: Date;
  cpvCodes: string[];
  source: 'DIAVGEIA' | 'KIMDIS';
  sourceUrl: string;
  budgetAmount?: number | null;
  numberOfBids?: number | null;
}

// ─── Safe date helper ───────────────────────────────────

function safeDate(value: unknown): Date {
  if (!value) return new Date();
  const d = new Date(String(value).split('+')[0]);
  return isNaN(d.getTime()) ? new Date() : d;
}

// ─── ΔΙΑΥΓΕΙΑ: Award decisions ──────────────────────────

export async function fetchDiavgeiaAwards(
  cpvCodes: string[],
  authority?: string,
): Promise<AwardResult[]> {
  const results: AwardResult[] = [];
  const searchTerms = ['ΚΑΤΑΚΥΡΩΣΗ', 'ΑΝΑΘΕΣΗ'];
  const cpvKeywords = cpvCodes.slice(0, 3).map((c) => c.split('-')[0]);

  for (const term of searchTerms) {
    try {
      const params = new URLSearchParams({
        subject: term,
        size: '100',
        page: '0',
      });
      if (cpvKeywords.length > 0) {
        params.set('q', cpvKeywords.join(' OR '));
      }
      if (authority) {
        params.set('organizationLabel', authority);
      }

      const res = await fetch(
        `https://diavgeia.gov.gr/luminapi/opendata/search?${params.toString()}`,
        {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(10000),
        },
      );

      if (!res.ok) continue;
      const data = await res.json();
      if (!data.decisions) continue;

      for (const d of data.decisions) {
        if (!d.ada) continue;
        const subject = (d.subject || '').toLowerCase();
        if (subject.includes('εντολή πληρωμής') || subject.includes('χρηματικό ένταλμα')) continue;

        const winner = extractWinnerFromDecision(d);
        const amount = d.amount?.amount ?? d.extraFieldValues?.awardAmount?.amount ?? null;

        if (winner || amount) {
          results.push({
            title: d.subject || '',
            winner: winner || 'Δεν αναφέρεται',
            amount: amount ? Number(amount) : null,
            authority: d.organizationLabel || d.organization?.label || '',
            date: safeDate(d.submissionTimestamp || d.issueDate),
            cpvCodes: cpvKeywords,
            source: 'DIAVGEIA',
            sourceUrl: `https://diavgeia.gov.gr/decision/view/${d.ada}`,
            budgetAmount: d.extraFieldValues?.estimatedAmount?.amount ?? null,
            numberOfBids: null,
          });
        }
      }
    } catch {
      // Continue with other search terms
    }
  }

  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.sourceUrl)) return false;
    seen.add(r.sourceUrl);
    return true;
  });
}

function extractWinnerFromDecision(decision: any): string | null {
  if (decision.extraFieldValues?.contractorName) {
    return decision.extraFieldValues.contractorName;
  }
  if (decision.extraFieldValues?.awardee?.name) {
    return decision.extraFieldValues.awardee.name;
  }
  return null;
}

// ─── ΚΗΜΔΗΣ: Award notices ──────────────────────────────

export async function fetchKimdisAwards(
  cpvCodes: string[],
  authority?: string,
): Promise<AwardResult[]> {
  try {
    const body: Record<string, any> = {};
    if (cpvCodes.length > 0) {
      body.cpvCodes = cpvCodes.slice(0, 5).map((c) => c.split('-')[0]);
    }
    if (authority) {
      body.organizationName = authority;
    }

    const res = await fetch(
      'https://cerpp.eprocurement.gov.gr/khmdhs-opendata/notice?page=0&size=100',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!res.ok) return [];
    const data = await res.json();
    const notices = data.content || data.notices || data.data || [];

    return notices
      .filter((n: any) => n.contractorName || n.totalCostWithoutVAT)
      .slice(0, 100)
      .map((n: any): AwardResult => {
        const cpvs: string[] = [];
        if (Array.isArray(n.objectDetails)) {
          for (const obj of n.objectDetails) {
            if (Array.isArray(obj.cpvs)) {
              for (const cpv of obj.cpvs) {
                if (cpv.key && !cpvs.includes(cpv.key)) cpvs.push(cpv.key);
              }
            }
          }
        }
        return {
          title: n.title || n.subject || '',
          winner: n.contractorName || n.awardee?.name || 'Δεν αναφέρεται',
          amount: n.totalCostWithoutVAT ?? n.totalCostWithVAT ?? null,
          authority: n.organization?.value || '',
          date: safeDate(n.submissionDate || n.publicationDate),
          cpvCodes: cpvs,
          source: 'KIMDIS',
          sourceUrl: `https://cerpp.eprocurement.gov.gr/kimds2/unprotected/searchNotices.htm?noticeId=${n.referenceNumber || ''}`,
          budgetAmount: n.estimatedValue ?? null,
          numberOfBids: n.numberOfTenders ?? n.numberOfBids ?? null,
        };
      });
  } catch {
    return [];
  }
}

// ─── Combined fetch ─────────────────────────────────────

export async function fetchAllAwards(
  cpvCodes: string[],
  authority?: string,
): Promise<AwardResult[]> {
  const [diavgeia, kimdis] = await Promise.all([
    fetchDiavgeiaAwards(cpvCodes, authority),
    fetchKimdisAwards(cpvCodes, authority),
  ]);
  return [...diavgeia, ...kimdis].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
}

// ─── Paginated date-range fetch (for backfill/cron) ────

export interface PaginatedAwardResponse {
  awards: AwardResult[];
  hasMorePages: boolean;
  totalFetched: number;
}

export async function fetchDiavgeiaByDateRange(
  fromDate: Date,
  toDate: Date,
  page: number = 0,
): Promise<PaginatedAwardResponse> {
  const results: AwardResult[] = [];
  const searchTerms = ['ΚΑΤΑΚΥΡΩΣΗ', 'ΑΝΑΘΕΣΗ'];
  let hasMore = false;

  for (const term of searchTerms) {
    try {
      const params = new URLSearchParams({
        subject: term,
        size: '100',
        page: String(page),
        from_issue_date: fromDate.toISOString().split('T')[0],
        to_issue_date: toDate.toISOString().split('T')[0],
      });

      const res = await fetch(
        `https://diavgeia.gov.gr/luminapi/opendata/search?${params.toString()}`,
        {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(15000),
        },
      );

      if (!res.ok) continue;
      const data = await res.json();
      if (!data.decisions) continue;

      const totalPages = data.info?.totalPages ?? 1;
      if (page + 1 < totalPages) hasMore = true;

      for (const d of data.decisions) {
        if (!d.ada) continue;
        const subject = (d.subject || '').toLowerCase();
        if (subject.includes('εντολή πληρωμής') || subject.includes('χρηματικό ένταλμα')) continue;

        const winner = extractWinnerFromDecision(d);
        const amount = d.amount?.amount ?? d.extraFieldValues?.awardAmount?.amount ?? null;

        if (winner || amount) {
          results.push({
            title: d.subject || '',
            winner: winner || 'Δεν αναφέρεται',
            amount: amount ? Number(amount) : null,
            authority: d.organizationLabel || d.organization?.label || '',
            date: safeDate(d.submissionTimestamp || d.issueDate),
            cpvCodes: (() => {
              const cpvs: string[] = [];
              if (d.extraFieldValues?.cpvs) {
                const cpvData = Array.isArray(d.extraFieldValues.cpvs) ? d.extraFieldValues.cpvs : [d.extraFieldValues.cpvs];
                for (const cpv of cpvData) {
                  const code = typeof cpv === 'string' ? cpv : cpv?.cpvCode || cpv?.code || cpv?.key;
                  if (code && !cpvs.includes(code)) cpvs.push(code);
                }
              }
              return cpvs;
            })(),
            source: 'DIAVGEIA',
            sourceUrl: `https://diavgeia.gov.gr/decision/view/${d.ada}`,
            budgetAmount: d.extraFieldValues?.estimatedAmount?.amount ?? null,
            numberOfBids: null,
          });
        }
      }
    } catch {
      // Continue with next search term
    }
  }

  const seen = new Set<string>();
  const unique = results.filter((r) => {
    if (seen.has(r.sourceUrl)) return false;
    seen.add(r.sourceUrl);
    return true;
  });

  return { awards: unique, hasMorePages: hasMore, totalFetched: unique.length };
}

export async function fetchKimdisByDateRange(
  fromDate: Date,
  toDate: Date,
  page: number = 0,
): Promise<PaginatedAwardResponse> {
  try {
    const body: Record<string, any> = {
      dateFrom: fromDate.toISOString().split('T')[0],
      dateTo: toDate.toISOString().split('T')[0],
    };

    const res = await fetch(
      `https://cerpp.eprocurement.gov.gr/khmdhs-opendata/notice?page=${page}&size=100`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!res.ok) return { awards: [], hasMorePages: false, totalFetched: 0 };
    const data = await res.json();
    const notices = data.content || data.notices || data.data || [];
    const totalPages = data.totalPages ?? 1;

    const awards: AwardResult[] = notices
      .filter((n: any) => n.contractorName || n.totalCostWithoutVAT)
      .map((n: any): AwardResult => {
        const cpvs: string[] = [];
        if (Array.isArray(n.objectDetails)) {
          for (const obj of n.objectDetails) {
            if (Array.isArray(obj.cpvs)) {
              for (const cpv of obj.cpvs) {
                if (cpv.key && !cpvs.includes(cpv.key)) cpvs.push(cpv.key);
              }
            }
          }
        }
        return {
          title: n.title || n.subject || '',
          winner: n.contractorName || n.awardee?.name || 'Δεν αναφέρεται',
          amount: n.totalCostWithoutVAT ?? n.totalCostWithVAT ?? null,
          authority: n.organization?.value || '',
          date: safeDate(n.submissionDate || n.publicationDate),
          cpvCodes: cpvs,
          source: 'KIMDIS',
          sourceUrl: `https://cerpp.eprocurement.gov.gr/kimds2/unprotected/searchNotices.htm?noticeId=${n.referenceNumber || ''}`,
          budgetAmount: n.estimatedValue ?? null,
          numberOfBids: n.numberOfTenders ?? n.numberOfBids ?? null,
        };
      });

    return {
      awards,
      hasMorePages: page + 1 < totalPages,
      totalFetched: awards.length,
    };
  } catch {
    return { awards: [], hasMorePages: false, totalFetched: 0 };
  }
}
