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

  // ── ΚΗΜΔΗΣ: Open Data API (no login required) ──────────────────
  if (documentCount === 0 && (platform === 'KIMDIS' || sourceUrl.includes('eprocurement.gov.gr'))) {
    const procNumber = tender.referenceNumber || sourceUrl.match(/(\d{2}PROC\d+)/)?.[1];
    if (procNumber) {
      // Try all ΚΗΜΔΗΣ attachment endpoints: notice, auction, contract, request
      const kimdisEndpoints = ['notice', 'auction', 'contract', 'request'];
      for (const type of kimdisEndpoints) {
        if (documentCount > 0) break;
        try {
          const apiUrl = `https://cerpp.eprocurement.gov.gr/khmdhs-opendata/${type}/attachment/${procNumber}`;
          console.log(`[fetchDocumentsForTender] Trying ΚΗΜΔΗΣ OpenData: ${type}/${procNumber}`);
          const res = await fetch(apiUrl, {
            headers: { Accept: 'application/pdf,application/octet-stream,*/*' },
            signal: AbortSignal.timeout(30000),
          });
          if (!res.ok) continue;
          const ct = res.headers.get('content-type') || '';
          if (ct.includes('json')) continue; // Skip JSON error responses
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length < 500) continue;

          // Determine extension from content-type
          let ext = 'pdf';
          if (ct.includes('zip')) ext = 'zip';
          else if (ct.includes('word') || ct.includes('docx')) ext = 'docx';

          const filename = `kimdis_${type}_${procNumber}.${ext}`;
          const s3Key = `tenants/${tenantId}/tenders/${tenderId}/docs/${Date.now()}-${filename}`;
          const mimeType = ext === 'pdf' ? 'application/pdf' : MIME_BY_EXT[ext] || 'application/octet-stream';
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
          console.log(`[fetchDocumentsForTender] ΚΗΜΔΗΣ OpenData downloaded: ${filename} (${buf.length} bytes)`);
        } catch (err) {
          console.warn(`[fetchDocumentsForTender] ΚΗΜΔΗΣ ${type} attachment failed:`, err);
        }
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

        console.log(`[fetchDocumentsForTender] Found ${candidateUrls.length} candidate URLs on page (direct fetch)`);

        // Jina Reader fallback: if direct scrape found nothing (JS-rendered pages like KIMDIS)
        if (candidateUrls.length === 0) {
          try {
            console.log(`[fetchDocumentsForTender] Trying Jina Reader for JS-rendered page...`);
            const jinaRes = await fetch(`https://r.jina.ai/${sourceUrl}`, {
              headers: { Accept: 'text/html', 'X-Return-Format': 'html' },
              signal: AbortSignal.timeout(20000),
            });
            if (jinaRes.ok) {
              const jinaHtml = await jinaRes.text();
              // Re-run all extraction strategies on Jina-rendered content
              let jMatch;
              const jExtRegex = /href=["']([^"']*\.(?:pdf|docx?|xlsx?|zip|xml|rar|odt)(?:\?[^"']*)?)["']/gi;
              while ((jMatch = jExtRegex.exec(jinaHtml)) !== null) {
                candidateUrls.push({ url: jMatch[1], label: '' });
              }
              const jDownloadRegex = /href=["']([^"']+(?:download|attachment|getFile|getDocument|document|arxeio|archeio|file)[^"']*)["'][^>]*>([^<]*)/gi;
              while ((jMatch = jDownloadRegex.exec(jinaHtml)) !== null) {
                candidateUrls.push({ url: jMatch[1], label: jMatch[2].trim() });
              }
              const jLabelRegex = /href=["']([^"']+)["'][^>]*>\s*(?:[^<]*?)?(Λήψη|λήψη|Download|download|PDF|pdf|Αρχείο|αρχείο|Συνημμένο|συνημμένο|Κατέβασμα|Έγγραφο|έγγραφο)[^<]*/gi;
              while ((jMatch = jLabelRegex.exec(jinaHtml)) !== null) {
                candidateUrls.push({ url: jMatch[1], label: jMatch[2] });
              }
              // Also check markdown-style links from Jina: [text](url)
              const mdLinkRegex = /\[([^\]]*)\]\((https?:\/\/[^)]*\.(?:pdf|docx?|xlsx?|zip)[^)]*)\)/gi;
              while ((jMatch = mdLinkRegex.exec(jinaHtml)) !== null) {
                candidateUrls.push({ url: jMatch[2], label: jMatch[1] });
              }
              console.log(`[fetchDocumentsForTender] Jina found ${candidateUrls.length} candidate URLs`);
            }
          } catch (jinaErr) {
            console.warn(`[fetchDocumentsForTender] Jina Reader failed:`, jinaErr);
          }
        }

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

  // ── Platform Redirect: follow links to ΕΣΗΔΗΣ/ΚΗΜΔΗΣ/Διαύγεια if no docs found ──
  if (documentCount === 0 && sourceUrl.startsWith('http')) {
    console.log(`[fetchDocumentsForTender] No docs on page, looking for platform redirect links...`);
    try {
      // Fetch page (or reuse from above — but simplicity wins)
      let html = '';
      try {
        const res = await fetch(sourceUrl, {
          headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) html = await res.text();
      } catch { /* ignore */ }

      // If direct fetch failed, try Jina
      if (!html) {
        try {
          const jinaRes = await fetch(`https://r.jina.ai/${sourceUrl}`, {
            headers: { Accept: 'text/html' },
            signal: AbortSignal.timeout(15000),
          });
          if (jinaRes.ok) html = await jinaRes.text();
        } catch { /* ignore */ }
      }

      if (html) {
        // Look for links to known procurement platforms
        const platformPatterns = [
          { pattern: /href=["'](https?:\/\/[^"']*promitheus\.gov\.gr[^"']*)["']/gi, name: 'ΕΣΗΔΗΣ/Promitheus' },
          { pattern: /href=["'](https?:\/\/[^"']*eprocurement\.gov\.gr[^"']*)["']/gi, name: 'ΚΗΜΔΗΣ' },
          { pattern: /href=["'](https?:\/\/[^"']*diavgeia\.gov\.gr[^"']*)["']/gi, name: 'Διαύγεια' },
          { pattern: /href=["'](https?:\/\/[^"']*ted\.europa\.eu[^"']*)["']/gi, name: 'TED' },
        ];

        const redirectUrls: Array<{ url: string; name: string }> = [];
        for (const { pattern, name } of platformPatterns) {
          let m;
          while ((m = pattern.exec(html)) !== null) {
            const url = m[1];
            // Skip JS/anchor/mailto links
            if (url.includes('javascript:') || url.includes('#') || url.length < 20) continue;
            redirectUrls.push({ url, name });
          }
        }

        // Also check markdown-style links (from Jina)
        const mdPlatformRegex = /\[([^\]]*)\]\((https?:\/\/[^)]*(?:promitheus|eprocurement|diavgeia|ted\.europa)[^)]*)\)/gi;
        let mdMatch;
        while ((mdMatch = mdPlatformRegex.exec(html)) !== null) {
          redirectUrls.push({ url: mdMatch[2], name: mdMatch[1] || 'Platform' });
        }

        if (redirectUrls.length > 0) {
          console.log(`[fetchDocumentsForTender] Found ${redirectUrls.length} platform redirect(s): ${redirectUrls.map(r => r.name).join(', ')}`);

          // Try fetching docs from each platform link (max 3)
          for (const redirect of redirectUrls.slice(0, 3)) {
            if (documentCount > 0) break;

            // For Διαύγεια links, extract ADA and use API
            if (redirect.url.includes('diavgeia.gov.gr')) {
              const adaMatch = redirect.url.match(/\/decision\/view\/([A-Za-z0-9\u0391-\u03A9\u03B1-\u03C9-]+)/);
              const ada = adaMatch?.[1];
              if (ada) {
                try {
                  const docUrl = `https://diavgeia.gov.gr/luminapi/api/decisions/${ada}/document`;
                  const docRes = await fetch(docUrl, {
                    headers: { Accept: 'application/pdf' },
                    signal: AbortSignal.timeout(20000),
                  });
                  if (docRes.ok && isAcceptedContentType(docRes.headers.get('content-type'))) {
                    const buf = Buffer.from(await docRes.arrayBuffer());
                    if (buf.length > 100) {
                      const s3Key = `tenants/${tenantId}/tenders/${tenderId}/docs/${Date.now()}-diavgeia-redirect-${ada}.pdf`;
                      await uploadFile(s3Key, buf, 'application/pdf');
                      await db.attachedDocument.create({
                        data: { tenderId, fileName: `Διαύγεια-${ada}.pdf`, fileKey: s3Key, fileSize: buf.length, mimeType: 'application/pdf', category: 'specification' },
                      });
                      documentCount++;
                      console.log(`[fetchDocumentsForTender] Redirect: Downloaded Διαύγεια PDF for ADA ${ada}`);
                    }
                  }
                } catch (err) {
                  console.warn(`[fetchDocumentsForTender] Redirect Διαύγεια failed:`, (err as Error).message);
                }
              }
              continue;
            }

            // For other platforms, scrape the redirect page for document links
            try {
              const redirectRes = await fetch(redirect.url, {
                headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                signal: AbortSignal.timeout(15000),
                redirect: 'follow',
              });
              if (!redirectRes.ok) continue;

              const redirectHtml = await redirectRes.text();
              const redirectOrigin = new URL(redirect.url).origin;
              const seen = new Set<string>();

              // Find document links on the redirect page
              const extRegex = /href=["']([^"']*\.(?:pdf|docx?|xlsx?|zip|xml)(?:\?[^"']*)?)["']/gi;
              let fileMatch;
              while ((fileMatch = extRegex.exec(redirectHtml)) !== null && documentCount < 10) {
                const href = fileMatch[1];
                if (href.startsWith('#') || href.startsWith('javascript:')) continue;
                const fullUrl = href.startsWith('http') ? href : `${redirectOrigin}${href.startsWith('/') ? '' : '/'}${href}`;
                if (seen.has(fullUrl)) continue;
                seen.add(fullUrl);

                try {
                  const fileRes = await fetch(fullUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/pdf,application/octet-stream,*/*' },
                    signal: AbortSignal.timeout(25000),
                    redirect: 'follow',
                  });
                  if (!fileRes.ok) continue;

                  const ct = fileRes.headers.get('content-type') || '';
                  const ctBase = ct.split(';')[0].trim().toLowerCase();
                  if (!isAcceptedContentType(ct) && ctBase !== 'application/octet-stream' && ctBase !== 'application/force-download') continue;

                  const buf = Buffer.from(await fileRes.arrayBuffer());
                  if (buf.length < 500) continue;

                  let ext = fullUrl.match(/\.(pdf|docx?|xlsx?|zip|xml)/i)?.[1]?.toLowerCase();
                  if (!ext) ext = ctBase.includes('pdf') ? 'pdf' : ctBase.includes('word') ? 'docx' : 'pdf';

                  const filename = `redirect_${redirect.name.replace(/[^a-zA-Z0-9]/g, '_')}_${documentCount + 1}.${ext}`;
                  const s3Key = `tenants/${tenantId}/tenders/${tenderId}/docs/${Date.now()}-${filename}`;
                  const mimeType = MIME_BY_EXT[ext] || 'application/octet-stream';
                  await uploadFile(s3Key, buf, mimeType);
                  await db.attachedDocument.create({
                    data: { tenderId, fileName: filename, fileKey: s3Key, fileSize: buf.length, mimeType, category: 'specification' },
                  });
                  documentCount++;
                  console.log(`[fetchDocumentsForTender] Redirect: Downloaded ${filename} from ${redirect.name} (${buf.length} bytes)`);
                } catch {
                  // Continue with next file
                }
              }
            } catch (err) {
              console.warn(`[fetchDocumentsForTender] Redirect scrape failed for ${redirect.name}:`, (err as Error).message);
            }
          }
        }
      }
    } catch (err) {
      console.error(`[fetchDocumentsForTender] Platform redirect failed:`, (err as Error).message);
    }
  }

  // ── Jina Reader fallback: extract links from JS-rendered pages ──
  if (documentCount === 0 && sourceUrl.startsWith('http')) {
    console.log(`[fetchDocumentsForTender] HTML scraping found 0 docs, trying Jina Reader...`);
    try {
      const jinaRes = await fetch(`https://r.jina.ai/${sourceUrl}`, {
        headers: { Accept: 'text/markdown' },
        signal: AbortSignal.timeout(15000),
      });

      if (jinaRes.ok) {
        const markdown = await jinaRes.text();
        const origin = new URL(sourceUrl).origin;
        const seen = new Set<string>();

        // Extract URLs from markdown links: [text](url)
        const mdLinkRegex = /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/gi;
        let match;
        while ((match = mdLinkRegex.exec(markdown)) !== null) {
          const label = match[1];
          const url = match[2];
          if (seen.has(url) || documentCount >= 10) continue;

          // Check if URL or label suggests a document
          const isDocUrl = /\.(pdf|docx?|xlsx?|zip|xml|rar|odt)(\?|$)/i.test(url)
            || /download|attachment|getFile|getDocument|arxeio|archeio/i.test(url);
          const isDocLabel = /Λήψη|λήψη|Download|download|PDF|pdf|Αρχείο|αρχείο|Συνημμένο|Κατέβασμα|Έγγραφο|έγγραφο|Τεύχος|Διακήρυξη|διακήρυξη|document/i.test(label);

          if (!isDocUrl && !isDocLabel) continue;
          seen.add(url);

          try {
            const fileRes = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/pdf,application/octet-stream,*/*',
              },
              signal: AbortSignal.timeout(30000),
              redirect: 'follow',
            });
            if (!fileRes.ok) continue;

            const ct = fileRes.headers.get('content-type')?.split(';')[0].trim().toLowerCase() || '';
            const isDocument = isAcceptedContentType(fileRes.headers.get('content-type'))
              || ct === 'application/octet-stream'
              || ct === 'application/force-download';
            if (!isDocument) continue;

            const buf = Buffer.from(await fileRes.arrayBuffer());
            if (buf.length < 500) continue;

            let ext = url.match(/\.(pdf|docx?|xlsx?|zip|xml|rar|odt)/i)?.[1]?.toLowerCase();
            if (!ext) {
              if (ct.includes('pdf')) ext = 'pdf';
              else if (ct.includes('word') || ct.includes('docx')) ext = 'docx';
              else if (ct.includes('excel') || ct.includes('xlsx')) ext = 'xlsx';
              else if (ct.includes('zip')) ext = 'zip';
              else ext = 'pdf';
            }

            const filename = label && label.length > 2
              ? `${label.replace(/[^a-zA-Z0-9α-ωΑ-Ωά-ώ._\- ]/g, '_').slice(0, 60)}.${ext}`
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
            console.log(`[fetchDocumentsForTender] Jina: Downloaded ${filename} (${buf.length} bytes)`);
          } catch (err) {
            console.error(`[fetchDocumentsForTender] Jina: Failed to download ${url}:`, err);
          }
        }
        console.log(`[fetchDocumentsForTender] Jina strategy found ${documentCount} documents`);
      }
    } catch (err) {
      console.error(`[fetchDocumentsForTender] Jina Reader failed:`, err);
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
