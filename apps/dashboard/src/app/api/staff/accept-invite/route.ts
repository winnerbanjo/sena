import { NextRequest, NextResponse } from 'next/server';
import { db, users, properties, propertyMembers, eq, and, ilike } from '@sena/database';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, fullName, propertyName, role } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = fullName ? String(fullName).trim() : '';

    // 1. Look up existing user
    let user = await db.query.users.findFirst({
      where: eq(users.email, cleanEmail),
    });

    const passwordHash = await bcrypt.hash(password, 10);

    if (!user) {
      // Create user if not created during invite
      const [newUser] = await db
        .insert(users)
        .values({
          email: cleanEmail,
          fullName: cleanName || 'Staff Member',
          passwordHash,
          isActive: true,
          emailVerified: new Date(),
        })
        .returning();
      user = newUser;
    } else {
      // Update existing invited user with real password hash
      const updateData: any = {
        passwordHash,
        isActive: true,
        emailVerified: new Date(),
      };
      if (cleanName) {
        updateData.fullName = cleanName;
      }
      await db.update(users).set(updateData).where(eq(users.id, user.id));
    }

    // 2. Resolve Property
    let targetProperty: any = null;
    if (propertyName) {
      targetProperty = await db.query.properties.findFirst({
        where: ilike(properties.name, `%${String(propertyName).trim()}%`),
      });
    }

    // 3. Find or update property membership
    let assignedRole = role || 'Front Desk Lead';
    let targetPropId = targetProperty?.id;

    if (targetPropId) {
      const existingPm = await db.query.propertyMembers.findFirst({
        where: and(
          eq(propertyMembers.userId, user.id),
          eq(propertyMembers.propertyId, targetPropId)
        ),
      });

      if (existingPm) {
        assignedRole = existingPm.role || assignedRole;
        await db
          .update(propertyMembers)
          .set({
            permissions: ['status:active', `activatedAt:${new Date().toISOString()}`],
          })
          .where(eq(propertyMembers.id, existingPm.id));
      } else {
        await db.insert(propertyMembers).values({
          propertyId: targetPropId,
          userId: user.id,
          role: assignedRole,
          permissions: ['status:active', `activatedAt:${new Date().toISOString()}`],
        });
      }
    } else {
      // Check existing membership for user
      const existingPm = await db.query.propertyMembers.findFirst({
        where: eq(propertyMembers.userId, user.id),
      });
      if (existingPm) {
        assignedRole = existingPm.role || assignedRole;
        targetPropId = existingPm.propertyId;
        const prop = await db.query.properties.findFirst({
          where: eq(properties.id, existingPm.propertyId),
        });
        if (prop) targetProperty = prop;
      }
    }

    const finalPropName = targetProperty?.name || propertyName || 'Amami';
    const finalPropSlug = targetProperty?.slug || 'amami';

    return NextResponse.json({
      success: true,
      message: 'Account password configured successfully. You may now access your console.',
      user: {
        id: user.id,
        email: user.email,
        name: cleanName || user.fullName,
        fullName: cleanName || user.fullName,
        role: assignedRole,
        property: finalPropName,
        propertyId: targetPropId,
        propertySlug: finalPropSlug,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/staff/accept-invite:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete invitation setup.' },
      { status: 500 }
    );
  }
}
