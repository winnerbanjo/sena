import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, users, properties, propertyMembers, eq, desc } from '@sena/database';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    // Resolve property (first property for current tenant)
    const prop = await db.query.properties.findFirst();
    if (!prop) {
      return NextResponse.json({ staff: [] });
    }

    const members = await db
      .select({
        id: propertyMembers.id,
        role: propertyMembers.role,
        permissions: propertyMembers.permissions,
        createdAt: propertyMembers.createdAt,
        userId: users.id,
        name: users.fullName,
        email: users.email,
        phone: users.phone,
      })
      .from(propertyMembers)
      .innerJoin(users, eq(propertyMembers.userId, users.id))
      .where(eq(propertyMembers.propertyId, prop.id))
      .orderBy(desc(propertyMembers.createdAt));

    const staffList = members.map((m) => {
      const perms = m.permissions;
      let dept = 'Front Office';
      let isInvited = false;

      if (Array.isArray(perms)) {
        const deptTag = perms.find((p) => typeof p === 'string' && p.startsWith('dept:'));
        if (deptTag) dept = deptTag.split(':')[1];
        if (perms.includes('status:invited')) isInvited = true;
      } else if (perms && typeof perms === 'object') {
        if ((perms as any).department) dept = (perms as any).department;
        if ((perms as any).status === 'invited') isInvited = true;
      }

      if (m.role === 'Owner' || m.role === 'General Manager') dept = 'Management';
      if (m.role.includes('Housekeeping') || m.role.includes('Attendant')) dept = 'Housekeeping';
      if (m.role === 'Finance') dept = 'Accounting';

      return {
        id: m.id,
        userId: m.userId,
        name: m.name,
        email: m.email,
        phone: m.phone || '—',
        role: m.role,
        department: dept,
        shiftStatus: 'on_duty',
        lastActive: isInvited ? 'Invited just now' : 'Active now',
      };
    });

    return NextResponse.json({ staff: staffList, propertyName: prop.name });
  } catch (error: any) {
    console.error('Staff GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
