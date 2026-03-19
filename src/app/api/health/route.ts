import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const checks: Record<string, string> = {};

  // Check DB
  try {
    const result = await db.user.count();
    checks.database = `OK (${result} users)`;
  } catch (e: any) {
    checks.database = `ERROR: ${e.message?.slice(0, 200)}`;
  }

  // Check env vars
  checks.DATABASE_URL = process.env.DATABASE_URL ? 'SET (' + process.env.DATABASE_URL.slice(0, 30) + '...)' : 'MISSING';
  checks.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ? 'SET' : 'MISSING';
  checks.AI_PROVIDER = process.env.AI_PROVIDER || 'not set';
  checks.AI_API_KEY = process.env.AI_API_KEY ? 'SET' : 'MISSING';
  checks.SUPABASE_URL = process.env.SUPABASE_URL ? 'SET' : 'MISSING';
  checks.SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) ? 'SET' : 'MISSING';
  checks.NODE_ENV = process.env.NODE_ENV || 'unknown';
  checks.platform = process.platform;
  checks.arch = process.arch;

  return NextResponse.json(checks);
}
