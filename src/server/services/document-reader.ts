/**
 * Document Reader Service
 * Reads and extracts text from attached tender documents stored in S3.
 * Used by all AI services to get REAL document content for analysis.
 *
 * For scanned/image PDFs where pdf-parse fails, falls back to
 * Gemini Vision OCR which handles Greek text excellently.
 */

import { db } from '@/lib/db';
import { getFileBuffer } from '@/lib/s3';
import { TRPCError } from '@trpc/server';

// ─── Gemini Vision OCR Fallback ────────────────────────────

/**
 * Uses Gemini 2.0 Flash Vision to OCR a scanned PDF.
 * Sends the entire PDF as inlineData — Gemini handles multi-page PDFs natively.
 */
async function extractTextWithGeminiVision(buffer: Buffer, fileName: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[DocumentReader] No GEMINI_API_KEY — cannot OCR scanned PDF');
    return '';
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    console.log(`[DocumentReader] Using Gemini Vision OCR for ${fileName} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)...`);

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: buffer.toString('base64'),
        },
      },
      'Εξήγαγε ΟΛΟ το κείμενο αυτού του PDF εγγράφου. Επέστρεψε μόνο το κείμενο, χωρίς σχόλια. Για πίνακες, μετέτρεψέ τους σε μορφή κειμένου.',
    ]);

    const text = result.response.text() || '';
    console.log(`[DocumentReader] Gemini Vision extracted ${text.length} chars from ${fileName}`);
    return text;
  } catch (err) {
    console.error(`[DocumentReader] Gemini Vision OCR failed for ${fileName}:`, err);
    return '';
  }
}

// ─── Text Extraction ───────────────────────────────────────

/**
 * Extract text from a single file buffer based on MIME type.
 * For PDFs: tries pdf-parse first, falls back to Gemini Vision if result is too short.
 */
async function extractText(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  if (buffer.length === 0) {
    return '';
  }

  switch (mimeType) {
    case 'application/pdf': {
      // Step 1: Try fast local pdf-parse
      let text = '';
      try {
        const pdfParse = (await import('pdf-parse')).default;
        const data = await pdfParse(buffer);
        text = data.text || '';
      } catch (err) {
        console.error(`[DocumentReader] PDF parse failed for ${fileName}:`, err);
      }

      // Step 2: If pdf-parse got very little text for a large file, it's likely scanned
      // Threshold: less than 1 char per KB means the PDF is mostly images
      const charsPerKB = text.trim().length / (buffer.length / 1024);
      if (charsPerKB < 1 && buffer.length > 50_000) {
        console.log(`[DocumentReader] pdf-parse got only ${text.trim().length} chars for ${(buffer.length / 1024).toFixed(0)} KB — falling back to Gemini Vision OCR`);
        const ocrText = await extractTextWithGeminiVision(buffer, fileName);
        if (ocrText.length > text.trim().length) {
          return ocrText;
        }
      }

      return text;
    }

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/msword': {
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return result.value || '';
      } catch (err) {
        console.error(`[DocumentReader] DOCX parse failed for ${fileName}:`, err);
        return '';
      }
    }

    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.ms-excel': {
      try {
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        let text = '';
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          if (sheet) {
            text += `--- ${sheetName} ---\n`;
            text += XLSX.utils.sheet_to_csv(sheet) + '\n';
          }
        }
        return text;
      } catch (err) {
        console.error(`[DocumentReader] Excel parse failed for ${fileName}:`, err);
        return '';
      }
    }

    case 'text/plain':
    case 'text/rtf': {
      return buffer.toString('utf-8');
    }

    default: {
      try {
        const text = buffer.toString('utf-8');
        if (/[a-zA-Zα-ωΑ-Ω]/.test(text) && text.length > 20) {
          return text;
        }
      } catch {
        // ignore
      }
      return '';
    }
  }
}

// ─── Document Reading ──────────────────────────────────────

/**
 * Reads ALL attached documents for a tender and returns their combined text.
 * This is the primary method AI services should use to get document content.
 * Caches extracted text in the DB so parsing only happens once per document.
 *
 * @param tenderId - The tender ID
 * @returns Combined document text with file headers
 */
export async function readTenderDocuments(tenderId: string): Promise<string> {
  const docs = await db.attachedDocument.findMany({
    where: { tenderId },
    orderBy: { createdAt: 'asc' },
  });

  if (docs.length === 0) return '';

  const parts: string[] = [];

  for (const doc of docs) {
    try {
      // Use cached extracted text if available AND non-trivial
      if (doc.extractedText && doc.extractedText.trim().length > 100) {
        parts.push(`--- ${doc.fileName} ---\n${doc.extractedText}`);
        continue;
      }

      const buffer = await getFileBuffer(doc.fileKey);
      if (buffer.length === 0) {
        await db.attachedDocument.update({
          where: { id: doc.id },
          data: { parsingStatus: 'failed', parsingError: 'Κενό αρχείο' },
        });
        continue;
      }

      const text = await extractText(buffer, doc.mimeType || 'application/pdf', doc.fileName);

      if (!text || text.trim().length < 10) {
        await db.attachedDocument.update({
          where: { id: doc.id },
          data: {
            parsingStatus: 'failed',
            parsingError: 'Δεν εξήχθη κείμενο (ούτε με OCR)',
            extractedText: null,
          },
        });
        parts.push(`--- ${doc.fileName} ---\n[Δεν εξήχθη κείμενο]`);
        continue;
      }

      // Count pages for PDFs
      let pageCount: number | null = null;
      if (doc.mimeType === 'application/pdf') {
        try {
          const pdfParse = (await import('pdf-parse')).default;
          const pdfData = await pdfParse(buffer);
          pageCount = pdfData.numpages;
        } catch { /* ignore page count errors */ }
      }

      // Store extracted text in DB for caching
      await db.attachedDocument.update({
        where: { id: doc.id },
        data: {
          extractedText: text,
          pageCount,
          parsingStatus: 'success',
          parsingError: null,
        },
      });

      parts.push(`--- ${doc.fileName} ---\n${text}`);
    } catch (err) {
      console.error(`[DocumentReader] Failed to process ${doc.fileName}:`, err);
      await db.attachedDocument.update({
        where: { id: doc.id },
        data: {
          parsingStatus: 'failed',
          parsingError: err instanceof Error ? err.message : 'Άγνωστο σφάλμα',
        },
      });
      parts.push(`--- ${doc.fileName} ---\n[Σφάλμα ανάγνωσης: ${err instanceof Error ? err.message : 'Άγνωστο'}]`);
    }
  }

  return parts.join('\n\n');
}

/**
 * Reads a specific attached document and returns its text.
 */
export async function readSingleDocument(fileKey: string, mimeType: string, fileName: string): Promise<string> {
  try {
    const buffer = await getFileBuffer(fileKey);
    return await extractText(buffer, mimeType, fileName);
  } catch (err) {
    console.error(`[DocumentReader] Failed to read ${fileName}:`, err);
    return '';
  }
}

/**
 * Guard: ensures documents exist AND are parsed before AI analysis.
 * If documents exist but haven't been parsed yet, triggers parsing first.
 * Throws PRECONDITION_FAILED only if no documents exist at all.
 */
export async function requireDocuments(tenderId: string): Promise<void> {
  const totalDocs = await db.attachedDocument.count({
    where: { tenderId },
  });

  if (totalDocs === 0) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Δεν βρέθηκαν έγγραφα. Ανεβάστε πρώτα τη διακήρυξη.',
    });
  }

  // Check if any docs are unparsed (parsingStatus is null)
  const unparsedCount = await db.attachedDocument.count({
    where: { tenderId, parsingStatus: null },
  });

  if (unparsedCount > 0) {
    // Trigger parsing by reading all documents (this will cache extracted text)
    console.log(`[requireDocuments] ${unparsedCount} unparsed docs found, triggering parsing...`);
    await readTenderDocuments(tenderId);
  }

  // Now check for successfully parsed docs
  const parsedCount = await db.attachedDocument.count({
    where: { tenderId, parsingStatus: 'success' },
  });

  if (parsedCount === 0) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Τα έγγραφα δεν περιέχουν αναγνώσιμο κείμενο (σκαναρισμένα PDF;). Δοκιμάστε με searchable PDF.',
    });
  }
}
