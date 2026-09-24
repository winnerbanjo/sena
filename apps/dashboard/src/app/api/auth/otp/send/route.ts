import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, verificationTokens, users, eq, and } from '@sena/database';
import { sendSenaEmail } from '@sena/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, userName = 'Hotelier' } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Valid email address is required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Generate cryptographic 6-digit numeric OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Remove any previous active tokens for this email
    await db.delete(verificationTokens).where(eq(verificationTokens.identifier, cleanEmail));

    // Insert new verification token
    await db.insert(verificationTokens).values({
      identifier: cleanEmail,
      token: otpCode,
      expires: expiresAt,
    });

    // Send transactional verification email via Resend
    let emailSent = false;
    let emailError = null;

    try {
      const emailResult = await sendSenaEmail(
        'account.verify_email',
        {
          userName,
          otpCode,
          expiresInMinutes: 10,
        },
        {
          to: cleanEmail,
          idempotencyKey: `otp_${cleanEmail}_${Date.now()}`,
        }
      );
      emailSent = emailResult.success;
      if (!emailResult.success) {
        emailError = emailResult.error;
      }
    } catch (e: any) {
      console.error('[OTP SEND EMAIL ERROR]', e);
      emailError = e.message;
    }

    return NextResponse.json({
      success: true,
      emailSent,
      emailError,
      message: `Verification code forwarded to ${cleanEmail}.`,
    });
  } catch (error: any) {
    console.error('OTP Send error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send verification code.' },
      { status: 500 }
    );
  }
}
