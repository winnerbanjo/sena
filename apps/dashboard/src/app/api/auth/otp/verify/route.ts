import { NextRequest, NextResponse } from 'next/server';
import { db, verificationTokens, users, eq, and, gt } from '@sena/database';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and 6-digit code are required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    // Query active, unexpired verification token
    const tokenRecord = await db.query.verificationTokens.findFirst({
      where: and(
        eq(verificationTokens.identifier, cleanEmail),
        eq(verificationTokens.token, cleanCode),
        gt(verificationTokens.expires, new Date())
      ),
    });

    if (!tokenRecord) {
      return NextResponse.json(
        { error: 'Invalid or expired verification code. Please request a fresh code.' },
        { status: 400 }
      );
    }

    // Mark user email as verified in PostgreSQL
    await db
      .update(users)
      .set({
        emailVerified: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.email, cleanEmail));

    // Delete token so it cannot be reused
    await db
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, cleanEmail),
          eq(verificationTokens.token, cleanCode)
        )
      );

    return NextResponse.json({
      success: true,
      message: 'Email address successfully verified.',
    });
  } catch (error: any) {
    console.error('OTP Verify error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify code.' },
      { status: 500 }
    );
  }
}
