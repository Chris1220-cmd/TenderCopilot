/**
 * Document Fetcher Service
 * Fetches documents from tender source URLs using platform-specific logic.
 * Supports Diavgeia (luminapi), TED, and generic HTML scraping for PDF/DOCX/XLSX/ZIP links.
 */

import { db } from '@/lib/db';
import { uploadFile } from '@/lib/s3';

// ─── Constants ───────────────────────────────────────────────

const ACCEPTED_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'application/x-zip-compressed',
  'text/xml',
  'application/xml',
]);

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
  xml: 'application/xml',
};

// ─── Helpers ─────────────────────────────────────────────────

/** Returns true if the Content-Type header indicates an acceptable document. */
function isAcceptedContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const base = contentType.split(';')[0].trim().toLowerCase();
  return ACCEPTED_CONTENT_TYPES.has(base);
}

// ─── Main Function ───────────────────────────────────────────

export async function fetchDocumentsForTender(params: {
  tenderId: string;
  tenantId: string;
  sourceUrl: string;
  platform: string;
}): Promise<{ documentCount: number }> {
  const { tenderId, tenantId, sourceUrl, platform } = params;

  const tender = await db.tender.findUnique({ where: { id: tenderId } });
  if (!tender) {
    throw new Error(`Tender ${tenderId} not found`);
  }

  let documentCount = 0;

  // ── Diavgeia: direct PDF download via API ────────────────────
  if (platform === 'DIAVGEIA' || sourceUrl.includes('diavgeia.gov.gr')) {
    // Extract ADA from URL: https://diavgeia.gov.gr/decision/view/{ADA}
    const adaMatch = sourceUrl.match(/\/decision\/view\/([A-Za-z0-9\u0391-\u03A9\u03B1-\u03C9-]+)/);
    const ada = adaMatch?.[1] || tender.referenceNumber;

    if (ada) {
      try {
        const docUrl = `https://diavgeia.gov.gr/luminapi/api/decisions/${ada}/document`;

        const docResponse = await fetch(docUrl, {
          headers: { Accept: 'application/pdf' },
          signal: AbortSignal.timeout(30000),
        });

        const contentType = docResponse.headers.get('content-type');
        if (docResponse.ok && isAcceptedContentType(contentType)) {
          const buffer = Buffer.from(await docResponse.arrayBuffer());
          if (buffer.length > 100) {
            const s3Key = `tenants/${tenantId}/tenders/${tenderId}/docs/${Date.now()}-diavgeia-${ada}.pdf`;
            await uploadFile(s3Key, buffer, 'application/pdf');

            await db.attachedDocument.create({
              data: {
                tenderId,
                fileName: `\u0394\u03B9\u03B1\u03CD\u03B3\u03B5\u03B9\u03B1-${ada}.pdf`,
                fileKey: s3Key,
                fileSize: buffer.length,
                mimeType: 'application/pdf',
                category: 'specification',
              },
            });
            documentCount++;
          }
        }
      } catch (err) {
        console.error(`[fetchDocumentsForTender] Diavgeia PDF download failed for ADA ${ada}:`, err);
        // Non-fatal — continue
      }

      // Also try to get the decision metadata for extra info
      try {
        const metaRes = await fetch(
          `https://diavgeia.gov.gr/luminapi/api/decisions/${ada}`,
          { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) }
        );
        if (metaRes.ok) {
          const meta = await metaRes.json();
          const updates: Record<string, unknown> = {};
          if (meta.extraFieldValues?.cpv) {
            const cpvs = Array.isArray(meta.extraFieldValues.cpv)
              ? meta.extraFieldValues.cpv
              : [meta.extraFieldValues.cpv];
            if (cpvs.length > 0) updates.cpvCodes = cpvs;
          }
          if (!tender.contractingAuthority && meta.organizationLabel) {
            updates.contractingAuthority = meta.organizationLabel;
          }
          if (Object.keys(updates).length > 0) {
            await db.tender.update({ where: { id: tenderId }, data: updates });
          }
        }
      } catch {
        // Metadata enrichment is optional
      }
    }
  }

  // ── TED / KIMDIS / Other: scrape source page for document links ───
  if (documentCount === 0 && sourceUrl.startsWith('http')) {
    try {
      const pageRes = await fetch(sourceUrl, {
        headers: {
          Accept: 'text/html',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (pageRes.ok) {
        const html = await pageRes.text();
        const origin = new URL(sourceUrl).origin;
        const seen = new Set<string>();
        const candidateUrls: Array<{ url: string; label: string }> = [];

        // Strategy 1: Links with file extensions (.pdf, .docx, etc.)
        const extRegex = /href=["']([^"']*\.(?:pdf|docx?|xlsx?|zip|xml|rar|odt)(?:\?[^"']*)?)["']/gi;
        let match;
        while ((match = extRegex.exec(html)) !== null) {
          candidateUrls.push({ url: match[1], label: '' });
        }

        // Strategy 2: Links with download-related keywords in href or text
        // Catches dynamic URLs like /download?id=123, /api/getFile, /attachment/view/456
        const downloadRegex = /href=["']([^"']+(?:download|attachment|getFile|getDocument|document|arxeio|archeio|file)[^"']*)["'][^>]*>([^<]*)/gi;
        while ((match = downloadRegex.exec(html)) !== null) {
          candidateUrls.push({ url: match[1], label: match[2].trim() });
        }

        // Strategy 3: Links with text containing "Λήψη", "Download", "PDF", "Αρχείο"
        const labelRegex = /href=["']([^"']+)["'][^>]*>\s*(?:[^<]*?)?(Λήψη|λήψη|Download|download|PDF|pdf|Αρχείο|αρχείο|Συνημμένο|συνημμένο|Κατέβασμα|Έγγραφο|έγγραφο)[^<]*/gi;
        while ((match = labelRegex.exec(html)) !== null) {
          candidateUrls.push({ url: match[1], label: match[2] });
        }

        console.log(`[fetchDocumentsForTender] Found ${candidateUrls.length} candidate URLs on page`);

        for (const candidate of candidateUrls) {
          if (documentCount >= 10) break;
          const href = candidate.url;
          // Skip anchors, javascript, mailto
          if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
          const fullUrl = href.startsWith('http') ? href : `${origin}${href.startsWith('/') ? '' : '/'}${href}`;
          if (seen.has(fullUrl)) continue;
          seen.add(fullUrl);

          try {
            const fileRes = await fetch(fullUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/pdf,application/octet-stream,*/*',
              },
              signal: AbortSignal.timeout(30000),
              redirect: 'follow',
            });

            if (!fileRes.ok) {
              console.warn(`[fetchDocumentsForTender] Download failed (HTTP ${fileRes.status}): ${fullUrl}`);
              continue;
            }

            const ct = fileRes.headers.get('content-type') || '';
            const ctBase = ct.split(';')[0].trim().toLowerCase();
            // Accept PDFs, documents, and octet-stream (often used for downloads)
            const isDocument = isAcceptedContentType(ct)
              || ctBase === 'application/octet-stream'
              || ctBase === 'application/force-download';

            if (!isDocument) continue;

            const buf = Buffer.from(await fileRes.arrayBuffer());
            if (buf.length < 500) continue; // Skip tiny files

            // Determine extension from URL, content-type, or label
            let ext = fullUrl.match(/\.(pdf|docx?|xlsx?|zip|xml|rar|odt)/i)?.[1]?.toLowerCase();
            if (!ext) {
              if (ctBase.includes('pdf')) ext = 'pdf';
              else if (ctBase.includes('word') || ctBase.includes('docx')) ext = 'docx';
              else if (ctBase.includes('excel') || ctBase.includes('xlsx')) ext = 'xlsx';
              else if (ctBase.includes('zip')) ext = 'zip';
              else ext = 'pdf'; // Default to PDF for octet-stream
            }

            const filename = candidate.label && candidate.label.length > 2
              ? `${candidate.label.replace(/[^a-zA-Z0-9α-ωΑ-Ωά-ώ._\- ]/g, '_').slice(0, 60)}.${ext}`
              : `document_${documentCount + 1}.${ext}`;
            const s3Key = `tenants/${tenantId}/tenders/${tenderId}/docs/${Date.now()}-${filename}`;
            const mimeType = MIME_BY_EXT[ext] || 'application/octet-stream';
            await uploadFile(s3Key, buf, mimeType);
            await db.attachedDocument.create({
              data: {
                tenderId,
                fileName: filename,
                fileKey: s3Key,
                fileSize: buf.length,
                mimeType,
                category: 'specification',
              },
            });
            documentCount++;
            console.log(`[fetchDocumentsForTender] Downloaded: ${filename} (${buf.length} bytes)`);
          } catch (err) {
            console.error(`[fetchDocumentsForTender] Failed to download ${fullUrl}:`, err);
          }
        }
      }
    } catch (err) {
      console.error(`[fetchDocumentsForTender] Page scraping failed for ${sourceUrl}:`, err);
    }
  }

  // ── Fallback: Deep Research with Jina + Claude AI ─────────────
  if (documentCount === 0 && sourceUrl.startsWith('http')) {
    console.log(`[fetchDocumentsForTender] No documents found via scraping, trying deep research...`);
    try {
      const { deepResearchTender } = await import('./deep-research');
      const deepResult = await deepResearchTender(tenderId, sourceUrl, tenantId);
      documentCount += deepResult.documentCount;
      console.log(`[fetchDocumentsForTender] Deep research found ${deepResult.documentCount} documents, enriched: ${deepResult.enriched}`);
    } catch (err) {
      console.error(`[fetchDocumentsForTender] Deep research failed:`, err);
    }
  }

  // Log activity
  await db.activity.create({
    data: {
      tenderId,
      action: 'documents_fetched_from_source',
      details: `Κατέβηκαν ${documentCount} έγγραφα από ${platform}: ${sourceUrl}`,
    },
  });

  return { documentCount };
}
