import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    attachedDocument: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { requireDocuments } from './document-reader';
import { db } from '@/lib/db';

describe('requireDocuments', () => {
  beforeEach(() => vi.clearAllMocks());

  // requireDocuments calls count three times: total, unparsed, parsed.
  // When unparsed > 0 it re-parses via readTenderDocuments (hits findMany).
  // For most tests we keep unparsed = 0 so the re-parse branch is skipped.
  function mockCountSequence(total: number, unparsed: number, parsed: number) {
    vi.mocked(db.attachedDocument.count)
      .mockResolvedValueOnce(total)
      .mockResolvedValueOnce(unparsed)
      .mockResolvedValueOnce(parsed);
  }

  it('resolves when at least one parsed document exists', async () => {
    mockCountSequence(2, 0, 2);
    await expect(requireDocuments('tender-1')).resolves.toBeUndefined();
  });

  it('throws PRECONDITION_FAILED when no documents exist', async () => {
    vi.mocked(db.attachedDocument.count).mockResolvedValue(0);
    await expect(requireDocuments('tender-1')).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
  });

  it('queries with correct tenderId and parsingStatus filter', async () => {
    mockCountSequence(1, 0, 1);
    await requireDocuments('tender-abc');
    expect(db.attachedDocument.count).toHaveBeenCalledWith({
      where: { tenderId: 'tender-abc', parsingStatus: 'success' },
    });
  });

  it('throws PRECONDITION_FAILED when no documents can be parsed', async () => {
    mockCountSequence(3, 0, 0);
    await expect(requireDocuments('tender-1')).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
  });
});
