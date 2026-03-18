/**
 * URL Importer Service
 * Given a URL to a tender page, scrapes the page content,
 * extracts tender metadata using cheerio, and downloads attached documents.
 * NO mock data — real scraping only.
 */

import { db } from '@/lib/db';
import { uploadFile } from '@/lib/s3';
import { tenderAnalysisQueue } from '@/server/jobs/queues';
import type { TenderPlatform } from '@prisma/client';
import * as cheerio from 'cheerio';

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

function detectPlatform(url: string): TenderPlatform {
  const hostname = new URL(url).hostname.toLowerCase();
  const pathname = new URL(url).pathname.toLowerCase();

  if (hostname.includes('promitheas.gov.gr') || hostname.includes('eprocurement.gov.gr')) {
    if (pathname.includes('kimds') || pathname.includes('kimds2')) {
      return 'OTHER';
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
    return 'OTHER';
  }

  return 'OTHER';
}

// ─── Metadata Extraction (cheerio-based) ────────────────────

function extractMetadata(html: string, platform: TenderPlatform, url: string): ExtractedMetadata {
  const $ = cheerio.load(html);

  // Extract title — try multiple strategies
  let title = '';
  // Try common patterns
  title = $('h1').first().text().trim()
    || $('title').text().trim()
    || $('[class*="title"]').first().text().trim()
    || '';

  // Clean up title
  title = title.replace(/\s+/g, ' ').trim();
  if (!title || title.length < 5) {
    title = 'Imported Tender';
  }

  // Extract reference number
  let referenceNumber: string | undefined;
  const refPatterns = [
    /(?:Αρ\.?\s*(?:Διακ|Πρωτ|Συστ|Αναφ)[^:]*:\s*)([\w\-\/\.]+)/i,
    /(?:Αριθμός\s*(?:Συστήματος|Διακήρυξης)[^:]*:\s*)([\w\-\/\.]+)/i,
    /(?:Reference|System)\s*(?:Number|No|#)?\s*:?\s*([\w\-\/\.]+)/i,
  ];
  const fullText = $.text();
  for (const pattern of refPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      referenceNumber = match[1].trim();
      break;
    }
  }

  // Also try from table cells or labeled fields
  if (!referenceNumber) {
    $('td, span, div').each((_, el) => {
      const text = $(el).text().trim();
      if (text.match(/^(Αρ\.|Αριθμός)/i)) {
        const next = $(el).next().text().trim();
        if (next && next.length < 50) {
          referenceNumber = next;
          return false; // break
        }
      }
    });
  }

  // Extract contracting authority
  let contractingAuthority: string | undefined;
  const authPatterns = [
    /(?:Αναθέτουσα\s*Αρχή|Φορέας)[^:]*:\s*([^<\n]{5,100})/i,
    /(?:Contracting\s*Authority)[^:]*:\s*([^<\n]{5,100})/i,
  ];
  for (const pattern of authPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      contractingAuthority = match[1].trim();
      break;
    }
  }

  // Extract budget
  let budget: number | undefined;
  const budgetPatterns = [
    /(?:Προϋπολογισμ|Budget|Εκτιμώμενη\s*αξία)[^:]*:\s*([\d.,]+)\s*(?:€|EUR|ευρώ)/i,
    /([\d.,]+)\s*(?:€|EUR)\s*(?:χωρίς|με|πλέον)\s*(?:ΦΠΑ|VAT)/i,
  ];
  for (const pattern of budgetPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      budget = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
      break;
    }
  }

  // Extract deadline
  let submissionDeadline: Date | undefined;
  const deadlinePatterns = [
    /(?:Προθεσμία|Deadline|Καταληκτική)[^:]*:\s*(\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4})/i,
    /(\d{1,2}[\/.]\d{1,2}[\/.]\d{4})\s*(?:και\s*ώρα|ημέρα)/i,
  ];
  for (const pattern of deadlinePatterns) {
    const match = fullText.match(pattern);
    if (match) {
      const parts = match[1].split(/[\/\.]/);
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]) < 100 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
        submissionDeadline = new Date(year, month, day);
      }
      break;
    }
  }

  // Extract CPV codes
  const cpvCodes: string[] = [];
  const cpvRegex = /(\d{8}-\d)/g;
  let cpvMatch: RegExpExecArray | null;
  while ((cpvMatch = cpvRegex.exec(fullText)) !== null) {
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

// ─── Document Link Discovery ────────────────────────────────

function findDocumentLinks(html: string, baseUrl: string): DocumentLink[] {
  const $ = cheerio.load(html);
  const links: DocumentLink[] = [];
  const origin = new URL(baseUrl).origin;
  const seen = new Set<string>();

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

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().replace(/\s+/g, ' ').trim();

    // Check if this looks like a file download
    const fileExtMatch = href.match(/\.(pdf|docx?|xlsx?|zip|rar|odt|ods|pptx?)(?:\?|$)/i);
    const isDownloadLink = href.toLowerCase().includes('download') || href.toLowerCase().includes('attachment');

    if (fileExtMatch || isDownloadLink) {
      const ext = fileExtMatch ? fileExtMatch[1].toLowerCase() : 'pdf';
      const fullUrl = href.startsWith('http') ? href : `${origin}${href.startsWith('/') ? '' : '/'}${href}`;

      if (seen.has(fullUrl)) return;
      seen.add(fullUrl);

      let fileName = text || '';
      if (!fileName.includes('.')) {
        fileName = fileName ? `${fileName}.${ext}` : `document_${links.length + 1}.${ext}`;
      }

      links.push({
        url: fullUrl,
        fileName,
        mimeType: mimeTypes[ext] || 'application/octet-stream',
      });
    }
  });

  return links;
}

// ─── Main Service ───────────────────────────────────────────

class UrlImporterService {
  /**
   * Import a tender from a procurement platform URL.
   * Actually fetches the page and downloads documents — no mock data.
   */
  async importFromUrl(url: string, tenantId: string): Promise<ImportResult> {
    const platform = detectPlatform(url);

    // ── Fetch page HTML ──────────────────────────────────────
    let html: string;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'el,en;q=0.9',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      html = await response.text();
    } catch (err: any) {
      throw new Error(
        `Αποτυχία λήψης σελίδας από ${url}: ${err.message || 'Άγνωστο σφάλμα'}. ` +
        'Ελέγξτε ότι η διεύθυνση είναι σωστή και προσβάσιμη.'
      );
    }

    // ── Extract metadata ─────────────────────────────────────
    const metadata = extractMetadata(html, platform, url);

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
        notes: `Imported from: ${url}\nDocuments found: ${documentLinks.length}`,
      },
    });

    // ── Download & store attachments ─────────────────────────
    let documentCount = 0;

    for (const docLink of documentLinks) {
      try {
        // ACTUALLY download the file
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout for large files

        const fileResponse = await fetch(docLink.url, {
          headers: {
            'Accept': '*/*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!fileResponse.ok) {
          console.warn(`[URLImporter] Failed to download ${docLink.fileName}: HTTP ${fileResponse.status}`);
          continue;
        }

        const arrayBuffer = await fileResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Skip empty files
        if (buffer.length < 100) {
          console.warn(`[URLImporter] Skipping empty file: ${docLink.fileName}`);
          continue;
        }

        const sanitizedName = docLink.fileName.replace(/[^a-zA-Z0-9._\-α-ωΑ-Ω]/g, '_');
        const s3Key = `tenants/${tenantId}/tenders/${tender.id}/attachments/${Date.now()}-${sanitizedName}`;
        await uploadFile(s3Key, buffer, docLink.mimeType);

        await db.attachedDocument.create({
          data: {
            tenderId: tender.id,
            fileName: docLink.fileName,
            fileKey: s3Key,
            fileSize: buffer.length,
            mimeType: docLink.mimeType,
            category: this.categorizeDocument(docLink.fileName),
          },
        });

        documentCount++;
      } catch (error: any) {
        console.error(`[URLImporter] Failed to download ${docLink.fileName}:`, error.message);
        // Continue with other documents — don't stop the whole import
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
          documentsFound: documentLinks.length,
          metadata: {
            title: metadata.title,
            budget: metadata.budget,
            cpvCodes: metadata.cpvCodes,
          },
        }),
      },
    });

    return {
      tenderId: tender.id,
      metadata,
      documentCount,
    };
  }

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
}

export const urlImporter = new UrlImporterService();
