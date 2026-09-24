import { NextRequest, NextResponse } from 'next/server';
import { db, verificationTokens, users, organizations, organizationMembers, eq, and, gt } from '@sena/database';
import { sendSenaEmail } from '@sena/email';

/**
 * POST /api/auth/otp/verify
 *
 * Step 2 of 2 – validate the OTP.
 *
 * If the token contains a pending signup payload (format "<otp>|<base64json>"),
 * the user + org are created atomically here.
 *
 * If the token is a plain OTP (no pipe / no payload), this is a standalone
 * email-verification call (e.g. password reset flow).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and 6-digit code are required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    // Fetch the token record (match by identifier only – we'll check OTP manually)
    const tokenRecord = await db.query.verificationTokens.findFirst({
      where: and(
        eq(verificationTokens.identifier, cleanEmail),
        gt(verificationTokens.expires, new Date())
      ),
    });

    if (!tokenRecord) {
      return NextResponse.json(
        { error: 'Invalid or expired verification code. Please request a fresh code.' },
        { status: 400 }
      );
    }

    // Token format: either "<otp>" (plain) or "<otp>|<base64payload>" (pending signup)
    const [storedOtp, pendingPayloadB64] = tokenRecord.token.split('|');

    if (storedOtp !== cleanCode) {
      return NextResponse.json(
        { error: 'Incorrect verification code. Please try again.' },
        { status: 400 }
      );
    }

    // Delete the token immediately (single-use)
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.identifier, cleanEmail));

    // ── CASE A: Pending signup payload → create user + org ──────────────────
    if (pendingPayloadB64) {
      let pending: {
        fullName: string;
        email: string;
        passwordHash: string;
        phone: string | null;
        propertyName: string;
        propertyCategory: string;
        orgSlug: string;
      };

      try {
        pending = JSON.parse(Buffer.from(pendingPayloadB64, 'base64').toString('utf-8'));
      } catch {
        return NextResponse.json(
          { error: 'Signup session expired or corrupted. Please register again.' },
          { status: 400 }
        );
      }

      // Atomically create user + org + membership
      const result = await db.transaction(async (tx) => {
        const [newUser] = await tx
          .insert(users)
          .values({
            fullName: pending.fullName,
            email: pending.email,
            passwordHash: pending.passwordHash,
            phone: pending.phone,
            emailVerified: new Date(), // verified right now
            isActive: true,
          })
          .returning({ id: users.id, email: users.email, fullName: users.fullName });

        const [newOrg] = await tx
          .insert(organizations)
          .values({
            name: pending.propertyName,
            slug: pending.orgSlug,
          })
          .returning({ id: organizations.id, name: organizations.name, slug: organizations.slug });

        await tx.insert(organizationMembers).values({
          organizationId: newOrg.id,
          userId: newUser.id,
          role: 'owner',
        });

        return { user: newUser, organization: newOrg };
      });

      // Send welcome email (non-blocking)
      sendSenaEmail(
        'account.welcome',
        {
          userName: result.user.fullName,
          organizationName: result.organization.name,
          propertyName: pending.propertyName,
        },
        {
          to: result.user.email,
          organizationId: result.organization.id,
          idempotencyKey: `welcome_${result.user.id}`,
          skipPreferencesCheck: true,
        }
      ).catch((e) => console.warn('[WELCOME EMAIL]', e));

      return NextResponse.json({
        success: true,
        message: 'Email verified. Account created successfully.',
        accountCreated: true,
        user: { id: result.user.id, email: result.user.email, name: result.user.fullName },
        organization: { id: result.organization.id, name: result.organization.name },
      });
    }

    // ── CASE B: Plain OTP (standalone email verification) ───────────────────
    await db
      .update(users)
      .set({ emailVerified: new Date(), updatedAt: new Date() })
      .where(eq(users.email, cleanEmail));

    return NextResponse.json({
      success: true,
      message: 'Email address successfully verified.',
      accountCreated: false,
    });
  } catch (error: any) {
    console.error('OTP Verify error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify code.' },
      { status: 500 }
    );
  }
}
