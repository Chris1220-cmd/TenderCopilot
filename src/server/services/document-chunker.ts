/**
 * Smart document chunking for RAG pipeline.
 * Splits extracted text into overlapping chunks preserving paragraph boundaries.
 */

export interface DocumentChunkData {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata: {
    page?: number;
    section?: string;
    headings?: string[];
  };
}

/** Rough token count for Greek text (~1 token per 3 chars) */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

/** Extract section headings from text (lines that look like headers) */
function extractHeadings(text: string): string[] {
  const headings: string[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Greek uppercase headers or numbered sections
    if (
      trimmed.length > 5 &&
      trimmed.length < 200 &&
      (
        trimmed === trimmed.toUpperCase() ||
        /^(ΑΡΘΡΟ|ΚΕΦΑΛΑΙΟ|ΠΑΡΑΡΤΗΜΑ|ΜΕΡΟΣ|§|Άρθρο)\s/i.test(trimmed) ||
        /^\d+(\.\d+)*\s+[Α-Ω]/.test(trimmed)
      )
    ) {
      headings.push(trimmed);
    }
  }
  return headings.slice(-3); // Keep last 3 headings for context
}

/**
 * Split text into chunks with overlap.
 * @param text - The full extracted text
 * @param targetTokens - Target tokens per chunk (default 600)
 * @param overlapTokens - Overlap between chunks (default 100)
 */
export function chunkDocument(
  text: string,
  targetTokens: number = 600,
  overlapTokens: number = 100
): DocumentChunkData[] {
  if (!text || text.trim().length === 0) return [];

  const targetChars = targetTokens * 3;
  const overlapChars = overlapTokens * 3;

  // Split into paragraphs
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);

  const chunks: DocumentChunkData[] = [];
  let currentContent = '';
  let chunkIndex = 0;

  for (const para of paragraphs) {
    const wouldExceed = (currentContent + '\n\n' + para).length > targetChars;

    if (wouldExceed && currentContent.length > 0) {
      // Save current chunk
      const content = currentContent.trim();
      chunks.push({
        chunkIndex,
        content,
        tokenCount: estimateTokens(content),
        metadata: {
          headings: extractHeadings(content),
        },
      });
      chunkIndex++;

      // Start new chunk with overlap from end of previous
      const overlapText = currentContent.slice(-overlapChars);
      currentContent = overlapText + '\n\n' + para;
    } else {
      currentContent += (currentContent ? '\n\n' : '') + para;
    }
  }

  // Don't forget the last chunk
  if (currentContent.trim().length > 0) {
    const content = currentContent.trim();
    chunks.push({
      chunkIndex,
      content,
      tokenCount: estimateTokens(content),
      metadata: {
        headings: extractHeadings(content),
      },
    });
  }

  return chunks;
}
