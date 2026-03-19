/**
 * Deep Research Service
 * Uses Jina Reader to fetch clean markdown from tender pages,
 * then sends to Claude AI for structured extraction of metadata,
 * CPV codes, documents, deadlines, and budgets.
 */

import { db } from '@/lib/db';
import { ai } from '@/server/ai';
import { uploadFile } from '@/lib/s3';

// ─── Types ──────────────────────────────────────────────────

interface DeepResearchResult {
  documentCount: number;
  enriched: boolean;
}

interface ExtractedTenderData {
  cpvCodes: string[];
  kadCodes: string[];
  documentUrls: string[];
  deadline: string | null;
  budget: number | null;
  authority: string | null;
  summary: string | null;
}

// ─── Constants ──────────────────────────────────────────────

const JINA_TIMEOUT = 15_000;
const DOC_DOWNLOAD_TIMEOUT = 30_000;
const MAX_DOCUMENTS = 10;

const ACCEPTED_EXTENSIONS = /\.(pdf|docx?|zip|xml)(\?.*)?$/i;

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  zip: 'application/zip',
  xml: 'application/xml',
};

// ─── Main Function ──────────────────────────────────────────

/**
 * Performs deep research on a tender page:
 * 1. Fetches clean markdown via Jina Reader
 * 2. Sends to Claude AI for structured extraction
 * 3. Updates tender record with enriched data
 * 4. Downloads discovered documents to S3
 */
export async function deepResearchTender(
  tenderId: string,
  sourceUrl: string,
  tenantId: string,
): Promise<DeepResearchResult> {
  console.log(`[DeepResearch] Starting for tender ${tenderId}, URL: ${sourceUrl}`);

  // ── Step 1: Fetch clean markdown via Jina Reader ──────────
  let pageMarkdown: string;
  try {
    const jinaUrl = `https://r.jina.ai/${sourceUrl}`;
    const jinaRes = await fetch(jinaUrl, {
      headers: { Accept: 'text/markdown' },
      signal: AbortSignal.timeout(JINA_TIMEOUT),
    });

    if (!jinaRes.ok) {
      console.error(`[DeepResearch] Jina Reader error: ${jinaRes.status}`);
      return { documentCount: 0, enriched: false };
    }

    pageMarkdown = await jinaRes.text();

    if (!pageMarkdown || pageMarkdown.trim().length < 50) {
      console.warn('[DeepResearch] Jina returned insufficient content');
      return { documentCount: 0, enriched: false };
    }

    console.log(`[DeepResearch] Jina returned ${pageMarkdown.length} chars`);
  } catch (err) {
    console.error('[DeepResearch] Jina fetch failed:', err);
    return { documentCount: 0, enriched: false };
  }

  // ── Step 2: Send to Claude AI for structured extraction ───
  let extracted: ExtractedTenderData;
  try {
    const aiResult = await ai().complete({
      messages: [
        {
          role: 'system',
          content:
            'You are a Greek public procurement expert. Extract structured data from tender documents. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: `From this Greek procurement tender page, extract:
- All CPV codes (format: XXXXXXXX-X)
- All KAD codes if mentioned
- All document download URLs (PDFs, DOCs, etc.)
- Submission deadline (ISO format)
- Budget amount in EUR
- Contracting authority name
- Brief requirements summary (2-3 sentences)

Return as JSON with keys: cpvCodes, kadCodes, documentUrls, deadline, budget, authority, summary

Page content:
${pageMarkdown.slice(0, 30000)}`,
        },
      ],
      maxTokens: 2048,
      temperature: 0,
      responseFormat: 'json',
    });

    // ── Step 3: Parse the Claude response ─────────────────────
    const parsed = JSON.parse(aiResult.content);
    extracted = {
      cpvCodes: Array.isArray(parsed.cpvCodes) ? parsed.cpvCodes : [],
      kadCodes: Array.isArray(parsed.kadCodes) ? parsed.kadCodes : [],
      documentUrls: Array.isArray(parsed.documentUrls) ? parsed.documentUrls : [],
      deadline: typeof parsed.deadline === 'string' ? parsed.deadline : null,
      budget: typeof parsed.budget === 'number' ? parsed.budget : null,
      authority: typeof parsed.authority === 'string' ? parsed.authority : null,
      summary: typeof parsed.summary === 'string' ? parsed.summary : null,
    };

    console.log(
      `[DeepResearch] AI extracted: ${extracted.cpvCodes.length} CPVs, ` +
        `${extracted.documentUrls.length} doc URLs, budget=${extracted.budget}`,
    );
  } catch (err) {
    console.error('[DeepResearch] AI extraction failed:', err);
    return { documentCount: 0, enriched: false };
  }

  // ── Step 4: Update tender record with enriched data ────────
  try {
    const updateData: Record<string, unknown> = {};

    if (extracted.cpvCodes.length > 0) {
      updateData.cpvCodes = extracted.cpvCodes;
    }
    if (extracted.budget !== null) {
      updateData.budget = extracted.budget;
    }
    if (extracted.deadline) {
      const deadlineDate = new Date(extracted.deadline);
      if (!isNaN(deadlineDate.getTime())) {
        updateData.submissionDeadline = deadlineDate;
      }
    }
    if (extracted.authority) {
      updateData.contractingAuthority = extracted.authority;
    }
    if (extracted.summary) {
      updateData.notes = extracted.summary;
    }

    if (Object.keys(updateData).length > 0) {
      await db.tender.update({
        where: { id: tenderId },
        data: updateData,
      });
      console.log(`[DeepResearch] Tender ${tenderId} enriched with ${Object.keys(updateData).length} fields`);
    }
  } catch (err) {
    console.error('[DeepResearch] Tender update failed:', err);
    // Non-fatal — continue with document downloads
  }

  // ── Step 5: Download documents → upload to S3 → create AttachedDocument records ──
  let documentCount = 0;

  // Accept any HTTP URL — don't require file extensions in URL
  // (many Greek procurement sites use dynamic download URLs like /download?id=123)
  const validUrls = extracted.documentUrls
    .filter((url): url is string => typeof url === 'string' && url.startsWith('http'))
    .slice(0, MAX_DOCUMENTS);

  for (const docUrl of validUrls) {
    try {
      const docRes = await fetch(docUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TenderCopilot/1.0)' },
        signal: AbortSignal.timeout(DOC_DOWNLOAD_TIMEOUT),
      });

      if (!docRes.ok) {
        console.warn(`[DeepResearch] Doc download failed (${docRes.status}): ${docUrl}`);
        continue;
      }

      // Check content-type to verify it's a document (not an HTML page)
      const ct = docRes.headers.get('content-type')?.split(';')[0].trim().toLowerCase() || '';
      const isDocument = ct.includes('pdf') || ct.includes('word') || ct.includes('zip')
        || ct.includes('octet-stream') || ct.includes('force-download')
        || ct.includes('excel') || ct.includes('xml') || ct.includes('rar');
      if (!isDocument && !ACCEPTED_EXTENSIONS.test(docUrl)) {
        console.warn(`[DeepResearch] Skipping non-document content-type (${ct}): ${docUrl}`);
        continue;
      }

      const buffer = Buffer.from(await docRes.arrayBuffer());
      if (buffer.length < 500) {
        console.warn(`[DeepResearch] Doc too small (${buffer.length} bytes): ${docUrl}`);
        continue;
      }

      // Determine extension from URL or content-type
      const extMatch = docUrl.match(/\.(pdf|docx?|xlsx?|zip|xml)/i);
      let ext = extMatch?.[1]?.toLowerCase();
      if (!ext) {
        if (ct.includes('pdf')) ext = 'pdf';
        else if (ct.includes('word') || ct.includes('docx')) ext = 'docx';
        else if (ct.includes('excel') || ct.includes('xlsx')) ext = 'xlsx';
        else if (ct.includes('zip')) ext = 'zip';
        else ext = 'pdf'; // Default for octet-stream/force-download
      }
      const mimeType = MIME_BY_EXT[ext] || 'application/octet-stream';

      // Extract a filename from URL
      const urlPath = new URL(docUrl).pathname;
      const urlFilename = urlPath.split('/').pop() || `document_${documentCount + 1}.${ext}`;
      const safeFilename = urlFilename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);

      const s3Key = `tenants/${tenantId}/tenders/${tenderId}/docs/${Date.now()}-${safeFilename}`;
      await uploadFile(s3Key, buffer, mimeType);

      await db.attachedDocument.create({
        data: {
          tenderId,
          fileName: safeFilename,
          fileKey: s3Key,
          fileSize: buffer.length,
          mimeType,
          category: 'specification',
        },
      });

      documentCount++;
      console.log(`[DeepResearch] Downloaded and stored: ${safeFilename} (${buffer.length} bytes)`);
    } catch (err) {
      console.warn(`[DeepResearch] Failed to download doc ${docUrl}:`, (err as Error).message);
      // Continue with remaining documents
    }
  }

  // Log activity
  try {
    await db.activity.create({
      data: {
        tenderId,
        action: 'deep_research',
        details: `Deep research: ${extracted.cpvCodes.length} CPV codes, ${documentCount} documents, budget=${extracted.budget ?? 'N/A'}`,
      },
    });
  } catch {
    // Activity logging is non-fatal
  }

  const enriched =
    extracted.cpvCodes.length > 0 ||
    extracted.budget !== null ||
    extracted.deadline !== null ||
    extracted.authority !== null ||
    documentCount > 0;

  console.log(`[DeepResearch] Done: ${documentCount} docs, enriched=${enriched}`);
  return { documentCount, enriched };
}
