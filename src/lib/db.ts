import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  // On platforms where native Prisma engine works (Linux/Vercel), use standard client.
  // On ARM64 Windows (local dev), use pg driver adapter as fallback.
  const isArmWindows =
    process.platform === 'win32' && process.arch === 'arm64';

  if (isArmWindows) {
    try {
      // Dynamic import to avoid bundling pg on Vercel
      const { PrismaPg } = require('@prisma/adapter-pg');
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });
      const adapter = new PrismaPg(pool);
      return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      } as any);
    } catch (err) {
      console.error('[DB] Failed to create adapter-based client:', err);
      // Fallback to standard client
    }
  }

  // Limit connections to avoid exhausting Supabase pool (free tier ~15 connections).
  // Vercel serverless spawns many instances — each should use minimal connections.
  const url = new URL(process.env.DATABASE_URL || '');
  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', '3');
  }

  return new PrismaClient({
    datasourceUrl: url.toString(),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
