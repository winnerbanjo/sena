import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, users, organizations, organizationMembers, verificationTokens } from '@sena/database';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { sendSenaEmail } from '@sena/email';

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

    // Check if user already exists
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'An account with this email address already exists. Please log in.' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    const orgSlug = propertyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Math.random().toString(36).substring(2, 7);

    // Atomically create user and organization
    const result = await db.transaction(async (tx) => {
      // 1. Insert User
      const [newUser] = await tx
        .insert(users)
        .values({
          fullName: fullName.trim(),
          email: cleanEmail,
          passwordHash,
          phone: phone ? String(phone).trim() : null,
          isActive: true,
        })
        .returning({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
        });

      // 2. Insert Organization
      const [newOrg] = await tx
        .insert(organizations)
        .values({
          name: propertyName.trim(),
          slug: orgSlug,
        })
        .returning({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
        });

      // 3. Insert Organization Member (Owner)
      await tx.insert(organizationMembers).values({
        organizationId: newOrg.id,
        userId: newUser.id,
        role: 'owner',
      });

      return {
        user: newUser,
        organization: newOrg,
      };
    });

    // Generate 6-digit OTP code and save verification token
    const otpCode = crypto.randomInt(100000, 999999).toString();
    try {
      await db.delete(verificationTokens).where(eq(verificationTokens.identifier, cleanEmail));
      await db.insert(verificationTokens).values({
        identifier: cleanEmail,
        token: otpCode,
        expires: new Date(Date.now() + 10 * 60 * 1000),
      });

      // Dispatch OTP verification email via Resend
      await sendSenaEmail(
        'account.verify_email',
        {
          userName: result.user.fullName,
          otpCode,
          expiresInMinutes: 10,
        },
        {
          to: result.user.email,
          idempotencyKey: `otp_${cleanEmail}_${Date.now()}`,
        }
      );
    } catch (otpErr) {
      console.warn('[REGISTRATION OTP EMAIL ERROR]', otpErr);
    }

    // Dispatch welcome email asynchronously (non-blocking)
    try {
      await sendSenaEmail(
        'account.welcome',
        {
          userName: result.user.fullName,
          organizationName: result.organization.name,
          propertyName: propertyName.trim(),
        },
        {
          to: result.user.email,
          organizationId: result.organization.id,
          idempotencyKey: `welcome_${result.user.id}`,
        }
      );
    } catch (emailErr) {
      console.warn('[WELCOME EMAIL ERROR]', emailErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Account created successfully in PostgreSQL.',
      data: result,
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create account.' },
      { status: 500 }
    );
  }
}
