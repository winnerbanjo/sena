import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, verificationTokens, users, eq, and, gt } from '@sena/database';
import { sendSenaEmail } from '@sena/email';
import { apiError } from '@/lib/api-error';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    // Respond with a generic success message to prevent user enumeration
    const genericResponse = {
      success: true,
      message: 'If an account exists with this email, you will receive password reset instructions shortly.',
    };

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user || !user.isActive) {
      return NextResponse.json(genericResponse);
    }

    // Rate limit: 1 reset request per minute
    const recentToken = await db.query.verificationTokens.findFirst({
      where: and(
        eq(verificationTokens.identifier, `reset:${email}`),
        gt(verificationTokens.createdAt, new Date(Date.now() - 60 * 1000))
      ),
    });

    if (recentToken) {
      return NextResponse.json(
        { error: 'Please wait a minute before requesting another reset link.' },
        { status: 429 }
      );
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Delete any existing reset token for this email
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.identifier, `reset:${email}`));

    // Insert new token
    await db.insert(verificationTokens).values({
      identifier: `reset:${email}`,
      token: resetToken,
      expires,
    });

    const origin = req.nextUrl.origin || 'http://localhost:3000';
    const resetUrl = `${origin}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    await sendSenaEmail(
      'account.password_reset',
      {
        userName: user.fullName || 'Hotelier',
        resetUrl,
        expiresInMinutes: 30,
      },
      {
        to: email,
        idempotencyKey: `pwd_reset_${email}_${Date.now()}`,
        skipPreferencesCheck: true,
      }
    ).catch((err) => console.error('Failed to send password reset email:', err));

    return NextResponse.json(genericResponse);
  } catch (err) {
    console.error('[FORGOT PASSWORD ERROR]', err);
    return NextResponse.json({ error: apiError(err) }, { status: 500 });
  }
}
