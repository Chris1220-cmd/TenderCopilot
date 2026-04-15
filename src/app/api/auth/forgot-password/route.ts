import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import crypto from 'crypto';

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = schema.parse(body);

    const user = await db.user.findUnique({ where: { email } });

    if (user) {
      // Delete any existing reset tokens for this email
      await db.verificationToken.deleteMany({
        where: { identifier: email },
      });

      const token = crypto.randomUUID();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await db.verificationToken.create({
        data: { identifier: email, token, expires },
      });

      const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
      const { sendPasswordResetEmail } = await import('@/server/services/email');
      await sendPasswordResetEmail(email, resetUrl);
    }

    // Always return success (no email enumeration)
    return NextResponse.json({ message: 'ok' });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    console.error('[ForgotPassword] Error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
