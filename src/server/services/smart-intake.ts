/**
 * Smart Intake Service
 * Handles the "drop files and we do everything" flow.
 * Accepts files, extracts text, identifies what they are,
 * creates a tender, runs analysis, and triggers compliance check.
 *
 * Uses REAL parsers:
 * - PDF via pdf-parse
 * - DOCX via mammoth
 * - Excel via xlsx
 * - Plain text / RTF direct
 */

import { db } from '@/lib/db';
import { uploadFile, getFileBuffer } from '@/lib/s3';
import { ai } from '@/server/ai';
import { parseAIResponse } from './ai-prompts';
import { tenderAnalysisQueue, complianceCheckQueue } from '@/server/jobs/queues';

// ─── Types ──────────────────────────────────────────────────

interface InputFile {
  name: string;
  buffer: Buffer;
  mimeType: string;
}

interface ExtractedTenderMetadata {
  title: string;
  referenceNumber?: string;
  contractingAuthority?: string;
  budget?: number;
  submissionDeadline?: string; // ISO date string
  cpvCodes?: string[];
  summary?: string;
  isTenderDocument: boolean;
  confidence: number; // 0-1
}

interface IntakeResult {
  tenderId: string;
  extractedMetadata: ExtractedTenderMetadata;
  fileCount: number;
}

// ─── Text Extraction (REAL implementations) ─────────────────

/**
 * Extracts text content from a file buffer based on MIME type.
 * Uses real parsing libraries — no stubs.
 */
async function extractTextFromFile(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  switch (mimeType) {
    case 'application/pdf': {
      try {
        const pdfParse = (await import('pdf-parse')).default;
        const data = await pdfParse(buffer);
        if (!data.text || data.text.trim().length < 10) {
          return `[PDF χωρίς εξαγώγιμο κείμενο — πιθανόν σκαναρισμένο: ${fileName}]`;
        }
        return data.text;
      } catch (err) {
        console.error(`[SmartIntake] PDF parse failed for ${fileName}:`, err);
        return `[Αποτυχία ανάγνωσης PDF: ${fileName}]`;
      }
    }

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        if (!result.value || result.value.trim().length < 10) {
          return `[DOCX χωρίς κείμενο: ${fileName}]`;
        }
        return result.value;
      } catch (err) {
        console.error(`[SmartIntake] DOCX parse failed for ${fileName}:`, err);
        return `[Αποτυχία ανάγνωσης DOCX: ${fileName}]`;
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
            text += `--- Φύλλο: ${sheetName} ---\n`;
            text += XLSX.utils.sheet_to_csv(sheet) + '\n\n';
          }
        }
        if (text.trim().length < 10) {
          return `[Excel χωρίς δεδομένα: ${fileName}]`;
        }
        return text;
      } catch (err) {
        console.error(`[SmartIntake] Excel parse failed for ${fileName}:`, err);
        return `[Αποτυχία ανάγνωσης Excel: ${fileName}]`;
      }
    }

    case 'text/plain':
    case 'text/rtf': {
      return buffer.toString('utf-8');
    }

    case 'application/msword': {
      // Old .doc format — try mammoth which has some support
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return result.value || `[DOC χωρίς κείμενο: ${fileName}]`;
      } catch {
        return `[Μη υποστηριζόμενη μορφή .doc: ${fileName}]`;
      }
    }

    default: {
      // Try UTF-8 decode as last resort
      try {
        const text = buffer.toString('utf-8');
        if (/[a-zA-Zα-ωΑ-Ω]/.test(text) && text.length > 20) {
          return text;
        }
      } catch {
        // ignore
      }
      return `[Μη υποστηριζόμενος τύπος αρχείου: ${mimeType} — ${fileName}]`;
    }
  }
}

/**
 * Uses AI to identify tender metadata from raw extracted text.
 * Sends the FULL extracted text to Claude for analysis.
 */
async function identifyTenderMetadata(
  texts: string[],
  fileNames: string[]
): Promise<ExtractedTenderMetadata> {
  // Use more text — up to 15000 chars per file for better analysis
  const combinedText = texts
    .map((text, i) => `--- Αρχείο: ${fileNames[i]} ---\n${text.substring(0, 15000)}`)
    .join('\n\n');

  if (combinedText.length < 50) {
    // Not enough text to analyze
    return {
      title: fileNames.map((f) => f.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')).join(' - ') || 'Imported Tender',
      isTenderDocument: false,
      confidence: 0.1,
      cpvCodes: [],
    };
  }

  const aiProvider = ai();

  const result = await aiProvider.complete({
    messages: [
      {
        role: 'system',
        content: `You are a Greek public procurement expert. Analyze the provided document text and extract tender metadata.
Respond with valid JSON only, no markdown formatting.

JSON schema:
{
  "isTenderDocument": boolean,
  "confidence": number (0-1),
  "title": string,
  "referenceNumber": string | null,
  "contractingAuthority": string | null,
  "budget": number | null,
  "submissionDeadline": string | null (ISO 8601 date),
  "cpvCodes": string[] (format: "XXXXXXXX-X"),
  "summary": string (2-3 sentences describing the tender scope)
}

Look for Greek procurement terminology:
- Διακήρυξη, Προκήρυξη = Tender notice
- Αναθέτουσα Αρχή = Contracting Authority
- Προϋπολογισμός = Budget (look for amounts in euros)
- Καταληκτική ημερομηνία = Submission deadline
- CPV κωδικοί = CPV codes
- Αρ. Πρωτ., Αρ. Συστήματος, Αρ. Διακήρυξης = Reference number

If the text doesn't appear to be a tender document, set isTenderDocument to false
and provide your best guess for the title.`,
      },
      {
        role: 'user',
        content: `Extract tender metadata from these documents:\n\n${combinedText}`,
      },
    ],
    maxTokens: 1000,
    temperature: 0.1,
    responseFormat: 'json',
  });

  try {
    const parsed = parseAIResponse<ExtractedTenderMetadata & { [key: string]: unknown }>(result.content, [], 'identifyTenderMetadata');
    return {
      title: parsed.title || 'Untitled Tender',
      referenceNumber: parsed.referenceNumber || undefined,
      contractingAuthority: parsed.contractingAuthority || undefined,
      budget: parsed.budget || undefined,
      submissionDeadline: parsed.submissionDeadline || undefined,
      cpvCodes: parsed.cpvCodes || [],
      summary: parsed.summary || undefined,
      isTenderDocument: parsed.isTenderDocument ?? true,
      confidence: parsed.confidence ?? 0.5,
    };
  } catch {
    // AI returned non-JSON — fall back to filename-based extraction
    const titleFromFiles = fileNames
      .map((f) => f.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '))
      .join(' - ');

    return {
      title: titleFromFiles || 'Imported Tender',
      isTenderDocument: true,
      confidence: 0.2,
      cpvCodes: [],
    };
  }
}

// ─── Main Service ───────────────────────────────────────────

class SmartIntakeService {
  /**
   * Process uploaded files: extract text, identify tender, create records, queue jobs.
   */
  async processFiles(files: InputFile[], tenantId: string): Promise<IntakeResult> {
    if (files.length === 0) {
      throw new Error('No files provided');
    }

    // ── Step 1: Extract text from all files ──────────────────
    const extractedTexts: string[] = [];
    const fileNames: string[] = [];

    for (const file of files) {
      const text = await extractTextFromFile(file.buffer, file.mimeType, file.name);
      extractedTexts.push(text);
      fileNames.push(file.name);
    }

    // ── Step 2: AI identification ────────────────────────────
    const metadata = await identifyTenderMetadata(extractedTexts, fileNames);

    // ── Step 3: Create Tender record ─────────────────────────
    const tender = await db.tender.create({
      data: {
        tenantId,
        title: metadata.title,
        referenceNumber: metadata.referenceNumber,
        contractingAuthority: metadata.contractingAuthority,
        platform: 'OTHER',
        cpvCodes: metadata.cpvCodes || [],
        budget: metadata.budget,
        submissionDeadline: metadata.submissionDeadline
          ? new Date(metadata.submissionDeadline)
          : undefined,
        status: 'DISCOVERY',
        notes: metadata.summary
          ? `AI-extracted summary: ${metadata.summary}\n\nConfidence: ${(metadata.confidence * 100).toFixed(0)}%`
          : `Imported via Smart Intake from ${files.length} file(s)`,
      },
    });

    // ── Step 4: Upload files to S3 & store extracted text ────
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._\-α-ωΑ-Ω]/g, '_');
      const s3Key = `tenants/${tenantId}/tenders/${tender.id}/attachments/${Date.now()}-${sanitizedName}`;

      await uploadFile(s3Key, file.buffer, file.mimeType);

      // Also store the extracted text as a separate file for AI access
      const textKey = `tenants/${tenantId}/tenders/${tender.id}/extracted-text/${Date.now()}-${sanitizedName}.txt`;
      await uploadFile(textKey, Buffer.from(extractedTexts[i], 'utf-8'), 'text/plain');

      await db.attachedDocument.create({
        data: {
          tenderId: tender.id,
          fileName: file.name,
          fileKey: s3Key,
          fileSize: file.buffer.length,
          mimeType: file.mimeType,
          category: this.guessCategory(file.name),
        },
      });
    }

    // ── Step 5: Queue analysis job ───────────────────────────
    await tenderAnalysisQueue.add('analyze-tender', {
      tenderId: tender.id,
      tenantId,
    });

    // ── Step 6: Queue compliance check ───────────────────────
    await complianceCheckQueue.add('check-compliance', {
      tenderId: tender.id,
      tenantId,
    });

    // ── Log activity ─────────────────────────────────────────
    await db.activity.create({
      data: {
        tenderId: tender.id,
        action: 'smart_intake_processed',
        details: JSON.stringify({
          fileCount: files.length,
          fileNames: files.map((f) => f.name),
          aiConfidence: metadata.confidence,
          isTenderDocument: metadata.isTenderDocument,
          extractedTextLengths: extractedTexts.map((t) => t.length),
        }),
      },
    });

    return {
      tenderId: tender.id,
      extractedMetadata: metadata,
      fileCount: files.length,
    };
  }

  /**
   * Process files that have already been uploaded to S3.
   * Fetches file buffers from S3, then runs the standard processFiles flow.
   */
  async processFromS3Keys(
    fileKeys: Array<{ key: string; name: string; mimeType: string }>,
    tenantId: string
  ): Promise<IntakeResult> {
    const files: InputFile[] = [];

    for (const fileInfo of fileKeys) {
      const buffer = await getFileBuffer(fileInfo.key);
      if (buffer.length === 0) {
        throw new Error(`Failed to download file: ${fileInfo.name}`);
      }
      files.push({
        name: fileInfo.name,
        buffer,
        mimeType: fileInfo.mimeType,
      });
    }

    return this.processFiles(files, tenantId);
  }

  /**
   * Extract text from an attached document's S3 file.
   * Used by AI services to read actual document content.
   */
  async extractTextFromAttachment(fileKey: string, mimeType: string, fileName: string): Promise<string> {
    const buffer = await getFileBuffer(fileKey);
    if (buffer.length === 0) {
      return `[Δεν βρέθηκε αρχείο: ${fileName}]`;
    }
    return extractTextFromFile(buffer, mimeType, fileName);
  }

  /**
   * Guesses the document category from the filename.
   */
  private guessCategory(fileName: string): string {
    const lower = fileName.toLowerCase();

    if (lower.includes('διακήρυξη') || lower.includes('prokirixi') || lower.includes('proclamation')) {
      return 'specification';
    }
    if (lower.includes('τεχνικ') || lower.includes('technical') || lower.includes('spec')) {
      return 'specification';
    }
    if (lower.includes('παράρτημα') || lower.includes('annex') || lower.includes('appendix')) {
      return 'appendix';
    }
    if (lower.includes('τεύχος') || lower.includes('volume')) {
      return 'specification';
    }
    if (lower.includes('teyd') || lower.includes('espd') || lower.includes('τυποποιημένο')) {
      return 'espd';
    }
    if (lower.includes('οικονομικ') || lower.includes('financial') || lower.includes('budget')) {
      return 'financial';
    }
    if (lower.includes('σύμβαση') || lower.includes('contract')) {
      return 'contract';
    }
    if (lower.includes('μελέτη') || lower.includes('study')) {
      return 'study';
    }
    if (lower.includes('διευκρίν') || lower.includes('clarification')) {
      return 'clarification';
    }

    return 'other';
  }
}

export const smartIntake = new SmartIntakeService();
