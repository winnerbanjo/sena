import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, users, properties, propertyMembers, eq, and, ilike } from '@sena/database';
import { sendSenaEmail } from '@sena/email';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();
    const { name, email, phone, role = 'Front Desk Lead', department = 'Front Office' } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name.trim();

    // 1. Resolve Property dynamically
    let prop: any = null;
    const headerPropName = req.headers.get('x-property-name') || body.propertyName;
    if (headerPropName) {
      prop = await db.query.properties.findFirst({
        where: ilike(properties.name, `%${String(headerPropName).trim()}%`),
      });
    }
    if (!prop && session?.user?.id) {
      const pm = await db.query.propertyMembers.findFirst({
        where: eq(propertyMembers.userId, session.user.id),
      });
      if (pm?.propertyId) {
        prop = await db.query.properties.findFirst({
          where: eq(properties.id, pm.propertyId),
        });
      }
    }
    if (!prop) {
      prop = await db.query.properties.findFirst();
    }
    if (!prop) {
      return NextResponse.json({ error: 'No active property found.' }, { status: 400 });
    }

    // 2. Resolve or Create User
    let user = await db.query.users.findFirst({
      where: eq(users.email, cleanEmail),
    });

    if (!user) {
      const [newUser] = await db
        .insert(users)
        .values({
          fullName: cleanName,
          email: cleanEmail,
          phone: phone ? phone.trim() : null,
          passwordHash: 'INVITED_PENDING_ACTIVATION',
          isActive: true,
        })
        .returning();
      user = newUser;
    } else {
      // Update phone if provided
      if (phone && phone !== '—') {
        await db
          .update(users)
          .set({ phone: phone.trim(), fullName: cleanName })
          .where(eq(users.id, user.id));
      }
    }

    // 3. Insert or Update Property Member
    const existingMember = await db.query.propertyMembers.findFirst({
      where: and(
        eq(propertyMembers.propertyId, prop.id),
        eq(propertyMembers.userId, user.id)
      ),
    });

    let memberId: string;
    const permissionsPayload: string[] = [
      `dept:${department}`,
      'status:invited',
      `invitedAt:${new Date().toISOString()}`,
    ];

    if (existingMember) {
      const [updated] = await db
        .update(propertyMembers)
        .set({
          role,
          permissions: permissionsPayload,
        })
        .where(eq(propertyMembers.id, existingMember.id))
        .returning();
      memberId = updated.id;
    } else {
      const [created] = await db
        .insert(propertyMembers)
        .values({
          propertyId: prop.id,
          userId: user.id,
          role,
          permissions: permissionsPayload,
        })
        .returning();
      memberId = created.id;
    }

    // 4. Send Transactional Invitation Email
    const appUrl = process.env.NEXTAUTH_URL || 'https://app.sena.ng';
    const inviteUrl = `${appUrl}/signup?email=${encodeURIComponent(cleanEmail)}&role=${encodeURIComponent(role)}&property=${encodeURIComponent(prop.name)}`;
    const inviterName = session?.user?.name || `${prop.name} Operations`;

    let emailSent = false;
    let emailError: string | null = null;

    try {
      const emailResult = await sendSenaEmail(
        'staff.invitation',
        {
          invitedEmail: cleanEmail,
          inviterName,
          propertyName: prop.name,
          roleName: role,
          inviteUrl,
          expiresInDays: 7,
        },
        {
          to: cleanEmail,
          idempotencyKey: `staff_invite_${cleanEmail}_${Date.now()}`,
          propertyId: prop.id,
          relatedEntity: 'staff',
          relatedId: memberId,
        }
      );

      if (emailResult.success) {
        emailSent = true;
      } else {
        emailError = emailResult.error || 'Failed to dispatch email';
      }
    } catch (e: any) {
      console.error('[STAFF INVITATION EMAIL ERROR]', e);
      emailError = e.message;
    }

    return NextResponse.json({
      success: true,
      emailSent,
      emailError,
      message: emailSent
        ? `Invitation email successfully sent to ${cleanEmail}`
        : `Staff member recorded. Email status: ${emailError || 'Pending delivery'}`,
      member: {
        id: memberId,
        userId: user.id,
        name: cleanName,
        email: cleanEmail,
        phone: phone || '—',
        role,
        department,
        shiftStatus: 'on_duty',
        lastActive: 'Invited just now',
      },
    });
  } catch (error: any) {
    console.error('Staff Invite POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
