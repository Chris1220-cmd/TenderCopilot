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
  checks.GEMINI_API_KEY = process.env.GEMINI_API_KEY ? 'SET' : 'MISSING';
  checks.GOOGLE_CUSTOM_SEARCH_API_KEY = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY ? 'SET' : 'MISSING';
  checks.GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID || 'MISSING';
  checks.NODE_ENV = process.env.NODE_ENV || 'unknown';
  checks.platform = process.platform;
  checks.arch = process.arch;

  // Test Google Custom Search API if key exists
  if (process.env.GOOGLE_CUSTOM_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
    try {
      const url = new URL('https://www.googleapis.com/customsearch/v1');
      url.searchParams.set('key', process.env.GOOGLE_CUSTOM_SEARCH_API_KEY);
      url.searchParams.set('cx', process.env.GOOGLE_SEARCH_ENGINE_ID);
      url.searchParams.set('q', 'test');
      url.searchParams.set('num', '1');
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        checks.GOOGLE_SEARCH_TEST = 'OK';
      } else {
        const body = await res.text().catch(() => '');
        checks.GOOGLE_SEARCH_TEST = `ERROR ${res.status}: ${body.slice(0, 200)}`;
      }
    } catch (e: any) {
      checks.GOOGLE_SEARCH_TEST = `ERROR: ${e.message?.slice(0, 200)}`;
    }
  }

  return NextResponse.json(checks);
}
