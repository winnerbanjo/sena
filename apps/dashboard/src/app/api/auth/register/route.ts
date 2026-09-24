import { NextResponse } from 'next/server';
import { db, users, organizations, organizationMembers } from '@sena/database';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

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
