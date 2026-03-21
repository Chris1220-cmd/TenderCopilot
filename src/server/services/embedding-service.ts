/**
 * Gemini embedding service + pgvector operations.
 * Handles: text → embedding, batch insert to DB, semantic search.
 */

import { db } from '@/lib/db';
import type { DocumentChunkData } from './document-chunker';

// ─── LRU Cache for query embeddings ──────────────────────────

const CACHE_MAX = 1000;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const queryCache = new Map<string, { embedding: number[]; ts: number }>();

function getCachedEmbedding(text: string): number[] | null {
  const entry = queryCache.get(text);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.embedding;
  if (entry) queryCache.delete(text);
  return null;
}

function setCachedEmbedding(text: string, embedding: number[]): void {
  if (queryCache.size >= CACHE_MAX) {
    const firstKey = queryCache.keys().next().value;
    if (firstKey) queryCache.delete(firstKey);
  }
  queryCache.set(text, { embedding, ts: Date.now() });
}

// ─── Gemini Embedding (via REST API v1) ──────────────────────

const EMBEDDING_MODEL = 'text-embedding-004';

/**
 * Call Gemini embedding API directly via REST (v1, not v1beta).
 * The @google/generative-ai SDK uses v1beta which doesn't support embedding models.
 */
async function callEmbeddingAPI(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY required for embeddings');

  const url = `https://generativelanguage.googleapis.com/v1/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding API error ${response.status}: ${error.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.embedding.values;
}

/**
 * Embed a single text string. Returns 768-dim vector.
 */
export async function embedText(text: string): Promise<number[]> {
  const cached = getCachedEmbedding(text);
  if (cached) return cached;

  const embedding = await callEmbeddingAPI(text);
  setCachedEmbedding(text, embedding);
  return embedding;
}

/**
 * Embed multiple texts. Returns array of 768-dim vectors.
 * Uses concurrency control to avoid rate limits.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];

  // Process in small batches with concurrency control
  const CONCURRENCY = 5;
  for (let i = 0; i < texts.length; i += CONCURRENCY) {
    const batch = texts.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((text) => callEmbeddingAPI(text))
    );
    results.push(...batchResults);
  }

  return results;
}

// ─── pgvector Operations ─────────────────────────────────────

/**
 * Store document chunks with embeddings in DB.
 * Uses raw SQL because Prisma doesn't support vector type natively.
 */
export async function storeChunksWithEmbeddings(
  documentId: string,
  tenderId: string,
  tenantId: string,
  chunks: DocumentChunkData[],
  embeddings: number[][]
): Promise<void> {
  // Delete existing chunks for this document (re-embedding case)
  await db.documentChunk.deleteMany({ where: { documentId } });

  // Insert chunks with embeddings via raw SQL
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];
    const id = crypto.randomUUID();
    const embeddingStr = `[${embedding.join(',')}]`;

    await db.$executeRaw`
      INSERT INTO "DocumentChunk" (
        "id", "documentId", "tenderId", "tenantId",
        "chunkIndex", "content", "embedding", "metadata", "tokenCount", "createdAt"
      ) VALUES (
        ${id},
        ${documentId}, ${tenderId}, ${tenantId},
        ${chunk.chunkIndex}, ${chunk.content},
        ${embeddingStr}::vector,
        ${JSON.stringify(chunk.metadata)}::jsonb,
        ${chunk.tokenCount},
        NOW()
      )
    `;
  }
}

// ─── Semantic Search ─────────────────────────────────────────

export interface SearchResult {
  id: string;
  content: string;
  metadata: any;
  tokenCount: number;
  similarity: number;
  documentId: string;
}

/**
 * Search for relevant document chunks using cosine similarity.
 */
export async function searchDocumentChunks(
  tenderId: string,
  tenantId: string,
  query: string,
  limit: number = 5
): Promise<SearchResult[]> {
  const queryEmbedding = await embedText(query);
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  // Fetch 2x limit for reranking headroom
  const chunks = await db.$queryRaw<SearchResult[]>`
    SELECT
      id, content, metadata, "tokenCount", "documentId",
      1 - (embedding <=> ${embeddingStr}::vector) as similarity
    FROM "DocumentChunk"
    WHERE "tenderId" = ${tenderId} AND "tenantId" = ${tenantId}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${limit * 2}
  `;

  // Keyword reranking: boost chunks containing query terms
  const reranked = rerankByKeywords(chunks, query);
  return reranked.slice(0, limit);
}

/**
 * Hybrid reranking: 0.7 * cosine + 0.3 * keyword overlap.
 */
function rerankByKeywords(chunks: SearchResult[], query: string): SearchResult[] {
  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (queryTerms.length === 0) return chunks;

  return chunks
    .map((chunk) => {
      const contentLower = chunk.content.toLowerCase();
      const matchCount = queryTerms.filter((t) => contentLower.includes(t)).length;
      const keywordScore = matchCount / queryTerms.length;
      const hybridScore = 0.7 * chunk.similarity + 0.3 * keywordScore;
      return { ...chunk, similarity: hybridScore };
    })
    .sort((a, b) => b.similarity - a.similarity);
}
