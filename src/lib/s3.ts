/**
 * S3 storage abstraction.
 * Uses MinIO/S3 when configured, falls back to no-op for demo deployments.
 */

const S3_AVAILABLE = !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY);

let s3Client: any = null;

function getS3Client() {
  if (s3Client) return s3Client;
  if (!S3_AVAILABLE) return null;

  try {
    const Minio = require('minio');
    const endpoint = process.env.S3_ENDPOINT!;
    const url = new URL(endpoint);

    s3Client = new Minio.Client({
      endPoint: url.hostname,
      port: url.port ? parseInt(url.port) : undefined,
      useSSL: url.protocol === 'https:',
      accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.S3_SECRET_KEY || 'minioadmin',
    });
    return s3Client;
  } catch {
    return null;
  }
}

const BUCKET = process.env.S3_BUCKET || 'tendercopilot';

export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const client = getS3Client();
  if (client) {
    await client.putObject(BUCKET, key, buffer, buffer.length, {
      'Content-Type': contentType,
    });
  } else {
    console.log(`[S3 Mock] Would upload ${key} (${buffer.length} bytes)`);
  }
  return key;
}

export async function getFileUrl(key: string): Promise<string> {
  const client = getS3Client();
  if (client) {
    return await client.presignedGetObject(BUCKET, key, 3600);
  }
  return `#file-not-available:${key}`;
}

export async function deleteFile(key: string): Promise<void> {
  const client = getS3Client();
  if (client) {
    await client.removeObject(BUCKET, key);
  }
}

export async function getFileBuffer(key: string): Promise<Buffer> {
  const client = getS3Client();
  if (client) {
    const stream = await client.getObject(BUCKET, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  return Buffer.from('');
}
