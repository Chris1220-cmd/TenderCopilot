/**
 * API route to backfill embeddings for existing documents.
 * GET /api/backfill-embeddings
 * This runs in the Next.js server where Prisma is properly configured.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { chunkDocument } from '@/server/services/document-chunker';
import { embedBatch, storeChunksWithEmbeddings } from '@/server/services/embedding-service';

export async function GET() {
  const results: string[] = [];

  try {
    // Find all documents with extractedText
    const docs = await db.attachedDocument.findMany({
      where: { extractedText: { not: null } },
      select: {
        id: true,
        fileName: true,
        tenderId: true,
        extractedText: true,
        tender: { select: { tenantId: true } },
      },
    });

    results.push(`Found ${docs.length} documents with text`);

    // Check which already have chunks
    const docsWithChunks = await db.documentChunk.groupBy({
      by: ['documentId'],
      _count: true,
    });
    const chunkedDocIds = new Set(docsWithChunks.map((d) => d.documentId));

    const docsToProcess = docs.filter((d) => !chunkedDocIds.has(d.id));
    results.push(`${docsToProcess.length} documents need embedding`);

    for (const doc of docsToProcess) {
      if (!doc.extractedText || !doc.tender?.tenantId) {
        results.push(`Skipped ${doc.fileName} — no text or tenant`);
        continue;
      }

      try {
        // 1. Chunk
        const chunks = chunkDocument(doc.extractedText);
        if (chunks.length === 0) {
          results.push(`${doc.fileName}: no chunks`);
          continue;
        }

        // 2. Embed
        const embeddings = await embedBatch(chunks.map((c) => c.content));

        // 3. Store
        await storeChunksWithEmbeddings(
          doc.id,
          doc.tenderId,
          doc.tender.tenantId,
          chunks,
          embeddings
        );

        results.push(`✅ ${doc.fileName}: ${chunks.length} chunks embedded`);
      } catch (err: any) {
        results.push(`❌ ${doc.fileName}: ${err.message?.slice(0, 100)}`);
      }
    }

    const totalChunks = await db.documentChunk.count();
    results.push(`Total chunks in DB: ${totalChunks}`);

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, results }, { status: 500 });
  }
}
