/**
 * File storage abstraction.
 * Uses Supabase Storage when SUPABASE_URL is set, MinIO/S3 when S3_ENDPOINT is set,
 * falls back to no-op for demo deployments.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BUCKET = process.env.S3_BUCKET || 'tendercopilot';

const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_KEY);
const USE_S3 = !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY);

export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  if (USE_SUPABASE) {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${key}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        body: new Uint8Array(buffer),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error('[Storage] Upload failed:', err);
    }
    return key;
  }

  if (USE_S3) {
    try {
      const Minio = require('minio');
      const url = new URL(process.env.S3_ENDPOINT!);
      const client = new Minio.Client({
        endPoint: url.hostname,
        port: url.port ? parseInt(url.port) : undefined,
        useSSL: url.protocol === 'https:',
        accessKey: process.env.S3_ACCESS_KEY,
        secretKey: process.env.S3_SECRET_KEY,
      });
      await client.putObject(BUCKET, key, buffer, buffer.length, { 'Content-Type': contentType });
      return key;
    } catch (e) {
      console.error('[Storage] S3 upload failed:', e);
    }
  }

  console.log(`[Storage Mock] Would upload ${key} (${buffer.length} bytes)`);
  return key;
}

export async function getFileUrl(key: string): Promise<string> {
  if (USE_SUPABASE) {
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`;
  }

  if (USE_S3) {
    try {
      const Minio = require('minio');
      const url = new URL(process.env.S3_ENDPOINT!);
      const client = new Minio.Client({
        endPoint: url.hostname,
        port: url.port ? parseInt(url.port) : undefined,
        useSSL: url.protocol === 'https:',
        accessKey: process.env.S3_ACCESS_KEY,
        secretKey: process.env.S3_SECRET_KEY,
      });
      return await client.presignedGetObject(BUCKET, key, 3600);
    } catch {}
  }

  return `#file-not-available:${key}`;
}

export async function deleteFile(key: string): Promise<void> {
  if (USE_SUPABASE) {
    await fetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${key}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${SUPABASE_KEY}` },
      }
    );
    return;
  }
  console.log(`[Storage Mock] Would delete ${key}`);
}

export async function getFileBuffer(key: string): Promise<Buffer> {
  if (USE_SUPABASE) {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${key}`,
      { headers: { Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
  }
  return Buffer.from('');
}
