/**
 * URL Importer Service
 * Given a URL to a tender page on ΕΣΗΔΗΣ, cosmoONE, iSupplies, ΚΗΜΔΗΣ, or Diavgeia,
 * scrapes the page content, extracts tender metadata, and downloads any attached documents.
 *
 * Currently uses stub implementations with realistic mock data.
 * Real implementations would use HTTP clients + HTML parsing.
 */

import { db } from '@/lib/db';
import { uploadFile } from '@/lib/s3';
import { tenderAnalysisQueue } from '@/server/jobs/queues';
import type { TenderPlatform } from '@prisma/client';

// ─── Types ──────────────────────────────────────────────────

interface ExtractedMetadata {
  title: string;
  referenceNumber?: string;
  contractingAuthority?: string;
  budget?: number;
  submissionDeadline?: Date;
  cpvCodes: string[];
  description?: string;
}

interface DocumentLink {
  url: string;
  fileName: string;
  mimeType: string;
  size?: number;
}

interface ImportResult {
  tenderId: string;
  metadata: ExtractedMetadata;
  documentCount: number;
}

// ─── Platform Detection ─────────────────────────────────────

/**
 * Detects the procurement platform from a URL.
 *
 * Known URL patterns:
 * - promitheas.gov.gr / www.eprocurement.gov.gr -> ΕΣΗΔΗΣ (ESIDIS)
 * - cosmo-one.gr / www.cosmo-one.gr -> cosmoONE (COSMOONE)
 * - isupplies.gr / www.isupplies.gr -> iSupplies (ISUPPLIES)
 * - eprocurement.gov.gr/kimds2 -> ΚΗΜΔΗΣ (mapped to OTHER for now)
 * - diavgeia.gov.gr -> Δι@ύγεια (mapped to OTHER for now)
 */
function detectPlatform(url: string): TenderPlatform {
  const hostname = new URL(url).hostname.toLowerCase();
  const pathname = new URL(url).pathname.toLowerCase();

  if (hostname.includes('promitheas.gov.gr') || hostname.includes('eprocurement.gov.gr')) {
    // Distinguish between ΕΣΗΔΗΣ and ΚΗΜΔΗΣ on the same domain
    if (pathname.includes('kimds') || pathname.includes('kimds2')) {
      return 'OTHER'; // ΚΗΜΔΗΣ - TODO: Add KIMDIS to TenderPlatform enum
    }
    return 'ESIDIS';
  }

  if (hostname.includes('cosmo-one.gr') || hostname.includes('cosmoone.gr')) {
    return 'COSMOONE';
  }

  if (hostname.includes('isupplies.gr')) {
    return 'ISUPPLIES';
  }

  if (hostname.includes('diavgeia.gov.gr')) {
    return 'OTHER'; // TODO: Add DIAVGEIA to TenderPlatform enum
  }

  return 'OTHER';
}

// ─── Metadata Extraction (stub implementations) ─────────────

/**
 * Extracts tender metadata from HTML content based on the platform.
 *
 * TODO: Real implementation for each platform:
 *
 * ESIDIS (promitheas.gov.gr):
 * - Parse the tender detail page at /ReqsAndSpecs/CommonView.aspx?id=XXXXX
 * - Extract from specific HTML elements:
 *   - Title: <span id="ctl00_ContentPlaceHolder1_lblTitle">
 *   - Reference: <span id="ctl00_ContentPlaceHolder1_lblSystemNumber">
 *   - Authority: <span id="ctl00_ContentPlaceHolder1_lblOrgName">
 *   - Budget: parse from description text
 *   - Deadline: <span id="ctl00_ContentPlaceHolder1_lblDeadline">
 *   - CPV: <span id="ctl00_ContentPlaceHolder1_lblCPV">
 *
 * cosmoONE:
 * - Parse tender detail at /Procurements/Procurement.aspx?id=XXXXX
 * - JSON-LD structured data may be available
 * - Look for data attributes on procurement details table
 *
 * iSupplies:
 * - Similar structure, parse procurement detail tables
 *
 * ΚΗΜΔΗΣ:
 * - Parse notice view at /kimds2/unprotected/viewNotice.htm?id=XXXXX
 * - XML structured data available via API endpoint
 *
 * Diavgeia:
 * - Use REST API: GET /api/decisions/{ada}
 * - JSON response with full decision metadata
 */
function extractMetadata(html: string, platform: TenderPlatform): ExtractedMetadata {
  // Stub: Use regex patterns that would work on real HTML
  // In production, use cheerio or similar HTML parser

  // Try to extract title from common HTML patterns
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
    || html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Imported Tender';

  // Try to extract reference number
  const refMatch = html.match(/(?:Αρ\.\s*(?:Διακ|Πρωτ|Συστ)[^:]*:\s*)([\w\-\/\.]+)/i)
    || html.match(/(?:Reference|System)\s*(?:Number|No|#)?\s*:?\s*([\w\-\/\.]+)/i);
  const referenceNumber = refMatch ? refMatch[1].trim() : undefined;

  // Try to extract contracting authority
  const authorityMatch = html.match(/(?:Αναθέτουσα\s*Αρχή|Φορέας)[^:]*:\s*([^<\n]+)/i)
    || html.match(/(?:Contracting\s*Authority)[^:]*:\s*([^<\n]+)/i);
  const contractingAuthority = authorityMatch ? authorityMatch[1].trim() : undefined;

  // Try to extract budget
  const budgetMatch = html.match(/(?:Προϋπολογισμός|Budget|Εκτιμώμενη\s*αξία)[^:]*:\s*([\d.,]+)\s*(?:€|EUR)/i);
  const budget = budgetMatch
    ? parseFloat(budgetMatch[1].replace(/\./g, '').replace(',', '.'))
    : undefined;

  // Try to extract deadline
  const deadlineMatch = html.match(/(?:Προθεσμία|Deadline|Καταληκτική)[^:]*:\s*(\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4})/i);
  let submissionDeadline: Date | undefined;
  if (deadlineMatch) {
    const parts = deadlineMatch[1].split(/[\/\.]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const year = parseInt(parts[2]) < 100 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
      submissionDeadline = new Date(year, month, day);
    }
  }

  // Try to extract CPV codes (format: 8 digits + check digit)
  const cpvCodes: string[] = [];
  const cpvRegex = /(\d{8}-\d)/g;
  let cpvMatch: RegExpExecArray | null;
  while ((cpvMatch = cpvRegex.exec(html)) !== null) {
    if (!cpvCodes.includes(cpvMatch[1])) {
      cpvCodes.push(cpvMatch[1]);
    }
  }

  return {
    title,
    referenceNumber,
    contractingAuthority,
    budget,
    submissionDeadline,
    cpvCodes,
  };
}

/**
 * Finds downloadable document links in HTML content.
 *
 * TODO: Real implementation would:
 * 1. Parse all <a> tags with href pointing to files
 * 2. Look for specific platform patterns:
 *    - ΕΣΗΔΗΣ: /ReqsAndSpecs/CommonDownload.aspx?id=XXX
 *    - cosmoONE: /Attachments/Download/XXX
 *    - ΚΗΜΔΗΣ: /kimds2/unprotected/downloadNoticeFile.htm?id=XXX
 * 3. Check file extensions: .pdf, .docx, .xlsx, .zip, .rar, .doc
 * 4. Resolve relative URLs to absolute
 * 5. Some platforms require authenticated sessions to download
 */
function findDocumentLinks(html: string, baseUrl: string): DocumentLink[] {
  const links: DocumentLink[] = [];
  const origin = new URL(baseUrl).origin;

  // Find all links that look like file downloads
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].replace(/<[^>]+>/g, '').trim();

    // Check if this looks like a file download
    const fileExtMatch = href.match(/\.(pdf|docx?|xlsx?|zip|rar|odt|ods|pptx?)(?:\?|$)/i);
    if (fileExtMatch || href.includes('download') || href.includes('Download') || href.includes('attachment')) {
      const ext = fileExtMatch ? fileExtMatch[1].toLowerCase() : 'pdf';
      const fileName = text || `document.${ext}`;

      const mimeTypes: Record<string, string> = {
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        zip: 'application/zip',
        rar: 'application/x-rar-compressed',
        odt: 'application/vnd.oasis.opendocument.text',
        ods: 'application/vnd.oasis.opendocument.spreadsheet',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      };

      const fullUrl = href.startsWith('http') ? href : `${origin}${href.startsWith('/') ? '' : '/'}${href}`;

      links.push({
        url: fullUrl,
        fileName: fileName.includes('.') ? fileName : `${fileName}.${ext}`,
        mimeType: mimeTypes[ext] || 'application/octet-stream',
      });
    }
  }

  return links;
}

// ─── Main Service ───────────────────────────────────────────

class UrlImporterService {
  /**
   * Import a tender from a procurement platform URL.
   *
   * Flow:
   * 1. Detect platform from URL
   * 2. Fetch page HTML
   * 3. Extract metadata (title, reference, authority, budget, deadline, CPVs)
   * 4. Find document links (PDF, DOCX, ZIP attachments)
   * 5. Create Tender record in DB
   * 6. Download and store attachments to S3
   * 7. Create AttachedDocument records
   * 8. Queue the tender analysis job
   * 9. Return the created tender ID
   */
  async importFromUrl(url: string, tenantId: string): Promise<ImportResult> {
    const platform = detectPlatform(url);

    // ── Fetch page HTML ──────────────────────────────────────
    // TODO: Real implementation would use fetch() or axios with:
    // - Proper headers (Accept-Language: el, User-Agent)
    // - Cookie/session handling for authenticated platforms
    // - Rate limiting to be respectful to government sites
    // - Retry logic for transient failures
    // - Proxy support if needed
    let html: string;
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'text/html',
          'Accept-Language': 'el,en;q=0.9',
          'User-Agent': 'TenderCopilot/1.0 (https://tendercopilot.gr)',
        },
      });

      if (!response.ok) {
        // Fall back to mock HTML for development
        html = this.getMockHtml(platform, url);
      } else {
        html = await response.text();
      }
    } catch {
      // Network error - use mock data for development
      html = this.getMockHtml(platform, url);
    }

    // ── Extract metadata ─────────────────────────────────────
    const metadata = extractMetadata(html, platform);

    // ── Find document links ──────────────────────────────────
    const documentLinks = findDocumentLinks(html, url);

    // ── Create Tender record ─────────────────────────────────
    const tender = await db.tender.create({
      data: {
        tenantId,
        title: metadata.title,
        referenceNumber: metadata.referenceNumber,
        contractingAuthority: metadata.contractingAuthority,
        platform,
        cpvCodes: metadata.cpvCodes,
        budget: metadata.budget,
        submissionDeadline: metadata.submissionDeadline,
        status: 'DISCOVERY',
        notes: `Imported from: ${url}`,
      },
    });

    // ── Download & store attachments ─────────────────────────
    let documentCount = 0;

    for (const docLink of documentLinks) {
      try {
        // TODO: Real implementation would download the file:
        // const fileResponse = await fetch(docLink.url);
        // const buffer = Buffer.from(await fileResponse.arrayBuffer());

        // For now, create a placeholder - real files would be downloaded
        const placeholderBuffer = Buffer.from(
          `[Placeholder for ${docLink.fileName} from ${docLink.url}]`
        );

        const s3Key = `tenants/${tenantId}/tenders/${tender.id}/attachments/${Date.now()}-${docLink.fileName}`;
        await uploadFile(s3Key, placeholderBuffer, docLink.mimeType);

        await db.attachedDocument.create({
          data: {
            tenderId: tender.id,
            fileName: docLink.fileName,
            fileKey: s3Key,
            fileSize: docLink.size || placeholderBuffer.length,
            mimeType: docLink.mimeType,
            category: this.categorizeDocument(docLink.fileName),
          },
        });

        documentCount++;
      } catch (error) {
        console.error(`Failed to download attachment ${docLink.fileName}:`, error);
      }
    }

    // ── Queue analysis job ───────────────────────────────────
    await tenderAnalysisQueue.add('analyze-tender', {
      tenderId: tender.id,
      tenantId,
    });

    // ── Log activity ─────────────────────────────────────────
    await db.activity.create({
      data: {
        tenderId: tender.id,
        action: 'imported_from_url',
        details: JSON.stringify({
          sourceUrl: url,
          platform,
          documentCount,
        }),
      },
    });

    return {
      tenderId: tender.id,
      metadata,
      documentCount,
    };
  }

  /**
   * Categorizes a document based on its filename.
   */
  private categorizeDocument(fileName: string): string {
    const lower = fileName.toLowerCase();

    if (lower.includes('διακήρυξη') || lower.includes('diakirixi') || lower.includes('proclamation')) {
      return 'specification';
    }
    if (lower.includes('παράρτημα') || lower.includes('annex') || lower.includes('appendix')) {
      return 'appendix';
    }
    if (lower.includes('διευκρίν') || lower.includes('clarification')) {
      return 'clarification';
    }
    if (lower.includes('τεύχος') || lower.includes('volume')) {
      return 'specification';
    }
    if (lower.includes('teyd') || lower.includes('espd') || lower.includes('τυποποιημένο')) {
      return 'espd';
    }
    if (lower.includes('σύμβαση') || lower.includes('contract')) {
      return 'contract';
    }
    if (lower.includes('μελέτη') || lower.includes('study')) {
      return 'study';
    }

    return 'other';
  }

  /**
   * Returns mock HTML for development/testing purposes.
   * Simulates what a real tender page would look like on each platform.
   */
  private getMockHtml(platform: TenderPlatform, url: string): string {
    switch (platform) {
      case 'ESIDIS':
        return `
          <html>
          <head><title>ΕΣΗΔΗΣ - Διαγωνισμός 123456</title></head>
          <body>
            <h1>Προμήθεια εξοπλισμού πληροφορικής και λογισμικού</h1>
            <table>
              <tr><td>Αρ. Συστήματος:</td><td>123456</td></tr>
              <tr><td>Αναθέτουσα Αρχή:</td><td>Υπουργείο Ψηφιακής Διακυβέρνησης</td></tr>
              <tr><td>Προϋπολογισμός:</td><td>350.000,00 €</td></tr>
              <tr><td>Καταληκτική ημερομηνία:</td><td>15/04/2024</td></tr>
              <tr><td>CPV:</td><td>72210000-0, 48000000-8</td></tr>
            </table>
            <div class="attachments">
              <a href="/ReqsAndSpecs/CommonDownload.aspx?id=001">Διακήρυξη.pdf</a>
              <a href="/ReqsAndSpecs/CommonDownload.aspx?id=002">Παράρτημα_Α.docx</a>
              <a href="/ReqsAndSpecs/CommonDownload.aspx?id=003">ΤΕΥΔ.pdf</a>
            </div>
          </body>
          </html>
        `;

      case 'COSMOONE':
        return `
          <html>
          <head><title>cosmoONE - Procurement Detail</title></head>
          <body>
            <h1>Υπηρεσίες συντήρησης και τεχνικής υποστήριξης πληροφοριακών συστημάτων</h1>
            <div class="procurement-details">
              <span class="label">Αρ. Διακήρυξης:</span><span>COSMO-2024-789</span>
              <span class="label">Αναθέτουσα Αρχή:</span><span>ΕΥΔΑΠ Α.Ε.</span>
              <span class="label">Προϋπολογισμός:</span><span>120.000,00 €</span>
              <span class="label">Προθεσμία υποβολής:</span><span>20/05/2024</span>
              <span class="label">CPV:</span><span>72250000-2</span>
            </div>
            <ul class="document-list">
              <a href="/Attachments/Download/101">Τεύχος_Διακήρυξης.pdf</a>
              <a href="/Attachments/Download/102">Τεχνικές_Προδιαγραφές.pdf</a>
            </ul>
          </body>
          </html>
        `;

      case 'ISUPPLIES':
        return `
          <html>
          <head><title>iSupplies - Tender</title></head>
          <body>
            <h1>Παροχή υπηρεσιών καθαριότητας δημοτικών κτιρίων</h1>
            <div class="tender-info">
              <p>Αρ. Πρωτ.: iSUP-2024-456</p>
              <p>Αναθέτουσα Αρχή: Δήμος Αθηναίων</p>
              <p>Εκτιμώμενη αξία: 200.000,00 €</p>
              <p>Καταληκτική ημερομηνία: 10/06/2024</p>
              <p>CPV: 90910000-9, 90911000-6</p>
            </div>
            <a href="/files/download/spec.pdf">Διακήρυξη.pdf</a>
            <a href="/files/download/annex.xlsx">Οικονομική_Προσφορά_Υπόδειγμα.xlsx</a>
          </body>
          </html>
        `;

      default:
        return `
          <html>
          <head><title>Tender Page</title></head>
          <body>
            <h1>Δημόσιος Διαγωνισμός</h1>
            <p>Αρ. Πρωτ.: GEN-2024-001</p>
            <p>Αναθέτουσα Αρχή: Δημόσιος Φορέας</p>
            <p>Προϋπολογισμός: 100.000,00 €</p>
            <p>Καταληκτική ημερομηνία: 30/06/2024</p>
            <a href="/download/document.pdf">Τεύχος Διακήρυξης.pdf</a>
          </body>
          </html>
        `;
    }
  }
}

export const urlImporter = new UrlImporterService();
