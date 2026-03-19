import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { uploadFile } from '@/lib/s3';
import { db } from '@/lib/db';

/**
 * POST /api/upload
 * Upload files to S3 and create AttachedDocument records.
 *
 * Query params:
 * - tenderId: associate with a tender
 * - category: document category (specification, appendix, etc.)
 * - type: 'tender' | 'certificate' | 'legal' | 'project'
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const files = formData.getAll('files') as File[];
  const tenderId = formData.get('tenderId') as string | null;
  const category = formData.get('category') as string | null;
  const uploadType = formData.get('type') as string | null;

  if (!files || files.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 });
  }

  const results = [];

  for (const file of files) {
    try {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Generate unique key
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const key = `uploads/${session.user.id}/${timestamp}_${safeName}`;

      console.log(`[Upload] Uploading ${file.name} (${buffer.length} bytes) to ${key}`);

      // Upload to S3/Supabase
      await uploadFile(key, buffer, file.type);

      let record: { id: string; fileName: string; fileKey: string } | null = null;

      if (tenderId && uploadType === 'tender') {
        record = await db.attachedDocument.create({
          data: {
            tenderId,
            fileName: file.name,
            fileKey: key,
            fileSize: buffer.length,
            mimeType: file.type,
            category: category || 'specification',
          },
        });
      }

      results.push({
        id: record?.id,
        fileName: file.name,
        fileKey: key,
        fileSize: buffer.length,
        mimeType: file.type,
      });
      console.log(`[Upload] Success: ${file.name}`);
    } catch (err: any) {
      console.error(`[Upload] Failed for ${file.name}:`, err.message || err);
      return NextResponse.json(
        { error: `Upload failed for ${file.name}: ${err.message || 'Unknown error'}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ files: results });
}

export const maxDuration = 60;
