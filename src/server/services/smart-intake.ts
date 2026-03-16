/**
 * Smart Intake Service
 * Handles the "drop files and we do everything" flow.
 * Accepts files, extracts text, identifies what they are,
 * creates a tender, runs analysis, and triggers compliance check.
 *
 * Supported file types:
 * - PDF (via pdf-parse)
 * - DOCX (via mammoth)
 * - Excel XLSX/XLS (via xlsx)
 * - Plain text / RTF
 */

import { db } from '@/lib/db';
import { uploadFile, getFileBuffer } from '@/lib/s3';
import { ai } from '@/server/ai';
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

// ─── Text Extraction ────────────────────────────────────────

/**
 * Extracts text content from a file buffer based on MIME type.
 *
 * TODO: Install and use real parsers in production:
 * - PDF: `npm install pdf-parse` -> const pdf = require('pdf-parse'); const data = await pdf(buffer);
 * - DOCX: `npm install mammoth` -> const mammoth = require('mammoth'); const result = await mammoth.extractRawText({buffer});
 * - XLSX: `npm install xlsx` -> const XLSX = require('xlsx'); const workbook = XLSX.read(buffer);
 *
 * For now, we attempt basic text extraction with fallbacks.
 */
async function extractTextFromFile(buffer: Buffer, mimeType: string): Promise<string> {
  switch (mimeType) {
    case 'application/pdf': {
      // TODO: Real implementation with pdf-parse:
      // const pdfParse = require('pdf-parse');
      // const data = await pdfParse(buffer);
      // return data.text;

      // Stub: Try to extract readable text from PDF binary
      // PDF files contain text between BT (Begin Text) and ET (End Text) markers
      // This is a very rough extraction for development only
      const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 50000));
      const textChunks: string[] = [];

      // Look for text between parentheses in PDF content streams
      const parenRegex = /\(([^)]{2,})\)/g;
      let match: RegExpExecArray | null;
      while ((match = parenRegex.exec(content)) !== null) {
        const text = match[1].replace(/\\[nrt]/g, ' ').trim();
        if (text.length > 2 && /[a-zA-Zα-ωΑ-Ω]/.test(text)) {
          textChunks.push(text);
        }
      }

      return textChunks.join(' ') || '[PDF content - requires pdf-parse library for full extraction]';
    }

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
      // TODO: Real implementation with mammoth:
      // const mammoth = require('mammoth');
      // const result = await mammoth.extractRawText({ buffer });
      // return result.value;

      // Stub: DOCX files are ZIP archives containing XML
      // The main content is in word/document.xml
      // For development, try to extract any readable text
      const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 50000));
      const xmlTextRegex = />([^<]{3,})</g;
      const textChunks: string[] = [];
      let match: RegExpExecArray | null;
      while ((match = xmlTextRegex.exec(content)) !== null) {
        const text = match[1].trim();
        if (/[a-zA-Zα-ωΑ-Ω]/.test(text)) {
          textChunks.push(text);
        }
      }

      return textChunks.join(' ') || '[DOCX content - requires mammoth library for full extraction]';
    }

    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.ms-excel': {
      // TODO: Real implementation with xlsx:
      // const XLSX = require('xlsx');
      // const workbook = XLSX.read(buffer, { type: 'buffer' });
      // let text = '';
      // for (const sheetName of workbook.SheetNames) {
      //   const sheet = workbook.Sheets[sheetName];
      //   text += XLSX.utils.sheet_to_csv(sheet) + '\n';
      // }
      // return text;

      return '[Excel content - requires xlsx library for extraction]';
    }

    case 'text/plain':
    case 'text/rtf': {
      return buffer.toString('utf-8');
    }

    case 'application/msword': {
      // TODO: Old .doc format - would need 'word-extractor' npm package
      // const WordExtractor = require('word-extractor');
      // const extractor = new WordExtractor();
      // const doc = await extractor.extract(buffer);
      // return doc.getBody();

      return '[DOC content - requires word-extractor library for extraction]';
    }

    default: {
      // Try UTF-8 decode as last resort
      try {
        const text = buffer.toString('utf-8');
        if (/[a-zA-Zα-ωΑ-Ω]/.test(text)) {
          return text;
        }
      } catch {
        // ignore
      }
      return `[Unsupported file type: ${mimeType}]`;
    }
  }
}

/**
 * Uses AI to identify tender metadata from raw extracted text.
 *
 * Sends the extracted text to the AI provider with a structured prompt
 * asking it to identify key tender information.
 */
async function identifyTenderMetadata(
  texts: string[],
  fileNames: string[]
): Promise<ExtractedTenderMetadata> {
  const combinedText = texts
    .map((text, i) => `--- File: ${fileNames[i]} ---\n${text.substring(0, 5000)}`)
    .join('\n\n');

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
    const parsed = JSON.parse(result.content);
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
    // AI returned non-JSON or malformed response
    // Fall back to extracting what we can from filenames
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
   *
   * Flow:
   * 1. Extract text from each file (PDF, DOCX, Excel, etc.)
   * 2. Use AI to identify: is this a tender? What's the title, authority, deadline?
   * 3. Create Tender record in DB
   * 4. Upload files to S3 and create AttachedDocument records
   * 5. Queue tender analysis job (extracts requirements from full text)
   * 6. Queue compliance check job (runs after analysis completes)
   * 7. Return { tenderId, extractedMetadata, fileCount }
   */
  async processFiles(files: InputFile[], tenantId: string): Promise<IntakeResult> {
    if (files.length === 0) {
      throw new Error('No files provided');
    }

    // ── Step 1: Extract text from all files ──────────────────
    const extractedTexts: string[] = [];
    const fileNames: string[] = [];

    for (const file of files) {
      const text = await extractTextFromFile(file.buffer, file.mimeType);
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

    // ── Step 4: Upload files to S3 ───────────────────────────
    for (const file of files) {
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._\-α-ωΑ-Ω]/g, '_');
      const s3Key = `tenants/${tenantId}/tenders/${tender.id}/attachments/${Date.now()}-${sanitizedName}`;

      await uploadFile(s3Key, file.buffer, file.mimeType);

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
    const analysisJob = await tenderAnalysisQueue.add('analyze-tender', {
      tenderId: tender.id,
      tenantId,
    });

    // ── Step 6: Queue compliance check (runs after analysis) ─
    // BullMQ doesn't have native job dependencies, so we add a delay
    // to let the analysis complete first. In production, the analysis
    // worker should trigger the compliance check when it finishes.
    await complianceCheckQueue.add(
      'check-compliance',
      {
        tenderId: tender.id,
        tenantId,
      },
      {
        delay: 60000, // 1 minute delay to let analysis complete
        // TODO: Replace with proper job chaining. The analysis worker
        // should add the compliance check job when it completes.
      }
    );

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
      files.push({
        name: fileInfo.name,
        buffer,
        mimeType: fileInfo.mimeType,
      });
    }

    return this.processFiles(files, tenantId);
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
