/**
 * Backfill script: Generate embeddings for existing documents that have extractedText but no chunks.
 * Run with: npx tsx scripts/backfill-embeddings.ts
 */

import { PrismaClient } from '@prisma/client';
import { chunkDocument } from '../src/server/services/document-chunker';
import { embedBatch, storeChunksWithEmbeddings } from '../src/server/services/embedding-service';

const db = new PrismaClient();

async function backfill() {
  console.log('🔍 Finding documents with text but no embeddings...');

  // Find all documents with extractedText
  const docs = await db.attachedDocument.findMany({
    where: {
      extractedText: { not: null },
    },
    select: {
      id: true,
      fileName: true,
      tenderId: true,
      extractedText: true,
      tender: { select: { tenantId: true } },
    },
  });

  console.log(`📄 Found ${docs.length} documents with text`);

  // Check which already have chunks
  const docsWithChunks = await db.documentChunk.groupBy({
    by: ['documentId'],
    _count: true,
  });
  const chunkedDocIds = new Set(docsWithChunks.map((d) => d.documentId));

  const docsToProcess = docs.filter((d) => !chunkedDocIds.has(d.id));
  console.log(`📝 ${docsToProcess.length} documents need embedding (${chunkedDocIds.size} already done)`);

  for (const doc of docsToProcess) {
    if (!doc.extractedText || !doc.tender?.tenantId) {
      console.log(`⏭️ Skipping ${doc.fileName} — no text or no tenant`);
      continue;
    }

    console.log(`\n🔄 Processing: ${doc.fileName} (${doc.extractedText.length} chars)...`);

    try {
      // 1. Chunk
      const chunks = chunkDocument(doc.extractedText);
      if (chunks.length === 0) {
        console.log(`  ⏭️ No chunks produced`);
        continue;
      }
      console.log(`  📦 ${chunks.length} chunks created`);

      // 2. Embed
      console.log(`  🧠 Embedding...`);
      const embeddings = await embedBatch(chunks.map((c) => c.content));
      console.log(`  ✅ ${embeddings.length} embeddings generated`);

      // 3. Store
      await storeChunksWithEmbeddings(
        doc.id,
        doc.tenderId,
        doc.tender.tenantId,
        chunks,
        embeddings
      );
      console.log(`  💾 Stored in DB`);
    } catch (err) {
      console.error(`  ❌ Error processing ${doc.fileName}:`, err);
    }
  }

  console.log('\n✅ Backfill complete!');

  // Show final counts
  const totalChunks = await db.documentChunk.count();
  console.log(`📊 Total chunks in DB: ${totalChunks}`);

  await db.$disconnect();
}

backfill().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
