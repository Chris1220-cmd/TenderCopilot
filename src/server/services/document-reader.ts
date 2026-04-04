/**
 * Document Reader Service — Tiered Extraction Pipeline
 *
 * Tier 1: pdf-parse (local, free, instant)
 * Quality Gate: 3 criteria decide if Tier 2 is needed
 * Tier 2: Document AI (main) + Gemini Vision (parallel backup)
 *
 * For non-PDF files: mammoth (DOCX), xlsx (Excel), direct (text)
 */

import { db } from '@/lib/db';
import { getFileBuffer } from '@/lib/s3';
import { TRPCError } from '@trpc/server';
import { evaluateQualityGate, type QualityGateResult } from './quality-gate';
import { extractWithDocumentAI, isDocumentAIAvailable } from './document-ai';
import { embeddingQueue } from '@/server/jobs/queues';

// ─── Types ──────────────────────────────────────────────────

interface ExtractionResult {
  text: string;
  method: 'pdf_parse' | 'document_ai' | 'gemini_vision';
  confidence: number | null;
  docAiRecommended: boolean;
  qualityGateResult: QualityGateResult | null;
  pageCount: number | null;
}

// ─── Gemini Vision OCR (Tier 2 Backup) ──────────────────────

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

// ─── PDF Extraction Pipeline ────────────────────────────────

async function extractPdf(buffer: Buffer, fileName: string): Promise<ExtractionResult> {
  // ── Tier 1: pdf-parse ──────────────────────────────────
  let pdfText = '';
  let pageCount = 0;
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    pdfText = data.text || '';
    pageCount = data.numpages || 0;
  } catch (err) {
    console.error(`[DocumentReader] pdf-parse failed for ${fileName}:`, err);
  }

  // ── Quality Gate ───────────────────────────────────────
  const gateResult = evaluateQualityGate({
    text: pdfText,
    fileSizeBytes: buffer.length,
    pageCount,
  });

  console.log(`[DocumentReader] Quality Gate for ${fileName}: ${gateResult.passed ? 'PASS' : 'FAIL'} (charsPerKB=${gateResult.charsPerKB}, keywords=${gateResult.keywordHits}, charsPerPage=${gateResult.charsPerPage}${gateResult.docAiRecommended ? ', docAI recommended' : ''})`);

  // ── Gate PASSED → use pdf-parse text ───────────────────
  if (gateResult.passed) {
    return {
      text: pdfText,
      method: 'pdf_parse',
      confidence: null,
      docAiRecommended: gateResult.docAiRecommended,
      qualityGateResult: gateResult,
      pageCount,
    };
  }

  // ── Gate FAILED → Tier 2: Document AI + Gemini Vision ──
  console.log(`[DocumentReader] Quality Gate failed for ${fileName} (reasons: ${gateResult.reasons.join(', ')}). Running Tier 2...`);

  const [docAiResult, geminiText] = await Promise.all([
    isDocumentAIAvailable()
      ? extractWithDocumentAI(buffer, 'application/pdf', fileName)
      : Promise.resolve(null),
    extractTextWithGeminiVision(buffer, fileName),
  ]);

  if (docAiResult && docAiResult.text.length > 0) {
    console.log(`[DocumentReader] Using Document AI result for ${fileName} (${docAiResult.text.length} chars, confidence: ${(docAiResult.confidence * 100).toFixed(1)}%)`);
    return {
      text: docAiResult.text,
      method: 'document_ai',
      confidence: docAiResult.confidence,
      docAiRecommended: false,
      qualityGateResult: gateResult,
      pageCount: docAiResult.pageCount || pageCount,
    };
  }

  if (geminiText.length > 0) {
    console.log(`[DocumentReader] Document AI unavailable/failed, using Gemini Vision for ${fileName}`);
    return {
      text: geminiText,
      method: 'gemini_vision',
      confidence: null,
      docAiRecommended: false,
      qualityGateResult: gateResult,
      pageCount,
    };
  }

  console.warn(`[DocumentReader] All Tier 2 extractors failed for ${fileName}. Using pdf-parse text (${pdfText.length} chars).`);
  return {
    text: pdfText,
    method: 'pdf_parse',
    confidence: null,
    docAiRecommended: true,
    qualityGateResult: gateResult,
    pageCount,
  };
}

// ─── Non-PDF Extraction (unchanged) ─────────────────────────

async function extractNonPdf(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  switch (mimeType) {
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
    case 'text/rtf':
      return buffer.toString('utf-8');

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

// ─── Document Reading (Main Export) ─────────────────────────

export async function readTenderDocuments(tenderId: string): Promise<string> {
  const [docs, tender] = await Promise.all([
    db.attachedDocument.findMany({
      where: { tenderId },
      orderBy: { createdAt: 'asc' },
    }),
    db.tender.findUnique({ where: { id: tenderId }, select: { tenantId: true } }),
  ]);

  if (docs.length === 0) return '';

  const parts: string[] = [];

  for (const doc of docs) {
    try {
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

      const isPdf = (doc.mimeType || '').includes('pdf');

      if (isPdf) {
        const result = await extractPdf(buffer, doc.fileName);

        if (!result.text || result.text.trim().length < 10) {
          await db.attachedDocument.update({
            where: { id: doc.id },
            data: {
              parsingStatus: 'failed',
              parsingError: 'Δεν εξήχθη κείμενο (ούτε με OCR)',
              extractedText: null,
              extractionMethod: result.method,
              qualityGateResult: result.qualityGateResult
                ? JSON.stringify(result.qualityGateResult)
                : null,
            },
          });
          parts.push(`--- ${doc.fileName} ---\n[Δεν εξήχθη κείμενο]`);
          continue;
        }

        await db.attachedDocument.update({
          where: { id: doc.id },
          data: {
            extractedText: result.text,
            pageCount: result.pageCount,
            parsingStatus: 'success',
            parsingError: null,
            extractionMethod: result.method,
            extractionConfidence: result.confidence,
            docAiRecommended: result.docAiRecommended,
            qualityGateResult: result.qualityGateResult
              ? JSON.stringify(result.qualityGateResult)
              : null,
          },
        });

        // Queue embedding job (non-blocking)
        if (tender?.tenantId) {
          await embeddingQueue.add('embed', {
            documentId: doc.id,
            tenderId: doc.tenderId,
            tenantId: tender.tenantId,
            extractedText: result.text,
          });
        }

        parts.push(`--- ${doc.fileName} ---\n${result.text}`);
      } else {
        const text = await extractNonPdf(buffer, doc.mimeType || '', doc.fileName);

        if (!text || text.trim().length < 10) {
          await db.attachedDocument.update({
            where: { id: doc.id },
            data: {
              parsingStatus: 'failed',
              parsingError: 'Δεν εξήχθη κείμενο',
              extractedText: null,
              extractionMethod: 'pdf_parse',
            },
          });
          parts.push(`--- ${doc.fileName} ---\n[Δεν εξήχθη κείμενο]`);
          continue;
        }

        await db.attachedDocument.update({
          where: { id: doc.id },
          data: {
            extractedText: text,
            parsingStatus: 'success',
            parsingError: null,
            extractionMethod: 'pdf_parse',
          },
        });

        // Queue embedding job (non-blocking)
        if (tender?.tenantId) {
          await embeddingQueue.add('embed', {
            documentId: doc.id,
            tenderId: doc.tenderId,
            tenantId: tender.tenantId,
            extractedText: text,
          });
        }

        parts.push(`--- ${doc.fileName} ---\n${text}`);
      }
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

// ─── Deep Parse (triggered by user) ─────────────────────────

export async function deepParseDocument(documentId: string): Promise<{ success: boolean; method: string }> {
  const doc = await db.attachedDocument.findUnique({
    where: { id: documentId },
    include: { tender: { select: { tenantId: true } } },
  });
  if (!doc) throw new Error('Document not found');

  const buffer = await getFileBuffer(doc.fileKey);
  if (buffer.length === 0) throw new Error('Empty file');

  const mimeType = doc.mimeType || '';
  if (!mimeType.includes('pdf')) {
    throw new Error('Deep Parse is only available for PDF files');
  }

  const docAiResult = await extractWithDocumentAI(buffer, mimeType, doc.fileName);

  if (docAiResult && docAiResult.text.length > 0) {
    await db.attachedDocument.update({
      where: { id: documentId },
      data: {
        extractedText: docAiResult.text,
        pageCount: docAiResult.pageCount,
        parsingStatus: 'success',
        parsingError: null,
        extractionMethod: 'document_ai',
        extractionConfidence: docAiResult.confidence,
        docAiRecommended: false,
      },
    });

    // Queue embedding job (non-blocking)
    await embeddingQueue.add('embed', {
      documentId: doc.id,
      tenderId: doc.tenderId,
      tenantId: doc.tender.tenantId,
      extractedText: docAiResult.text,
    });

    return { success: true, method: 'document_ai' };
  }

  const geminiText = await extractTextWithGeminiVision(buffer, doc.fileName);
  if (geminiText.length > 0) {
    await db.attachedDocument.update({
      where: { id: documentId },
      data: {
        extractedText: geminiText,
        parsingStatus: 'success',
        parsingError: null,
        extractionMethod: 'gemini_vision',
        docAiRecommended: false,
      },
    });

    // Queue embedding job (non-blocking)
    await embeddingQueue.add('embed', {
      documentId: doc.id,
      tenderId: doc.tenderId,
      tenantId: doc.tender.tenantId,
      extractedText: geminiText,
    });

    return { success: true, method: 'gemini_vision' };
  }

  throw new Error('Document AI and Gemini Vision both failed');
}

// ─── Other Exports (unchanged) ──────────────────────────────

export async function readSingleDocument(fileKey: string, mimeType: string, fileName: string): Promise<string> {
  try {
    const buffer = await getFileBuffer(fileKey);
    const isPdf = mimeType.includes('pdf');
    if (isPdf) {
      const result = await extractPdf(buffer, fileName);
      return result.text;
    }
    return await extractNonPdf(buffer, mimeType, fileName);
  } catch (err) {
    console.error(`[DocumentReader] Failed to read ${fileName}:`, err);
    return '';
  }
}

export async function requireDocuments(tenderId: string): Promise<void> {
  const totalDocs = await db.attachedDocument.count({ where: { tenderId } });

  if (totalDocs === 0) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Δεν βρέθηκαν έγγραφα. Ανεβάστε πρώτα τη διακήρυξη.',
    });
  }

  const unparsedCount = await db.attachedDocument.count({
    where: { tenderId, parsingStatus: null },
  });

  if (unparsedCount > 0) {
    console.log(`[requireDocuments] ${unparsedCount} unparsed docs found, triggering parsing...`);
    await readTenderDocuments(tenderId);
  }

  const parsedCount = await db.attachedDocument.count({
    where: { tenderId, parsingStatus: 'success' },
  });

  if (parsedCount === 0) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `Τα ${totalDocs} έγγραφα δεν μπόρεσαν να αναλυθούν. Βεβαιωθείτε ότι τα PDF είναι searchable (όχι σκαναρισμένες εικόνες). Δοκιμάστε "Deep Parse" για OCR.`,
    });
  }
}
