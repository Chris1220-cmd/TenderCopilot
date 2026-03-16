import { Queue } from 'bullmq';

/**
 * Queue instances for use in API handlers.
 * The actual workers are in worker.ts (run as a separate process).
 */

const connection = {
  host: new URL(process.env.REDIS_URL || 'redis://localhost:6379').hostname,
  port: parseInt(new URL(process.env.REDIS_URL || 'redis://localhost:6379').port || '6379'),
};

export const tenderAnalysisQueue = new Queue('tender-analysis', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  },
});

export const complianceCheckQueue = new Queue('compliance-check', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 3000 },
  },
});

export const documentGenerationQueue = new Queue('document-generation', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 3000 },
  },
});
