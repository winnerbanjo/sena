import { apiError } from '@/lib/api-error';
import crypto from 'crypto';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, users, properties, propertyMembers, eq, and, ilike } from '@sena/database';
import { sendSenaEmail } from '@sena/email';
import { resolveTenantForRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

async function handlePOST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();
    const { name, email, phone, role = 'Front Desk Lead', department = 'Front Office' } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name.trim();

    // 1. Resolve Property strictly scoped to authenticated tenant
    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant) {
      return NextResponse.json({ error: 'No active property found for this account.' }, { status: 400 });
    }
    const prop = tenant.property;
    const allowedRoles = ['manager', 'front_desk', 'housekeeping', 'accountant', 'marketing', 'General Manager', 'Front Desk Lead', 'Housekeeping Lead', 'Housekeeping Supervisor', 'Finance', 'Room Attendant'];
    if (!allowedRoles.includes(role)) return NextResponse.json({ error: 'Choose a supported staff role.' }, { status: 422 });

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
    }

    // 3. Insert or Update Property Member
    const existingMember = await db.query.propertyMembers.findFirst({
      where: and(
        eq(propertyMembers.propertyId, prop.id),
        eq(propertyMembers.userId, user.id)
      ),
    });

    if (existingMember && !existingMember.permissions?.includes('status:invited')) return NextResponse.json({ error: 'This person already belongs to your property.' }, { status: 409 });
    let memberId: string;
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const invitationHash = crypto.createHash('sha256').update(invitationToken).digest('hex');
    const permissionsPayload: string[] = [
      `inviteHash:${invitationHash}`,
      `inviteExpires:${Date.now() + 7 * 24 * 60 * 60 * 1000}`,
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
    const inviteUrl = `${appUrl}/signup?email=${encodeURIComponent(cleanEmail)}&token=${invitationToken}&role=${encodeURIComponent(role)}&property=${encodeURIComponent(prop.name)}`;
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
      emailError: emailSent ? null : 'The invitation could not be delivered. Please try again.',
      message: emailSent
        ? `Invitation email successfully sent to ${cleanEmail}`
        : 'Invitation saved, but the email could not be delivered. Please try again.',
      member: {
        id: memberId,
        userId: user.id,
        name: cleanName,
        email: cleanEmail,
        phone: phone || '—',
        role,
        department,
        status: 'invited',
        lastActive: 'Invitation pending',
      },
    });
  } catch (error: any) {
    console.error('Staff Invite POST error:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const POST = withMerchant(handlePOST, 'staff');
