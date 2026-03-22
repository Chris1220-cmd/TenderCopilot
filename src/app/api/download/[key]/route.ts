import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/download/[...key]
 * Generates a presigned URL for downloading files from S3.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { key: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // The key comes URL-encoded from the path
    const { getFileUrl } = await import('@/lib/s3');
    const key = decodeURIComponent(params.key);
    const url = await getFileUrl(key);
    return NextResponse.json({ url });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
