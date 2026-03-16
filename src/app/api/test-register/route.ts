import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name, companyName } = body;

    // Step 1: Hash password
    const hashedPassword = await bcrypt.hash(password || 'test1234', 12);

    // Step 2: Create user
    const user = await db.user.create({
      data: {
        email: email || 'test@test.com',
        name: name || 'Test User',
        hashedPassword,
      },
    });

    // Step 3: Create tenant
    const tenant = await db.tenant.create({
      data: {
        name: companyName || 'Test Company',
        slug: `test-${Date.now()}`,
      },
    });

    // Step 4: Link
    await db.tenantUser.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        role: 'ADMIN',
      },
    });

    // Step 5: Company profile
    await db.companyProfile.create({
      data: {
        tenantId: tenant.id,
        legalName: companyName || 'Test',
        taxId: '',
      },
    });

    return NextResponse.json({ success: true, userId: user.id, tenantId: tenant.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack?.slice(0, 500) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const count = await db.user.count();
    return NextResponse.json({ users: count, status: 'OK' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
