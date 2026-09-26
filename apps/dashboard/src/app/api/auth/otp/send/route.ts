import { apiError } from '@/lib/api-error';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, verificationTokens, users, eq, and, sql } from '@sena/database';
import { sendSenaEmail } from '@sena/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, userName = 'Hotelier' } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Valid email address is required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 255) return NextResponse.json({ error: 'Valid email address is required.' }, { status: 400 });
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const issued = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`otp:${cleanEmail}`}))`);
      const pending = await tx.query.verificationTokens.findFirst({ where: eq(verificationTokens.identifier, cleanEmail) });
      if (pending && Date.now() - pending.createdAt.getTime() < 60000) return false;
      await tx.delete(verificationTokens).where(eq(verificationTokens.identifier, cleanEmail));
      await tx.insert(verificationTokens).values({ identifier: cleanEmail, token: `${otpCode}|${pending && pending.expires > new Date() ? pending.token.split('|')[1] || '' : ''}|0`, expires: new Date(Date.now() + 10 * 60 * 1000) });
      return true;
    });
    if (!issued) return NextResponse.json({ error: 'Please wait a minute before requesting another code.' }, { status: 429 });

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

    if (!emailSent) return NextResponse.json({ error: 'We could not send your code. Please try again.' }, { status: 503 });
    return NextResponse.json({
      success: true,
      emailSent,
      emailError,
      message: `Verification code forwarded to ${cleanEmail}.`,
    });
  } catch (error: any) {
    console.error('OTP Send error:', error);
    return NextResponse.json(
      { error: apiError(error) },
      { status: 500 }
    );
  }
}
