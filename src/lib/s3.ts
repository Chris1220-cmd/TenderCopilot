import { Client as MinioClient } from 'minio';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY;
const S3_BUCKET = process.env.S3_BUCKET || 'tendercopilot';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

let _minioClient: MinioClient | null = null;

function getStorageMode(): 'supabase' | 's3' {
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) return 'supabase';
  if (S3_ENDPOINT && S3_ACCESS_KEY && S3_SECRET_KEY) return 's3';
  throw new Error(
    'Storage not configured. Set SUPABASE_URL + SUPABASE_SERVICE_KEY, ' +
    'or S3_ENDPOINT + S3_ACCESS_KEY + S3_SECRET_KEY in .env'
  );
}

function getMinioClient(): MinioClient {
  if (_minioClient) return _minioClient;
  const mode = getStorageMode();
  if (mode === 'supabase') {
    const url = new URL(SUPABASE_URL!);
    _minioClient = new MinioClient({
      endPoint: url.hostname,
      port: 443,
      useSSL: true,
      accessKey: SUPABASE_SERVICE_KEY!,
      secretKey: SUPABASE_SERVICE_KEY!,
    });
  } else {
    const url = new URL(S3_ENDPOINT!);
    _minioClient = new MinioClient({
      endPoint: url.hostname,
      port: url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 9000),
      useSSL: url.protocol === 'https:',
      accessKey: S3_ACCESS_KEY!,
      secretKey: S3_SECRET_KEY!,
    });
  }
  return _minioClient;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 500));
    }
  }
  throw new Error('Unreachable');
}

export async function uploadFile(key: string, buffer: Buffer, contentType?: string): Promise<string> {
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
  }
  const mode = getStorageMode();
  if (mode === 'supabase') {
    return withRetry(async () => {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${S3_BUCKET}/${key}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': contentType || 'application/octet-stream',
          'x-upsert': 'true',
        },
        body: new Uint8Array(buffer),
      });
      if (!res.ok) throw new Error(`Supabase upload failed: ${res.status} ${await res.text()}`);
      return key;
    });
  }
  const client = getMinioClient();
  return withRetry(async () => {
    await client.putObject(S3_BUCKET, key, buffer, buffer.length, {
      'Content-Type': contentType || 'application/octet-stream',
    });
    return key;
  });
}

export async function getFileUrl(key: string): Promise<string> {
  const mode = getStorageMode();
  if (mode === 'supabase') {
    return `${SUPABASE_URL}/storage/v1/object/public/${S3_BUCKET}/${key}`;
  }
  const client = getMinioClient();
  return client.presignedGetObject(S3_BUCKET, key, 3600);
}

export async function getFileBuffer(key: string): Promise<Buffer> {
  const mode = getStorageMode();
  if (mode === 'supabase') {
    return withRetry(async () => {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${S3_BUCKET}/${key}`, {
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
      });
      if (!res.ok) throw new Error(`Supabase download failed: ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    });
  }
  const client = getMinioClient();
  return withRetry(async () => {
    const stream = await client.getObject(S3_BUCKET, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  });
}

export async function deleteFile(key: string): Promise<void> {
  const mode = getStorageMode();
  if (mode === 'supabase') {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${S3_BUCKET}/${key}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    });
    return;
  }
  const client = getMinioClient();
  await client.removeObject(S3_BUCKET, key);
}
