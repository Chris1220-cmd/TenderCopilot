import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    attachedDocument: {
      count: vi.fn(),
    },
  },
}));

import { requireDocuments } from './document-reader';
import { db } from '@/lib/db';

describe('requireDocuments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves when at least one parsed document exists', async () => {
    vi.mocked(db.attachedDocument.count).mockResolvedValue(2);
    await expect(requireDocuments('tender-1')).resolves.toBeUndefined();
  });

  it('throws PRECONDITION_FAILED when no parsed documents exist', async () => {
    vi.mocked(db.attachedDocument.count).mockResolvedValue(0);
    await expect(requireDocuments('tender-1')).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
  });

  it('queries with correct tenderId and parsingStatus filter', async () => {
    vi.mocked(db.attachedDocument.count).mockResolvedValue(1);
    await requireDocuments('tender-abc');
    expect(db.attachedDocument.count).toHaveBeenCalledWith({
      where: { tenderId: 'tender-abc', parsingStatus: 'success' },
    });
  });
});
