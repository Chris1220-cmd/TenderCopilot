import { NextResponse } from 'next/server';

export async function GET() {
  // Test 1: Can we even import NextAuth?
  try {
    const NextAuth = require('next-auth');
    const version = NextAuth.default ? 'v5' : 'unknown';

    // Test 2: Can we create a minimal auth instance?
    const { auth } = NextAuth.default({
      providers: [],
      trustHost: true,
      session: { strategy: 'jwt' },
      secret: process.env.NEXTAUTH_SECRET || 'test-secret',
    });

    const session = await auth();

    return NextResponse.json({
      nextauth: 'OK',
      version,
      session: session || null,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT SET',
      AUTH_URL: process.env.AUTH_URL || 'NOT SET',
      VERCEL_URL: process.env.VERCEL_URL || 'NOT SET',
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message?.slice(0, 500),
      stack: error.stack?.slice(0, 300),
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT SET',
      AUTH_URL: process.env.AUTH_URL || 'NOT SET',
      VERCEL_URL: process.env.VERCEL_URL || 'NOT SET',
    }, { status: 500 });
  }
}
