import * as Minio from 'minio';

const globalForS3 = globalThis as unknown as {
  s3Client: Minio.Client | undefined;
};

function createS3Client() {
  const endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000';
  const url = new URL(endpoint);

  return new Minio.Client({
    endPoint: url.hostname,
    port: url.port ? parseInt(url.port) : undefined,
    useSSL: url.protocol === 'https:',
    accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.S3_SECRET_KEY || 'minioadmin',
  });
}

export const s3 = globalForS3.s3Client ?? createS3Client();

if (process.env.NODE_ENV !== 'production') globalForS3.s3Client = s3;

const BUCKET = process.env.S3_BUCKET || 'tendercopilot';

export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  await s3.putObject(BUCKET, key, buffer, buffer.length, {
    'Content-Type': contentType,
  });
  return key;
}

export async function getFileUrl(key: string): Promise<string> {
  return await s3.presignedGetObject(BUCKET, key, 3600); // 1h expiry
}

export async function deleteFile(key: string): Promise<void> {
  await s3.removeObject(BUCKET, key);
}

export async function getFileBuffer(key: string): Promise<Buffer> {
  const stream = await s3.getObject(BUCKET, key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
