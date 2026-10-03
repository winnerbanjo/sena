import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, verificationTokens, users, organizations, organizationMembers } from '@sena/database';
import { apiError } from '@/lib/api-error';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { sendSenaEmail } from '@sena/email';

/**
 * POST /api/auth/register
 *
 * Step 1 of 2 – store a pending signup OTP token (NO user row written yet).
 * The real user + org are created in /api/auth/otp/verify once the code is confirmed.
 *
 * Token format stored in DB:  "<otpCode>|<base64(JSON payload)>"
 * The pipe separator lets the verify route split OTP from signup data without
 * adding a new DB column.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fullName, email, password, phone, propertyName, propertyCategory } = body;

    const cleanFullName = typeof fullName === 'string' ? fullName.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.toLowerCase().trim() : '';
    const cleanPassword = typeof password === 'string' ? password : '';
    const cleanPhone = typeof phone === 'string' && phone.trim() ? phone.trim() : null;
    const effectivePropertyName =
      typeof propertyName === 'string' && propertyName.trim()
        ? propertyName.trim()
        : `${cleanFullName || 'My'}'s Workspace`;

    if (
      !cleanFullName ||
      cleanFullName.length > 255 ||
      !cleanEmail ||
      cleanEmail.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
      cleanPassword.length < 8 ||
      Buffer.byteLength(cleanPassword, 'utf8') > 72
    ) {
      return NextResponse.json(
        { error: 'Enter your full name, a valid email address, and a password of at least 8 characters.' },
        { status: 400 }
      );
    }

    // Block re-registration for ALREADY-VERIFIED accounts only
    const existing = await db
      .select({ id: users.id, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'An account with this email address already exists. Please log in.' },
        { status: 409 }
      );
    }

    // Pre-hash the password (safe to do before account creation)
    const passwordHash = await bcrypt.hash(cleanPassword, 10);
    const orgSlug =
      effectivePropertyName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50) +
      '-' +
      crypto.randomBytes(3).toString('hex');

    // Build the OTP and the pending-signup payload
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const pendingPayload = Buffer.from(
      JSON.stringify({
        fullName: cleanFullName,
        email: cleanEmail,
        passwordHash,
        phone: cleanPhone,
        propertyName: effectivePropertyName,
        propertyCategory: propertyCategory || 'boutique_hotel',
        orgSlug,
      })
    ).toString('base64');

    // Store as "<otpCode>|<base64payload>" in the token column
    const tokenValue = `${otpCode}|${pendingPayload}`;

    const issued = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`otp:${cleanEmail}`}))`);
      const pending = await tx.query.verificationTokens.findFirst({ where: eq(verificationTokens.identifier, cleanEmail) });
      if (pending && Date.now() - pending.createdAt.getTime() < 60000) return false;
      await tx.delete(verificationTokens).where(eq(verificationTokens.identifier, cleanEmail));
      await tx.insert(verificationTokens).values({ identifier: cleanEmail, token: tokenValue, expires: new Date(Date.now() + 15 * 60 * 1000) });
      return true;
    });
    if (!issued) return NextResponse.json({ error: 'Please wait a minute before requesting another code.' }, { status: 429 });

    // Send OTP verification email
    try {
      const delivery = await sendSenaEmail(
        'account.verify_email',
        {
          userName: fullName.trim(),
          otpCode,
          expiresInMinutes: 15,
        },
        {
          to: cleanEmail,
          idempotencyKey: `otp_${cleanEmail}_${Date.now()}`,
          skipPreferencesCheck: true,
        }
      );
      if (!delivery.success) return NextResponse.json({ error: 'We could not send your verification code. Please retry in a minute.' }, { status: 503 });
    } catch (emailErr) {
      return NextResponse.json({ error: 'We could not send your verification code. Please retry in a minute.' }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent. Complete signup by entering the code.',
      requiresVerification: true,
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: apiError(error) },
      { status: 500 }
    );
  }
}
