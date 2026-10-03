import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db, verificationTokens, users, eq, and, gt } from '@sena/database';
import { sendSenaEmail } from '@sena/email';
import { apiError } from '@/lib/api-error';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !token) {
      return NextResponse.json(
        { error: 'Invalid or missing reset token.' },
        { status: 400 }
      );
    }

    if (!password || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
      return NextResponse.json(
        { error: 'Password must be between 8 and 72 characters.' },
        { status: 400 }
      );
    }

    const resetRecord = await db.query.verificationTokens.findFirst({
      where: and(
        eq(verificationTokens.identifier, `reset:${email}`),
        eq(verificationTokens.token, token),
        gt(verificationTokens.expires, new Date())
      ),
    });

    if (!resetRecord) {
      return NextResponse.json(
        { error: 'This reset link is invalid or has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.email, email));

      await tx
        .delete(verificationTokens)
        .where(eq(verificationTokens.identifier, `reset:${email}`));
    });

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (user) {
      await sendSenaEmail(
        'account.password_changed',
        {
          userName: user.fullName || 'Hotelier',
          timestamp: new Date().toUTCString(),
        },
        {
          to: email,
          idempotencyKey: `pwd_changed_${email}_${Date.now()}`,
          skipPreferencesCheck: true,
        }
      ).catch(() => undefined);
    }

    return NextResponse.json({
      success: true,
      message: 'Your password has been updated. You can now sign in with your new password.',
    });
  } catch (err) {
    console.error('[RESET PASSWORD ERROR]', err);
    return NextResponse.json({ error: apiError(err) }, { status: 500 });
  }
}
