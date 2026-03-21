import { Worker, Queue } from 'bullmq';
const connection = {
  host: new URL(process.env.REDIS_URL || 'redis://localhost:6379').hostname,
  port: parseInt(new URL(process.env.REDIS_URL || 'redis://localhost:6379').port || '6379'),
};
import { tenderAnalysisService } from '@/server/services/tender-analysis';
import { complianceEngine } from '@/server/services/compliance-engine';
import { documentGenerator } from '@/server/services/document-generator';
import { chunkDocument } from '@/server/services/document-chunker';
import { embedBatch, storeChunksWithEmbeddings } from '@/server/services/embedding-service';

// ─── Queue definitions ──────────────────────────────────────

export const tenderAnalysisQueue = new Queue('tender-analysis', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

export const complianceCheckQueue = new Queue('compliance-check', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { count: 100 },
  },
});

export const documentGenerationQueue = new Queue('document-generation', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { count: 100 },
  },
});

// ─── Workers ─────────────────────────────────────────────────

const analysisWorker = new Worker(
  'tender-analysis',
  async (job) => {
    const { tenderId, documentTexts } = job.data as {
      tenderId: string;
      documentTexts: string[];
    };

    console.log(`[Worker] Analyzing tender ${tenderId}...`);
    const analysis = await tenderAnalysisService.analyzeTender(tenderId, documentTexts);
    await tenderAnalysisService.saveRequirements(tenderId, analysis);
    console.log(`[Worker] Tender ${tenderId} analysis complete: ${analysis.requirements.length} requirements`);

    // Auto-trigger compliance check after analysis
    await complianceCheckQueue.add('check', {
      tenderId,
      tenantId: job.data.tenantId,
    });
  },
  { connection, concurrency: 2 }
);

const complianceWorker = new Worker(
  'compliance-check',
  async (job) => {
    const { tenderId, tenantId } = job.data as {
      tenderId: string;
      tenantId: string;
    };

    console.log(`[Worker] Running compliance check for tender ${tenderId}...`);
    const result = await complianceEngine.runComplianceCheck(tenderId, tenantId);
    console.log(`[Worker] Compliance check complete: score ${result.score.toFixed(1)}%`);
  },
  { connection, concurrency: 3 }
);

const docGenWorker = new Worker(
  'document-generation',
  async (job) => {
    const { tenderId, tenantId, type, requirementTexts } = job.data as {
      tenderId: string;
      tenantId: string;
      type: string;
      requirementTexts?: string[];
    };

    console.log(`[Worker] Generating document type "${type}" for tender ${tenderId}...`);

    switch (type) {
      case 'solemn_declaration':
        await documentGenerator.generateSolemnDeclaration(tenderId, tenantId, requirementTexts || []);
        break;
      case 'non_exclusion':
        await documentGenerator.generateNonExclusionDeclaration(tenderId, tenantId);
        break;
      case 'technical_compliance':
        await documentGenerator.generateTechnicalComplianceTable(tenderId, tenantId);
        break;
      case 'technical_proposal':
        await documentGenerator.generateTechnicalProposal(tenderId, tenantId);
        break;
      default:
        throw new Error(`Unknown document type: ${type}`);
    }

    console.log(`[Worker] Document generation complete for tender ${tenderId}`);
  },
  { connection, concurrency: 2 }
);

const embeddingWorker = new Worker(
  'document-embedding',
  async (job) => {
    const { documentId, tenderId, tenantId, extractedText } = job.data as {
      documentId: string;
      tenderId: string;
      tenantId: string;
      extractedText: string;
    };

    console.log(`[Worker] Embedding document ${documentId} (${extractedText.length} chars)...`);

    // 1. Chunk the text
    const chunks = chunkDocument(extractedText);
    if (chunks.length === 0) {
      console.log(`[Worker] No chunks produced for document ${documentId}`);
      return;
    }

    console.log(`[Worker] Chunked into ${chunks.length} pieces, embedding...`);

    // 2. Embed all chunks
    const embeddings = await embedBatch(chunks.map((c) => c.content));

    // 3. Store in DB with vectors
    await storeChunksWithEmbeddings(documentId, tenderId, tenantId, chunks, embeddings);

    console.log(`[Worker] Document ${documentId} embedded: ${chunks.length} chunks stored`);
  },
  {
    connection,
    concurrency: 1,
  }
);

// ─── Error handling ──────────────────────────────────────────

for (const worker of [analysisWorker, complianceWorker, docGenWorker, embeddingWorker]) {
  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err);
  });
  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err);
  });
}

console.log('🏭 TenderCopilot workers started');
