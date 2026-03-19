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
        // Look for PDF/DOCX/DOC/ZIP/XML links
        const linkRegex = /href=["']([^"']*\.(?:pdf|docx?|xlsx?|zip|xml)(?:\?[^"']*)?)["']/gi;
        const origin = new URL(sourceUrl).origin;
        let match;
        const seen = new Set<string>();

        while ((match = linkRegex.exec(html)) !== null && documentCount < 10) {
          const href = match[1];
          const fullUrl = href.startsWith('http') ? href : `${origin}${href.startsWith('/') ? '' : '/'}${href}`;
          if (seen.has(fullUrl)) continue;
          seen.add(fullUrl);

          try {
            const fileRes = await fetch(fullUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0' },
              signal: AbortSignal.timeout(30000),
            });

            if (!fileRes.ok) {
              console.error(`[fetchDocumentsForTender] Download failed (HTTP ${fileRes.status}): ${fullUrl}`);
              continue;
            }

            const ct = fileRes.headers.get('content-type');
            if (!isAcceptedContentType(ct)) {
              console.error(`[fetchDocumentsForTender] Rejected content-type "${ct}" for: ${fullUrl}`);
              continue;
            }

            const buf = Buffer.from(await fileRes.arrayBuffer());
            if (buf.length > 100) {
              const ext = fullUrl.match(/\.(pdf|docx?|xlsx?|zip|xml)/i)?.[1]?.toLowerCase() || 'pdf';
              const filename = `document_${documentCount + 1}.${ext}`;
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
            }
          } catch (err) {
            console.error(`[fetchDocumentsForTender] Failed to download ${fullUrl}:`, err);
          }
        }
      }
    } catch (err) {
      console.error(`[fetchDocumentsForTender] Page scraping failed for ${sourceUrl}:`, err);
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
