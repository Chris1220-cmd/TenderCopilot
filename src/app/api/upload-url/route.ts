import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = 'tendercopilot';

/**
 * POST /api/upload-url
 * Returns a signed upload URL for direct browser-to-Supabase uploads.
 * Used for files > 4MB that can't pass through Vercel's body limit.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { fileName, contentType } = await req.json();
  if (!fileName) {
    return NextResponse.json({ error: 'fileName required' }, { status: 400 });
  }

  const timestamp = Date.now();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `uploads/${session.user.id}/${timestamp}_${safeName}`;

  // Create signed upload URL via Supabase Storage API
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${key}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ upsert: true }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error('[upload-url] Failed to create signed URL:', res.status, text);
    return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 });
  }

  const data = await res.json();

  return NextResponse.json({
    uploadUrl: `${SUPABASE_URL}/storage/v1${data.url}`,
    key,
    token: data.token,
  });
}
