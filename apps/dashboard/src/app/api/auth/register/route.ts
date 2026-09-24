import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, verificationTokens, users, organizations, organizationMembers } from '@sena/database';
import { eq } from 'drizzle-orm';
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

    if (!fullName || !email || !password || !propertyName) {
      return NextResponse.json(
        { error: 'Full name, email, password, and property name are required.' },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).toLowerCase().trim();

    // Block re-registration for ALREADY-VERIFIED accounts only
    const existing = await db
      .select({ id: users.id, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    if (existing.length > 0 && existing[0].emailVerified !== null) {
      return NextResponse.json(
        { error: 'An account with this email address already exists. Please log in.' },
        { status: 409 }
      );
    }

    // If a ghost unverified row exists (e.g. previous failed attempt), clean it up
    if (existing.length > 0 && existing[0].emailVerified === null) {
      const ghostId = existing[0].id;
      const memberships = await db
        .select({ orgId: organizationMembers.organizationId })
        .from(organizationMembers)
        .where(eq(organizationMembers.userId, ghostId));

      for (const m of memberships) {
        await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, m.orgId));
        await db.delete(organizations).where(eq(organizations.id, m.orgId));
      }
      await db.delete(users).where(eq(users.id, ghostId));
    }

    // Pre-hash the password (safe to do before account creation)
    const passwordHash = await bcrypt.hash(password, 10);
    const orgSlug =
      propertyName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') +
      '-' +
      Math.random().toString(36).substring(2, 7);

    // Build the OTP and the pending-signup payload
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const pendingPayload = Buffer.from(
      JSON.stringify({
        fullName: fullName.trim(),
        email: cleanEmail,
        passwordHash,
        phone: phone ? String(phone).trim() : null,
        propertyName: propertyName.trim(),
        propertyCategory: propertyCategory || 'boutique_hotel',
        orgSlug,
      })
    ).toString('base64');

    // Store as "<otpCode>|<base64payload>" in the token column
    const tokenValue = `${otpCode}|${pendingPayload}`;

    // Clear any stale tokens for this email and insert the new one
    await db.delete(verificationTokens).where(eq(verificationTokens.identifier, cleanEmail));
    await db.insert(verificationTokens).values({
      identifier: cleanEmail,
      token: tokenValue,
      expires: new Date(Date.now() + 15 * 60 * 1000), // 15 min
    });

    // Send OTP verification email
    try {
      await sendSenaEmail(
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
    } catch (emailErr) {
      console.warn('[REGISTRATION OTP EMAIL ERROR]', emailErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent. Complete signup by entering the code.',
      requiresVerification: true,
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create account.' },
      { status: 500 }
    );
  }
}
