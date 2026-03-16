import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET() {
  try {
    const session = await auth();
    return NextResponse.json({ session: session || null, status: 'OK' });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message?.slice(0, 300),
      name: error.name,
      status: 'ERROR'
    }, { status: 500 });
  }
}
