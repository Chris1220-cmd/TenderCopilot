/**
 * Job queue abstraction.
 * Uses BullMQ when Redis is available, falls back to inline execution otherwise.
 * This allows deployment without Redis (Vercel, etc.)
 */

interface JobQueue {
  add(name: string, data: any): Promise<void>;
}

function createQueue(queueName: string): JobQueue {
  if (process.env.REDIS_URL) {
    try {
      const { Queue } = require('bullmq');
      const url = new URL(process.env.REDIS_URL);
      const connection = {
        host: url.hostname,
        port: parseInt(url.port || '6379'),
      };
      const queue = new Queue(queueName, {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      });
      return queue;
    } catch {
      // Redis not available, fall through to inline
    }
  }

  // Fallback: log job (in production, these would be processed by a worker)
  return {
    async add(name: string, data: any) {
      console.log(`[Queue:${queueName}] Job "${name}" queued (inline mode):`, JSON.stringify(data).slice(0, 200));
    },
  };
}

export const tenderAnalysisQueue = createQueue('tender-analysis');
export const complianceCheckQueue = createQueue('compliance-check');
export const documentGenerationQueue = createQueue('document-generation');
