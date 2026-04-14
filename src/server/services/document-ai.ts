/**
 * Google Document AI Client
 *
 * Handles OCR extraction via Document AI's prebuilt OCR processor.
 * Gracefully returns null if not configured (env vars missing).
 *
 * Setup:
 * 1. Enable Document AI API in GCP
 * 2. Create an OCR processor in 'eu' location
 * 3. Set env vars: GOOGLE_CLOUD_PROJECT_ID, DOCUMENT_AI_PROCESSOR_ID
 * 4. Auth: GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_JSON
 */

import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

// ─── Types ──────────────────────────────────────────────────

export interface DocumentAIResult {
  text: string;
  confidence: number;
  pageCount: number;
  processingTimeMs: number;
}

// ─── Configuration ──────────────────────────────────────────

// Cache the private-key health check result so we don't re-parse on every call.
let keyHealthChecked = false;
let keyHealthOk = false;

function isPrivateKeyHealthy(): boolean {
  if (keyHealthChecked) return keyHealthOk;
  keyHealthChecked = true;

  try {
    // Read the service account JSON from whichever env var is set.
    let pk: string | undefined;
    const jsonEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (jsonEnv) {
      pk = JSON.parse(jsonEnv).private_key;
    } else {
      const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (credPath) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const path = require('path');
        const resolved = path.isAbsolute(credPath) ? credPath : path.resolve(process.cwd(), credPath);
        if (fs.existsSync(resolved)) {
          pk = JSON.parse(fs.readFileSync(resolved, 'utf8')).private_key;
        }
      }
    }
    if (!pk) return (keyHealthOk = false);

    // Try to parse the private key — catches corrupt keys before they hit gRPC
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto');
    crypto.createPrivateKey({ key: pk, format: 'pem' });
    return (keyHealthOk = true);
  } catch {
    return (keyHealthOk = false);
  }
}

function getConfig() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'eu';

  if (!projectId || !processorId) {
    return null;
  }

  // If the service account private key is unparseable, skip Document AI
  // entirely so the Gemini Vision fallback runs cleanly instead of waiting
  // for a gRPC auth failure and polluting logs with DECODER errors.
  if (!isPrivateKeyHealthy()) {
    return null;
  }

  return { projectId, processorId, location };
}

function createClient(): DocumentProcessorServiceClient | null {
  const config = getConfig();
  if (!config) return null;

  // Support Vercel: service account JSON in env var
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    try {
      const credentials = JSON.parse(serviceAccountJson);
      return new DocumentProcessorServiceClient({
        credentials,
        apiEndpoint: `${config.location}-documentai.googleapis.com`,
      });
    } catch (err) {
      console.error('[DocumentAI] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', err);
      return null;
    }
  }

  // Fallback: GOOGLE_APPLICATION_CREDENTIALS file path
  return new DocumentProcessorServiceClient({
    apiEndpoint: `${config.location}-documentai.googleapis.com`,
  });
}

// ─── Availability Check ────────────────────────────────────

/**
 * Returns true if Document AI is configured and available.
 */
export function isDocumentAIAvailable(): boolean {
  return getConfig() !== null;
}

// ─── Online Processing ─────────────────────────────────────

async function processOnline(
  client: DocumentProcessorServiceClient,
  processorName: string,
  buffer: Buffer,
  mimeType: string
): Promise<DocumentAIResult> {
  const [result] = await client.processDocument({
    name: processorName,
    rawDocument: {
      content: buffer.toString('base64'),
      mimeType,
    },
  });

  const document = result.document;
  if (!document) {
    throw new Error('Document AI returned no document');
  }

  const text = document.text || '';
  const pages = document.pages || [];

  // Calculate average confidence across all pages
  let totalConfidence = 0;
  let confidenceCount = 0;
  for (const page of pages) {
    for (const block of page.blocks || []) {
      if (block.layout?.confidence) {
        totalConfidence += block.layout.confidence;
        confidenceCount++;
      }
    }
  }

  return {
    text,
    confidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
    pageCount: pages.length,
    processingTimeMs: 0,
  };
}

// ─── Main Export ─────────────────────────────────────────────

/**
 * Extract text from a PDF using Google Document AI.
 *
 * @returns Extraction result or null if Document AI is unavailable/fails
 */
export async function extractWithDocumentAI(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<DocumentAIResult | null> {
  const config = getConfig();
  if (!config) {
    console.warn('[DocumentAI] Not configured — skipping. Set GOOGLE_CLOUD_PROJECT_ID and DOCUMENT_AI_PROCESSOR_ID.');
    return null;
  }

  const client = createClient();
  if (!client) {
    console.error('[DocumentAI] Failed to create client');
    return null;
  }

  const processorName = `projects/${config.projectId}/locations/${config.location}/processors/${config.processorId}`;
  const startTime = Date.now();

  try {
    console.log(`[DocumentAI] Processing ${fileName} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)...`);

    const result = await processOnline(client, processorName, buffer, mimeType);
    result.processingTimeMs = Date.now() - startTime;

    console.log(`[DocumentAI] Extracted ${result.text.length} chars from ${fileName} in ${result.processingTimeMs}ms (confidence: ${(result.confidence * 100).toFixed(1)}%)`);

    return result;
  } catch (err) {
    console.error(`[DocumentAI] Failed to process ${fileName}:`, err);
    return null;
  }
}
