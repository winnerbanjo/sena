import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, users, properties, propertyMembers, eq, desc } from '@sena/database';
import { resolveTenantForRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

async function handleGET(req: NextRequest) {
  try {
    const session = await auth();

    // Resolve property dynamically with strict tenant isolation
    const tenant = await resolveTenantForRequest(session, req);
    if (!tenant) {
      return NextResponse.json({ staff: [] });
    }

    const prop = tenant.property;

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

      if (['owner', 'manager', 'general manager'].includes(m.role.toLowerCase())) dept = 'Management';
      if (m.role.toLowerCase().includes('housekeeping') || m.role.toLowerCase().includes('attendant')) dept = 'Housekeeping';
      if (['finance', 'accountant'].includes(m.role.toLowerCase())) dept = 'Accounting';

      return {
        id: m.id,
        userId: m.userId,
        name: m.name,
        email: m.email,
        phone: m.phone || '—',
        role: m.role,
        department: dept,
        status: Array.isArray(perms) && perms.includes('status:revoked') ? 'revoked' : isInvited ? 'invited' : 'active',
        lastActive: isInvited ? 'Invitation pending' : 'Activity not tracked',
      };
    });

    return NextResponse.json({ staff: staffList, propertyName: prop.name });
  } catch (error: any) {
    console.error('Staff GET error:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'staff');

async function handlePATCH(req: NextRequest) {
  const session=await auth();
  const tenant=await resolveTenantForRequest(session,req);
  const {memberId,action}=await req.json();
  if(!tenant || action!=='revoke' || typeof memberId!=='string') return NextResponse.json({error:'Choose a valid staff action.'},{status:400});
  return db.transaction(async tx=>{
    const [member]=await tx.select().from(propertyMembers).where(eq(propertyMembers.id,memberId)).for('update');
    if(!member || member.propertyId!==tenant.propertyId) return NextResponse.json({error:'Staff member not found.'},{status:404});
    if(member.userId===tenant.userId || member.role.toLowerCase()==='owner') return NextResponse.json({error:'Owner and current-account access cannot be removed here.'},{status:409});
    const permissions=Array.isArray(member.permissions)?member.permissions.filter(p=>!p.startsWith('status:') && !p.startsWith('invite:')):[];
    await tx.update(propertyMembers).set({permissions:[...permissions,'status:revoked']}).where(eq(propertyMembers.id,member.id));
    return NextResponse.json({success:true,message:'Property access removed. Operational history is preserved.'});
  });
}
export const PATCH=withMerchant(handlePATCH,'staff');
